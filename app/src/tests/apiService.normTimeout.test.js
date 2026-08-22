/**
 * L1 — timeout lungo solo su ingest/upload batch norme (IA-17).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiService, {
  NORM_BATCH_REQUEST_TIMEOUT_MS,
  NORM_BATCH_TIMEOUT_MESSAGE,
} from '../services/apiService';

describe('apiService timeout ingest/upload norme', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('costante almeno 10 minuti, sotto i 20 (non alza il default GET)', () => {
    expect(NORM_BATCH_REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10 * 60 * 1000);
    expect(NORM_BATCH_REQUEST_TIMEOUT_MS).toBeLessThanOrEqual(20 * 60 * 1000);
    expect(apiService.timeout).toBeLessThan(60 * 1000);
  });

  it('ingestNormsFromFolder passa timeout e messaggio dedicati', async () => {
    const postSpy = vi.spyOn(apiService, 'post').mockResolvedValue({ data: { results: [] } });
    await apiService.ingestNormsFromFolder(42);
    expect(postSpy).toHaveBeenCalledWith(
      '/documents/norms/ingest-from-folder',
      { folder_id: 42 },
      expect.objectContaining({
        timeout: NORM_BATCH_REQUEST_TIMEOUT_MS,
        timeoutMessage: NORM_BATCH_TIMEOUT_MESSAGE,
      }),
    );
  });

  it('messaggio timeout è italiano e non «Richiesta timeout»', () => {
    expect(NORM_BATCH_TIMEOUT_MESSAGE).toMatch(/elaborazione delle norme/i);
    expect(NORM_BATCH_TIMEOUT_MESSAGE).not.toBe('Richiesta timeout');
    expect(NORM_BATCH_TIMEOUT_MESSAGE).toMatch(/è/);
  });
});
