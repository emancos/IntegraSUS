import { Module } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { DownloaderModule } from '../downloader/downloader.module.js';
import { ParserModule } from '../parser/parser.module.js';
import { ImporterModule } from '../importer/importer.module.js';
import { SyncController } from './sync.controller.js';
import { CnesModule } from '../cnes/cnes.module.js';
import { SiaModule } from '../sia/sia.module.js';

@Module({
  imports: [DownloaderModule, ParserModule, ImporterModule, CnesModule, SiaModule],
  providers: [SyncService],
  controllers: [SyncController]
})
export class SyncModule {}