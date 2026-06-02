/**
 * Test CRUD companyPersonnel.controller (ADR-012 slice S3)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./companyPersonnel.controller');

const AUDITOR_ORG_ID = 10;
const ORG_ID = 1001;
const COMPANY_ID = 42;

function mockReq(overrides = {}) {
  return {
    user: { auditor_org_id: AUDITOR_ORG_ID, organization_id: ORG_ID, role: 'auditor' },
    params: { companyId: String(COMPANY_ID) },
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

function mockCompanyScope() {
  query.mockResolvedValueOnce({
    recordset: [{ company_id: COMPANY_ID, organization_id: ORG_ID }],
  });
}

afterEach(() => jest.clearAllMocks());

describe('companyPersonnel — scope RBAC', () => {
  it('listPersonnel 403 cross-studio se azienda non in auditor_org', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq();
    const res = mockRes();
    await ctrl.listPersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('listPersonnel 403 senza auditor_org_id', async () => {
    const req = mockReq({ user: { role: 'admin' } });
    const res = mockRes();
    await ctrl.listPersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AUDITOR_ORG_REQUIRED' }),
    );
  });
});

describe('companyPersonnel CRUD', () => {
  it('listPersonnel restituisce righe per company', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, name: 'Mario Rossi', company_id: COMPANY_ID }],
    });
    const req = mockReq();
    const res = mockRes();
    await ctrl.listPersonnel(req, res);
    expect(query.mock.calls[1][0]).toContain('company_id = @company_id');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, name: 'Mario Rossi', company_id: COMPANY_ID }],
    });
  });

  it('createPersonnel valida nome obbligatorio', async () => {
    mockCompanyScope();
    const req = mockReq({ body: { name: '  ' } });
    const res = mockRes();
    await ctrl.createPersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createPersonnel inserisce con organization_id da scope', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{ id: 5, name: 'Luigi', organization_id: ORG_ID, company_id: COMPANY_ID }],
    });
    const req = mockReq({
      body: { name: 'Luigi', job_title: 'Resp. qualità', can_actuation: true },
    });
    const res = mockRes();
    await ctrl.createPersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(query.mock.calls[1][1].organization_id).toBe(ORG_ID);
    expect(query.mock.calls[1][1].company_id).toBe(COMPANY_ID);
  });

  it('updatePersonnel 404 se assente', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { companyId: String(COMPANY_ID), id: '99' } });
    const res = mockRes();
    await ctrl.updatePersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('updatePersonnel aggiorna flag can_verify', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({ recordset: [{ id: 3 }] });
    query.mockResolvedValueOnce({
      recordset: [{ id: 3, can_verify: 1, name: 'Anna' }],
    });
    const req = mockReq({
      params: { companyId: String(COMPANY_ID), id: '3' },
      body: { can_verify: true },
    });
    const res = mockRes();
    await ctrl.updatePersonnel(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  it('deletePersonnel disattiva (soft delete)', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{ id: 7, notification_contact_id: null, active: 1 }],
    });
    query.mockResolvedValueOnce({
      recordset: [{ id: 7, active: 0 }],
    });
    const req = mockReq({ params: { companyId: String(COMPANY_ID), id: '7' } });
    const res = mockRes();
    await ctrl.deletePersonnel(req, res);
    expect(query.mock.calls[2][0]).toContain('active = 0');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Personale disattivato' }),
    );
  });

  it('createPersonnel 403 se company_id non appartiene a org utente', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      user: { auditor_org_id: 999, role: 'auditor' },
      body: { name: 'Test' },
    });
    const res = mockRes();
    await ctrl.createPersonnel(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('validateEmail', () => {
  it('accetta email nulla (opzionale)', () => {
    expect(ctrl.validateEmail(null)).toBe(true);
  });
  it('rifiuta email malformata', () => {
    expect(ctrl.validateEmail('bad')).toBe(false);
  });
});
