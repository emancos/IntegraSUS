import { Module } from '@nestjs/common';
import { ImporterService } from './importer.service.js';

@Module({
  providers: [ImporterService],
  exports: [ImporterService],
})
export class ImporterModule {}