/**
 * Test CRUD companyCounterparties.controller (PR1)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/companyAccess.service', () => {
  const actual = jest.requireActual('../services/companyAccess.service');
  return {
    ...actual,
    ensureCompanyAccessLoaded: jest.fn(async (user) => {
      if (user?.company_access !== undefined) return user.company_access;
      user.company_access = [];
      return [];
    }),
  };
});

const { query } = require('../config/database');
const ctrl = require('./companyCounterparties.controller');

const AUDITOR_ORG_ID = 10;
const ORG_ID = 1001;
const COMPANY_ID = 42;

function mockReq(overrides = {}) {
  return {
    params: { companyId: String(COMPANY_ID) },
    query: {},
    body: {},
    ...overrides,
    user: {
      auditor_org_id: AUDITOR_ORG_ID,
      organization_id: ORG_ID,
      role: 'auditor',
      user_id: 7,
      company_access: [],
      ...(overrides.user || {}),
    },
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

describe('companyCounterparties — scope RBAC', () => {
  it('listCounterparties 403 cross-studio se azienda non in auditor_org', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq();
    const res = mockRes();
    await ctrl.listCounterparties(req, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });
});

describe('companyCounterparties CRUD', () => {
  it('listCounterparties filtra per organization_id e company_id', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{ id: 1, name: 'PT.MAIDO', role: 'end_customer' }],
    });
    const req = mockReq({ query: { role: 'end_customer' } });
    const res = mockRes();
    await ctrl.listCounterparties(req, res);
    expect(query.mock.calls[1][0]).toContain('organization_id = @organization_id');
    expect(query.mock.calls[1][0]).toContain('cc.role = @role');
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [{ id: 1, name: 'PT.MAIDO', role: 'end_customer' }],
    });
  });

  it('createCounterparty valida nome e ruolo', async () => {
    mockCompanyScope();
    const req = mockReq({ body: { name: '  ', role: 'customer' } });
    const res = mockRes();
    await ctrl.createCounterparty(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('createCounterparty inserisce con organization_id da scope', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{
        id: 9,
        name: 'LM&CO',
        role: 'customer',
        organization_id: ORG_ID,
        company_id: COMPANY_ID,
      }],
    });
    const req = mockReq({
      body: { name: 'LM&CO', role: 'customer', external_ref: 'LM001' },
    });
    const res = mockRes();
    await ctrl.createCounterparty(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(query.mock.calls[1][1].organization_id).toBe(ORG_ID);
    expect(query.mock.calls[1][1].company_id).toBe(COMPANY_ID);
  });

  it('deactivateCounterparty soft-delete is_active=0', async () => {
    mockCompanyScope();
    query.mockResolvedValueOnce({
      recordset: [{ id: 3, is_active: 1 }],
    });
    query.mockResolvedValueOnce({
      recordset: [{ id: 3, is_active: 0 }],
    });
    const req = mockReq({ params: { companyId: String(COMPANY_ID), id: '3' } });
    const res = mockRes();
    await ctrl.deactivateCounterparty(req, res);
    expect(query.mock.calls[2][0]).toContain('is_active = 0');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: 'Controparte disattivata' }),
    );
  });
});

describe('companyCounterparties — validateRole', () => {
  it('accetta ruoli previsti', () => {
    expect(ctrl.validateRole('customer')).toBe(true);
    expect(ctrl.validateRole('end_customer')).toBe(true);
    expect(ctrl.validateRole('supplier')).toBe(true);
    expect(ctrl.validateRole('invalid')).toBe(false);
  });
});
