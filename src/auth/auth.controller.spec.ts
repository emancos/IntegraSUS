import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { vi } from 'vitest';
import { AuthService } from './auth.service.js';

describe('AuthController', () => {
  let instance: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
