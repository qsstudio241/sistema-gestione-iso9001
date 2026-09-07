/**
 * @jest-environment node
 */

/**
 * L1 — company.controller allega ai_context (CTX-2)
 */
jest.mock('../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('../services/documentTreeProvisioner.service', () => ({}));
jest.mock('../services/billing.service', () => ({
  syncCompanyActiveStatus: jest.fn(),
  onCompanyCreated: jest.fn(),
}));
jest.mock('../services/companyMaintenance.service', () => ({
  hardDeleteCompany: jest.fn(),
}));
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
const ctrl = require('./company.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('company.controller ai_context (CTX-2)', () => {
  beforeEach(() => {
    query.mockReset();
  });

  it('GET /:id include ai_context da scoreCompanyContext', async () => {
    query.mockResolvedValue({
      recordset: [{
        id: 42,
        auditor_org_id: 1,
        name: 'Acme',
        vat_number: null,
        sector: null,
        address: null,
        logo_url: null,
        iso3834_level: null,
        risk_pg_max: null,
        is_active: true,
        created_at: null,
        updated_at: null,
      }],
    });
    const req = {
      params: { id: '42' },
      query: {},
      user: { role: 'auditor', auditor_org_id: 1, organization_id: 1001 },
    };
    const res = mockRes();
    await ctrl.getCompanyById(req, res);
    expect(res.json).toHaveBeenCalled();
    const body = res.json.mock.calls[0][0];
    expect(body.success).toBe(true);
    expect(body.data.ai_context).toBeDefined();
    expect(body.data.ai_context.version).toBe('company-v1');
    expect(body.data.ai_context.scope).toBe('company');
    expect(body.data.ai_context.level).toBe('incompleto');
    expect(Array.isArray(body.data.ai_context.missing)).toBe(true);
    expect(body.data.ai_context.missing).toEqual(
      expect.arrayContaining(['vat_number', 'sector', 'address'])
    );
  });

  it('GET /:id score pronto se campi company-v1 pieni', async () => {
    query.mockResolvedValue({
      recordset: [{
        id: 7,
        auditor_org_id: 1,
        name: 'Acme Srl',
        vat_number: 'IT12345678901',
        sector: 'Metalmeccanica',
        address: 'Via Roma 12, Padova',
        logo_url: null,
        iso3834_level: '3',
        risk_pg_max: null,
        is_active: true,
        created_at: null,
        updated_at: null,
      }],
    });
    const req = {
      params: { id: '7' },
      query: {},
      user: { role: 'auditor', auditor_org_id: 1, organization_id: 1001 },
    };
    const res = mockRes();
    await ctrl.getCompanyById(req, res);
    const body = res.json.mock.calls[0][0];
    expect(body.data.ai_context.score).toBe(100);
    expect(body.data.ai_context.level).toBe('pronto');
    expect(body.data.ai_context.missing).toEqual([]);
  });
});
