import { Test, TestingModule } from '@nestjs/testing';
import { SiaController } from './sia.controller.js';
import { vi } from 'vitest';
import { SiaService } from './sia.service.js';

describe('SiaController', () => {
  let instance: SiaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SiaController],
      providers: [
        { provide: SiaService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<SiaController>(SiaController);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
