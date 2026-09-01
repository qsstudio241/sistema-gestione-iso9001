/**
 * VC-3 — polling multi-job + reload Report studio.
 */
import { describe, it, expect } from 'vitest';
import {
  collectPollingExtractionIds,
  resolveAnalysisPollTick,
} from '../utils/analysisJobPolling';

describe('collectPollingExtractionIds', () => {
  it('raccoglie tutti gli extraction_id (non solo il primo)', () => {
    expect(collectPollingExtractionIds([
      { extraction_id: 10, status: 'processing' },
      { extraction_id: 20, status: 'processing' },
      { extraction_id: null },
      { status: 'done' },
    ])).toEqual([10, 20]);
  });

  it('lista vuota / null → []', () => {
    expect(collectPollingExtractionIds(null)).toEqual([]);
    expect(collectPollingExtractionIds([])).toEqual([]);
  });
});

describe('resolveAnalysisPollTick (multi-job)', () => {
  it('tutti processing → continua senza bump', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: 'processing' },
      { id: 2, status: 'processing' },
    ]);
    expect(tick.remainingIds).toEqual([1, 2]);
    expect(tick.newlyDoneCount).toBe(0);
    expect(tick.allTerminal).toBe(false);
    expect(tick.banner).toBeNull();
  });

  it('un job done e uno processing → bump + resta il processing', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: 'done' },
      { id: 2, status: 'processing' },
    ]);
    expect(tick.remainingIds).toEqual([2]);
    expect(tick.newlyDoneCount).toBe(1);
    expect(tick.anyDone).toBe(true);
    expect(tick.allTerminal).toBe(false);
    expect(tick.banner).toBeNull();
  });

  it('tutti done → stop + banner done + bump per ciascun job', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: 'done' },
      { id: 2, status: 'done' },
    ]);
    expect(tick.remainingIds).toEqual([]);
    expect(tick.newlyDoneCount).toBe(2);
    expect(tick.allTerminal).toBe(true);
    expect(tick.banner).toBe('done');
  });

  it('errore + done → stop con banner done (priorità done)', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: 'error' },
      { id: 2, status: 'done' },
    ]);
    expect(tick.allTerminal).toBe(true);
    expect(tick.banner).toBe('done');
    expect(tick.newlyDoneCount).toBe(1);
  });

  it('solo error → banner error senza bump', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: 'error' },
    ]);
    expect(tick.newlyDoneCount).toBe(0);
    expect(tick.banner).toBe('error');
    expect(tick.allTerminal).toBe(true);
  });

  it('networkError mantiene il job in coda', () => {
    const tick = resolveAnalysisPollTick([
      { id: 1, status: null, networkError: true },
      { id: 2, status: 'done' },
    ]);
    expect(tick.remainingIds).toEqual([1]);
    expect(tick.newlyDoneCount).toBe(1);
    expect(tick.allTerminal).toBe(false);
  });
});
