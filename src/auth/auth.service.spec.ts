import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service.js';
import { vi } from 'vitest';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let instance: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: DataSource, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
        { provide: JwtService, useValue: { query: vi.fn(), runSync: vi.fn(), getConfig: vi.fn(), sign: vi.fn() } },
      ],
    }).compile();

    instance = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
