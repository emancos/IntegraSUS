import { Module } from '@nestjs/common';
import { SiaController } from './sia.controller.js';
import { SiaService } from './sia.service.js';
import { SiaImporterService } from './sia-importer.service.js';

@Module({
  controllers: [SiaController],
  providers: [SiaService, SiaImporterService],
  exports: [SiaService, SiaImporterService]
})
export class SiaModule {}
