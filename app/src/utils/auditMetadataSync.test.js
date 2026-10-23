import { describe, expect, it, vi } from 'vitest';
import {
  auditMetadataSyncSignature,
  createMetadataSyncScheduler,
} from './auditMetadataSync';

function audit(outcomeText) {
  return {
    metadata: {
      auditNumber: 'AUD-1',
      clientName: 'Prova',
      auditOutcome: { conclusions: outcomeText, emergingFindings: { totalNC: 1 } },
      lastModified: new Date().toISOString(),
    },
  };
}

describe('auditMetadataSyncSignature', () => {
  it('ignora lastModified: stessa scheda non cambia firma', () => {
    const a = audit('testo');
    const b = audit('testo');
    b.metadata.lastModified = '1999-01-01T00:00:00.000Z';
    expect(auditMetadataSyncSignature(a, { answered_questions: 3 }))
      .toBe(auditMetadataSyncSignature(b, { answered_questions: 3 }));
  });

  it('una conclusione diversa cambia firma', () => {
    expect(auditMetadataSyncSignature(audit('a'), {}))
      .not.toBe(auditMetadataSyncSignature(audit('b'), {}));
  });
});

describe('createMetadataSyncScheduler', () => {
  it('tanti aggiornamenti uguali o ravvicinati diventano un solo invio', () => {
    vi.useFakeTimers();
    const enqueue = vi.fn();
    const scheduler = createMetadataSyncScheduler({ enqueue, debounceMs: 1000 });
    const payload = { audit_uuid: 'u1', client_name: 'Prova', audit_number: 'AUD-1' };
    const sig = auditMetadataSyncSignature(audit('bozza'), { answered_questions: 2 });
    scheduler.schedule('u1', sig, payload);
    scheduler.schedule('u1', sig, { ...payload, notes: 'stessa firma' });
    vi.advanceTimersByTime(1000);
    expect(enqueue).toHaveBeenCalledTimes(1);

    scheduler.schedule('u1', sig, payload);
    vi.advanceTimersByTime(1000);
    expect(enqueue).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('una scheda in attesa non riparte con lo stato bozza', () => {
    vi.useFakeTimers();
    const enqueue = vi.fn();
    const scheduler = createMetadataSyncScheduler({ enqueue, debounceMs: 1200 });
    const draftAudit = audit('dal PC');
    draftAudit.metadata.status = 'draft';
    const sig = auditMetadataSyncSignature(draftAudit, { answered_questions: 0 });
    scheduler.schedule('u1', sig, {
      audit_uuid: 'u1',
      status: 'draft',
      notes: 'bozza',
      auditOutcome: { conclusions: 'dal PC' },
    });
    expect(scheduler.patchPendingStatus('u1', 'in_progress')).toBe(true);
    vi.advanceTimersByTime(1200);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue.mock.calls[0][0].status).toBe('in_progress');
    expect(enqueue.mock.calls[0][0].auditOutcome.conclusions).toBe('dal PC');
    vi.useRealTimers();
  });

  it('flush invia subito e non ripete se nulla è cambiato', () => {
    const enqueue = vi.fn();
    const scheduler = createMetadataSyncScheduler({
      enqueue,
      debounceMs: 5000,
      setTimer: () => 1,
      clearTimer: () => {},
    });
    const sig = 'firma-a';
    scheduler.schedule('u1', sig, { audit_uuid: 'u1' });
    expect(scheduler.flushAll()).toBe(1);
    expect(enqueue).toHaveBeenCalledTimes(1);
    scheduler.schedule('u1', sig, { audit_uuid: 'u1' });
    expect(scheduler.flushAll()).toBe(0);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });
});
