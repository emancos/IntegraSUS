import { Test, TestingModule } from '@nestjs/testing';
import { CnesImporterService } from './cnes-importer.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('CnesImporterService', () => {
  let instance: CnesImporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CnesImporterService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<CnesImporterService>(CnesImporterService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
