import { Test, TestingModule } from '@nestjs/testing';
import { ImporterService } from './importer.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';

describe('ImporterService', () => {
  let instance: ImporterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImporterService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<ImporterService>(ImporterService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
