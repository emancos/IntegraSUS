import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
// @ts-ignore
import Parser from 'node-dbf';

@Injectable()
export class SiaImporterService {
  private readonly logger = new Logger(SiaImporterService.name);

  constructor(private dataSource: DataSource) {}

  async createTables() {
    this.logger.log('Creating SIA staging tables...');
    await this.dataSource.query(`
      CREATE TABLE IF NOT EXISTS tb_sia_cids (
        codigo VARCHAR(10) PRIMARY KEY,
        descricao TEXT
      )
    `);
    
    await this.dataSource.query('TRUNCATE TABLE tb_sia_cids');
  }

  async importCids(dbfPath: string) {
    this.logger.log('Importing CIDs from SIA (BDSIA)...');
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    
    let batch: any[] = [];
    let processed = 0;
    let insertPromise = Promise.resolve();

    return new Promise<void>((resolve, reject) => {
      // @ts-ignore
      const parser = new (Parser.default || Parser)(dbfPath, { encoding: 'latin1' });
      
      parser.on('record', (record: any) => {
        // According to standard DATASUS CID.DBF: CID (or CD_CID) and NO_CID (or DESC_CID)
        const codigo = (record.CD_CID || record.CID || record.CD_CODIGO || '').trim();
        const descricao = (record.NO_CID || record.NM_CID || record.DESC_CID || record.DS_NOME || '').trim();
        
        if (codigo) {
            batch.push({ codigo, descricao });
        }

        if (batch.length >= 1000) {
          parser.pause();
          const currentBatch = [...batch];
          batch = [];
          processed += currentBatch.length;
          insertPromise = insertPromise.then(async () => {
            await this.insertCidsBatch(queryRunner, currentBatch);
            parser.resume();
          }).catch(reject);
        }
      });

      parser.on('end', () => {
        insertPromise.then(async () => {
          if (batch.length > 0) {
            await this.insertCidsBatch(queryRunner, batch);
            processed += batch.length;
          }
          this.logger.log(`Finished importing ${processed} CIDs from DBF.`);
          await queryRunner.release();
          resolve();
        }).catch(reject);
      });

      parser.on('error', (err: any) => {
        this.logger.error('Error parsing DBF: ' + err.message);
        reject(err);
      });

      parser.parse();
    });
  }

  private async insertCidsBatch(queryRunner: any, rows: any[]) {
    const values = [];
    const params = [];
    let i = 1;
    for (const r of rows) {
      values.push(`($${i}, $${i+1})`);
      params.push(r.codigo, r.descricao.substring(0, 500));
      i += 2;
    }

    if (values.length === 0) return;
    const query = `INSERT INTO tb_sia_cids (codigo, descricao) VALUES ${values.join(', ')} ON CONFLICT (codigo) DO NOTHING`;
    await queryRunner.query(query, params);
  }
}
