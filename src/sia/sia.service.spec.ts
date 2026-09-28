import { Test, TestingModule } from '@nestjs/testing';
import { SiaService } from './sia.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('SiaService', () => {
  let instance: SiaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiaService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<SiaService>(SiaService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
