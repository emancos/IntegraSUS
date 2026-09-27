import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';

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
      responseType: 'arraybuffer'
    });

    fs.writeFileSync(zipPath, response.data);
    this.logger.log('Download complete. Extracting...');

    const zip = new AdmZip(zipPath);
    const extractPath = path.join(destFolder, 'extracted');
    zip.extractAllTo(extractPath, true);
    
    this.logger.log(`Extracted to ${extractPath}`);
    return extractPath;
  }
}