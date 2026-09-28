import { Test, TestingModule } from '@nestjs/testing';
import { CnesController } from './cnes.controller.js';
import { vi } from 'vitest';
import { CnesService } from './cnes.service.js';

describe('CnesController', () => {
  let instance: CnesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CnesController],
      providers: [
        { provide: CnesService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<CnesController>(CnesController);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
