/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../services/docCodeGenerator.service', () => ({
  allocateDocCode: jest.fn(),
  resolveExpiryDate: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  sendAccessDenied: jest.fn(),
}));

const { query } = require('../config/database');
const { allocateDocCode, resolveExpiryDate } = require('../services/docCodeGenerator.service');
const ctrl = require('./document.controller');

const ORG_ID = 1001;

function mockReq(overrides = {}) {
  return {
    user: { organization_id: ORG_ID, user_id: 42 },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

afterEach(() => jest.clearAllMocks());

describe('createDocument', () => {
  it('genera doc_code via allocateDocCode se assente nel body', async () => {
    allocateDocCode.mockResolvedValueOnce('PG-001');
    resolveExpiryDate.mockResolvedValueOnce(null);

    query
      .mockResolvedValueOnce({ recordset: [{ id: 99 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      body: {
        doc_type: 'procedura',
        title: 'Procedura test',
        status: 'bozza',
      },
    });
    const res = mockRes();

    await ctrl.createDocument(req, res);

    expect(allocateDocCode).toHaveBeenCalledWith(ORG_ID, 'procedura');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ doc_code: 'PG-001' }),
      })
    );
    const insertParams = query.mock.calls[0][1];
    expect(insertParams.doc_code).toBe('PG-001');
  });

  it('accetta status legacy "vigente" mappandolo a rilasciato', async () => {
    resolveExpiryDate.mockResolvedValueOnce(null);
    query
      .mockResolvedValueOnce({ recordset: [{ id: 101 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      body: {
        doc_type: 'procedura',
        title: 'Doc vigente legacy',
        status: 'vigente',
      },
    });
    const res = mockRes();

    await ctrl.createDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(query.mock.calls[0][1].status).toBe('rilasciato');
  });

  it('non sovrascrive doc_code fornito esplicitamente', async () => {
    resolveExpiryDate.mockResolvedValueOnce(null);
    query
      .mockResolvedValueOnce({ recordset: [{ id: 100 }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      body: {
        doc_type: 'procedura',
        title: 'Doc manuale',
        doc_code: 'MAN-999',
      },
    });
    const res = mockRes();

    await ctrl.createDocument(req, res);

    expect(allocateDocCode).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1].doc_code).toBe('MAN-999');
  });
});

describe('getFolderSuggestion', () => {
  it('mappa certificato_materiale a cartella 2.1', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: 5, title: 'CERTIFICATI', folder_code: '2.1' }],
    });

    const req = mockReq({ query: { doc_type: 'certificato_materiale' } });
    const res = mockRes();
    await ctrl.getFolderSuggestion(req, res);

    expect(query.mock.calls[0][1].folder_code).toBe('2.1');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ folder_code: '2.1', confidence: 'high' })
    );
  });
});
