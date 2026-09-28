import { Test, TestingModule } from '@nestjs/testing';
import { SyncController, SyncConfigDto } from './sync.controller.js';
import { SyncService } from './sync.service.js';

describe('SyncController', () => {
  let controller: SyncController;
  let service: SyncService;

  const mockSyncConfig: SyncConfigDto = {
    cnes_competence: '202608',
    sia_competence: '202609a',
    cron_expression: '0 2 * * 0',
    auto_sync_enabled: true
  };

  const mockSyncService = {
    runSync: vi.fn(),
    getConfig: vi.fn().mockReturnValue(mockSyncConfig),
    updateConfig: vi.fn().mockImplementation((config) => ({ ...mockSyncConfig, ...config }))
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        {
          provide: SyncService,
          useValue: mockSyncService
        }
      ],
    }).compile();

    controller = module.get<SyncController>(SyncController);
    service = module.get<SyncService>(SyncService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('triggerSync', () => {
    it('should call runSync and return a success message', () => {
      const result = controller.triggerSync();
      expect(service.runSync).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Sync process started in the background.' });
    });
  });

  describe('getConfig', () => {
    it('should return the current configuration', () => {
      const result = controller.getConfig();
      expect(service.getConfig).toHaveBeenCalled();
      expect(result).toEqual(mockSyncConfig);
    });
  });

  describe('updateConfig', () => {
    it('should update configuration and return the new config', () => {
      const updateData: SyncConfigDto = { auto_sync_enabled: false };
      const result = controller.updateConfig(updateData);
      
      expect(service.updateConfig).toHaveBeenCalledWith(updateData);
      expect(result.message).toBe('Configuration updated successfully.');
      expect(result.config.auto_sync_enabled).toBe(false);
    });
  });
});
