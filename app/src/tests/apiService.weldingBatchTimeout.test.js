/**
 * L1 — timeout lungo sull'ingest batch WPS/WPQR (PDF firmati + OCR/AI).
 */
import { describe, it, expect } from 'vitest';
import apiService, {
  WELDING_BATCH_REQUEST_TIMEOUT_MS,
  WELDING_BATCH_TIMEOUT_MESSAGE,
} from '../services/apiService';

describe('apiService timeout ingest batch WPS/WPQR', () => {
  it('costante almeno 10 minuti, sotto i 20 (non alza il default GET)', () => {
    expect(WELDING_BATCH_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
    expect(WELDING_BATCH_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(20 * 60 * 1000);
    expect(apiService.timeout).toBeLessThan(60 * 1000);
  });

  it('messaggio timeout è italiano e non «Failed to fetch»', () => {
    expect(WELDING_BATCH_TIMEOUT_MESSAGE).toMatch(/estrazione WPS\/WPQR/i);
    expect(WELDING_BATCH_TIMEOUT_MESSAGE).toMatch(/è/);
    expect(WELDING_BATCH_TIMEOUT_MESSAGE).not.toMatch(/Failed to fetch/i);
    expect(WELDING_BATCH_TIMEOUT_MESSAGE).not.toMatch(/180s/);
  });
});
