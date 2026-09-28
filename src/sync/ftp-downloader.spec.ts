import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getLatestFtpFile } from './ftp-downloader.js';
import * as ftp from 'basic-ftp';

// Mock the basic-ftp Client
vi.mock('basic-ftp', () => {
  const Client = vi.fn();
  Client.prototype.access = vi.fn().mockResolvedValue(undefined);
  Client.prototype.list = vi.fn().mockResolvedValue([
    { name: 'BASE_DE_DADOS_CNES_202607.ZIP', type: 1 },
    { name: 'BASE_DE_DADOS_CNES_202608.ZIP', type: 1 },
    { name: 'BASE_DE_DADOS_CNES_202601.ZIP', type: 1 },
    { name: 'other_file.txt', type: 1 }
  ]);
  Client.prototype.close = vi.fn();
  return { Client };
});

describe('ftp-downloader utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLatestFtpFile', () => {
    it('should return the file with the highest competence based on regex', async () => {
      const result = await getLatestFtpFile('ftp.datasus.gov.br', 'cnes', /^BASE_DE_DADOS_CNES_(\d{6})\.ZIP$/i);
      expect(result).not.toBeNull();
      expect(result?.filename).toBe('BASE_DE_DADOS_CNES_202608.ZIP');
      expect(result?.competence).toBe('202608');
    });

    it('should return null if no matching files are found', async () => {
      const result = await getLatestFtpFile('ftp.datasus.gov.br', 'cnes', /^NO_MATCH_(\d{6})\.ZIP$/i);
      expect(result).toBeNull();
    });
  });
});
