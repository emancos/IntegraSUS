import { Module } from '@nestjs/common';
import { ProcedimentosController } from './procedimentos.controller.js';

@Module({
  controllers: [ProcedimentosController],
})
export class ProcedimentosModule {}