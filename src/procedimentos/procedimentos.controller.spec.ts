import { Test, TestingModule } from '@nestjs/testing';
import { ProcedimentosController } from './procedimentos.controller.js';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { DataSource } from 'typeorm';

describe('ProcedimentosController', () => {
  let instance: ProcedimentosController;
  let dataSourceMock: any;

  beforeEach(async () => {
    dataSourceMock = {
      query: vi.fn(),
      runSync: vi.fn(),
      getConfig: vi.fn(),
      sign: vi.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcedimentosController],
      providers: [
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    instance = module.get<ProcedimentosController>(ProcedimentosController);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });

  it('should return message if tb_procedimento_json does not exist', async () => {
    dataSourceMock.query.mockResolvedValueOnce([]); // no tables found

    const res = await instance.getProcedimentos('1', '10');
    expect(res).toEqual({
      data: [],
      meta: { total: 0, page: 1, limit: 10 },
      message: 'Tabela tb_procedimento_json não existe. Por favor, aguarde o Sync ou rode /sync/trigger.'
    });
  });

  it('should list procedimentos without search', async () => {
    // 1. check tables
    dataSourceMock.query.mockResolvedValueOnce([{ table_name: 'tb_procedimento_json' }]);
    // 2. data query
    dataSourceMock.query.mockResolvedValueOnce([
      { documento: { codigo: '0301010072', nome: 'CONSULTA MEDICA EM ATENCAO ESPECIALIZADA', valores: { total: 10 } } }
    ]);
    // 3. count query
    dataSourceMock.query.mockResolvedValueOnce([{ count: '1' }]);

    const res = await instance.getProcedimentos('1', '10');
    expect(res.meta).toEqual({ total: 1, page: 1, limit: 10 });
    expect(res.data[0].codigo).toBe('0301010072');
    expect(res.data[0].valores).toBeUndefined(); // stripped for listing
  });

  it('should return dynamic specialized consultation name when searching by "CONSULTA EM ANGIOLOGIA"', async () => {
    // 1. check tables (has all tables)
    dataSourceMock.query.mockResolvedValueOnce([
      { table_name: 'tb_procedimento_json' },
      { table_name: 'rl_procedimento_ocupacao' },
      { table_name: 'tb_ocupacao' }
    ]);

    // 2. data query (returns row with cbo_codigo and cbo_nome)
    dataSourceMock.query.mockResolvedValueOnce([
      {
        codigo: '0301010072',
        cbo_codigo: '225115',
        cbo_nome: 'Médico angiologista',
        documento: {
          codigo: '0301010072',
          nome: 'CONSULTA MEDICA EM ATENCAO ESPECIALIZADA'
        }
      }
    ]);

    // 3. count query
    dataSourceMock.query.mockResolvedValueOnce([{ count: '1' }]);

    const res = await instance.getProcedimentos('1', '10', 'CONSULTA EM ANGIOLOGIA');
    expect(res.meta.total).toBe(1);
    expect(res.data[0].codigo).toBe('0301010072');
    expect(res.data[0].nome).toBe('CONSULTA EM ANGIOLOGIA');
    expect(res.data[0].nome_especifico).toBe('CONSULTA EM ANGIOLOGIA');
    expect(res.data[0].nome_original).toBe('CONSULTA MEDICA EM ATENCAO ESPECIALIZADA');
    expect(res.data[0].cbo_especifico).toEqual({
      codigo: '225115',
      nome: 'Médico angiologista',
      especialidade: 'ANGIOLOGIA'
    });
  });

  it('should format consultation in getProcedimentosPorCbo for 0301010072', async () => {
    dataSourceMock.query.mockResolvedValueOnce([
      {
        cbo_nome: 'Médico angiologista',
        documento: {
          codigo: '0301010072',
          nome: 'CONSULTA MEDICA EM ATENCAO ESPECIALIZADA'
        }
      }
    ]);
    dataSourceMock.query.mockResolvedValueOnce([{ count: '1' }]);

    const res = await instance.getProcedimentosPorCbo('225115', 'consulta', '1', '10');
    expect(res.meta.total).toBe(1);
    expect(res.data[0].nome).toBe('CONSULTA EM ANGIOLOGIA');
    expect(res.data[0].nome_especifico).toBe('CONSULTA EM ANGIOLOGIA');
    expect(res.data[0].cbo_especifico?.codigo).toBe('225115');
  });

  it('should preserve original name for non-specialized procedures in getProcedimentosPorCbo', async () => {
    dataSourceMock.query.mockResolvedValueOnce([
      {
        cbo_nome: 'Médico angiologista',
        documento: {
          codigo: '0301010137',
          nome: 'CONSULTA/ATENDIMENTO DOMICILIAR NA ATENCAO ESPECIALIZADA'
        }
      }
    ]);
    dataSourceMock.query.mockResolvedValueOnce([{ count: '1' }]);

    const res = await instance.getProcedimentosPorCbo('225115', 'consulta', '1', '10');
    expect(res.data[0].codigo).toBe('0301010137');
    expect(res.data[0].nome).toBe('CONSULTA/ATENDIMENTO DOMICILIAR NA ATENCAO ESPECIALIZADA');
    expect(res.data[0].nome_especifico).toBeUndefined();
  });
});
