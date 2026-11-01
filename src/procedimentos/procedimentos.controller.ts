import { Controller, Get, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';
import { formatConsultaName, extractSearchTerms } from './specialty.utils.js';

@ApiTags('procedimentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procedimentos')
export class ProcedimentosController {
  constructor(private dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Listar procedimentos (com paginação e filtros por grupo, subgrupo, forma e busca textual)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do procedimento, especialidade médica (ex: Angiologia, "CONSULTA EM ANGIOLOGIA") ou código' })
  @ApiQuery({ name: 'grupo', required: false, description: 'Filtrar por código do grupo (2 dígitos, ex: 02)' })
  @ApiQuery({ name: 'subgrupo', required: false, description: 'Filtrar por código do subgrupo (2 dígitos, ex: 06)' })
  @ApiQuery({ name: 'forma', required: false, description: 'Filtrar por código da forma de organização (2 dígitos, ex: 01)' })
  async getProcedimentos(
    @Query('page') page = '1', 
    @Query('limit') limit = '10', 
    @Query('search') search?: string,
    @Query('grupo') grupo?: string,
    @Query('subgrupo') subgrupo?: string,
    @Query('forma') forma?: string
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const offset = (p - 1) * l;
    
    // Verifica tabelas existentes
    const checkTables = await this.dataSource.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('tb_procedimento_json', 'rl_procedimento_ocupacao', 'tb_ocupacao')
    `);
    const tableNames = new Set(checkTables.map((r: any) => r.table_name));
    if (!tableNames.has('tb_procedimento_json')) {
      return { 
        data: [], 
        meta: { total: 0, page: p, limit: l },
        message: 'Tabela tb_procedimento_json não existe. Por favor, aguarde o Sync ou rode /sync/trigger.' 
      };
    }

    let rows: any[] = [];
    let totalCount = 0;

    // Constrói condições adicionais de hierarquia (grupo, subgrupo, forma)
    const buildHierarchyFilters = (alias: string, startIndex: number) => {
      const conds: string[] = [];
      const params: any[] = [];
      let idx = startIndex;

      if (grupo && grupo.trim()) {
        params.push(grupo.trim());
        conds.push(`SUBSTRING(${alias}codigo, 1, 2) = $${idx++}`);
      }
      if (subgrupo && subgrupo.trim()) {
        params.push(subgrupo.trim());
        conds.push(`SUBSTRING(${alias}codigo, 3, 2) = $${idx++}`);
      }
      if (forma && forma.trim()) {
        params.push(forma.trim());
        conds.push(`SUBSTRING(${alias}codigo, 5, 2) = $${idx++}`);
      }

      return { conds, params };
    };

    if (search && search.trim()) {
      const searchTrimmed = search.trim();
      const searchTerms = extractSearchTerms(searchTrimmed);
      const hasOcupacaoTables = tableNames.has('rl_procedimento_ocupacao') && tableNames.has('tb_ocupacao');

      // Se for uma busca por consulta ou especialidade médica e tivermos as tabelas de CBO
      if (hasOcupacaoTables && searchTerms.isConsultationOrSpecialty && (searchTerms.stems.length > 0 || searchTerms.isCboCode)) {
        const queryParams: any[] = [`%${searchTrimmed}%`, searchTrimmed];
        const cboConds: string[] = [];

        if (searchTerms.isCboCode) {
          queryParams.push(searchTerms.normalized.replace(/\D/g, ''));
          cboConds.push(`o."CO_OCUPACAO" = $${queryParams.length}`);
        }

        for (const stem of searchTerms.stems) {
          queryParams.push(`%${stem}%`);
          cboConds.push(`o."NO_OCUPACAO" ILIKE $${queryParams.length}`);
        }

        const cboWhere = cboConds.length > 0 ? cboConds.join(' OR ') : 'FALSE';

        // Filtros de hierarquia para direct_results
        const hDirect = buildHierarchyFilters('j.', queryParams.length + 1);
        queryParams.push(...hDirect.params);
        const directExtra = hDirect.conds.length > 0 ? ` AND ${hDirect.conds.join(' AND ')}` : '';

        const cteQuery = `
          WITH direct_results AS (
            SELECT 
              j.codigo,
              j.documento,
              NULL::varchar AS cbo_codigo,
              NULL::varchar AS cbo_nome
            FROM tb_procedimento_json j
            WHERE (j.nome ILIKE $1 OR j.codigo = $2)${directExtra}
          ),
          cbo_results AS (
            SELECT DISTINCT
              j.codigo,
              j.documento,
              o."CO_OCUPACAO"::varchar AS cbo_codigo,
              o."NO_OCUPACAO"::varchar AS cbo_nome
            FROM rl_procedimento_ocupacao r
            INNER JOIN tb_ocupacao o ON r."CO_OCUPACAO" = o."CO_OCUPACAO"
            INNER JOIN tb_procedimento_json j ON r."CO_PROCEDIMENTO" = j.codigo
            WHERE (j.codigo = '0301010072' OR (j.codigo = '0301010048' AND NOT o."NO_OCUPACAO" ILIKE 'medico%'))
              AND (${cboWhere})${directExtra}
          ),
          combined AS (
            SELECT * FROM direct_results d
            WHERE NOT EXISTS (
              SELECT 1 FROM cbo_results c WHERE c.codigo = d.codigo
            )
            UNION ALL
            SELECT * FROM cbo_results
          )
        `;

        const dataQuery = `${cteQuery} SELECT * FROM combined LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
        const countQuery = `${cteQuery} SELECT COUNT(*) as count FROM combined`;

        rows = await this.dataSource.query(dataQuery, [...queryParams, l, offset]);
        const countRes = await this.dataSource.query(countQuery, queryParams);
        totalCount = parseInt(countRes[0]?.count || '0', 10);
      } else {
        // Busca padrão em tb_procedimento_json
        const queryParams: any[] = [`%${searchTrimmed}%`, searchTrimmed];
        const hFilters = buildHierarchyFilters('', queryParams.length + 1);
        queryParams.push(...hFilters.params);
        const hierarchyWhere = hFilters.conds.length > 0 ? ` AND ${hFilters.conds.join(' AND ')}` : '';

        const query = `
          SELECT documento, NULL::varchar AS cbo_codigo, NULL::varchar AS cbo_nome 
          FROM tb_procedimento_json 
          WHERE (nome ILIKE $1 OR codigo = $2)${hierarchyWhere}
          LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;
        rows = await this.dataSource.query(query, [...queryParams, l, offset]);

        const countQuery = `
          SELECT COUNT(*) as count 
          FROM tb_procedimento_json 
          WHERE (nome ILIKE $1 OR codigo = $2)${hierarchyWhere}
        `;
        const countRes = await this.dataSource.query(countQuery, queryParams);
        totalCount = parseInt(countRes[0]?.count || '0', 10);
      }
    } else {
      // Listagem sem busca textual (com possíveis filtros de grupo/subgrupo/forma)
      const hFilters = buildHierarchyFilters('', 1);
      const whereClause = hFilters.conds.length > 0 ? `WHERE ${hFilters.conds.join(' AND ')}` : '';

      const query = `
        SELECT documento, NULL::varchar AS cbo_codigo, NULL::varchar AS cbo_nome 
        FROM tb_procedimento_json 
        ${whereClause}
        LIMIT $${hFilters.params.length + 1} OFFSET $${hFilters.params.length + 2}
      `;
      rows = await this.dataSource.query(query, [...hFilters.params, l, offset]);

      const countQuery = `SELECT COUNT(*) as count FROM tb_procedimento_json ${whereClause}`;
      const countRes = await this.dataSource.query(countQuery, hFilters.params);
      totalCount = parseInt(countRes[0]?.count || '0', 10);
    }
    
    // Formata os dados e injeta o nome específico apenas quando for consulta especializada (0301010072 ou 0301010048)
    const formattedData = rows.map((r: any) => {
      const doc = JSON.parse(JSON.stringify(r.documento));
      if (doc && doc.valores) delete doc.valores;

      if (r.cbo_codigo && r.cbo_nome && (doc.codigo === '0301010072' || doc.codigo === '0301010048')) {
        const info = formatConsultaName(r.cbo_nome, doc.nome);
        doc.nome_original = doc.nome;
        doc.nome = info.nomeConsulta;
        doc.nome_especifico = info.nomeConsulta;
        doc.cbo_especifico = {
          codigo: r.cbo_codigo,
          nome: r.cbo_nome,
          especialidade: info.especialidade
        };
      }

      return doc;
    });

    return { 
      data: formattedData, 
      meta: { total: totalCount, page: p, limit: l } 
    };
  }

  @Get('subgrupos')
  @ApiOperation({ summary: 'Listar ou buscar subgrupos textualmente (ex: tomografia, radiologia)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual no nome do subgrupo (ex: tomografia)' })
  @ApiQuery({ name: 'grupo', required: false, description: 'Filtrar subgrupos de um grupo específico (ex: 02)' })
  async getSubgrupos(@Query('search') search?: string, @Query('grupo') grupo?: string) {
    const check = await this.dataSource.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tb_sub_grupo') as has_subgrupo
    `);
    
    if (check[0]?.has_subgrupo) {
      const conditions: string[] = [];
      const params: any[] = [];
      
      if (search && search.trim()) {
        params.push(`%${search.trim()}%`);
        conditions.push(`sg."NO_SUB_GRUPO" ILIKE $${params.length}`);
      }
      if (grupo && grupo.trim()) {
        params.push(grupo.trim());
        conditions.push(`sg."CO_GRUPO" = $${params.length}`);
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT 
          sg."CO_GRUPO" as grupo_codigo,
          COALESCE(g."NO_GRUPO", '') as grupo_nome,
          sg."CO_SUB_GRUPO" as subgrupo_codigo,
          sg."NO_SUB_GRUPO" as subgrupo_nome
        FROM tb_sub_grupo sg
        LEFT JOIN tb_grupo g ON sg."CO_GRUPO" = g."CO_GRUPO"
        ${whereClause}
        ORDER BY sg."CO_GRUPO", sg."CO_SUB_GRUPO"
      `;
      return this.dataSource.query(query, params);
    }

    // Fallback caso a tabela relacional ainda não exista
    const conditions: string[] = [];
    const params: any[] = [];
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      conditions.push(`documento->'subgrupo'->>'nome' ILIKE $${params.length}`);
    }
    if (grupo && grupo.trim()) {
      params.push(grupo.trim());
      conditions.push(`documento->'grupo'->>'codigo' = $${params.length}`);
    }
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `
      SELECT DISTINCT 
        documento->'grupo'->>'codigo' as grupo_codigo,
        documento->'grupo'->>'nome' as grupo_nome,
        documento->'subgrupo'->>'codigo' as subgrupo_codigo,
        documento->'subgrupo'->>'nome' as subgrupo_nome
      FROM tb_procedimento_json
      ${whereClause}
      ORDER BY grupo_codigo, subgrupo_codigo
    `;
    return this.dataSource.query(query, params);
  }

  @Get('grupos')
  @ApiOperation({ summary: 'Listar grupos (com suporte à busca textual e árvore hierárquica completa)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do grupo' })
  @ApiQuery({ name: 'arvore', required: false, description: 'Se true, retorna a árvore completa com subgrupos e formas de organização aninhados' })
  async getGrupos(@Query('search') search?: string, @Query('arvore') arvore?: string) {
    const isArvore = arvore === 'true' || arvore === '1';

    const check = await this.dataSource.query(`
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tb_grupo') as has_grupo
    `);

    if (!isArvore) {
      if (check[0]?.has_grupo) {
        if (search && search.trim()) {
          return this.dataSource.query(
            `SELECT "CO_GRUPO" as codigo, "NO_GRUPO" as nome FROM tb_grupo WHERE "NO_GRUPO" ILIKE $1 ORDER BY "CO_GRUPO"`,
            [`%${search.trim()}%`]
          );
        }
        return this.dataSource.query(`SELECT "CO_GRUPO" as codigo, "NO_GRUPO" as nome FROM tb_grupo ORDER BY "CO_GRUPO"`);
      }
      // Fallback via tb_procedimento_json
      if (search && search.trim()) {
        return this.dataSource.query(
          `SELECT DISTINCT documento->'grupo'->>'codigo' as codigo, documento->'grupo'->>'nome' as nome FROM tb_procedimento_json WHERE documento->'grupo'->>'nome' ILIKE $1 ORDER BY codigo`,
          [`%${search.trim()}%`]
        );
      }
      return this.dataSource.query(
        `SELECT DISTINCT documento->'grupo'->>'codigo' as codigo, documento->'grupo'->>'nome' as nome FROM tb_procedimento_json ORDER BY codigo`
      );
    }

    // Árvore completa aninhada
    let grupos: any[] = [];
    let subgrupos: any[] = [];
    let formas: any[] = [];

    if (check[0]?.has_grupo) {
      const gQuery = search && search.trim() 
        ? `SELECT "CO_GRUPO" as codigo, "NO_GRUPO" as nome FROM tb_grupo WHERE "NO_GRUPO" ILIKE $1 ORDER BY "CO_GRUPO"`
        : `SELECT "CO_GRUPO" as codigo, "NO_GRUPO" as nome FROM tb_grupo ORDER BY "CO_GRUPO"`;
      grupos = await this.dataSource.query(gQuery, search && search.trim() ? [`%${search.trim()}%`] : []);
      subgrupos = await this.dataSource.query(`SELECT "CO_GRUPO" as grupo_codigo, "CO_SUB_GRUPO" as codigo, "NO_SUB_GRUPO" as nome FROM tb_sub_grupo ORDER BY "CO_GRUPO", "CO_SUB_GRUPO"`);
      formas = await this.dataSource.query(`SELECT "CO_GRUPO" as grupo_codigo, "CO_SUB_GRUPO" as subgrupo_codigo, "CO_FORMA_ORGANIZACAO" as codigo, "NO_FORMA_ORGANIZACAO" as nome FROM tb_forma_organizacao ORDER BY "CO_GRUPO", "CO_SUB_GRUPO", "CO_FORMA_ORGANIZACAO"`);
    } else {
      // Fallback
      grupos = await this.dataSource.query(`SELECT DISTINCT documento->'grupo'->>'codigo' as codigo, documento->'grupo'->>'nome' as nome FROM tb_procedimento_json ORDER BY codigo`);
      subgrupos = await this.dataSource.query(`SELECT DISTINCT documento->'grupo'->>'codigo' as grupo_codigo, documento->'subgrupo'->>'codigo' as codigo, documento->'subgrupo'->>'nome' as nome FROM tb_procedimento_json ORDER BY grupo_codigo, codigo`);
      formas = await this.dataSource.query(`SELECT DISTINCT documento->'grupo'->>'codigo' as grupo_codigo, documento->'subgrupo'->>'codigo' as subgrupo_codigo, documento->'forma_organizacao'->>'codigo' as codigo, documento->'forma_organizacao'->>'nome' as nome FROM tb_procedimento_json ORDER BY grupo_codigo, subgrupo_codigo, codigo`);
    }

    const formasMap = new Map<string, any[]>();
    for (const f of formas) {
      const key = `${f.grupo_codigo}-${f.subgrupo_codigo}`;
      if (!formasMap.has(key)) formasMap.set(key, []);
      formasMap.get(key)!.push({ codigo: f.codigo, nome: f.nome });
    }

    const subgruposMap = new Map<string, any[]>();
    for (const sg of subgrupos) {
      const key = sg.grupo_codigo;
      if (!subgruposMap.has(key)) subgruposMap.set(key, []);
      subgruposMap.get(key)!.push({
        codigo: sg.codigo,
        nome: sg.nome,
        formas_organizacao: formasMap.get(`${sg.grupo_codigo}-${sg.codigo}`) || []
      });
    }

    return grupos.map(g => ({
      codigo: g.codigo,
      nome: g.nome,
      subgrupos: subgruposMap.get(g.codigo) || []
    }));
  }

  @Get('grupos/:grupo/subgrupos')
  @ApiOperation({ summary: 'Listar subgrupos de um grupo específico' })
  @ApiParam({ name: 'grupo', description: 'Código do grupo (ex: 02)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do subgrupo' })
  async getSubgruposDoGrupo(@Param('grupo') grupo: string, @Query('search') search?: string) {
    const params: any[] = [grupo];
    let where = `sg."CO_GRUPO" = $1`;
    if (search && search.trim()) {
      params.push(`%${search.trim()}%`);
      where += ` AND sg."NO_SUB_GRUPO" ILIKE $2`;
    }
    const query = `
      SELECT 
        sg."CO_GRUPO" as grupo_codigo,
        sg."CO_SUB_GRUPO" as codigo, 
        sg."NO_SUB_GRUPO" as nome 
      FROM tb_sub_grupo sg 
      WHERE ${where} 
      ORDER BY sg."CO_SUB_GRUPO"
    `;
    return this.dataSource.query(query, params);
  }

  @Get('grupos/:grupo/subgrupos/:subgrupo/formas')
  @ApiOperation({ summary: 'Listar formas de organização de um subgrupo' })
  @ApiParam({ name: 'grupo', description: 'Código do grupo (ex: 02)' })
  @ApiParam({ name: 'subgrupo', description: 'Código do subgrupo (ex: 06)' })
  async getFormasDoSubgrupo(@Param('grupo') grupo: string, @Param('subgrupo') subgrupo: string) {
    const query = `
      SELECT 
        fo."CO_GRUPO" as grupo_codigo,
        fo."CO_SUB_GRUPO" as subgrupo_codigo,
        fo."CO_FORMA_ORGANIZACAO" as codigo, 
        fo."NO_FORMA_ORGANIZACAO" as nome 
      FROM tb_forma_organizacao fo 
      WHERE fo."CO_GRUPO" = $1 AND fo."CO_SUB_GRUPO" = $2 
      ORDER BY fo."CO_FORMA_ORGANIZACAO"
    `;
    return this.dataSource.query(query, [grupo, subgrupo]);
  }

  @Get('grupos/:grupo/subgrupos/:subgrupo/procedimentos')
  @ApiOperation({ summary: 'Listar todos os procedimentos de um subgrupo (ex: todas as tomografias do 02.06)' })
  @ApiParam({ name: 'grupo', description: 'Código do grupo (ex: 02)' })
  @ApiParam({ name: 'subgrupo', description: 'Código do subgrupo (ex: 06)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do procedimento' })
  async getProcedimentosDoSubgrupo(
    @Param('grupo') grupo: string,
    @Param('subgrupo') subgrupo: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10',
    @Query('search') search?: string
  ) {
    return this.getProcedimentos(page, limit, search, grupo, subgrupo);
  }

  @Get('cid/:cid')
  @ApiOperation({ summary: 'Listar procedimentos filtrados por CID' })
  @ApiParam({ name: 'cid', description: 'Código CID (ex: A00)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  async getProcedimentosPorCid(@Param('cid') cid: string, @Query('page') page = '1', @Query('limit') limit = '10') {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const offset = (p - 1) * l;
    
    const query = `
      SELECT j.documento 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_cid r ON j.codigo = r."CO_PROCEDIMENTO"
      WHERE r."CO_CID" = $1
      LIMIT $2 OFFSET $3
    `;
    const rows = await this.dataSource.query(query, [cid, l, offset]);
    
    const countQuery = `
      SELECT COUNT(*) 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_cid r ON j.codigo = r."CO_PROCEDIMENTO"
      WHERE r."CO_CID" = $1
    `;
    const countRes = await this.dataSource.query(countQuery, [cid]);
    
    const formattedData = rows.map((r: any) => {
        const doc = r.documento;
        if (doc && doc.valores) delete doc.valores;
        return doc;
    });
    return { data: formattedData, meta: { total: parseInt(countRes[0].count, 10), page: p, limit: l } };
  }

  @Get('cbo/:cbo')
  @ApiOperation({ summary: 'Listar procedimentos permitidos por CBO' })
  @ApiParam({ name: 'cbo', description: 'Código CBO (ex: 225125)' })
  @ApiQuery({ name: 'tipo', required: false, description: 'Filtrar por tipo: consulta, exame ou cirurgia' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  async getProcedimentosPorCbo(
    @Param('cbo') cbo: string, 
    @Query('tipo') tipo?: string, 
    @Query('page') page = '1', 
    @Query('limit') limit = '10'
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const offset = (p - 1) * l;
    
    let baseWhere = `r."CO_OCUPACAO" = $1`;
    let queryParams: any[] = [cbo];
    
    if (tipo) {
      const tipoLower = tipo.toLowerCase().trim();
      if (tipoLower === 'consulta') {
        baseWhere += ` AND j.codigo LIKE '0301%'`;
      } else if (tipoLower === 'exame') {
        baseWhere += ` AND j.codigo LIKE '02%'`;
      } else if (tipoLower === 'cirurgia') {
        baseWhere += ` AND j.codigo LIKE '04%'`;
      }
    }
    
    const query = `
      SELECT j.documento, o."NO_OCUPACAO" as cbo_nome 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_ocupacao r ON j.codigo = r."CO_PROCEDIMENTO"
      LEFT JOIN tb_ocupacao o ON r."CO_OCUPACAO" = o."CO_OCUPACAO"
      WHERE ${baseWhere}
      LIMIT $2 OFFSET $3
    `;
    queryParams.push(l, offset);
    
    const rows = await this.dataSource.query(query, queryParams);
    
    const countQuery = `
      SELECT COUNT(*) 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_ocupacao r ON j.codigo = r."CO_PROCEDIMENTO"
      WHERE ${baseWhere}
    `;
    const countRes = await this.dataSource.query(countQuery, [cbo]);
    
    const formattedData = rows.map((r: any) => {
        const doc = JSON.parse(JSON.stringify(r.documento));
        if (doc && doc.valores) delete doc.valores;

        // Formata especificamente a Consulta Médica em Atenção Especializada (0301010072) ou Exceto Médico (0301010048)
        if (r.cbo_nome && (doc.codigo === '0301010072' || (doc.codigo === '0301010048' && !r.cbo_nome.toLowerCase().startsWith('medico')))) {
          const info = formatConsultaName(r.cbo_nome, doc.nome);
          doc.nome_original = doc.nome;
          doc.nome = info.nomeConsulta;
          doc.nome_especifico = info.nomeConsulta;
          doc.cbo_especifico = {
            codigo: cbo,
            nome: r.cbo_nome,
            especialidade: info.especialidade
          };
        }

        return doc;
    });
    return { data: formattedData, meta: { total: parseInt(countRes[0].count, 10), page: p, limit: l } };
  }

  @Get(':codigo')
  @ApiOperation({ summary: 'Obter detalhamento completo de um procedimento' })
  @ApiParam({ name: 'codigo', description: 'Código SIGTAP de 10 dígitos' })
  async getProcedimento(@Param('codigo') codigo: string) {
    const query = `SELECT documento FROM tb_procedimento_json WHERE codigo = $1`;
    const rows = await this.dataSource.query(query, [codigo]);
    if (!rows || rows.length === 0) {
        throw new NotFoundException(`Procedimento ${codigo} não encontrado`);
    }
    
    return rows[0].documento;
  }
}
