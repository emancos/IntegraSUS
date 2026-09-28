import { Test, TestingModule } from '@nestjs/testing';
import { DownloaderService } from './downloader.service.js';
import { vi } from 'vitest';

describe('DownloaderService', () => {
  let instance: DownloaderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DownloaderService,
      ],
    }).compile();

    instance = module.get<DownloaderService>(DownloaderService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
