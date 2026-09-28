import { Test, TestingModule } from '@nestjs/testing';
import { SiaImporterService } from './sia-importer.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('SiaImporterService', () => {
  let instance: SiaImporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SiaImporterService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<SiaImporterService>(SiaImporterService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
