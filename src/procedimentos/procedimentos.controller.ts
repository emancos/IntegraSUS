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
  @ApiOperation({ summary: 'Listar procedimentos (com paginação e busca expandida por nome, especialidade ou CBO)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do procedimento, especialidade médica (ex: Angiologia, "CONSULTA EM ANGIOLOGIA") ou código' })
  async getProcedimentos(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string) {
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

        const cteQuery = `
          WITH direct_results AS (
            SELECT 
              j.codigo,
              j.documento,
              NULL::varchar AS cbo_codigo,
              NULL::varchar AS cbo_nome
            FROM tb_procedimento_json j
            WHERE (j.nome ILIKE $1 OR j.codigo = $2)
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
              AND (${cboWhere})
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
        const query = `
          SELECT documento, NULL::varchar AS cbo_codigo, NULL::varchar AS cbo_nome 
          FROM tb_procedimento_json 
          WHERE nome ILIKE $1 OR codigo = $2
          LIMIT $3 OFFSET $4
        `;
        rows = await this.dataSource.query(query, [`%${searchTrimmed}%`, searchTrimmed, l, offset]);

        const countQuery = `
          SELECT COUNT(*) as count 
          FROM tb_procedimento_json 
          WHERE nome ILIKE $1 OR codigo = $2
        `;
        const countRes = await this.dataSource.query(countQuery, [`%${searchTrimmed}%`, searchTrimmed]);
        totalCount = parseInt(countRes[0]?.count || '0', 10);
      }
    } else {
      // Listagem sem busca
      const query = `
        SELECT documento, NULL::varchar AS cbo_codigo, NULL::varchar AS cbo_nome 
        FROM tb_procedimento_json 
        LIMIT $1 OFFSET $2
      `;
      rows = await this.dataSource.query(query, [l, offset]);

      const countQuery = `SELECT COUNT(*) as count FROM tb_procedimento_json`;
      const countRes = await this.dataSource.query(countQuery);
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
