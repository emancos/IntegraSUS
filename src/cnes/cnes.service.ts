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

  async searchProfissionaisByName(nome: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT p.documento 
      FROM tb_cnes_profissionais_json p 
    `;
    const params: any[] = [];

    if (nome) {
      query += ` WHERE p.nome_busca LIKE $1 `;
      params.push(`%${nome.toUpperCase().trim()}%`);
    }

    query += ` ORDER BY p.nome_busca ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.dataSource.query(query, params);
    
    let countQuery = `SELECT COUNT(1) as total FROM tb_cnes_profissionais_json p`;
    let countParams: any[] = [];
    if (nome) {
      countQuery += ` WHERE p.nome_busca LIKE $1`;
      countParams.push(`%${nome.toUpperCase().trim()}%`);
    }
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
