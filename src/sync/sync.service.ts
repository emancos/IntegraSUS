import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
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
import { downloadFtpMultithreaded, getLatestFtpFile } from './ftp-downloader.js';
import { ProgressBar } from './progress.utils.js';

export interface SyncConfig {
  sigtap_competence: string;
  cnes_competence: string;
  sia_competence: string;
  cron_expression: string;
  auto_sync_enabled: boolean;
}

@Injectable()
export class SyncService implements OnModuleInit {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;
  private readonly configPath = path.join(process.cwd(), 'sync-config.json');

  constructor(
    private downloader: DownloaderService,
    private parser: ParserService,
    private importer: ImporterService,
    private cnesImporter: CnesImporterService,
    private siaImporter: SiaImporterService,
    private schedulerRegistry: SchedulerRegistry
  ) { }

  onModuleInit() {
    this.configureCron();
  }

  public configureCron() {
    const config = this.getConfig();
    const jobName = 'dynamicSyncCron';

    try {
      this.schedulerRegistry.deleteCronJob(jobName);
    } catch (e) {
      // Ignore if job doesn't exist yet
    }

    if (config.auto_sync_enabled && config.cron_expression) {
      const job = new CronJob(config.cron_expression, async () => {
        this.logger.log('Starting IntegraSUS sync via Cron...');
        await this.runSync(false);
      });

      this.schedulerRegistry.addCronJob(jobName, job);
      job.start();
      this.logger.log(`Sync cron scheduled with expression: ${config.cron_expression}`);
    } else {
      this.logger.log('Sync cron is disabled in configuration.');
    }
  }

  public async getLatestSigtapVersion(): Promise<{ competence: string, downloadUrl: string } | null> {
    try {
      const githubUrl = 'https://api.github.com/repos/RenatoKR/SIGTAP/contents/tabelas';
      const { data } = await axios.get(githubUrl);
      const zipFiles = data.filter((f: any) => f.name.endsWith('.zip'));
      if (zipFiles.length === 0) return null;
      zipFiles.sort((a: any, b: any) => b.name.localeCompare(a.name));
      return { competence: zipFiles[0].name.replace('.zip', ''), downloadUrl: zipFiles[0].download_url };
    } catch (e) {
      this.logger.error('Error fetching latest SIGTAP version: ' + (e as Error).message);
      return null;
    }
  }

  public async getLatestCnesVersion(): Promise<{ filename: string, competence: string } | null> {
    try {
      return await getLatestFtpFile("ftp.datasus.gov.br", "cnes", /^BASE_DE_DADOS_CNES_(\d{6})\.ZIP$/i);
    } catch (e) {
      this.logger.error('Error fetching latest CNES version: ' + (e as Error).message);
      return null;
    }
  }

  public async getLatestSiaVersion(): Promise<{ filename: string, competence: string, remotePath: string } | null> {
    const client = new Client();
    let latestYear = '';
    try {
      await client.access({ host: "ftp.datasus.gov.br" });
      const yearDirs = await client.list('siasus/bdsia');
      for (const d of yearDirs) {
        if (d.type === 2 && /^\d{4}$/.test(d.name)) {
          if (d.name > latestYear) latestYear = d.name;
        }
      }
    } catch (err) {
      this.logger.error('Error fetching SIA year directories: ' + (err as Error).message);
      return null;
    } finally {
      try { client.close(); } catch(e) {}
    }
    if (!latestYear) return null;
    
    try {
      const latestSia = await getLatestFtpFile("ftp.datasus.gov.br", `siasus/bdsia/${latestYear}`, /^BDSIA(\d{6}[a-z]?)\.exe$/i);
      if (!latestSia) return null;
      return { ...latestSia, remotePath: `siasus/bdsia/${latestYear}/${latestSia.filename}` };
    } catch (e) {
      this.logger.error('Error fetching latest SIA file: ' + (e as Error).message);
      return null;
    }
  }

  public async checkIfUpToDate(): Promise<boolean> {
    this.logger.log('Checking versions online for SIGTAP, CNES, and SIA...');
    const config = this.getConfig();
    const [sigtap, cnes, sia] = await Promise.all([
      this.getLatestSigtapVersion(),
      this.getLatestCnesVersion(),
      this.getLatestSiaVersion()
    ]);

    if (sigtap && sigtap.competence !== config.sigtap_competence) return false;
    if (cnes && cnes.competence !== config.cnes_competence) return false;
    if (sia && sia.competence !== config.sia_competence) return false;

    return true;
  }

