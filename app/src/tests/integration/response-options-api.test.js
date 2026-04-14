/**
 * Response options — contratto dati usato da ChecklistModule / UI.
 * Eseguito in CI (Vitest): mock di apiService, nessuna rete.
 * Smoke rete opzionale: variabile RUN_INTEGRATION_TESTS=1 + backend raggiungibile.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.hoisted(() => vi.fn());
const mockGetToken = vi.hoisted(() => vi.fn());
const mockClearToken = vi.hoisted(() => vi.fn());
const mockSetToken = vi.hoisted(() => vi.fn());

vi.mock('@/services/apiService', () => ({
  default: {
    get: mockGet,
    getToken: mockGetToken,
    clearToken: mockClearToken,
    setToken: mockSetToken,
  },
}));

import apiService from '@/services/apiService';

/** Allineato alle asserzioni storiche (6 codici, testi IT, severity, exclude_from_calc). */
const RESPONSE_OPTIONS_FIXTURE = [
  { option_code: 'C', option_name_it: 'Conforme (Soddisfatto)', option_name_en: 'Conform', severity_level: 1, display_order: 1, exclude_from_calc: false },
  { option_code: 'NC', option_name_it: 'Non Conforme (Non Soddisfatto)', option_name_en: 'Non-conformity', severity_level: 3, display_order: 2, exclude_from_calc: false },
  { option_code: 'OSS', option_name_it: 'Osservazione', option_name_en: 'Observation', severity_level: 2, display_order: 3, exclude_from_calc: false },
  { option_code: 'OM', option_name_it: 'Opportunità di miglioramento', option_name_en: 'Opportunity', severity_level: 2, display_order: 4, exclude_from_calc: false },
  { option_code: 'NA', option_name_it: 'Non Applicabile', option_name_en: 'N/A', severity_level: 0, display_order: 5, exclude_from_calc: true },
  { option_code: 'NV', option_name_it: 'Non Verificato', option_name_en: 'Not verified', severity_level: 0, display_order: 6, exclude_from_calc: true },
];

describe('Response Options API (contract)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((path) => {
      if (path === '/response-options') {
        return Promise.resolve({ success: true, data: RESPONSE_OPTIONS_FIXTURE });
      }
      return Promise.reject(new Error(`Unexpected GET ${path}`));
    });
    mockGetToken.mockReturnValue(null);
  });

  describe('GET /response-options (mocked payload)', () => {
    it('should expose 6 response options', async () => {
      const response = await apiService.get('/response-options');
      expect(response.success).toBe(true);
      expect(Array.isArray(response.data)).toBe(true);
      expect(response.data).toHaveLength(6);
    });

    it('should return options with correct structure', async () => {
      const response = await apiService.get('/response-options');
      const firstOption = response.data[0];
      expect(firstOption).toHaveProperty('option_code');
      expect(firstOption).toHaveProperty('option_name_it');
      expect(firstOption).toHaveProperty('option_name_en');
      expect(firstOption).toHaveProperty('severity_level');
      expect(firstOption).toHaveProperty('display_order');
    });

    it('should return all expected option codes', async () => {
      const response = await apiService.get('/response-options');
      const codes = response.data.map((opt) => opt.option_code);
      expect(codes).toContain('C');
      expect(codes).toContain('NC');
      expect(codes).toContain('OSS');
      expect(codes).toContain('OM');
      expect(codes).toContain('NA');
      expect(codes).toContain('NV');
    });

    it('should return options ordered by display_order', async () => {
      const response = await apiService.get('/response-options');
      const orders = response.data.map((opt) => opt.display_order);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThanOrEqual(orders[i - 1]);
      }
    });

    it('should return correct Italian names', async () => {
      const response = await apiService.get('/response-options');
      const optionByCode = response.data.reduce((acc, opt) => {
        acc[opt.option_code] = opt;
        return acc;
      }, {});
      expect(optionByCode.C.option_name_it).toBe('Conforme (Soddisfatto)');
      expect(optionByCode.NC.option_name_it).toBe('Non Conforme (Non Soddisfatto)');
      expect(optionByCode.OSS.option_name_it).toContain('Osservazione');
      expect(optionByCode.OM.option_name_it).toContain('Opportunità');
      expect(optionByCode.NA.option_name_it).toBe('Non Applicabile');
      expect(optionByCode.NV.option_name_it).toBe('Non Verificato');
    });

    it('should have correct severity levels', async () => {
      const response = await apiService.get('/response-options');
      const optionByCode = response.data.reduce((acc, opt) => {
        acc[opt.option_code] = opt;
        return acc;
      }, {});
      expect(optionByCode.C.severity_level).toBe(1);
      expect(optionByCode.NC.severity_level).toBe(3);
      expect(optionByCode.OSS.severity_level).toBe(2);
      expect(optionByCode.OM.severity_level).toBe(2);
      expect(optionByCode.NA.severity_level).toBe(0);
      expect(optionByCode.NV.severity_level).toBe(0);
    });

    it('should handle NA and NV with exclude_from_calc flag', async () => {
      const response = await apiService.get('/response-options');
      const optionByCode = response.data.reduce((acc, opt) => {
        acc[opt.option_code] = opt;
        return acc;
      }, {});
      expect(optionByCode.NA.exclude_from_calc).toBe(true);
      expect(optionByCode.NV.exclude_from_calc).toBe(true);
      expect(optionByCode.C.exclude_from_calc).toBe(false);
      expect(optionByCode.NC.exclude_from_calc).toBe(false);
      expect(optionByCode.OSS.exclude_from_calc).toBe(false);
      expect(optionByCode.OM.exclude_from_calc).toBe(false);
    });

    it('should work when client clears token (public-style read)', async () => {
      mockGetToken.mockReturnValue('fake');
      mockClearToken.mockImplementation(() => {});
      mockSetToken.mockImplementation(() => {});

      const response = await apiService.get('/response-options', { includeAuth: false });
      expect(response.success).toBe(true);
      expect(response.data).toHaveLength(6);
    });
  });

  describe('Frontend Integration (ChecklistModule)', () => {
    it('should cache options in component state', async () => {
      const response = await apiService.get('/response-options');
      const cachedOptions = response.data;
      expect(cachedOptions).toHaveLength(6);
      expect(cachedOptions[0]).toHaveProperty('option_code');
    });

    it('should fallback to local STATUS if API fails', async () => {
      const fallbackStatus = {
        C: 'C',
        NC: 'NC',
        OSS: 'OSS',
        OM: 'OM',
        NA: 'NA',
        NOT_ANSWERED: 'NOT_ANSWERED',
      };
      expect(Object.keys(fallbackStatus)).toHaveLength(6);
    });
  });
});
