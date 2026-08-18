/**
 * @jest-environment node
 *
 * L1 MC-4 — API certificati materiale (mock DB).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));
jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../services/qualificationCompany.service', () => ({
  companyBelongsToOrg: jest.fn().mockResolvedValue(true),
}));
jest.mock('../services/documentTextExtractor.service', () => ({
  extractDocumentText: jest.fn(),
}));
jest.mock('../services/importAiExtraction.service', () => ({
  extractStructuredByDocType: jest.fn(),
}));
jest.mock('../services/materialComplianceRuleEngine.service', () => ({
  evaluateMaterialCertificate: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const { query, getPool } = require('../config/database');
const { assertMutatingAllowed, sendAccessDenied } = require('../services/companyAccess.service');
const { companyBelongsToOrg } = require('../services/qualificationCompany.service');
const { extractDocumentText } = require('../services/documentTextExtractor.service');
const { extractStructuredByDocType } = require('../services/importAiExtraction.service');
const { evaluateMaterialCertificate } = require('../services/materialComplianceRuleEngine.service');
const { DOCUMENT_TYPE_SCHEMAS } = require('../data/documentTypeSchemas');
const { findIngestFieldsMissingFromManualEdit } = require('../utils/manualEditCompletenessCheck');
const ctrl = require('./materialCertificates.controller');

const USER = { organization_id: 1001, user_id: 7, role: 'admin', company_access: [] };

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
    user: { ...USER, ...(overrides.user || {}) },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

const CERT = {
  id: 11,
  organization_id: 1001,
  company_id: 3,
  storage_path: '/tmp/mtc.pdf',
  material_role: 'base',
  workflow_status: 'extracted',
  extracted_json: JSON.stringify({
    material_role: 'base',
    steel_designation: 'S355J2',
    thickness_mm: 10,
    ReH: 360,
  }),
  corrected_json: null,
  evaluate_result_json: null,
  updated_at: new Date('2026-08-17T12:00:00.000Z'),
};

function sqlOf(call) {
  return String(call[0] || '');
}

function mockTx() {
  const queryMock = jest.fn().mockResolvedValue({ recordset: [{ id: 11 }] });
  const tx = {
    begin: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    request: jest.fn(() => {
      const r = { query: queryMock };
      r.input = jest.fn().mockReturnValue(r);
      return r;
    }),
  };
  getPool.mockResolvedValue({ transaction: () => tx });
  return { queryMock, tx };
}

beforeEach(() => {
  jest.clearAllMocks();
  assertMutatingAllowed.mockResolvedValue(null);
  companyBelongsToOrg.mockResolvedValue(true);
});

describe('materialCertificates.controller (MC-4)', () => {
  it('schema ingest material_certificate è coperto da PATCH manuale', () => {
    const missing = findIngestFieldsMissingFromManualEdit(
      DOCUMENT_TYPE_SCHEMAS.material_certificate.aiExpectedSchema,
      ctrl.MATERIAL_CERTIFICATE_MANUAL_EDITABLE_FIELDS
    );
    expect(missing).toEqual([]);
  });

  it('list filtra per organization_id', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 11, workflow_status: 'received' }] });
    const res = mockRes();
    await ctrl.listCertificates(mockReq(), res);
    expect(sqlOf(query.mock.calls[0])).toMatch(/organization_id = @organization_id/);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('get 404 se id fuori tenant', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const res = mockRes();
    await ctrl.getCertificate(mockReq({ params: { id: '99' } }), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('create 400 senza company_id e senza file', async () => {
    const res = mockRes();
    await ctrl.createCertificate(mockReq({ body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('COMPANY_REQUIRED');

    const res2 = mockRes();
    await ctrl.createCertificate(mockReq({ body: { company_id: 3 } }), res2);
    expect(res2.status).toHaveBeenCalledWith(400);
    expect(res2.json.mock.calls[0][0].code).toBe('FILE_REQUIRED');
  });

  it('create 403 se viewer senza write', async () => {
    assertMutatingAllowed.mockResolvedValueOnce({
      status: 403,
      body: { error: 'Permesso negato: sola lettura', code: 'AUTH_FORBIDDEN' },
    });
    const res = mockRes();
    await ctrl.createCertificate(mockReq({
      body: { company_id: 3 },
      file: { path: '/tmp/a.pdf', originalname: 'a.pdf', mimetype: 'application/pdf', size: 10 },
    }), res);
    expect(sendAccessDenied).toHaveBeenCalled();
  });

  it('create 403 se company_id non appartiene al tenant', async () => {
    companyBelongsToOrg.mockResolvedValueOnce(false);
    const res = mockRes();
    await ctrl.createCertificate(mockReq({
      body: { company_id: 3 },
      file: { path: '/tmp/a.pdf', originalname: 'a.pdf', mimetype: 'application/pdf', size: 10 },
    }), res);
    expect(sendAccessDenied).toHaveBeenCalledWith(res, expect.objectContaining({ status: 403 }));
    expect(query).not.toHaveBeenCalled();
  });

  it('list e stats 403 se company_id fuori tenant', async () => {
    companyBelongsToOrg.mockResolvedValue(false);
    const resList = mockRes();
    await ctrl.listCertificates(mockReq({ query: { company_id: '99' } }), resList);
    expect(sendAccessDenied).toHaveBeenCalledWith(resList, expect.objectContaining({ status: 403 }));

    const resStats = mockRes();
    await ctrl.getStats(mockReq({ query: { company_id: '99' } }), resStats);
    expect(sendAccessDenied).toHaveBeenCalledWith(resStats, expect.objectContaining({ status: 403 }));
  });

  it('create persiste received e non compliant', async () => {
    const { queryMock } = mockTx();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ id: 50 }] })
      .mockResolvedValueOnce({ recordset: [{ id: 51 }] })
      .mockResolvedValueOnce({ recordset: [{ id: 11, workflow_status: 'received', material_role: 'base', company_id: 3 }] });
    const res = mockRes();
    await ctrl.createCertificate(mockReq({
      body: { company_id: 3, material_role: 'base' },
      file: { path: '/tmp/a.pdf', originalname: 'a.pdf', mimetype: 'application/pdf', size: 10 },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.workflow_status).toBe('received');
    expect(res.json.mock.calls[0][0].data.workflow_status).not.toBe('compliant');
  });

  it('extract senza testo → text_ready ocr_skipped, 200, non 500', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'received' }] });
    extractDocumentText.mockResolvedValueOnce({ text: null, reason: 'pdf_no_text_layer' });
    query.mockResolvedValueOnce({ recordset: [{ id: 11 }] });
    const res = mockRes();
    await ctrl.extractCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.data.workflow_status).toBe('text_ready');
    expect(body.data.text_extract_reason).toBe('ocr_skipped');
    expect(body.data.workflow_status).not.toBe('compliant');
    expect(extractStructuredByDocType).not.toHaveBeenCalled();
    const readySql = query.mock.calls.find((c) => /workflow_status = 'text_ready'/.test(sqlOf(c)));
    expect(readySql).toBeTruthy();
    expect(sqlOf(readySql)).toMatch(/extracted_json = NULL/);
    expect(sqlOf(readySql)).toMatch(/OUTPUT INSERTED\.id/);
  });

  it('extract con testo persiste extracted_json e stato extracted', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'received' }] });
    extractDocumentText.mockResolvedValueOnce({
      text: 'Certificato 3.1 S355J2 ReH 360 '.repeat(10),
    });
    extractStructuredByDocType.mockResolvedValueOnce({
      model: 'test-model',
      data: {
        type_specific_data: {
          material_role: 'base',
          steel_designation: 'S355J2',
          inspection_document_type: '3.1',
          ReH: 360,
        },
      },
    });
    query.mockResolvedValueOnce({ recordset: [{ id: 11 }] });
    const res = mockRes();
    await ctrl.extractCertificate(mockReq({ params: { id: '11' } }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.workflow_status).toBe('extracted');
    expect(body.data.extracted_json.steel_designation).toBe('S355J2');
    expect(body.data.workflow_status).not.toBe('compliant');
    const updateSql = query.mock.calls.find((c) => /workflow_status = 'extracted'/.test(sqlOf(c)));
    expect(updateSql).toBeTruthy();
  });

  it('evaluate persiste checks, pending_review, mai compliant', async () => {
    query.mockResolvedValueOnce({ recordset: [CERT] });
    const { queryMock, tx } = mockTx();
    evaluateMaterialCertificate.mockReturnValueOnce({
      status: 'pass',
      kb_snapshot_hash: 'a'.repeat(64),
      checks: [{
        requirement_key: 'ReH',
        source_level: 'material_std',
        source_ref: 'EN 10025-2',
        required_value: '≥ 355',
        actual_value: '360',
        result: 'pass',
        explanation: 'ok',
      }],
    });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' }, body: {} }), res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.workflow_status).toBe('pending_review');
    expect(body.data.status).toBe('pass');
    expect(body.data.workflow_status).not.toBe('compliant');
    expect(tx.begin).toHaveBeenCalled();
    expect(tx.commit).toHaveBeenCalled();
    const sqls = queryMock.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /DELETE FROM dbo.material_certificate_checks/.test(s))).toBe(true);
    expect(sqls.some((s) => /INSERT INTO dbo.material_certificate_checks/.test(s))).toBe(true);
    expect(sqls.some((s) => /workflow_status = 'pending_review'/.test(s))).toBe(true);
    expect(sqls.some((s) => /reviewed_by = NULL/.test(s))).toBe(true);
    expect(sqls.some((s) => /updated_at = SYSUTCDATETIME\(\)/.test(s))).toBe(true);
    expect(sqls.some((s) => /AND updated_at = @updated_at/.test(s))).toBe(false);
  });

  it('evaluate da extracted con Date JS (driver mssql) non dà 409', async () => {
    query.mockResolvedValueOnce({
      recordset: [{
        ...CERT,
        workflow_status: 'extracted',
        updated_at: new Date('2026-08-17T12:00:00.123Z'),
      }],
    });
    mockTx();
    evaluateMaterialCertificate.mockReturnValueOnce({
      status: 'pass',
      kb_snapshot_hash: 'a'.repeat(64),
      checks: [],
    });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' }, body: {} }), res);
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].data.workflow_status).toBe('pending_review');
    expect(res.json.mock.calls[0][0].data.workflow_status).not.toBe('compliant');
  });

  it('extract da compliant → 409 (non degrada HITL)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'compliant' }] });
    const res = mockRes();
    await ctrl.extractCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(extractDocumentText).not.toHaveBeenCalled();
  });

  it('evaluate rollback se INSERT checks fallisce', async () => {
    query.mockResolvedValueOnce({ recordset: [CERT] });
    const { queryMock, tx } = mockTx();
    queryMock.mockReset();
    queryMock
      .mockResolvedValueOnce({ recordset: [] })
      .mockRejectedValueOnce(new Error('insert fail'));
    evaluateMaterialCertificate.mockReturnValueOnce({
      status: 'pass',
      kb_snapshot_hash: 'a'.repeat(64),
      checks: [{ requirement_key: 'ReH', result: 'pass' }],
    });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('evaluate 409 se già compliant', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'compliant' }] });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(evaluateMaterialCertificate).not.toHaveBeenCalled();
  });

  it('PATCH da compliant → 409', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'compliant' }] });
    const res = mockRes();
    await ctrl.patchCertificate(mockReq({
      params: { id: '11' },
      body: { designation: 'S355J2' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('evaluate 409 se lo stato non è più valutabile in transazione', async () => {
    query.mockResolvedValueOnce({ recordset: [CERT] });
    const { queryMock, tx } = mockTx();
    queryMock.mockImplementation((sql) => {
      if (/UPDATE dbo.material_certificates/.test(String(sql))) {
        return Promise.resolve({ recordset: [] });
      }
      return Promise.resolve({ recordset: [{ id: 11 }] });
    });
    evaluateMaterialCertificate.mockReturnValueOnce({
      status: 'pass',
      kb_snapshot_hash: 'a'.repeat(64),
      checks: [],
    });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' }, body: {} }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(tx.rollback).toHaveBeenCalled();
    expect(tx.commit).not.toHaveBeenCalled();
  });

  it('PATCH rifiuta workflow_status nel body', async () => {
    const res = mockRes();
    await ctrl.patchCertificate(mockReq({
      params: { id: '11' },
      body: { workflow_status: 'compliant' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('WORKFLOW_VIA_HITL');
  });

  it('approve da pending_review → compliant (solo HITL)', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'pending_review' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 11, workflow_status: 'compliant' }] });
    const res = mockRes();
    await ctrl.approveCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.json.mock.calls[0][0].data.workflow_status).toBe('compliant');
  });

  it('reject da compliant → 409 (solo archive)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'compliant' }] });
    const res = mockRes();
    await ctrl.rejectCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('evaluate da non_compliant è consentito (ri-valuta dopo correzione)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'non_compliant' }] });
    mockTx();
    evaluateMaterialCertificate.mockReturnValueOnce({
      status: 'fail',
      kb_snapshot_hash: 'b'.repeat(64),
      checks: [],
    });
    const res = mockRes();
    await ctrl.evaluateCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.json.mock.calls[0][0].data.workflow_status).toBe('pending_review');
  });

  it('approve da extracted → 409', async () => {
    query.mockResolvedValueOnce({ recordset: [{ ...CERT, workflow_status: 'extracted' }] });
    const res = mockRes();
    await ctrl.approveCertificate(mockReq({ params: { id: '11' } }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it('sorgente controller: extract/evaluate non assegnano compliant', () => {
    const src = fs.readFileSync(path.join(__dirname, 'materialCertificates.controller.js'), 'utf8');
    expect(src).toMatch(/workflow_status = 'pending_review'/);
    expect(src).toMatch(/workflow_status = 'extracted'/);
    expect(src).not.toMatch(/workflow_status = 'compliant'/);
    expect(src).toMatch(/nextStatus: 'compliant'/);
  });

  it('routes: authenticate + capability AND, extract con logAiInteraction', () => {
    const src = fs.readFileSync(
      path.join(__dirname, '../routes/materialCertificates.routes.js'),
      'utf8'
    );
    expect(src).toMatch(/router\.use\(authenticate\)/);
    expect(src).toMatch(/requireMaterialComplianceCapability/);
    expect(src).toMatch(/logAiInteraction\('import'\)/);
    expect(src).toMatch(/\/evaluate/);
  });
});
