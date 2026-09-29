import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse } from '@nestjs/swagger';

export class SyncConfigDto {
  @ApiProperty({ description: 'Competência atual baixada do SIGTAP', example: '202609', required: false })
  sigtap_competence?: string;

  @ApiProperty({ description: 'Competência atual baixada do CNES', example: '202608', required: false })
  cnes_competence?: string;

  @ApiProperty({ description: 'Competência atual baixada do SIA', example: '202609a', required: false })
  sia_competence?: string;

  @ApiProperty({ description: 'Expressão Cron para o agendamento', example: '0 2 * * 0', required: false })
  cron_expression?: string;

  @ApiProperty({ description: 'Habilita ou desabilita a sincronização automática', example: true, required: false })
  auto_sync_enabled?: boolean;
}

export class TriggerSyncDto {
  @ApiProperty({ description: 'Forçar sincronização ignorando versão atual (baixa de novo)', example: true, required: false })
  force?: boolean;
}

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Disparar sincronização completa de todos os dados em saúde' })
  @ApiResponse({ status: 201, description: 'Processo de sincronização completo iniciado em background.' })
  @ApiResponse({ status: 200, description: 'A base de dados já está totalmente atualizada.' })
  async triggerSync(@Body() body: TriggerSyncDto) {
    if (!body?.force) {
      const isUpToDate = await this.syncService.checkIfUpToDate();
      if (isUpToDate) {
        return { message: 'A base de dados já está totalmente atualizada.' };
      }
    }
    
    this.syncService.runSync(body?.force).catch(e => console.error(e));
    return { message: 'Sincronização completa iniciada em background.' };
  }

  @Post('cnes/trigger')
  @ApiOperation({ summary: 'Disparar sincronização apenas do CNES' })
  @ApiResponse({ status: 201, description: 'Processo de sincronização do CNES iniciado em background.' })
  @ApiResponse({ status: 200, description: 'A base do CNES já está atualizada.' })
  async triggerCnesSync(@Body() body: TriggerSyncDto) {
    if (!body?.force) {
      const config = this.syncService.getConfig();
      const latest = await this.syncService.getLatestCnesVersion();
      if (latest && latest.competence === config.cnes_competence) {
        return { message: 'A base do CNES já está atualizada.' };
      }
    }
    this.syncService.runSingleSync('cnes', body?.force).catch(e => console.error(e));
    return { message: 'Sincronização do CNES iniciada em background.' };
  }

  @Post('sia/trigger')
  @ApiOperation({ summary: 'Disparar sincronização apenas do SIA' })
  @ApiResponse({ status: 201, description: 'Processo de sincronização do SIA iniciado em background.' })
  @ApiResponse({ status: 200, description: 'A base do SIA já está atualizada.' })
  async triggerSiaSync(@Body() body: TriggerSyncDto) {
    if (!body?.force) {
      const config = this.syncService.getConfig();
      const latest = await this.syncService.getLatestSiaVersion();
      if (latest && latest.competence === config.sia_competence) {
        return { message: 'A base do SIA já está atualizada.' };
      }
    }
    this.syncService.runSingleSync('sia', body?.force).catch(e => console.error(e));
    return { message: 'Sincronização do SIA iniciada em background.' };
  }

  @Post('sigtap/trigger')
  @ApiOperation({ summary: 'Disparar sincronização apenas do SIGTAP' })
  @ApiResponse({ status: 201, description: 'Processo de sincronização do SIGTAP iniciado em background.' })
  @ApiResponse({ status: 200, description: 'A base do SIGTAP já está atualizada.' })
  async triggerSigtapSync(@Body() body: TriggerSyncDto) {
    if (!body?.force) {
      const config = this.syncService.getConfig();
      const latest = await this.syncService.getLatestSigtapVersion();
      if (latest && latest.competence === config.sigtap_competence) {
        return { message: 'A base do SIGTAP já está atualizada.' };
      }
    }
    this.syncService.runSingleSync('sigtap', body?.force).catch(e => console.error(e));
    return { message: 'Sincronização do SIGTAP iniciada em background.' };
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