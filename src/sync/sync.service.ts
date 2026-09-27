import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DownloaderService } from '../downloader/downloader.service.js';
import { ParserService } from '../parser/parser.service.js';
import { ImporterService } from '../importer/importer.service.js';
import * as path from 'path';
import * as fs from 'fs';
import axios from 'axios';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isSyncing = false;

  constructor(
    private downloader: DownloaderService,
    private parser: ParserService,
    private importer: ImporterService,
  ) {}

  @Cron('0 5 * * *')
  async handleCron() {
    this.logger.log('Starting SIGTAP daily sync via Cron...');
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
      this.logger.log('SIGTAP Sync completed successfully.');
    } catch (e) {
      this.logger.error('Error during SIGTAP Sync: ' + (e as Error).message);
    } finally {
      this.isSyncing = false;
    }
  }
}