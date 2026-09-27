import { Controller, Get, Param, Query, NotFoundException, UseGuards } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery, ApiParam } from '@nestjs/swagger';

@ApiTags('procedimentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procedimentos')
export class ProcedimentosController {
  constructor(private dataSource: DataSource) {}

  @Get()
  @ApiOperation({ summary: 'Listar procedimentos (com paginação e busca por nome)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  @ApiQuery({ name: 'search', required: false, description: 'Busca textual pelo nome do procedimento' })
  async getProcedimentos(@Query('page') page = '1', @Query('limit') limit = '10', @Query('search') search?: string) {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const offset = (p - 1) * l;
    
    // Verifica se a tabela já existe (caso o sync nunca tenha rodado)
    const checkTable = await this.dataSource.query(`SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tb_procedimento_json')`);
    if (!checkTable[0].exists) {
        return { data: [], message: 'Tabela tb_procedimento_json não existe. Por favor, aguarde o Sync ou rode /sync/trigger.' };
    }

    let query, countQuery, rows, countRes;

    if (search) {
        query = `SELECT documento FROM tb_procedimento_json WHERE nome ILIKE $1 LIMIT $2 OFFSET $3`;
        rows = await this.dataSource.query(query, [`%${search}%`, l, offset]);
        
        countQuery = `SELECT COUNT(*) FROM tb_procedimento_json WHERE nome ILIKE $1`;
        countRes = await this.dataSource.query(countQuery, [`%${search}%`]);
    } else {
        query = `SELECT documento FROM tb_procedimento_json LIMIT $1 OFFSET $2`;
        rows = await this.dataSource.query(query, [l, offset]);
        
        countQuery = `SELECT COUNT(*) FROM tb_procedimento_json`;
        countRes = await this.dataSource.query(countQuery);
    }
    
    // Remove "valores" da listagem para manter leve
    const formattedData = rows.map((r: any) => {
        const doc = r.documento;
        if (doc && doc.valores) delete doc.valores;
        return doc;
    });
    return { data: formattedData, meta: { total: parseInt(countRes[0].count, 10), page: p, limit: l } };
  }

  @Get('cid/:cid')
  @ApiOperation({ summary: 'Listar procedimentos filtrados por CID' })
  @ApiParam({ name: 'cid', description: 'Código CID (ex: A00)' })
  @ApiQuery({ name: 'page', required: false, description: 'Número da página (padrão: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Itens por página (padrão: 10)' })
  async getProcedimentosPorCid(@Param('cid') cid: string, @Query('page') page = '1', @Query('limit') limit = '10') {
    const p = parseInt(page, 10) || 1;
    const l = parseInt(limit, 10) || 10;
    const offset = (p - 1) * l;
    
    const query = `
      SELECT j.documento 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_cid r ON j.codigo = r."CO_PROCEDIMENTO"
      WHERE r."CO_CID" = $1
      LIMIT $2 OFFSET $3
    `;
    const rows = await this.dataSource.query(query, [cid, l, offset]);
    
    const countQuery = `
      SELECT COUNT(*) 
      FROM tb_procedimento_json j
      INNER JOIN rl_procedimento_cid r ON j.codigo = r."CO_PROCEDIMENTO"
      WHERE r."CO_CID" = $1
    `;
    const countRes = await this.dataSource.query(countQuery, [cid]);
    
    const formattedData = rows.map((r: any) => {
        const doc = r.documento;
        if (doc && doc.valores) delete doc.valores;
        return doc;
    });
    return { data: formattedData, meta: { total: parseInt(countRes[0].count, 10), page: p, limit: l } };
  }

  @Get(':codigo')
  @ApiOperation({ summary: 'Obter detalhamento completo de um procedimento' })
  @ApiParam({ name: 'codigo', description: 'Código SIGTAP de 10 dígitos' })
  async getProcedimento(@Param('codigo') codigo: string) {
    const query = `SELECT documento FROM tb_procedimento_json WHERE codigo = $1`;
    const rows = await this.dataSource.query(query, [codigo]);
    if (!rows || rows.length === 0) {
        throw new NotFoundException(`Procedimento ${codigo} não encontrado`);
    }
    
    return rows[0].documento;
  }
}