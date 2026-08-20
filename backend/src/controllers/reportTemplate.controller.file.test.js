/**
 * @jest-environment node
 *
 * GET /report-templates/:id/file — archivio unico sul VPS.
 */
const path = require('path');
const fs = require('fs');
const { PassThrough } = require('stream');

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

const { downloadTemplateFile } = require('./reportTemplate.controller');

const SYSTEM_DOCX = path.join(__dirname, '../../templates/ISO3834-audit-report.docx');

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    headersSent: false,
    piped: null,
  };
  res.status = jest.fn(function status(code) {
    this.statusCode = code;
    return this;
  });
  res.json = jest.fn(function json() {
    this.headersSent = true;
    return this;
  });
  res.setHeader = jest.fn(function setHeader(k, v) {
    this.headers[k] = v;
    return this;
  });
  return res;
}

describe('downloadTemplateFile', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('400 se id non numerico', async () => {
    const res = mockRes();
    await downloadTemplateFile(
      { params: { id: 'abc' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'INVALID_ID' }),
    );
  });

  it('404 se riga assente', async () => {
    mockQuery.mockResolvedValue({ recordset: [] });
    const res = mockRes();
    await downloadTemplateFile(
      { params: { id: '9' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('403 se template di un altro studio', async () => {
    mockQuery.mockResolvedValue({
      recordset: [{
        id: 12,
        organization_id: 2002,
        name: 'Copia Mason',
        file_path: '/uploads/templates/2002/x.docx',
        is_system: 0,
      }],
    });
    const res = mockRes();
    await downloadTemplateFile(
      { params: { id: '12' }, user: { organization_id: 1001 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('streamma il .docx di sistema da backend/templates', async () => {
    expect(fs.existsSync(SYSTEM_DOCX)).toBe(true);
    mockQuery.mockResolvedValue({
      recordset: [{
        id: 4,
        organization_id: null,
        name: 'Report Audit ISO 3834-2',
        file_path: '/templates/ISO3834-audit-report.docx',
        is_system: 1,
      }],
    });

    const passthrough = new PassThrough();
    passthrough.pipe = jest.fn();
    const spy = jest.spyOn(fs, 'createReadStream').mockReturnValue(passthrough);
    const res = mockRes();

    await downloadTemplateFile(
      { params: { id: '4' }, user: { organization_id: 1001 } },
      res,
    );

    expect(res.status).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toMatch(/wordprocessingml/);
    expect(res.headers['Content-Disposition']).toMatch(/ISO3834-audit-report\.docx/);
    expect(spy.mock.calls[0][0]).toBe(path.resolve(SYSTEM_DOCX));
    expect(passthrough.pipe).toHaveBeenCalledWith(res);
    spy.mockRestore();
  });
});
