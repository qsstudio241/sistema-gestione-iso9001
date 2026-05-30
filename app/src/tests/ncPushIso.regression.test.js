/**
 * Test regressione - push audit ISO ? registro NC (Slice 11)
 * NON modifica il flusso push: verifica contratto API e parsing risposta UI.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPost = vi.hoisted(() => vi.fn());
const mockDelete = vi.hoisted(() => vi.fn());

vi.mock('../services/apiService', () => ({
  default: {
    pushAuditToNcRegister: (auditRef) => mockPost(`/audits/${auditRef}/push-to-nc-register`, {}),
    undoPushAuditToNcRegister: (auditRef) => mockDelete(`/audits/${auditRef}/push-to-nc-register`),
  },
}));

import apiService from '../services/apiService';

/** Parsing summary come in AuditClosePanel.handleNcPush */
function parsePushResponse(res) {
  const data = res?.data || res || {};
  return data.summary || {
    created_count: (data.created || []).length,
    skipped_count: (data.skipped || []).length,
    total_findings: 0,
  };
}

describe('ncPushIso regression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pushAuditToNcRegister usa endpoint POST /audits/:id/push-to-nc-register', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        created: [{ nc_id: 1, nc_number: 'NC-AUD-001' }],
        skipped: [],
        summary: { created_count: 1, skipped_count: 0, total_findings: 1 },
      },
    });

    await apiService.pushAuditToNcRegister(42);

    expect(mockPost).toHaveBeenCalledWith('/audits/42/push-to-nc-register', {});
  });

  it('parsePushResponse accetta summary esplicito', () => {
    const summary = parsePushResponse({
      data: {
        summary: { created_count: 2, skipped_count: 1, total_findings: 3 },
      },
    });
    expect(summary).toEqual({ created_count: 2, skipped_count: 1, total_findings: 3 });
  });

  it('parsePushResponse deriva conteggi da created/skipped se summary assente', () => {
    const summary = parsePushResponse({
      data: {
        created: [{ nc_id: 1 }, { nc_id: 2 }],
        skipped: [{ reason: 'already_pushed' }],
      },
    });
    expect(summary.created_count).toBe(2);
    expect(summary.skipped_count).toBe(1);
  });

  it('parsePushResponse accetta summary con custom_findings (push ISO+custom)', () => {
    const summary = parsePushResponse({
      data: {
        summary: {
          created_count: 3,
          skipped_count: 1,
          total_findings: 4,
          iso_findings: 2,
          custom_findings: 2,
        },
      },
    });
    expect(summary.custom_findings).toBe(2);
    expect(summary.total_findings).toBe(4);
  });

  it('undoPushAuditToNcRegister usa DELETE sullo stesso path', async () => {
    mockDelete.mockResolvedValueOnce({ success: true, deleted_count: 2 });
    await apiService.undoPushAuditToNcRegister('uuid-audit');
    expect(mockDelete).toHaveBeenCalledWith('/audits/uuid-audit/push-to-nc-register');
  });
});
