/**
 * Test L1 - ncWorkflow approvazione RQ (NC Hardening H3)
 */
import { describe, it, expect } from 'vitest';
import {
  canTransitionNcStatus,
  canApproveNcClosure,
  canReopenNc,
  getNcReopenButton,
  NC_REOPEN_TARGET_STATUS,
} from '../utils/ncWorkflow';

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

describe('ncWorkflow - riapertura NC chiusa', () => {
  it('canReopenNc solo admin/superadmin', () => {
    expect(canReopenNc({ role: 'admin' })).toBe(true);
    expect(canReopenNc({ role: 'auditor' })).toBe(false);
  });

  it('getNcReopenButton solo per NC closed e RQ', () => {
    const closed = { status: 'closed' };
    expect(getNcReopenButton(closed, { role: 'admin' })).toBe(NC_REOPEN_TARGET_STATUS);
    expect(getNcReopenButton(closed, { role: 'auditor' })).toBeNull();
    expect(getNcReopenButton({ status: 'in_progress' }, { role: 'admin' })).toBeNull();
  });
});
