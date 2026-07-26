/**
 * Test L1 — ncWorkflow riapertura (approvazione RQ rimossa)
 */
import { describe, it, expect } from 'vitest';
import {
  canCloseNc,
  canApproveNcClosure,
  canReopenNc,
  getNcReopenButton,
  NC_REOPEN_TARGET_STATUS,
} from '../utils/ncWorkflow';

describe('ncWorkflow - chiusura senza approvazione RQ', () => {
  it('canApproveNcClosure resta admin/superadmin (solo riapertura)', () => {
    expect(canApproveNcClosure({ role: 'admin' })).toBe(true);
    expect(canApproveNcClosure({ role: 'superadmin' })).toBe(true);
    expect(canApproveNcClosure({ role: 'auditor' })).toBe(false);
  });

  it('closed NON richiede approved_at', () => {
    const nc = {
      status: 'open',
      corrective_action_needed: 'no',
      corrective_action_evaluation_notes: 'Motivazione',
      correction_completed_count: 1,
      verification_notes: 'OK',
      verification_contact_id: 7,
      approved_at: null,
    };
    expect(canCloseNc(nc).ok).toBe(true);
  });
});

describe('ncWorkflow - riapertura NC chiusa', () => {
  it('canReopenNc solo admin/superadmin', () => {
    expect(canReopenNc({ role: 'admin' })).toBe(true);
    expect(canReopenNc({ role: 'auditor' })).toBe(false);
  });

  it('getNcReopenButton torna open (non in_progress)', () => {
    const closed = { status: 'closed' };
    expect(getNcReopenButton(closed, { role: 'admin' })).toBe(NC_REOPEN_TARGET_STATUS);
    expect(NC_REOPEN_TARGET_STATUS).toBe('open');
    expect(getNcReopenButton(closed, { role: 'auditor' })).toBeNull();
    expect(getNcReopenButton({ status: 'open' }, { role: 'admin' })).toBeNull();
  });
});
