import { describe, it, expect, vi } from 'vitest';
import { createChecklistSaveScheduler, isRetryableSaveError, retryDelayMs } from './checklistSaveScheduler';

function fakeClock() {
  let now = 0;
  const timers = [];
  return {
    now: () => now,
    setTimer(fn, ms) {
      const id = { fn, at: now + ms, cancelled: false };
      timers.push(id);
      return id;
    },
    clearTimer(id) {
      if (id) id.cancelled = true;
    },
    async advance(ms) {
      now += ms;
      const due = timers.filter((t) => !t.cancelled && t.at <= now);
      due.forEach((t) => { t.cancelled = true; });
      for (const t of due) {
        await t.fn();
      }
    },
  };
}

describe('checklistSaveScheduler', () => {
  it('non invia nulla senza una modifica', async () => {
    const send = vi.fn();
    const clock = fakeClock();
    createChecklistSaveScheduler({ send, setTimer: clock.setTimer, clearTimer: clock.clearTimer });
    await clock.advance(5000);
    expect(send).not.toHaveBeenCalled();
  });

  it('accoda una sola richiesta per domanda dopo il debounce', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    sched.schedule('q1', { n: 2 });
    sched.schedule('q1', { n: 3 });
    await clock.advance(999);
    expect(send).not.toHaveBeenCalled();
    await clock.advance(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({ n: 3 });
    expect(sched.snapshot().phase).toBe('saved');
  });

  it('tiene una sola richiesta in volo e poi manda l ultima versione', async () => {
    let release;
    const send = vi.fn(() => new Promise((resolve) => { release = resolve; }));
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    await clock.advance(1000);
    expect(send).toHaveBeenCalledTimes(1);
    sched.schedule('q1', { n: 2 });
    sched.schedule('q1', { n: 3 });
    expect(send).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    await clock.advance(0);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0]).toEqual({ n: 3 });
  });

  it('su 429 rispetta Retry-After e non usa il backoff al posto dell header', async () => {
    const send = vi.fn()
      .mockRejectedValueOnce({ status: 429, data: { retryAfterMs: 2500 } })
      .mockResolvedValueOnce(undefined);
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    await clock.advance(1000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(sched.snapshot().phase).toBe('retrying');
    await clock.advance(2499);
    expect(send).toHaveBeenCalledTimes(1);
    await clock.advance(1);
    expect(send).toHaveBeenCalledTimes(2);
    expect(sched.snapshot().phase).toBe('saved');
  });

  it('più domande pronte insieme partono in serie, non in parallelo', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sendMany = vi.fn().mockResolvedValue(undefined);
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      sendMany,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    sched.schedule('q2', { n: 2 });
    await clock.advance(1000);
    expect(send).not.toHaveBeenCalled();
    const flat = sendMany.mock.calls.flatMap((call) => call[0]);
    expect(flat).toEqual([{ n: 1 }, { n: 2 }]);
    expect(sched.snapshot().phase).toBe('saved');
  });

  it('al refresh manda tutte le domande ancora aperte in un solo invio', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const sendMany = vi.fn().mockResolvedValue(undefined);
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      sendMany,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    sched.schedule('q2', { n: 2 });
    sched.schedule('q3', { n: 3 });
    await sched.flushAllNow({ keepalive: true });
    expect(send).not.toHaveBeenCalled();
    expect(sendMany).toHaveBeenCalledTimes(1);
    expect(sendMany.mock.calls[0][0]).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);
    expect(sendMany.mock.calls[0][1]).toEqual({ keepalive: true });
    expect(sched.snapshot().phase).toBe('saved');
    expect(sched.snapshot().saved).toBe(3);
  });

  it('al refresh invia subito la modifica ancora in attesa', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const clock = fakeClock();
    const sched = createChecklistSaveScheduler({
      debounceMs: 1000,
      send,
      setTimer: clock.setTimer,
      clearTimer: clock.clearTimer,
    });
    sched.schedule('q1', { n: 1 });
    expect(send).not.toHaveBeenCalled();
    await sched.flushAllNow({ keepalive: true });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toEqual({ n: 1 });
    expect(send.mock.calls[0][1]).toEqual({ keepalive: true });
    expect(sched.snapshot().phase).toBe('saved');
  });

  it('un errore di salvataggio eventi si può riprovare', () => {
    expect(isRetryableSaveError({ status: 500, code: 'EVENTS_SAVE_ERROR' })).toBe(true);
    expect(isRetryableSaveError({ status: 500, code: 'API_ERROR' })).toBe(false);
  });

  it('senza Retry-After il ritardo raddoppia', () => {
    expect(retryDelayMs({ status: 0 }, 1)).toBe(1000);
    expect(retryDelayMs({ code: 'NETWORK_ERROR' }, 2)).toBe(2000);
    expect(retryDelayMs({ code: 'TIMEOUT' }, 3)).toBe(4000);
  });
});
