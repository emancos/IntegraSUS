import { Module } from '@nestjs/common';
import { CnesController } from './cnes.controller.js';
import { CnesService } from './cnes.service.js';
import { CnesImporterService } from './cnes-importer.service.js';
import { DownloaderModule } from '../downloader/downloader.module.js';

@Module({
  imports: [DownloaderModule],
  controllers: [CnesController],
  providers: [CnesService, CnesImporterService],
  exports: [CnesService, CnesImporterService]
})
export class CnesModule {}
