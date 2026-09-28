import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DownloaderService } from '../downloader/downloader.service.js';
import { ParserService } from '../parser/parser.service.js';
import { ImporterService } from '../importer/importer.service.js';
import { CnesImporterService } from '../cnes/cnes-importer.service.js';
import { SiaImporterService } from '../sia/sia-importer.service.js';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';
import { Client } from 'basic-ftp';
import AdmZip from 'adm-zip';
import { execSync } from 'child_process';
import _7zip from '7zip-bin';
import { downloadFtpMultithreaded } from './ftp-downloader.js';
import { ProgressBar } from './progress.utils.js';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  constructor(
    private downloader: DownloaderService,
    private parser: ParserService,
    private importer: ImporterService,
    private cnesImporter: CnesImporterService,
    private siaImporter: SiaImporterService
  ) { }

  @Cron('0 5 * * *')
  async handleCron() {
    this.logger.log('Starting IntegraSUS daily sync via Cron...');
    await this.runSync();
  }

  async runSync() {
    if (this.isSyncing) {
      this.logger.warn('Sync is already running.');
      return;
    }

    this.isSyncing = true;

    try {
      // Iniciar CNES Sync
      await this.syncCnes();

      // Iniciar SIGTAP Sync
      await this.syncSigtap();

      // Iniciar SIA Sync
      await this.syncSia();

      this.logger.log('IntegraSUS Sync completed successfully.');
    } catch (e) {
      this.logger.error('Error during IntegraSUS Sync: ' + (e as Error).message);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncSigtap() {
    this.logger.log('Starting SIGTAP Sync...');
    try {
      const githubUrl = 'https://api.github.com/repos/RenatoKR/SIGTAP/contents/tabelas';
      const { data } = await axios.get(githubUrl);

      const zipFiles = data.filter((f: any) => f.name.endsWith('.zip'));
      if (zipFiles.length === 0) {
        this.logger.warn('No zip files found on GitHub repo.');
        return;
      }

      zipFiles.sort((a: any, b: any) => b.name.localeCompare(a.name));
      const latestZip = zipFiles[0];
      const downloadUrl = latestZip.download_url;

      const destPath = path.join(process.cwd(), 'temp_sigtap');
      const extractPath = await this.downloader.downloadAndExtract(downloadUrl, destPath);

      const files = fs.readdirSync(extractPath);
      const layoutFiles = files.filter(f => f.endsWith('_layout.txt'));

      for (const layoutFile of layoutFiles) {
        const dataFile = layoutFile.replace('_layout.txt', '.txt');
        const tableName = layoutFile.replace('_layout.txt', '').toLowerCase();

        const layoutFullPath = path.join(extractPath, layoutFile);
        const dataFullPath = path.join(extractPath, dataFile);

        if (!fs.existsSync(dataFullPath)) {
          this.logger.warn(`Data file ${dataFile} not found for layout ${layoutFile}`);
          continue;
        }

        const layout = this.parser.parseLayout(layoutFullPath);
        const dataRows = this.parser.parseData(dataFullPath, layout);

        await this.importer.importTable(tableName, layout, dataRows);
      }

      await this.importer.buildJsonDocuments();

      this.logger.log('Limpando diretório temporário SIGTAP...');
      fs.rmSync(destPath, { recursive: true, force: true });
      this.logger.log('SIGTAP Sync completed successfully.');
    } catch (e) {
      this.logger.error('Error during SIGTAP Sync: ' + (e as Error).message);
      throw e;
    }
  }

  private async syncCnes() {
    this.logger.log('Starting CNES Sync...');
    const cnesZipPath = path.join(process.cwd(), 'BASE_DE_DADOS_CNES_202608.ZIP');
    const cnesExtractedPath = path.join(process.cwd(), 'temp_cnes');

    if (!fs.existsSync(cnesZipPath)) {
      this.logger.log('Downloading CNES ZIP via FTP with 8 threads (Bypassing DATASUS WAF)...');
      try {
        await downloadFtpMultithreaded("ftp.datasus.gov.br", "cnes/BASE_DE_DADOS_CNES_202608.ZIP", cnesZipPath, 8);
        this.logger.log('Download CNES ZIP finished.');
      } catch (e) {
        this.logger.error('Failed to download CNES ZIP: ' + (e as Error).message);
        try { if (fs.existsSync(cnesZipPath)) fs.unlinkSync(cnesZipPath); } catch (_) { }
        return;
      }
    }

    if (fs.existsSync(cnesZipPath)) {
      this.logger.log('Extracting CNES ZIP via 7zip-bin...');
      if (!fs.existsSync(cnesExtractedPath)) fs.mkdirSync(cnesExtractedPath);

      const path7za = _7zip.path7za;
      execSync(`"${path7za}" x "${cnesZipPath}" -o"${cnesExtractedPath}" -y`);

      await this.cnesImporter.createTables();

      const tbEstab = path.join(cnesExtractedPath, 'tbEstabelecimento202608.csv');
      if (fs.existsSync(tbEstab)) await this.cnesImporter.importEstabelecimentos(tbEstab);

      let tbProf = path.join(cnesExtractedPath, 'tbProfissional202608.csv');
      if (!fs.existsSync(tbProf)) {
        const files = fs.readdirSync(cnesExtractedPath);
        const altFile = files.find(f => f.toLowerCase().startsWith('tbdadosprofissionalsus'));
        if (altFile) {
          tbProf = path.join(cnesExtractedPath, altFile);
          this.logger.log(`Found alternative Profissionais file: ${altFile}`);
        }
      }

      if (fs.existsSync(tbProf)) {
        await this.cnesImporter.importProfissionais(tbProf);
      } else {
        this.logger.warn('Profissionais CSV not found in the extracted CNES zip.');
      }

      this.logger.log('Limpando diretório temporário CNES...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        fs.rmSync(cnesExtractedPath, { recursive: true, force: true });
        fs.unlinkSync(cnesZipPath);
      } catch (cleanupErr) {
        this.logger.warn('Aviso: Não foi possível remover os arquivos temporários do CNES agora. ' + (cleanupErr as Error).message);
      }

      this.logger.log('CNES Sync completed successfully.');
    } else {
      this.logger.warn('CNES ZIP not found.');
    }
  }

  private async syncSia() {
    this.logger.log('Starting SIA Sync...');
    const siaZipPath = path.join(process.cwd(), 'BDSIA202609a.exe');
    const siaExtractedPath = path.join(process.cwd(), 'temp_sia');

    if (!fs.existsSync(siaZipPath)) {
      this.logger.log('Downloading SIA EXE...');
      try {
        const url = 'https://github.com/RenatoKR/SIASUS/raw/main/bdsia/BDSIA202609a.exe';
        const response = await axios({ url, method: 'GET', responseType: 'stream' });

        const totalLength = parseInt((response.headers['content-length'] as string) || '0', 10);
        const progressBar = new ProgressBar('Downloading SIA', totalLength);

        const writer = fs.createWriteStream(siaZipPath);
        response.data.on('data', (chunk: Buffer) => progressBar.add(chunk.length));
        response.data.pipe(writer);

        await new Promise<void>((resolve, reject) => {
          writer.on('finish', () => {
            progressBar.finish();
            resolve();
          });
          writer.on('error', reject);
        });
        this.logger.log('Download SIA EXE finished.');
      } catch (e) {
        this.logger.error('Failed to download SIA EXE: ' + (e as Error).message);
        return;
      }
    }

    if (fs.existsSync(siaZipPath)) {
      this.logger.log('Extracting SIA EXE via 7zip-bin...');
      if (!fs.existsSync(siaExtractedPath)) fs.mkdirSync(siaExtractedPath);

      try {
        const path7za = _7zip.path7za;
        execSync(`"${path7za}" x "${siaZipPath}" -o"${siaExtractedPath}" -y`);

        await this.siaImporter.createTables();

        const realCidPath = path.join(siaExtractedPath, 'S_CID.DBF');
        if (fs.existsSync(realCidPath)) {
          await this.siaImporter.importCids(realCidPath);
        } else {
          this.logger.warn('S_CID.DBF not found in extracted SIA files.');
        }

        this.logger.log('Limpando diretório temporário SIA...');
        // Windows often locks files for a few milliseconds after closing streams. Wait before deleting.
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          fs.rmSync(siaExtractedPath, { recursive: true, force: true });
          fs.unlinkSync(siaZipPath);
        } catch (cleanupErr) {
          this.logger.warn('Aviso: Não foi possível remover os arquivos temporários do SIA agora. ' + (cleanupErr as Error).message);
        }

        this.logger.log('SIA Sync completed successfully.');
      } catch (err) {
        this.logger.error('Failed to extract/import SIA: ' + (err as Error).message);
      }
    } else {
      this.logger.warn('SIA EXE not found even after download.');
    }
  }
}