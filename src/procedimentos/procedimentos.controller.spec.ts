import { Test, TestingModule } from '@nestjs/testing';
import { ProcedimentosController } from './procedimentos.controller.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('ProcedimentosController', () => {
  let instance: ProcedimentosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProcedimentosController],
      providers: [
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<ProcedimentosController>(ProcedimentosController);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
