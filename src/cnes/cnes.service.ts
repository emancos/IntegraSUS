import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class CnesService {
  constructor(private dataSource: DataSource) {}

  async findProfissionalByCpf(cpf: string) {
    const query = `
      SELECT p.documento 
      FROM tb_cnes_profissionais_json p 
      WHERE p.cpf = $1
    `;
    const rows = await this.dataSource.query(query, [cpf]);
    if (rows.length === 0) {
      throw new NotFoundException('Profissional não encontrado para o CPF informado');
    }
    return rows[0].documento;
  }

  async findProfissionalByCns(cns: string) {
    const query = `
      SELECT p.documento 
      FROM tb_cnes_profissionais_json p 
      WHERE p.cns = $1
    `;
    const rows = await this.dataSource.query(query, [cns]);
    if (rows.length === 0) {
      throw new NotFoundException('Profissional não encontrado para o CNS informado');
    }
    return rows[0].documento;
  }

  async searchProfissionaisByName(nome: string, municipio: string, cnes: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT p.documento 
      FROM tb_cnes_profissionais_json p 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    let countQuery = `SELECT COUNT(1) as total FROM tb_cnes_profissionais_json p WHERE 1=1`;
    const countParams: any[] = [];

    if (nome) {
      params.push(`%${nome.toUpperCase().trim()}%`);
      countParams.push(`%${nome.toUpperCase().trim()}%`);
      query += ` AND p.nome_busca LIKE $${params.length} `;
      countQuery += ` AND p.nome_busca LIKE $${countParams.length} `;
    }

    if (municipio) {
      params.push(`[{"municipio": {"codigo": "${municipio.trim()}"}}]`);
      countParams.push(`[{"municipio": {"codigo": "${municipio.trim()}"}}]`);
      query += ` AND p.documento->'unidades' @> $${params.length}::jsonb `;
      countQuery += ` AND p.documento->'unidades' @> $${countParams.length}::jsonb `;
    }

    if (cnes) {
      params.push(`[{"codigo": "${cnes.trim()}"}]`);
      countParams.push(`[{"codigo": "${cnes.trim()}"}]`);
      query += ` AND p.documento->'unidades' @> $${params.length}::jsonb `;
      countQuery += ` AND p.documento->'unidades' @> $${countParams.length}::jsonb `;
    }

    query += ` ORDER BY p.nome_busca ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.dataSource.query(query, params);
    const countRows = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countRows[0].total, 10);

    return {
      data: rows.map((r: any) => r.documento),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };
  }

  async searchEstabelecimentos(nome: string, municipio: string, cnes: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT e.documento 
      FROM tb_cnes_estabelecimentos_json e 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    let countQuery = `SELECT COUNT(1) as total FROM tb_cnes_estabelecimentos_json e WHERE 1=1`;
    const countParams: any[] = [];

    if (nome) {
      params.push(`%${nome.toUpperCase().trim()}%`);
      countParams.push(`%${nome.toUpperCase().trim()}%`);
      query += ` AND e.nome_busca LIKE $${params.length} `;
      countQuery += ` AND e.nome_busca LIKE $${countParams.length} `;
    }

    if (municipio) {
      params.push(municipio.trim());
      countParams.push(municipio.trim());
      query += ` AND e.documento->>'coMunicipioIbge' = $${params.length} `;
      countQuery += ` AND e.documento->>'coMunicipioIbge' = $${countParams.length} `;
    }

    if (cnes) {
      params.push(cnes.trim());
      countParams.push(cnes.trim());
      query += ` AND e.co_cnes = $${params.length} `;
      countQuery += ` AND e.co_cnes = $${countParams.length} `;
    }

    query += ` ORDER BY e.nome_busca ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.dataSource.query(query, params);
    const countRows = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countRows[0].total, 10);

    return {
      data: rows.map((r: any) => r.documento),
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };
  }
}
