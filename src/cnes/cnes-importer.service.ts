import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import csv from 'csv-parser';

@Injectable()
export class CnesImporterService {
  private readonly logger = new Logger(CnesImporterService.name);

  constructor(private dataSource: DataSource) {}

  async createTables() {
    this.logger.log('Creating CNES staging tables...');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_estabelecimentos_raw (
        co_unidade VARCHAR(30) PRIMARY KEY,
        co_cnes VARCHAR(30),
        nu_cnpj_mantenedora VARCHAR(50),
        tp_pfpj VARCHAR(50),
        nivel_dep VARCHAR(50),
        no_razao_social VARCHAR(255),
        no_fantasia VARCHAR(255),
        no_logradouro VARCHAR(255),
        nu_endereco VARCHAR(50),
        no_complemento VARCHAR(100),
        no_bairro VARCHAR(100),
        co_cep VARCHAR(20),
        co_regiao_saude VARCHAR(50),
        co_micro_regiao VARCHAR(50),
        co_distrito_sanitario VARCHAR(50),
        co_distrito_administrativo VARCHAR(50),
        nu_telefone VARCHAR(50),
        nu_fax VARCHAR(50),
        no_email VARCHAR(100),
        nu_cpf VARCHAR(50),
        nu_cnpj VARCHAR(50),
        co_atividade VARCHAR(50),
        co_clientela VARCHAR(50),
        nu_alvara VARCHAR(50),
        dt_expedicao VARCHAR(50),
        tp_orgao_expedidor VARCHAR(50),
        dt_val_lic_sani VARCHAR(50),
        tp_lic_sani VARCHAR(50),
        tp_unidade VARCHAR(50),
        co_turno_atendimento VARCHAR(50),
        co_estado_gestor VARCHAR(50),
        co_municipio_gestor VARCHAR(50),
        co_natureza_jur VARCHAR(50),
        tp_gestao VARCHAR(50)
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_carga_horaria_raw (
        co_unidade VARCHAR(30),
        co_profissional_sus VARCHAR(50)
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_profissionais_raw (
        co_profissional_sus VARCHAR(50),
        cpf VARCHAR(20),
        cns VARCHAR(50),
        nome VARCHAR(255),
        cbo VARCHAR(50)
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_profissionais_json (
        cpf VARCHAR(20),
        cns VARCHAR(50),
        nome_busca TEXT,
        documento JSONB
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_estabelecimentos_json (
        co_cnes VARCHAR(30),
        nome_busca TEXT,
        documento JSONB
      )
    `);
    
    // Clear tables and drop indexes before bulk insert
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_estabelecimentos_raw');
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_carga_horaria_raw');
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_profissionais_raw');
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_profissionais_json');
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_estabelecimentos_json');
    
    this.logger.log('Dropping existing indexes to optimize bulk insert...');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_prof_cpf');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_prof_cns');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_prof_nome_trgm');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_prof_doc_cnes');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_prof_doc_mun');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_estab_cnes');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_estab_nome_trgm');
    await this.dataSource.query('DROP INDEX IF EXISTS idx_cnes_estab_mun');
    
    // Create extension
    await this.dataSource.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
  }

  async importEstabelecimentos(csvPath: string) {
    this.logger.log('Importing Estabelecimentos from CNES...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    let batch: any[] = [];
    let processed = 0;
    let insertPromise = Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(csvPath, { encoding: 'latin1' }).pipe(csv({ separator: ';' }));
      
      stream.on('data', (row) => {
          batch.push(row);
          if (batch.length >= 2000) {
            stream.pause();
            const currentBatch = [...batch];
            batch = [];
            processed += currentBatch.length;
            insertPromise = insertPromise.then(async () => {
              await this.insertEstabelecimentosBatch(queryRunner, currentBatch);
              if (processed % 20000 === 0) this.logger.log(`Imported ${processed} estabelecimentos...`);
              stream.resume();
            }).catch(reject);
          }
        })
        .on('end', () => {
          insertPromise.then(async () => {
            if (batch.length > 0) {
              await this.insertEstabelecimentosBatch(queryRunner, batch);
              processed += batch.length;
            }
            this.logger.log(`Finished importing ${processed} estabelecimentos.`);
            await queryRunner.release();
            resolve();
          }).catch(reject);
        })
        .on('error', (err) => reject(err));
    });
  }

  private async insertEstabelecimentosBatch(queryRunner: any, rows: any[]) {
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      const co_unidade = (r.CO_UNIDADE || '').trim();
      if (!co_unidade) continue;
      values.push(`($${i}, $${i+1}, $${i+2}, $${i+3}, $${i+4}, $${i+5}, $${i+6}, $${i+7}, $${i+8}, $${i+9}, $${i+10}, $${i+11}, $${i+12}, $${i+13}, $${i+14}, $${i+15}, $${i+16}, $${i+17}, $${i+18}, $${i+19}, $${i+20}, $${i+21}, $${i+22}, $${i+23}, $${i+24}, $${i+25}, $${i+26}, $${i+27}, $${i+28}, $${i+29}, $${i+30}, $${i+31}, $${i+32}, $${i+33})`);
      params.push(
        co_unidade,
        (r.CO_CNES || '').trim(),
        (r.NU_CNPJ_MANTENEDORA || '').trim(),
        (r.TP_PFPJ || '').trim(),
        (r.NIVEL_DEP || '').trim(),
        (r.NO_RAZAO_SOCIAL || '').substring(0, 255),
        (r.NO_FANTASIA || '').substring(0, 255),
        (r.NO_LOGRADOURO || '').substring(0, 255),
        (r.NU_ENDERECO || '').substring(0, 50),
        (r.NO_COMPLEMENTO || '').substring(0, 100),
        (r.NO_BAIRRO || '').substring(0, 100),
        (r.CO_CEP || '').trim(),
        (r.CO_REGIAO_SAUDE || '').trim(),
        (r.CO_MICRO_REGIAO || '').trim(),
        (r.CO_DISTRITO_SANITARIO || '').trim(),
        (r.CO_DISTRITO_ADMINISTRATIVO || '').trim(),
        (r.NU_TELEFONE || '').trim(),
        (r.NU_FAX || '').trim(),
        (r.NO_EMAIL || '').substring(0, 100),
        (r.NU_CPF || '').trim(),
        (r.NU_CNPJ || '').trim(),
        (r.CO_ATIVIDADE || '').trim(),
        (r.CO_CLIENTELA || '').trim(),
        (r.NU_ALVARA || '').trim(),
        (r.DT_EXPEDICAO || '').trim(),
        (r.TP_ORGAO_EXPEDIDOR || '').trim(),
        (r.DT_VAL_LIC_SANI || '').trim(),
        (r.TP_LIC_SANI || '').trim(),
        (r.TP_UNIDADE || '').trim(),
        (r.CO_TURNO_ATENDIMENTO || '').trim(),
        (r.CO_ESTADO_GESTOR || '').trim(),
        (r.CO_MUNICIPIO_GESTOR || '').trim(),
        (r.CO_NATUREZA_JUR || '').trim(),
        (r.TP_GESTAO || '').trim()
      );
      i += 34;
    }

    if (values.length === 0) return;
    const query = `INSERT INTO tb_cnes_estabelecimentos_raw VALUES ${values.join(', ')} ON CONFLICT (co_unidade) DO NOTHING`;
    await queryRunner.query(query, params);
  }

  async importCargaHoraria(csvPath: string) {
    this.logger.log('Importing Carga Horaria (Vínculos) from CNES...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    let batch: any[] = [];
    let processed = 0;
    let insertPromise = Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(csvPath, { encoding: 'latin1' }).pipe(csv({ separator: ';' }));
      
      stream.on('data', (row) => {
          batch.push(row);
          if (batch.length >= 5000) {
            stream.pause();
            const currentBatch = [...batch];
            batch = [];
            processed += currentBatch.length;
            insertPromise = insertPromise.then(async () => {
              await this.insertCargaHorariaBatch(queryRunner, currentBatch);
              if (processed % 500000 === 0) this.logger.log(`Imported ${processed} vínculos...`);
              stream.resume();
            }).catch(reject);
          }
        })
        .on('end', () => {
          insertPromise.then(async () => {
            if (batch.length > 0) {
              await this.insertCargaHorariaBatch(queryRunner, batch);
              processed += batch.length;
            }
            this.logger.log(`Finished importing ${processed} vínculos.`);
            await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_ch_prof ON tb_cnes_carga_horaria_raw(co_profissional_sus)');
            await queryRunner.release();
            resolve();
          }).catch(reject);
        })
        .on('error', (err) => reject(err));
    });
  }

  private async insertCargaHorariaBatch(queryRunner: any, rows: any[]) {
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      const co_unidade = (r.CO_UNIDADE || '').trim();
      const prof = (r.CO_PROFISSIONAL_SUS || '').trim();
      if (!co_unidade || !prof) continue;
      values.push(`($${i}, $${i+1})`);
      params.push(co_unidade, prof);
      i += 2;
    }
    if (values.length === 0) return;
    const query = `INSERT INTO tb_cnes_carga_horaria_raw VALUES ${values.join(', ')}`;
    await queryRunner.query(query, params);
  }

  async importProfissionais(csvPath: string) {
    this.logger.log('Importing Profissionais from CNES...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    let batch: any[] = [];
    let processed = 0;
    let insertPromise = Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      const stream = fs.createReadStream(csvPath, { encoding: 'latin1' }).pipe(csv({ separator: ';' }));
      
      stream.on('data', (row) => {
          batch.push(row);
          if (batch.length >= 5000) {
            stream.pause();
            const currentBatch = [...batch];
            batch = [];
            processed += currentBatch.length;
            insertPromise = insertPromise.then(async () => {
              await this.insertProfissionaisBatch(queryRunner, currentBatch);
              if (processed % 200000 === 0) this.logger.log(`Imported ${processed} profissionais...`);
              stream.resume();
            }).catch(reject);
          }
        })
        .on('end', () => {
          insertPromise.then(async () => {
            if (batch.length > 0) {
              await this.insertProfissionaisBatch(queryRunner, batch);
              processed += batch.length;
            }
            this.logger.log(`Finished importing ${processed} profissionais.`);
            await queryRunner.release();
            resolve();
          }).catch(reject);
        })
        .on('error', (err) => reject(err));
    });
  }

  private async insertProfissionaisBatch(queryRunner: any, rows: any[]) {
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      const cns = (r.CO_PROFISSIONAL_SUS || r.CO_CNS || '').trim();
      const cpf = (r.CO_CPF || r.NU_CPF || '').trim();
      const nome = (r.NO_PROFISSIONAL || '').trim();
      const cbo = (r.CO_CBO || '').trim();
      
      if (!nome) continue; 
      
      values.push(`($${i}, $${i+1}, $${i+2}, $${i+3}, $${i+4})`);
      params.push(cns, cpf, cns, nome, cbo);
      i += 5;
    }

    if (values.length === 0) return;
    const query = `INSERT INTO tb_cnes_profissionais_raw VALUES ${values.join(', ')}`;
    await queryRunner.query(query, params);
  }

  async aggregateJsonDocuments() {
    this.logger.log('Aggregating and building JSON documents (SQL)...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    this.logger.log('1/2 Building tb_cnes_estabelecimentos_json...');
    await queryRunner.query(`
      INSERT INTO tb_cnes_estabelecimentos_json (co_cnes, nome_busca, documento)
      SELECT 
        e.co_cnes,
        e.no_fantasia || ' ' || e.no_razao_social,
        jsonb_build_object(
          'coUf', e.co_estado_gestor,
          'coMunicipioIbge', e.co_municipio_gestor,
          'coCnes', e.co_cnes,
          'noFantasia', e.no_fantasia,
          'noRazaoSocial', e.no_razao_social,
          'noLogradouro', e.no_logradouro,
          'nuEndereco', e.nu_endereco,
          'noComplemento', NULLIF(e.no_complemento, ''),
          'noBairro', e.no_bairro,
          'coCep', e.co_cep,
          'nuTelefone', NULLIF(e.nu_telefone, ''),
          'dsEmail', NULLIF(e.no_email, ''),
          'stCotaTabela', false,
          'stSolicitaFora', false,
          'stSolicitante', false,
          'tpGestao', e.tp_gestao,
          'stExecutante', false,
          'sgUf', (CASE e.co_estado_gestor
            WHEN '11' THEN 'RO' WHEN '12' THEN 'AC' WHEN '13' THEN 'AM' WHEN '14' THEN 'RR'
            WHEN '15' THEN 'PA' WHEN '16' THEN 'AP' WHEN '17' THEN 'TO' WHEN '21' THEN 'MA'
            WHEN '22' THEN 'PI' WHEN '23' THEN 'CE' WHEN '24' THEN 'RN' WHEN '25' THEN 'PB'
            WHEN '26' THEN 'PE' WHEN '27' THEN 'AL' WHEN '28' THEN 'SE' WHEN '29' THEN 'BA'
            WHEN '31' THEN 'MG' WHEN '32' THEN 'ES' WHEN '33' THEN 'RJ' WHEN '35' THEN 'SP'
            WHEN '41' THEN 'PR' WHEN '42' THEN 'SC' WHEN '43' THEN 'RS' WHEN '50' THEN 'MS'
            WHEN '51' THEN 'MT' WHEN '52' THEN 'GO' WHEN '53' THEN 'DF' ELSE '' END),
          'nuCnpj', NULLIF(e.nu_cnpj, ''),
          'coNaturezaOrganizacao', null,
          'coNaturezaJuridica', e.co_natureza_jur
        )
      FROM tb_cnes_estabelecimentos_raw e
      WHERE e.co_cnes IS NOT NULL AND e.co_cnes != ''
    `);

    this.logger.log('2/2 Building tb_cnes_profissionais_json (Joining with Carga Horaria)...');
    
    await queryRunner.query(`
      INSERT INTO tb_cnes_profissionais_json (cpf, cns, nome_busca, documento)
      SELECT 
        p.cpf,
        p.cns,
        p.nome as nome_busca,
        jsonb_build_object(
          'nome', p.nome,
          'cpf_mascarado', CASE 
            WHEN length(p.cpf) = 11 AND position('X' in p.cpf) = 0 THEN
              substring(p.cpf from 1 for 3) || '.***.***-' || substring(p.cpf from 10 for 2)
            ELSE p.cpf
          END,
          'cns', p.cns,
          'cbo', jsonb_build_object('codigo', p.cbo),
          'unidades', (
             SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'codigo', e.co_cnes,
                'nome', COALESCE(e.no_fantasia, e.no_razao_social, 'Desconhecido'),
                'municipio', jsonb_build_object(
                    'codigo', e.co_municipio_gestor, 
                    'uf', e.co_estado_gestor
                )
             )), '[]'::jsonb)
             FROM tb_cnes_carga_horaria_raw ch
             JOIN tb_cnes_estabelecimentos_raw e ON ch.co_unidade = e.co_unidade
             WHERE ch.co_profissional_sus = p.cns
          )
        )
      FROM (
        SELECT cpf, cns, MAX(nome) as nome, MAX(cbo) as cbo 
        FROM tb_cnes_profissionais_raw 
        GROUP BY cpf, cns
      ) p
    `);

    this.logger.log('Creating final indexes...');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_cpf ON tb_cnes_profissionais_json(cpf)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_cns ON tb_cnes_profissionais_json(cns)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_nome_trgm ON tb_cnes_profissionais_json USING GIN (nome_busca gin_trgm_ops)');
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cnes_prof_doc_cnes ON tb_cnes_profissionais_json USING GIN ((documento->'unidades') jsonb_path_ops)`);
    
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_estab_cnes ON tb_cnes_estabelecimentos_json(co_cnes)');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_estab_nome_trgm ON tb_cnes_estabelecimentos_json USING GIN (nome_busca gin_trgm_ops)');
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_cnes_estab_mun ON tb_cnes_estabelecimentos_json USING BTREE ((documento->>'coMunicipioIbge'))`);

    this.logger.log('Dropping staging tables...');
    await queryRunner.query('DROP TABLE IF EXISTS tb_cnes_estabelecimentos_raw');
    await queryRunner.query('DROP TABLE IF EXISTS tb_cnes_carga_horaria_raw');
    await queryRunner.query('DROP TABLE IF EXISTS tb_cnes_profissionais_raw');

    this.logger.log('JSON Aggregation Complete!');
    await queryRunner.release();
  }
}
