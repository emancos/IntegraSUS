import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LayoutColumn } from '../parser/parser.service.js';

@Injectable()
export class ImporterService {
  private readonly logger = new Logger(ImporterService.name);

  constructor(private dataSource: DataSource) {}

  async importTable(tableName: string, layout: LayoutColumn[], dataRows: IterableIterator<any>) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    try {
      let columnsDef = layout.map(col => {
        let sqlType = 'VARCHAR(255)';
        if (col.tipo === 'VARCHAR2') sqlType = `VARCHAR(${col.tamanho})`;
        else if (col.tipo === 'NUMBER') sqlType = `NUMERIC`;
        else if (col.tipo === 'CHAR') sqlType = `CHAR(${col.tamanho})`;
        
        return `"${col.coluna}" ${sqlType}`;
      }).join(', ');
      
      const dropSql = `DROP TABLE IF EXISTS "${tableName}" CASCADE`;
      await queryRunner.query(dropSql);

      const createSql = `CREATE TABLE "${tableName}" (${columnsDef})`;
      await queryRunner.query(createSql);

      const chunkSize = 1000;
      let chunk = [];
      
      for (const row of dataRows) {
        chunk.push(row);
        if (chunk.length >= chunkSize) {
          await this.insertChunk(queryRunner, tableName, layout, chunk);
          chunk = [];
        }
      }
      if (chunk.length > 0) {
        await this.insertChunk(queryRunner, tableName, layout, chunk);
      }
      this.logger.log(`Imported table ${tableName} successfully.`);
    } catch (e) {
      this.logger.error(`Error importing table ${tableName}: ` + (e as Error).message);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  private async insertChunk(queryRunner: any, tableName: string, layout: LayoutColumn[], rows: any[]) {
    const columns = layout.map(l => `"${l.coluna}"`).join(',');
    
    const valuesList = [];
    for (const row of rows) {
      const vals = layout.map(l => {
        let v = row[l.coluna];
        if (v === undefined || v === null || v === '') return 'NULL';
        v = v.replace(/'/g, "''"); 
        if (l.tipo === 'NUMBER') {
           return v.trim() === '' ? 'NULL' : `'${v}'`;
        }
        return `'${v}'`;
      });
      valuesList.push(`(${vals.join(',')})`);
    }
    
    const insertSql = `INSERT INTO "${tableName}" (${columns}) VALUES ${valuesList.join(',')}`;
    await queryRunner.query(insertSql);
  }

  async buildJsonDocuments() {
    this.logger.log('Iniciando construção dos documentos JSON de alta performance...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    try {
      await queryRunner.query(`DROP TABLE IF EXISTS tb_procedimento_json CASCADE`);
      await queryRunner.query(`CREATE TABLE tb_procedimento_json (codigo VARCHAR(10) PRIMARY KEY, nome VARCHAR(255), documento JSONB)`);

      const BASE_SELECT = `
        p.*,
        g."NO_GRUPO",
        sg."NO_SUB_GRUPO",
        fo."NO_FORMA_ORGANIZACAO",
        (
          SELECT json_agg(json_build_object('codigo', r."CO_CID", 'nome', c."NO_CID"))
          FROM rl_procedimento_cid r
          LEFT JOIN tb_cid c ON r."CO_CID" = c."CO_CID"
          WHERE r."CO_PROCEDIMENTO" = p."CO_PROCEDIMENTO"
        ) as cids
      `;
      const BASE_JOINS = `
        LEFT JOIN tb_grupo g ON SUBSTRING(p."CO_PROCEDIMENTO", 1, 2) = g."CO_GRUPO"
        LEFT JOIN tb_sub_grupo sg ON SUBSTRING(p."CO_PROCEDIMENTO", 1, 2) = sg."CO_GRUPO" AND SUBSTRING(p."CO_PROCEDIMENTO", 3, 2) = sg."CO_SUB_GRUPO"
        LEFT JOIN tb_forma_organizacao fo ON SUBSTRING(p."CO_PROCEDIMENTO", 1, 2) = fo."CO_GRUPO" AND SUBSTRING(p."CO_PROCEDIMENTO", 3, 2) = fo."CO_SUB_GRUPO" AND SUBSTRING(p."CO_PROCEDIMENTO", 5, 2) = fo."CO_FORMA_ORGANIZACAO"
      `;

      const allRows = await queryRunner.query(`SELECT ${BASE_SELECT} FROM tb_procedimento p ${BASE_JOINS}`);
      
      this.logger.log(`Foram encontrados ${allRows.length} procedimentos para agregar.`);

      const formatarIdade = (mesesStr: any) => {
          const m = Number(mesesStr);
          if (isNaN(m)) return '';
          if (m === 9999) return 'Sem limite';
          if (m < 12) return `${m} meses`;
          return `${Math.floor(m / 12)} anos`;
      };
      const formatValue = (v: any) => {
          const num = (Number(v) / 100);
          return 'R$ ' + num.toFixed(2).replace('.', ',');
      };

      for (let i = 0; i < allRows.length; i++) {
        const raw = allRows[i];
        const codigo = raw.CO_PROCEDIMENTO;

        const valSA = Number(raw.VL_SA || 0);
        const valSH = Number(raw.VL_SH || 0);
        const valSP = Number(raw.VL_SP || 0);

        const obj: any = {
            codigo: raw.CO_PROCEDIMENTO,
            nome: raw.NO_PROCEDIMENTO,
            grupo: raw.CO_PROCEDIMENTO ? {
                codigo: raw.CO_PROCEDIMENTO.substring(0, 2),
                nome: raw.NO_GRUPO || ''
            } : null,
            subgrupo: raw.CO_PROCEDIMENTO ? {
                codigo: raw.CO_PROCEDIMENTO.substring(2, 4),
                nome: raw.NO_SUB_GRUPO || ''
            } : null,
            forma_organizacao: raw.CO_PROCEDIMENTO ? {
                codigo: raw.CO_PROCEDIMENTO.substring(4, 6),
                nome: raw.NO_FORMA_ORGANIZACAO || ''
            } : null,
            competencia: raw.DT_COMPETENCIA ? `${raw.DT_COMPETENCIA.substring(4, 6)}/${raw.DT_COMPETENCIA.substring(0, 4)}` : '',
            idade_minima: formatarIdade(raw.VL_IDADE_MINIMA),
            idade_maxima: formatarIdade(raw.VL_IDADE_MAXIMA),
            cids: raw.cids || [],
            valores: {
                servico_ambulatorial: formatValue(valSA),
                total_ambulatorial: formatValue(valSA),
                servico_hospitalar: formatValue(valSH),
                servico_profissional: formatValue(valSP),
                total_hospitalar: formatValue(valSH + valSP)
            }
        };

        // Descrição
        const descRes = await queryRunner.query(`SELECT "DS_PROCEDIMENTO" FROM tb_descricao WHERE "CO_PROCEDIMENTO" = $1`, [codigo]);
        if (descRes.length > 0) obj.descricao = descRes[0].DS_PROCEDIMENTO;

        // CBOs
        const cbosRaw = await queryRunner.query(`
          SELECT r."CO_OCUPACAO", o."NO_OCUPACAO" FROM rl_procedimento_ocupacao r LEFT JOIN tb_ocupacao o ON r."CO_OCUPACAO" = o."CO_OCUPACAO" WHERE r."CO_PROCEDIMENTO" = $1
        `, [codigo]);
        const categoriasCbo: Record<string, any> = {};
        for (const cbo of cbosRaw) {
            const cat = cbo.CO_OCUPACAO ? cbo.CO_OCUPACAO.substring(0, 4) : 'Outros';
            if (!categoriasCbo[cat]) categoriasCbo[cat] = { categoria: cat, ocupacoes: [] };
            categoriasCbo[cat].ocupacoes.push({ codigo: cbo.CO_OCUPACAO, nome: cbo.NO_OCUPACAO });
        }
        if (cbosRaw.length > 0) obj.cbos = Object.values(categoriasCbo);

        // Modalidades, Instrumentos, Servicos
        const modRes = await queryRunner.query(`SELECT r."CO_MODALIDADE" as codigo, m."NO_MODALIDADE" as nome FROM rl_procedimento_modalidade r LEFT JOIN tb_modalidade m ON r."CO_MODALIDADE" = m."CO_MODALIDADE" WHERE r."CO_PROCEDIMENTO" = $1`, [codigo]);
        if (modRes.length > 0) obj.modalidades = modRes;

        const regRes = await queryRunner.query(`SELECT r."CO_REGISTRO" as codigo, tr."NO_REGISTRO" as nome FROM rl_procedimento_registro r LEFT JOIN tb_registro tr ON r."CO_REGISTRO" = tr."CO_REGISTRO" WHERE r."CO_PROCEDIMENTO" = $1`, [codigo]);
        if (regRes.length > 0) obj.instrumentos_registro = regRes;

        const servRes = await queryRunner.query(`
          SELECT r."CO_SERVICO" as servico_codigo, s."NO_SERVICO" as servico_nome, r."CO_CLASSIFICACAO" as classificacao_codigo, sc."NO_CLASSIFICACAO" as classificacao_nome
          FROM rl_procedimento_servico r
          LEFT JOIN tb_servico s ON r."CO_SERVICO" = s."CO_SERVICO"
          LEFT JOIN tb_servico_classificacao sc ON r."CO_SERVICO" = sc."CO_SERVICO" AND r."CO_CLASSIFICACAO" = sc."CO_CLASSIFICACAO"
          WHERE r."CO_PROCEDIMENTO" = $1
        `, [codigo]);
        if (servRes.length > 0) obj.servicos_classificacao = servRes.map((s: any) => ({ servico: { codigo: s.servico_codigo, nome: s.servico_nome || '' }, classificacao: { codigo: s.classificacao_codigo, nome: s.classificacao_nome || '' } }));

        // Extra relations
        const extraRelations = [
          { key: 'leitos', query: `SELECT r."CO_TIPO_LEITO" as codigo, t."NO_TIPO_LEITO" as nome FROM rl_procedimento_leito r LEFT JOIN tb_tipo_leito t ON r."CO_TIPO_LEITO" = t."CO_TIPO_LEITO" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'habilitacoes', query: `SELECT r."CO_HABILITACAO" as codigo, t."NO_HABILITACAO" as nome FROM rl_procedimento_habilitacao r LEFT JOIN tb_habilitacao t ON r."CO_HABILITACAO" = t."CO_HABILITACAO" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'redes', query: `SELECT r."CO_COMPONENTE_REDE" as codigo, t."NO_COMPONENTE_REDE" as nome FROM rl_procedimento_comp_rede r LEFT JOIN tb_componente_rede t ON r."CO_COMPONENTE_REDE" = t."CO_COMPONENTE_REDE" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'origens', query: `SELECT r."CO_PROCEDIMENTO_ORIGEM" as codigo, p."NO_PROCEDIMENTO" as nome FROM rl_procedimento_origem r LEFT JOIN tb_procedimento p ON r."CO_PROCEDIMENTO_ORIGEM" = p."CO_PROCEDIMENTO" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'regras_condicionadas', query: `SELECT r."CO_REGRA_CONDICIONADA" as codigo, t."NO_REGRA_CONDICIONADA" as nome FROM rl_procedimento_regra_cond r LEFT JOIN tb_regra_condicionada t ON r."CO_REGRA_CONDICIONADA" = t."CO_REGRA_CONDICIONADA" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'renases', query: `SELECT r."CO_RENASES" as codigo, t."NO_RENASES" as nome FROM rl_procedimento_renases r LEFT JOIN tb_renases t ON r."CO_RENASES" = t."CO_RENASES" WHERE r."CO_PROCEDIMENTO" = $1` },
          { key: 'tuss', query: `SELECT r."CO_TUSS" as codigo, t."NO_TUSS" as nome FROM rl_procedimento_tuss r LEFT JOIN tb_tuss t ON r."CO_TUSS" = t."CO_TUSS" WHERE r."CO_PROCEDIMENTO" = $1` }
        ];

        for (const rel of extraRelations) {
            try {
                const res = await queryRunner.query(rel.query, [codigo]);
                if (res && res.length > 0) obj[rel.key] = res;
            } catch (e) {}
        }

        await queryRunner.query(`INSERT INTO tb_procedimento_json (codigo, nome, documento) VALUES ($1, $2, $3)`, [codigo, obj.nome, JSON.stringify(obj)]);
        
        if (i % 500 === 0 && i > 0) this.logger.log(`Agregados ${i} procedimentos...`);
      }
      this.logger.log('Construção dos documentos JSON finalizada com sucesso!');

    } catch (e) {
      this.logger.error('Erro construindo documentos JSON: ' + (e as Error).message);
    } finally {
      await queryRunner.release();
    }
  }}