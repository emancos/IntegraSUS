import { Test, TestingModule } from '@nestjs/testing';
import { ParserService } from './parser.service.js';
import { vi } from 'vitest';

describe('ParserService', () => {
  let instance: ParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParserService,
      ],
    }).compile();

    instance = module.get<ParserService>(ParserService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
