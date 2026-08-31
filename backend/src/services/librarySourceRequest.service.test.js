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
} = require('./librarySourceRequest.service');

describe('librarySourceRequest.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
