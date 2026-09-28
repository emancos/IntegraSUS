import { Test, TestingModule } from '@nestjs/testing';
import { AppService } from './app.service.js';

describe('AppService', () => {
  let instance: AppService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppService],
    }).compile();

    instance = module.get<AppService>(AppService);
  });

  it('should be defined', () => {
    expect(instance).toBeDefined();
  });
});
