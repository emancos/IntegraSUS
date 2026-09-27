import { Controller, Post, UseGuards } from '@nestjs/common';
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
}