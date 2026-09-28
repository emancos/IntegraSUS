import { Test, TestingModule } from '@nestjs/testing';
import { CnesService } from './cnes.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('CnesService', () => {
  let instance: CnesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CnesService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<CnesService>(CnesService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
