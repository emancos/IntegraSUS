import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';

export class SyncConfigDto {
  @ApiProperty({ description: 'Competência atual baixada do CNES', example: '202608', required: false })
  cnes_competence?: string;

  @ApiProperty({ description: 'Competência atual baixada do SIA', example: '202609a', required: false })
  sia_competence?: string;

  @ApiProperty({ description: 'Expressão Cron para o agendamento', example: '0 2 * * 0', required: false })
  cron_expression?: string;

  @ApiProperty({ description: 'Habilita ou desabilita a sincronização automática', example: true, required: false })
  auto_sync_enabled?: boolean;
}

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Disparar sincronização completa do dos dados em saúde' })
  @ApiResponse({ status: 201, description: 'Processo de sincronização iniciado em background.' })
  triggerSync() {
    this.syncService.runSync();
    return { message: 'Sync process started in the background.' };
  }

  @Get('config')
  @ApiOperation({ summary: 'Obter configuração de sincronização atual' })
  @ApiResponse({ status: 200, description: 'Configuração retornada com sucesso.', type: SyncConfigDto })
  getConfig() {
    return this.syncService.getConfig();
  }

  @Post('config')
  @ApiOperation({ summary: 'Atualizar configuração de agendamento (ex: cron, auto_sync_enabled)' })
  @ApiResponse({ status: 201, description: 'Configuração atualizada com sucesso.', type: SyncConfigDto })
  updateConfig(@Body() body: SyncConfigDto) {
    const newConfig = this.syncService.updateConfig(body);
    return { message: 'Configuration updated successfully.', config: newConfig };
  }
}