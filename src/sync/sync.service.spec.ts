import { Test, TestingModule } from '@nestjs/testing';
import { SyncService } from './sync.service.js';
import { vi } from 'vitest';
import { DownloaderService } from '../downloader/downloader.service.js';
import { ParserService } from '../parser/parser.service.js';
import { ImporterService } from '../importer/importer.service.js';
import { CnesImporterService } from '../cnes/cnes-importer.service.js';
import { SiaImporterService } from '../sia/sia-importer.service.js';
import { SchedulerRegistry } from '@nestjs/schedule';

describe('SyncService', () => {
  let instance: SyncService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SyncService,
        { provide: DownloaderService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: ParserService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: ImporterService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: CnesImporterService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: SiaImporterService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: SchedulerRegistry, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<SyncService>(SyncService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
