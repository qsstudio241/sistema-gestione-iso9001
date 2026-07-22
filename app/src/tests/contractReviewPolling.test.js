/**
 * Test SLICE A — Polling UI "in analisi…"
 *
 * Testa la logica di polling estratta come funzione pura:
 *  1. si ferma quando status === 'done'
 *  2. si ferma quando status === 'error'
 *  3. non supera il massimo di tentativi
 *  4. viene pulito correttamente (cleanup / stop())
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Logica di polling: replica esatta del useEffect in ContractReviewPage.
 * Accetta una funzione `fetchStatus` (mockabile in test) al posto di apiService.
 */
function startPolling({ fetchStatus, onDone, onError, onMaxAttempts, maxAttempts = 10, intervalMs = 3000 }) {
  let attempts = 0;
  let stopped = false;
  let timerId = null;

  function schedule() {
    if (stopped || attempts >= maxAttempts) {
      onMaxAttempts?.();
      return;
    }
    timerId = setTimeout(async () => {
      if (stopped) return;
      try {
        const data = await fetchStatus();
        if (data.status !== 'processing') {
          stopped = true;
          if (data.status === 'done') onDone?.(data);
          else onError?.(data);
        } else {
          attempts++;
          schedule();
        }
      } catch {
        attempts++;
        schedule();
      }
    }, intervalMs);
  }

  schedule();

  return function stop() {
    stopped = true;
    if (timerId) clearTimeout(timerId);
  };
}

describe('Polling auto-estrazione AI (SLICE A)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('si ferma e chiama onDone quando status è "done" al primo tentativo', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ status: 'done', requirements: [] });
    const onDone = vi.fn();
    const onError = vi.fn();

    startPolling({ fetchStatus, onDone, onError, intervalMs: 3000 });

    await vi.advanceTimersByTimeAsync(3001);

    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith({ status: 'done', requirements: [] });
    expect(onError).not.toHaveBeenCalled();
  });

  it('si ferma e chiama onError quando status è "error"', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ status: 'error', error_message: 'timeout AI' });
    const onDone = vi.fn();
    const onError = vi.fn();

    startPolling({ fetchStatus, onDone, onError, intervalMs: 3000 });

    await vi.advanceTimersByTimeAsync(3001);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('continua se status è "processing" e si ferma al limite massimo tentativi', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ status: 'processing' });
    const onMaxAttempts = vi.fn();

    startPolling({ fetchStatus, onMaxAttempts, maxAttempts: 3, intervalMs: 100 });

    await vi.advanceTimersByTimeAsync(500);

    expect(fetchStatus).toHaveBeenCalledTimes(3);
    expect(onMaxAttempts).toHaveBeenCalledTimes(1);
  });

  it('si ferma al 2° tentativo se prima "processing" poi "done"', async () => {
    const fetchStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'done', requirements: [{ id: 1 }] });
    const onDone = vi.fn();

    startPolling({ fetchStatus, onDone, intervalMs: 3000 });

    await vi.advanceTimersByTimeAsync(6001);

    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledOnce();
    expect(onDone.mock.calls[0][0]).toMatchObject({ status: 'done' });
  });

  it('stop() cancella il timer e impedisce ulteriori chiamate (cleanup unmount)', async () => {
    const fetchStatus = vi.fn().mockResolvedValue({ status: 'processing' });
    const onDone = vi.fn();

    const stop = startPolling({ fetchStatus, onDone, intervalMs: 3000 });

    // Ferma prima che il timer scatti
    stop();

    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchStatus).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('gestisce eccezioni di rete e riprova (fino al massimo)', async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new Error('Network error'));
    const onMaxAttempts = vi.fn();

    startPolling({ fetchStatus, onMaxAttempts, maxAttempts: 2, intervalMs: 100 });

    await vi.advanceTimersByTimeAsync(500);

    expect(fetchStatus).toHaveBeenCalledTimes(2);
    expect(onMaxAttempts).toHaveBeenCalledTimes(1);
  });
});
