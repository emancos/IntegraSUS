import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { ProgressBar } from '../sync/progress.utils.js';

@Injectable()
export class DownloaderService {
  private readonly logger = new Logger(DownloaderService.name);

  async downloadAndExtract(url: string, destFolder: string): Promise<string> {
    const zipPath = path.join(destFolder, 'sigtap.zip');
    
    if (!fs.existsSync(destFolder)) {
      fs.mkdirSync(destFolder, { recursive: true });
    }

    this.logger.log(`Downloading SIGTAP from ${url} to ${zipPath}`);
    
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream'
    });

    const totalLength = parseInt((response.headers['content-length'] as string) || '0', 10);
    const progressBar = new ProgressBar('Downloading SIGTAP', totalLength);
    const writer = fs.createWriteStream(zipPath);

    response.data.on('data', (chunk: Buffer) => progressBar.add(chunk.length));
    response.data.pipe(writer);

    await new Promise<void>((resolve, reject) => {
      writer.on('finish', () => {
        progressBar.finish();
        resolve();
      });
      writer.on('error', reject);
    });
    this.logger.log('Download complete. Extracting...');

    const zip = new AdmZip(zipPath);
    const extractPath = path.join(destFolder, 'extracted');
    zip.extractAllTo(extractPath, true);
    
    this.logger.log(`Extracted to ${extractPath}`);
    return extractPath;
  }
}