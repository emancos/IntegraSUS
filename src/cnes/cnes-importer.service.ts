import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import csv from 'csv-parser';

@Injectable()
export class CnesImporterService {
  private readonly logger = new Logger(CnesImporterService.name);

  constructor(private dataSource: DataSource) {}

  async createTables() {
    this.logger.log('Creating CNES staging tables...');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_estabelecimentos (
        cnes VARCHAR(10) PRIMARY KEY,
        razao_social VARCHAR(255),
        fantasia VARCHAR(255),
        municipio_codigo VARCHAR(20),
        uf VARCHAR(2)
      )
    `);

    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_cnes_profissionais_json (
        cpf VARCHAR(20),
        cns VARCHAR(20),
        nome_busca TEXT,
        documento JSONB
      )
    `);
    
    // Clear them
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_estabelecimentos');
    await this.dataSource.query('TRUNCATE TABLE tb_cnes_profissionais_json');
  }

  async importEstabelecimentos(csvPath: string) {
    this.logger.log('Importing Estabelecimentos from CNES...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    let batch: any[] = [];
    let processed = 0;

    return new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath, { encoding: 'latin1' })
        .pipe(csv({ separator: ';' }))
        .on('data', async (row) => {
          batch.push(row);
          if (batch.length >= 1000) {
            const currentBatch = [...batch];
            batch = [];
            processed += currentBatch.length;
            await this.insertEstabelecimentosBatch(queryRunner, currentBatch);
            if (processed % 10000 === 0) this.logger.log(`Imported ${processed} estabelecimentos...`);
          }
        })
        .on('end', async () => {
          if (batch.length > 0) {
            await this.insertEstabelecimentosBatch(queryRunner, batch);
            processed += batch.length;
          }
          this.logger.log(`Finished importing ${processed} estabelecimentos.`);
          await queryRunner.release();
          resolve();
        })
        .on('error', (err) => reject(err));
    });
  }

  private async insertEstabelecimentosBatch(queryRunner: any, rows: any[]) {
    // Only keeping essential data for the API joins
    // From tbEstabelecimento: CO_UNIDADE (cnes), NO_RAZAO_SOCIAL, NO_FANTASIA, CO_MUNICIPIO_GESTOR, CO_ESTADO_GESTOR
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      const cnes = (r.CO_CNES || r.CO_UNIDADE || '').trim();
      if (!cnes) continue;
      values.push(`($${i}, $${i+1}, $${i+2}, $${i+3}, $${i+4})`);
      params.push(
        cnes, 
        (r.NO_RAZAO_SOCIAL || '').substring(0, 255), 
        (r.NO_FANTASIA || '').substring(0, 255), 
        (r.CO_MUNICIPIO_GESTOR || '').trim(), 
        (r.CO_ESTADO_GESTOR || '').trim()
      );
      i += 5;
    }

    if (values.length === 0) return;
    const query = `INSERT INTO tb_cnes_estabelecimentos (cnes, razao_social, fantasia, municipio_codigo, uf) VALUES ${values.join(', ')} ON CONFLICT (cnes) DO NOTHING`;
    await queryRunner.query(query, params);
  }

  async importProfissionais(csvPath: string) {
    this.logger.log('Importing Profissionais and building JSON documents...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();

    // Cache estabelecimentos in memory since it's fast and we need it to build JSON
    this.logger.log('Caching estabelecimentos...');
    const estabRows = await queryRunner.query('SELECT * FROM tb_cnes_estabelecimentos');
    const estabMap = new Map();
    for (const e of estabRows) {
      estabMap.set(e.cnes, e);
    }
    
    let batch: any[] = [];
    let processed = 0;

    return new Promise<void>((resolve, reject) => {
      fs.createReadStream(csvPath, { encoding: 'latin1' })
        .pipe(csv({ separator: ';' }))
        .on('data', async (row) => {
          batch.push(row);
          if (batch.length >= 1000) {
            const currentBatch = [...batch];
            batch = [];
            processed += currentBatch.length;
            await this.insertProfissionaisBatch(queryRunner, currentBatch, estabMap);
            if (processed % 10000 === 0) this.logger.log(`Imported ${processed} profissionais...`);
          }
        })
        .on('end', async () => {
          if (batch.length > 0) {
            await this.insertProfissionaisBatch(queryRunner, batch, estabMap);
            processed += batch.length;
          }
          
          this.logger.log('Creating indexes for Profissionais...');
          await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_cpf ON tb_cnes_profissionais_json(cpf)');
          await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_cns ON tb_cnes_profissionais_json(cns)');
          await queryRunner.query('CREATE INDEX IF NOT EXISTS idx_cnes_prof_nome ON tb_cnes_profissionais_json(nome_busca)');

          this.logger.log(`Finished building ${processed} profissionais JSON documents.`);
          await queryRunner.release();
          resolve();
        })
        .on('error', (err) => reject(err));
    });
  }

  private async insertProfissionaisBatch(queryRunner: any, rows: any[], estabMap: Map<string, any>) {
    // From tbProfissional: CO_PROFISSIONAL_SUS (cns), NU_CPF, NO_PROFISSIONAL, CO_CBO, CO_UNIDADE
    // The user requested: nome, cpf_mascarado, cns, cbo, estabelecimento_vinculado e municipio_uf (código e nome)
    // We don't have tbMunicipio loaded yet, so we will return the IBGE code for now, or just the state.
    
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      const cns = (r.CO_PROFISSIONAL_SUS || '').trim();
      let cpf = (r.NU_CPF || '').trim();
      const nome = (r.NO_PROFISSIONAL || '').trim();
      
      // se n tiver na tbProfissional, tenta tbDadosProfissional
      if (!nome) continue; 
      
      const cnes_est = (r.CO_CNES || r.CO_UNIDADE || '').trim();
      const estab = estabMap.get(cnes_est) || {};
      
      const cpf_mascarado = cpf ? cpf.substring(0,3) + '.***.***-' + cpf.substring(9,11) : '';

      const doc = {
        nome: nome,
        cpf_mascarado: cpf_mascarado,
        cns: cns,
        cbo: {
          codigo: r.CO_CBO || ''
        },
        estabelecimento: {
          codigo: cnes_est,
          nome: estab.fantasia || estab.razao_social || 'Desconhecido'
        },
        municipio: {
          codigo: estab.municipio_codigo || '',
          uf: estab.uf || ''
        }
      };

      values.push(`($${i}, $${i+1}, $${i+2}, $${i+3})`);
      params.push(
        cpf,
        cns,
        nome.toUpperCase(),
        doc
      );
      i += 4;
    }

    if (values.length === 0) return;
    const query = `INSERT INTO tb_cnes_profissionais_json (cpf, cns, nome_busca, documento) VALUES ${values.join(', ')}`;
    await queryRunner.query(query, params);
  }
}
