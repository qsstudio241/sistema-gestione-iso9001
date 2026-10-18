/**
 * @jest-environment node
 */

/**
 * L'admin di studio senza auditor_org_id deve vedere le aziende del proprio
 * studio. Oggi GET /companies risponde 403 AUDITOR_ORG_REQUIRED e la tendina
 * Ambito resta senza aziende. Il viewer senza auditor_org resta 403.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }));
jest.mock('../services/documentTreeProvisioner.service', () => ({}));
jest.mock('../services/billing.service', () => ({
  syncCompanyActiveStatus: jest.fn(),
  onCompanyCreated: jest.fn(),
}));
jest.mock('../services/companyMaintenance.service', () => ({ hardDeleteCompany: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn(async () => []),
  hasCompanyAccessRows: jest.fn(() => false),
  getAllowedCompanyIds: jest.fn(() => null),
  assertCompanyAccess: jest.fn(),
  assertCompanyWriteAccess: jest.fn(),
  assertMutatingAllowed: jest.fn(),
  sendAccessDenied: jest.fn(),
}));

const { query } = require('../config/database');
const { listCompanies } = require('./company.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

function run(user, queryParams = {}) {
  const req = { user, query: queryParams };
  const res = mockRes();
  return listCompanies(req, res).then(() => res);
}

describe('listCompanies — admin di studio senza auditor_org', () => {
  beforeEach(() => {
    query.mockReset();
    query.mockImplementation(async (sql) => {
      if (/COUNT\(\*\)/i.test(sql)) return { recordset: [{ total: 1 }] };
      return { recordset: [{ id: 49, name: 'GrokBot Azienda Prova' }] };
    });
  });

  it('admin con organization_id e senza auditor_org_id elenca le aziende dello studio', async () => {
    const res = await run({ role: 'admin', organization_id: 1005, auditor_org_id: null, user_id: 2027 });
    expect(res.status).not.toHaveBeenCalledWith(403);
    const sql = query.mock.calls.map((c) => c[0]).join('\n');
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/auditor_orgs/i);
    expect(sql).toMatch(/organization_id = @organization_id/);
    expect(params.organization_id).toBe(1005);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('se passa auditor_org_id in query, resta il filtro esplicito', async () => {
    const res = await run(
      { role: 'admin', organization_id: 1005, auditor_org_id: null, user_id: 2027 },
      { auditor_org_id: '25' },
    );
    expect(res.status).not.toHaveBeenCalledWith(403);
    const sql = query.mock.calls[0][0];
    expect(sql).toMatch(/auditor_org_id = @auditor_org_id/);
    expect(query.mock.calls[0][1].auditor_org_id).toBe(25);
  });

  it('viewer senza auditor_org resta 403', async () => {
    const res = await run({ role: 'viewer', organization_id: 1005, auditor_org_id: null, user_id: 2028 });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUDITOR_ORG_REQUIRED' }));
    expect(query).not.toHaveBeenCalled();
  });

  it('auditor con auditor_org_id filtra quello, non lo studio intero', async () => {
    await run({ role: 'auditor', organization_id: 1005, auditor_org_id: 25, user_id: 2029 });
    const sql = query.mock.calls[0][0];
    expect(sql).toMatch(/auditor_org_id = @auditor_org_id/);
    expect(sql).not.toMatch(/auditor_orgs/i);
    expect(query.mock.calls[0][1].auditor_org_id).toBe(25);
  });
});