  async runSync(force: boolean = false) {
    if (this.isSyncing) {
      this.logger.warn('Sync is already running.');
      return;
    }
    this.isSyncing = true;
    try {
      await this.syncCnes(force);
      await this.syncSigtap(force);
      await this.syncSia(force);
      this.logger.log('IntegraSUS Sync completed successfully.');
    } catch (e) {
      this.logger.error('Error during IntegraSUS Sync: ' + (e as Error).message);
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncSigtap(force: boolean = false) {
    this.logger.log('Starting SIGTAP Sync...');
    try {
      const latest = await this.getLatestSigtapVersion();
      if (!latest) {
        this.logger.warn('Could not determine latest SIGTAP version.');
        return;
      }
      
      const config = this.getConfig();
      if (!force && config.sigtap_competence === latest.competence) {
        this.logger.log(`SIGTAP is already up-to-date (Competence: ${latest.competence}). Skipping download.`);
        return;
      }

      this.logger.log(`Found latest SIGTAP file (Competence: ${latest.competence})`);
      const destPath = path.join(process.cwd(), 'temp_sigtap');
      const extractPath = await this.downloader.downloadAndExtract(latest.downloadUrl, destPath);

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
      this.updateConfig({ sigtap_competence: latest.competence });
    } catch (e) {
      this.logger.error('Error during SIGTAP Sync: ' + (e as Error).message);
      throw e;
    }
  }

  private async syncCnes(force: boolean = false) {
    this.logger.log('Starting CNES Sync...');
    
    const latestCnes = await this.getLatestCnesVersion();
    if (!latestCnes) {
      this.logger.error('Could not find any CNES zip file on FTP.');
      return;
    }

    const config = this.getConfig();
    if (!force && config.cnes_competence === latestCnes.competence) {
      this.logger.log(`CNES is already up-to-date (Competence: ${latestCnes.competence}). Skipping download.`);
      return;
    }

    this.logger.log(`Found latest CNES file: ${latestCnes.filename} (Competence: ${latestCnes.competence})`);

    const cnesZipPath = path.join(process.cwd(), latestCnes.filename);
    const cnesExtractedPath = path.join(process.cwd(), 'temp_cnes');

    if (!fs.existsSync(cnesZipPath)) {
      this.logger.log(`Downloading CNES ZIP (${latestCnes.filename}) via FTP with 8 threads...`);
      try {
        await downloadFtpMultithreaded("ftp.datasus.gov.br", `cnes/${latestCnes.filename}`, cnesZipPath, 8);
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

      const files = fs.readdirSync(cnesExtractedPath);
      
      const altEstab = files.find(f => f.toLowerCase().startsWith('tbestabelecimento'));
      if (altEstab) {
        const tbEstab = path.join(cnesExtractedPath, altEstab);
        await this.cnesImporter.importEstabelecimentos(tbEstab);
      } else {
        this.logger.warn('Estabelecimento CSV not found in the extracted CNES zip.');
      }

      let tbProf = null;
      const altFile = files.find(f => f.toLowerCase().startsWith('tbdadosprofissionalsus'));
      if (altFile) {
        tbProf = path.join(cnesExtractedPath, altFile);
        this.logger.log(`Found alternative Profissionais file: ${altFile}`);
      }

      if (tbProf && fs.existsSync(tbProf)) {
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
      this.updateConfig({ cnes_competence: latestCnes.competence });
    } else {
      this.logger.warn('CNES ZIP not found.');
    }
  }

  private async syncSia(force: boolean = false) {
    this.logger.log('Starting SIA Sync...');
    
    const latestSia = await this.getLatestSiaVersion();
    if (!latestSia) {
      this.logger.error('Could not find any SIA exe file on FTP.');
      return;
    }

    const config = this.getConfig();
    if (!force && config.sia_competence === latestSia.competence) {
      this.logger.log(`SIA is already up-to-date (Competence: ${latestSia.competence}). Skipping download.`);
      return;
    }

    this.logger.log(`Found latest SIA file: ${latestSia.filename} (Competence: ${latestSia.competence})`);

    const siaZipPath = path.join(process.cwd(), latestSia.filename);
    const siaExtractedPath = path.join(process.cwd(), 'temp_sia');

    if (!fs.existsSync(siaZipPath)) {
      this.logger.log(`Downloading SIA EXE (${latestSia.filename}) via FTP...`);
      try {
        await downloadFtpMultithreaded("ftp.datasus.gov.br", latestSia.remotePath, siaZipPath, 4);
        this.logger.log('Download SIA EXE finished.');
      } catch (e) {
        this.logger.error('Failed to download SIA EXE: ' + (e as Error).message);
        try { if (fs.existsSync(siaZipPath)) fs.unlinkSync(siaZipPath); } catch (_) { }
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
        await new Promise(resolve => setTimeout(resolve, 1000));
        try {
          fs.rmSync(siaExtractedPath, { recursive: true, force: true });
          fs.unlinkSync(siaZipPath);
        } catch (cleanupErr) {
          this.logger.warn('Aviso: Não foi possível remover os arquivos temporários do SIA agora. ' + (cleanupErr as Error).message);
        }

        this.logger.log('SIA Sync completed successfully.');
        this.updateConfig({ sia_competence: latestSia.competence });
      } catch (err) {
        this.logger.error('Failed to extract/import SIA: ' + (err as Error).message);
      }
    } else {
      this.logger.warn('SIA EXE not found even after download.');
    }
  }

  public getConfig(): SyncConfig {
    const defaultConfig: SyncConfig = {
      sigtap_competence: '',
      cnes_competence: '',
      sia_competence: '',
      cron_expression: '0 2 * * 0',
      auto_sync_enabled: true
    };
    if (fs.existsSync(this.configPath)) {
      try {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...defaultConfig, ...JSON.parse(data) };
      } catch (e) {
        this.logger.warn('Could not read sync-config.json, using defaults.');
      }
    }
    return defaultConfig;
  }

  public updateConfig(partialConfig: Partial<SyncConfig>): SyncConfig {
    const config = this.getConfig();
    const newConfig = { ...config, ...partialConfig };
    fs.writeFileSync(this.configPath, JSON.stringify(newConfig, null, 2), 'utf8');
    this.configureCron(); 
    return newConfig;
  }
}