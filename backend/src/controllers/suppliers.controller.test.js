/**
 * Test listSuppliers — filtro company_id (Mason audit 2ª parte)
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
    companyAccessSqlFilter: jest.fn(() => ({ clause: null, params: {} })),
  };
});

const { query } = require('../config/database');
const ctrl = require('./suppliers.controller');

const ORG_ID = 1001;

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
    user: {
      organization_id: ORG_ID,
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

afterEach(() => jest.clearAllMocks());

describe('listSuppliers — filtro company_id', () => {
  it('con company_id=7 aggiunge filtro SQL e parametro', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 1, name: 'Fornitore A', company_id: 7 }] });
    const req = mockReq({ query: { company_id: '7' } });
    const res = mockRes();

    await ctrl.listSuppliers(req, res);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toContain('s.company_id = @company_id');
    expect(params.company_id).toBe(7);
    expect(params.org).toBe(ORG_ID);
  });

  it('senza company_id non aggiunge filtro company_id', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ query: { supplier_type: 'external' } });
    const res = mockRes();

    await ctrl.listSuppliers(req, res);

    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).not.toContain('s.company_id = @company_id');
    expect(params.company_id).toBeUndefined();
    expect(params.st).toBe('external');
  });

  it('company_id=abc restituisce 400', async () => {
    const req = mockReq({ query: { company_id: 'abc' } });
    const res = mockRes();

    await ctrl.listSuppliers(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
    expect(query).not.toHaveBeenCalled();
  });
});
