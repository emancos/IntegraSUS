import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('trigger')
  @ApiOperation({ summary: 'Disparar sincronização completa do SIGTAP' })
  triggerSync() {
    this.syncService.runSync();
    return { message: 'Sync process started in the background.' };
  }

  @Get('config')
  @ApiOperation({ summary: 'Obter configuração de sincronização atual' })
  getConfig() {
    return this.syncService.getConfig();
  }

  @Post('config')
  @ApiOperation({ summary: 'Atualizar configuração de agendamento (ex: cron, auto_sync_enabled)' })
  updateConfig(@Body() body: any) {
    const newConfig = this.syncService.updateConfig(body);
    return { message: 'Configuration updated successfully.', config: newConfig };
  }
}