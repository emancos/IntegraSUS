import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CnesService } from './cnes.service.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags('cnes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cnes')
export class CnesController {
  constructor(private readonly cnesService: CnesService) {}

  @Get('profissionais/cpf/:cpf')
  @ApiOperation({ summary: 'Consultar profissional por CPF' })
  @ApiParam({ name: 'cpf', description: 'CPF do profissional' })
  async getProfissionalByCpf(@Param('cpf') cpf: string) {
    return this.cnesService.findProfissionalByCpf(cpf);
  }

  @Get('profissionais/cns/:cns')
  @ApiOperation({ summary: 'Consultar profissional por CNS' })
  @ApiParam({ name: 'cns', description: 'CNS do profissional' })
  async getProfissionalByCns(@Param('cns') cns: string) {
    return this.cnesService.findProfissionalByCns(cns);
  }

  @Get('profissionais')
  @ApiOperation({ summary: 'Buscar profissionais por nome, município ou CNES' })
  @ApiQuery({ name: 'nome', required: false, description: 'Nome ou parte do nome' })
  @ApiQuery({ name: 'municipio', required: false, description: 'Código IBGE do município' })
  @ApiQuery({ name: 'cnes', required: false, description: 'Código CNES do estabelecimento' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  async searchProfissionais(
    @Query('nome') nome: string,
    @Query('municipio') municipio: string,
    @Query('cnes') cnes: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10'
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    return this.cnesService.searchProfissionaisByName(nome, municipio, cnes, p, l);
  }
  @Get('estabelecimentos')
  @ApiOperation({ summary: 'Buscar estabelecimentos por nome, município ou CNES' })
  @ApiQuery({ name: 'nome', required: false, description: 'Nome fantasia ou razão social' })
  @ApiQuery({ name: 'municipio', required: false, description: 'Código IBGE do município' })
  @ApiQuery({ name: 'cnes', required: false, description: 'Código CNES do estabelecimento' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  async searchEstabelecimentos(
    @Query('nome') nome: string,
    @Query('municipio') municipio: string,
    @Query('cnes') cnes: string,
    @Query('page') page = '1',
    @Query('limit') limit = '10'
  ) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    return this.cnesService.searchEstabelecimentos(nome, municipio, cnes, p, l);
  }
}
