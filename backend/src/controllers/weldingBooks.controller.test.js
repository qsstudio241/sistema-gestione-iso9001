/**
 * ISO-1d — RBAC company_access sul Welding Book
 * Service reale: user.company_access già caricato.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./weldingBooks.controller');

const ORG_ID = 1001;

const studioAdmin = {
  user_id: 1,
  role: 'admin',
  organization_id: ORG_ID,
  company_access: [],
};

const companyWrite11 = {
  user_id: 2,
  role: 'viewer',
  organization_id: ORG_ID,
  company_access: [{ company_id: 11, permission: 'write' }],
};

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
    user: { ...(overrides.user || studioAdmin) },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockListQueries() {
  query.mockImplementation(async (sql) => {
    if (sql.includes('COUNT(*) AS total')) return { recordset: [{ total: 0 }] };
    return { recordset: [] };
  });
}

function mockGetQueries(book) {
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM welding_books')) return { recordset: book ? [book] : [] };
    return { recordset: [] };
  });
}

afterEach(() => jest.clearAllMocks());

describe('listWeldingBooks — company_access', () => {
  it('studio senza access list: SQL senza IN (@uca_', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listWeldingBooks(mockReq({ user: studioAdmin }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).not.toMatch(/b\.company_id IN/);
    expect(Object.keys(params).some((k) => k.startsWith('uca_'))).toBe(false);
  });

  it('utente con company_access su 11: SQL contiene b.company_id IN', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listWeldingBooks(mockReq({ user: companyWrite11 }), res);
    const sql = query.mock.calls[0][0];
    expect(sql).toMatch(/b\.company_id IN \(@uca_0\)/);
    expect(query.mock.calls[0][1].uca_0).toBe(11);
  });
});

describe('getWeldingBookStats — company_access', () => {
  it('studio senza access list: SQL senza IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0, draft: 0, released: 0 }] });
    const res = mockRes();
    await ctrl.getWeldingBookStats(mockReq({ user: studioAdmin }), res);
    expect(query.mock.calls[0][0]).not.toMatch(/b\.company_id IN/);
  });

  it('utente con company_access: SQL contiene b.company_id IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0, draft: 0, released: 0 }] });
    const res = mockRes();
    await ctrl.getWeldingBookStats(mockReq({ user: companyWrite11 }), res);
    expect(query.mock.calls[0][0]).toMatch(/b\.company_id IN \(@uca_0\)/);
    expect(query.mock.calls[0][1].uca_0).toBe(11);
  });
});

describe('getWeldingBook — company_access', () => {
  it('libro azienda 12 con access solo 11 → 403 FORBIDDEN', async () => {
    mockGetQueries({ id: 5, company_id: 12, book_number: 'WB-2026-001' });
    const res = mockRes();
    await ctrl.getWeldingBook(mockReq({ params: { id: '5' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('libro senza company_id con access list → 403 FORBIDDEN (non 400)', async () => {
    mockGetQueries({ id: 6, company_id: null, book_number: 'WB-2026-002' });
    const res = mockRes();
    await ctrl.getWeldingBook(mockReq({ params: { id: '6' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('libro azienda 11 con access 11 → 200', async () => {
    mockGetQueries({ id: 7, company_id: 11, book_number: 'WB-2026-003' });
    const res = mockRes();
    await ctrl.getWeldingBook(mockReq({ params: { id: '7' }, user: companyWrite11 }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 7, company_id: 11 }),
    }));
  });

  it('studio admin senza access list: get ok su qualsiasi azienda', async () => {
    mockGetQueries({ id: 8, company_id: 12, book_number: 'WB-2026-004' });
    const res = mockRes();
    await ctrl.getWeldingBook(mockReq({ params: { id: '8' }, user: studioAdmin }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 8, company_id: 12 }),
    }));
  });
});

describe('createWeldingBook — company_access', () => {
  it('create fuori scope (azienda 12) → 403, nessun INSERT', async () => {
    const res = mockRes();
    await ctrl.createWeldingBook(mockReq({
      user: companyWrite11,
      body: { company_id: 12, product_code: 'X' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('studio admin senza access list: create ok', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO welding_books')) {
        return { recordset: [{ id: 99, company_id: 12, book_number: 'WB-2026-001' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createWeldingBook(mockReq({
      user: studioAdmin,
      body: { company_id: 12, product_code: 'P1' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('updateWeldingBook — company_access', () => {
  it('update libro di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.updateWeldingBook(mockReq({
      params: { id: '5' },
      user: companyWrite11,
      body: { product_code: 'Tentativo' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(query.mock.calls.length).toBe(1);
  });
});

describe('deleteWeldingBook — company_access', () => {
  it('delete libro di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.deleteWeldingBook(mockReq({
      params: { id: '5' },
      user: companyWrite11,
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.mock.calls.length).toBe(1);
  });
});
