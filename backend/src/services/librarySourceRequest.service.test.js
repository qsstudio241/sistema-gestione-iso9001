'use strict';

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./alertMail.service', () => ({ sendAlertEmail: jest.fn() }));
jest.mock('../utils/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const {
  upsertGapRequest,
  processGapsFromChat,
  listPlatformQueue,
  acknowledgePlatformRequest,
  markPlatformDigitized,
  closeTenantRequestsCoveredByCode,
  tryCloseTenantRequestsAfterIngest,
  sourceCodesMatch,
} = require('./librarySourceRequest.service');

describe('librarySourceRequest.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sourceCodesMatch: case-insensitive e prefisso', () => {
    expect(sourceCodesMatch('ISO 1', 'iso 1')).toBe(true);
    expect(sourceCodesMatch('ISO 14555:2025', 'ISO 14555:2025 (arc stud)')).toBe(true);
    expect(sourceCodesMatch('a', 'b')).toBe(false);
    expect(sourceCodesMatch('', 'x')).toBe(false);
  });

  it('dedupe: non reinserisce se open recente', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 7, source_code: 'ISO 14555:2025', status: 'open' }],
    });
    const r = await upsertGapRequest(
      { code: 'ISO 14555:2025', reason: 'test' },
      { organizationId: 1001, userId: 1 }
    );
    expect(r.created).toBe(false);
    expect(r.row.id).toBe(7);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('crea e emaila superadmin per closure platform', async () => {
    query
      .mockResolvedValueOnce({ recordset: [] }) // dedupe
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 9,
            source_code: 'ISO 14555:2025',
            source_title: 'Stud',
            reason: 'range',
            quality_notes: 'secondo passaggio OCR',
            closure_path: 'platform',
            requesting_organization_id: 1001,
          },
        ],
      }) // insert
      .mockResolvedValueOnce({
        recordset: [{ email: 'sa@example.com' }],
      }) // superadmins
      .mockResolvedValueOnce({ recordset: [] }); // update email_notified_at
    sendAlertEmail.mockResolvedValue(true);

    const r = await upsertGapRequest(
      {
        code: 'ISO 14555:2025',
        title: 'Stud',
        reason: 'range',
        qualityNotes: 'secondo passaggio OCR',
        closurePath: 'platform',
      },
      { organizationId: 1001, userId: 3, messagePreview: 'Domanda stud' }
    );
    expect(r.created).toBe(true);
    expect(r.emailed).toBe(true);
    expect(sendAlertEmail).toHaveBeenCalledWith(
      'sa@example.com',
      expect.stringContaining('ISO 14555:2025'),
      expect.stringContaining('secondo passaggio OCR')
    );
  });

  it('processGapsFromChat aggrega risultati', async () => {
    query
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 1,
            source_code: 'A',
            closure_path: 'tenant',
            requesting_organization_id: 1,
          },
        ],
      });
    const results = await processGapsFromChat(
      [{ code: 'A', closurePath: 'tenant' }],
      { organizationId: 1 }
    );
    expect(results).toHaveLength(1);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('listPlatformQueue filtra closure_path=platform e status aperti', async () => {
    query.mockResolvedValueOnce({
      recordset: [
        {
          id: 3,
          source_code: 'ISO X',
          closure_path: 'platform',
          status: 'open',
          requesting_organization_name: 'Studio A',
        },
      ],
    });
    const rows = await listPlatformQueue();
    expect(rows).toHaveLength(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringMatching(/closure_path = N'platform'/),
      {}
    );
    expect(query.mock.calls[0][0]).toMatch(/status IN \(N'open', N'in_progress'\)/);
  });

  it('acknowledgePlatformRequest: open → in_progress', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          { id: 5, closure_path: 'platform', status: 'open', source_code: 'ISO Y' },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          { id: 5, closure_path: 'platform', status: 'in_progress', source_code: 'ISO Y' },
        ],
      });
    const r = await acknowledgePlatformRequest(5);
    expect(r.changed).toBe(true);
    expect(r.row.status).toBe('in_progress');
  });

  it('acknowledgePlatformRequest: rifiuta non-platform', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 6, closure_path: 'tenant', status: 'open' }],
    });
    const r = await acknowledgePlatformRequest(6);
    expect(r.error).toBe('not_platform');
  });

  it('markPlatformDigitized: open → digitized con note qualità', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 8,
            closure_path: 'platform',
            status: 'open',
            source_code: 'ISO Z',
            quality_notes: 'OCR debole',
            requesting_organization_id: 1002,
            requesting_user_id: 4,
          },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 8,
            closure_path: 'platform',
            status: 'digitized',
            source_code: 'ISO Z',
            quality_notes: 'OCR debole\nChiusura piattaforma: MD ok, secondo passaggio non serve',
            requesting_organization_id: 1002,
            requesting_user_id: 4,
          },
        ],
      });
    const r = await markPlatformDigitized(8, {
      qualityNotes: 'MD ok, secondo passaggio non serve',
      notifyTenant: false,
    });
    expect(r.changed).toBe(true);
    expect(r.row.status).toBe('digitized');
    expect(r.tenantEmailed).toBe(false);
    expect(query.mock.calls[1][0]).toMatch(/status = N'digitized'/);
    expect(query.mock.calls[1][1].notes).toMatch(/Chiusura piattaforma/);
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it('markPlatformDigitized: notifyTenant emaila richiedente', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 9,
            closure_path: 'platform',
            status: 'in_progress',
            source_code: 'ISO ACK',
            quality_notes: null,
            requesting_organization_id: 1003,
            requesting_user_id: 11,
            source_title: 'Ack test',
          },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 9,
            closure_path: 'platform',
            status: 'digitized',
            source_code: 'ISO ACK',
            quality_notes: 'Chiusura piattaforma: QA ok',
            requesting_organization_id: 1003,
            requesting_user_id: 11,
            source_title: 'Ack test',
          },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [{ email: 'tenant@studio.it' }],
      });
    sendAlertEmail.mockResolvedValue(true);
    const r = await markPlatformDigitized(9, {
      qualityNotes: 'QA ok',
      notifyTenant: true,
    });
    expect(r.changed).toBe(true);
    expect(r.tenantEmailed).toBe(true);
    expect(sendAlertEmail).toHaveBeenCalledWith(
      'tenant@studio.it',
      expect.stringContaining('ISO ACK'),
      expect.stringContaining('digitalizzata')
    );
  });

  it('markPlatformDigitized: rifiuta non-platform', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 10, closure_path: 'tenant', status: 'open' }],
    });
    const r = await markPlatformDigitized(10, { qualityNotes: 'x' });
    expect(r.error).toBe('not_platform');
  });

  it('closeTenantRequestsCoveredByCode: chiude solo tenant open/in_progress', async () => {
    query
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 11,
            source_code: 'ISO 14555:2025',
            status: 'open',
            closure_path: 'tenant',
            requesting_organization_id: 1001,
          },
          {
            id: 12,
            source_code: 'ISO OTHER',
            status: 'open',
            closure_path: 'tenant',
            requesting_organization_id: 1001,
          },
        ],
      })
      .mockResolvedValueOnce({
        recordset: [
          {
            id: 11,
            source_code: 'ISO 14555:2025',
            status: 'closed',
            closure_path: 'tenant',
          },
        ],
      });
    const r = await closeTenantRequestsCoveredByCode(1001, 'ISO 14555:2025 (arc)', {
      documentId: 99,
    });
    expect(r.count).toBe(1);
    expect(r.closed[0].id).toBe(11);
    expect(r.closed[0].status).toBe('closed');
    expect(query.mock.calls[1][0]).toMatch(/status = N'closed'/);
    expect(query.mock.calls[1][0]).toMatch(/closure_path = N'tenant'/);
  });

  it('closeTenantRequestsCoveredByCode: nessuna match → count 0', async () => {
    query.mockResolvedValueOnce({
      recordset: [
        {
          id: 20,
          source_code: 'ISO X',
          status: 'open',
          closure_path: 'tenant',
        },
      ],
    });
    const r = await closeTenantRequestsCoveredByCode(1001, 'ISO Y');
    expect(r.count).toBe(0);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('tryCloseTenantRequestsAfterIngest: non propaga errori', async () => {
    query.mockRejectedValueOnce(new Error('db down'));
    const r = await tryCloseTenantRequestsAfterIngest(1001, 'ISO Z');
    expect(r.count).toBe(0);
    expect(r.error).toMatch(/db down/);
  });
});
