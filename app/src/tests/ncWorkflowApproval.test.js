/**
 * Test L1 - ncWorkflow approvazione RQ (NC Hardening H3)
 */
import { describe, it, expect } from 'vitest';
import { canTransitionNcStatus, canApproveNcClosure } from '../utils/ncWorkflow';

describe('ncWorkflow - approvazione RQ', () => {
  it('canApproveNcClosure solo admin/superadmin', () => {
    expect(canApproveNcClosure({ role: 'admin' })).toBe(true);
    expect(canApproveNcClosure({ role: 'superadmin' })).toBe(true);
    expect(canApproveNcClosure({ role: 'auditor' })).toBe(false);
  });

  it('closed richiede approved_at', () => {
    const nc = { verification_notes: 'OK', approved_at: null };
    const gate = canTransitionNcStatus(nc, 'closed');
    expect(gate.ok).toBe(false);
    expect(gate.message).toMatch(/approvazione/i);
  });

  it('closed consentita con approved_at e note verifica', () => {
    const nc = { verification_notes: 'Verifica efficace', approved_at: '2026-05-30' };
    expect(canTransitionNcStatus(nc, 'closed').ok).toBe(true);
  });
});
