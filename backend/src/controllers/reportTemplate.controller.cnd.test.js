/**
 * @jest-environment node
 *
 * CND-4: lista scope cnd, upload .docx, resolve org, .doc rifiutato.
 */
const mockQuery = jest.fn();
jest.mock('../config/database', () => ({
  query: (...args) => mockQuery(...args),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const {
  listTemplates,
  uploadTemplate,
  resolveTemplate,
} = require('./reportTemplate.controller');

function mockRes() {
  const res = { statusCode: 200, headersSent: false };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    this.headersSent = true;
    return this;
  });
  return res;
}

describe('reportTemplate CND-4', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('listTemplates accetta scope=cnd', async () => {
    mockQuery.mockResolvedValue({
      recordset: [{
        id: 4,
        organization_id: null,
        name: 'Verbale CND VT (sistema)',
        scope: 'cnd',
        standard_key: 'VT',
        file_path: '/templates/VT-verbale.docx',
        is_system: 1,
      }],
    });
    const res = mockRes();
    await listTemplates(
      { query: { scope: 'cnd' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = mockQuery.mock.calls[0][0];
    const params = mockQuery.mock.calls[0][1];
    expect(sql).toMatch(/scope = @scope/);
    expect(params.scope).toBe('cnd');
    expect(res.json.mock.calls[0][0].data[0].standard_key).toBe('VT');
  });

  it('uploadTemplate rifiuta .doc', async () => {
    const res = mockRes();
    await uploadTemplate(
      {
        user: { role: 'admin', organization_id: 1001 },
        file: { path: '/tmp/x.doc', originalname: 'MTxxx-2026.doc' },
        body: { scope: 'cnd', standard_key: 'MT' },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_FILE_TYPE' }),
    );
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('uploadTemplate scope cnd senza metodo → 400', async () => {
    const res = mockRes();
    await uploadTemplate(
      {
        user: { role: 'admin', organization_id: 1001 },
        file: { path: '/tmp/x.docx', originalname: 'pt.docx' },
        body: { scope: 'cnd' },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_STANDARD_KEY' }),
    );
  });

  it('uploadTemplate accetta .docx CND con standard_key PT', async () => {
    mockQuery.mockResolvedValue({
      recordset: [{ id: 88, file_path: '/uploads/templates/1001/pt.docx', name: 'PT Mason' }],
    });
    const res = mockRes();
    await uploadTemplate(
      {
        user: { role: 'admin', organization_id: 1001 },
        file: { path: '/tmp/x.docx', originalname: 'PT-2026.docx' },
        body: { scope: 'cnd', standard_key: 'pt', name: 'PT Mason' },
      },
      res,
    );
    expect(res.statusCode).toBe(201);
    const insertParams = mockQuery.mock.calls[0][1];
    expect(insertParams.scope).toBe('cnd');
    expect(insertParams.standard_key).toBe('PT');
  });

  it('resolveTemplate scope=cnd senza chiave → 400', async () => {
    const res = mockRes();
    await resolveTemplate(
      { query: { scope: 'cnd' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'MISSING_STANDARD_KEY' }),
    );
  });

  it('resolveTemplate scope=cnd&standard_key=VT usa il template studio', async () => {
    mockQuery.mockResolvedValueOnce({
      recordset: [{ id: 9, file_path: '/uploads/vt-org.docx', name: 'VT studio' }],
    });
    const res = mockRes();
    await resolveTemplate(
      { query: { scope: 'cnd', standard_key: 'VT' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: 9, name: 'VT studio' }),
      }),
    );
  });
});
