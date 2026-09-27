import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SiaService } from './sia.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('cids')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cids')
export class SiaController {
  constructor(private readonly siaService: SiaService) {}

  @Get()
  @ApiOperation({ summary: 'Consultar catálogo de CIDs (Tabela BDSIA)' })
  @ApiQuery({ name: 'search', required: false, description: 'Buscar por código ou descrição' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 50)' })
  async searchCids(
    @Query('search') search: string,
    @Query('page') page = '1',
    @Query('limit') limit = '50'
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 50;
    return this.siaService.searchCids(search, p, l);
  }
}
