import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SiaService {
  constructor(private dataSource: DataSource) {}

  async searchCids(search: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    let query = `
      SELECT codigo, descricao 
      FROM tb_sia_cids 
    `;
    const params: any[] = [];

    if (search) {
      query += ` WHERE codigo ILIKE $1 OR descricao ILIKE $1 `;
      params.push(`%${search.trim()}%`);
    }

    query += ` ORDER BY codigo ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await this.dataSource.query(query, params);
    
    let countQuery = `SELECT COUNT(1) as total FROM tb_sia_cids`;
    let countParams: any[] = [];
    if (search) {
      countQuery += ` WHERE codigo ILIKE $1 OR descricao ILIKE $1`;
      countParams.push(`%${search.trim()}%`);
    }
    const countRows = await this.dataSource.query(countQuery, countParams);
    const total = parseInt(countRows[0].total, 10);

    return {
      data: rows,
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    };
  }
}
