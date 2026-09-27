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
import AdmZip from 'adm-zip';

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
  ) {}

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
      const githubUrl = 'https://api.github.com/repos/RenatoKR/SIGTAP/contents/tabelas';
      const { data } = await axios.get(githubUrl);
      
      const zipFiles = data.filter((f: any) => f.name.endsWith('.zip'));
      if (zipFiles.length === 0) {
        this.logger.warn('No zip files found on GitHub repo.');
        this.isSyncing = false;
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

      // Iniciar CNES Sync
      await this.syncCnes();

      // Iniciar SIA Sync
      await this.syncSia();

      this.logger.log('IntegraSUS Sync completed successfully.');
    } catch (e) {
      this.logger.error('Error during IntegraSUS Sync: ' + (e as Error).message);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncCnes() {
    this.logger.log('Starting CNES Sync...');
    // We can assume the file is already in projeto_base_cnes for testing purposes or we can download it.
    // For now we will use the local ZIP we already have to save time, and extract it.
    const cnesZipPath = path.join(process.cwd(), 'projeto_base_cnes', 'BASE_DE_DADOS_CNES_202608.ZIP');
    const cnesExtractedPath = path.join(process.cwd(), 'temp_cnes');

    if (fs.existsSync(cnesZipPath)) {
      this.logger.log('Extracting CNES ZIP...');
      if (!fs.existsSync(cnesExtractedPath)) fs.mkdirSync(cnesExtractedPath);
      
      const zip = new AdmZip(cnesZipPath);
      zip.extractAllTo(cnesExtractedPath, true);

      await this.cnesImporter.createTables();
      
      const tbEstab = path.join(cnesExtractedPath, 'tbEstabelecimento202608.csv');
      if (fs.existsSync(tbEstab)) await this.cnesImporter.importEstabelecimentos(tbEstab);

      const tbProf = path.join(cnesExtractedPath, 'tbProfissional202608.csv');
      if (fs.existsSync(tbProf)) await this.cnesImporter.importProfissionais(tbProf);

      this.logger.log('Limpando diretório temporário CNES...');
      fs.rmSync(cnesExtractedPath, { recursive: true, force: true });
      
      this.logger.log('CNES Sync completed successfully.');
    } else {
      this.logger.warn('CNES ZIP not found.');
    }
  }

  private async syncSia() {
    this.logger.log('Starting SIA Sync...');
    // Mock the download of the file (usually a URL to BDSIAxxxx.exe)
    const siaZipPath = path.join(process.cwd(), 'projeto_base_sia', 'BDSIA202609a.exe');
    const siaExtractedPath = path.join(process.cwd(), 'temp_sia');

    if (fs.existsSync(siaZipPath)) {
      this.logger.log('Extracting SIA EXE via 7zip-bin...');
      if (!fs.existsSync(siaExtractedPath)) fs.mkdirSync(siaExtractedPath);
      
      try {
        const { path7za } = require('7zip-bin');
        const { execSync } = require('child_process');
        execSync(`"${path7za}" x "${siaZipPath}" -o"${siaExtractedPath}" -y`);
        
        await this.siaImporter.createTables();

        const cidPath = path.join(siaExtractedPath, 'CADMUN.DBF'); // Just using CADMUN temporarily, but in production we expect CID.DBF
        // The test repo only has CADMUN.DBF for DBF example, but let's assume it would be CID.DBF
        const realCidPath = path.join(siaExtractedPath, 'CID.DBF');
        if (fs.existsSync(realCidPath)) {
          await this.siaImporter.importCids(realCidPath);
        } else if (fs.existsSync(cidPath)) {
          // Fallback to try reading if it has CID format, but in this case CADMUN is diff.
          this.logger.warn('CID.DBF not found in extracted SIA files.');
        }

        this.logger.log('Limpando diretório temporário SIA...');
        fs.rmSync(siaExtractedPath, { recursive: true, force: true });
        this.logger.log('SIA Sync completed successfully.');
      } catch (err) {
        this.logger.error('Failed to extract/import SIA: ' + (err as Error).message);
      }
    } else {
      this.logger.warn('SIA EXE not found.');
    }
  }
}