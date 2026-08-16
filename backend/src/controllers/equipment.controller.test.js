/**
 * ISO-1c — RBAC company_access sulle Attrezzature
 * Service reale: user.company_access già caricato.
 * Asset studio (company_id NULL) restano visibili in lettura.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./equipment.controller');

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

function mockGetQueries(asset) {
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM equipment_assets')) return { recordset: asset ? [asset] : [] };
    return { recordset: [] };
  });
}

afterEach(() => jest.clearAllMocks());

describe('listEquipment — company_access', () => {
  it('studio senza access list: SQL senza IN (@uca_', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listEquipment(mockReq({ user: studioAdmin }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = query.mock.calls[0][0];
    expect(sql).not.toMatch(/ea\.company_id IN/);
    expect(sql).not.toContain('user_company_id');
  });

  it('utente azienda: SQL include NULL studio OR IN propria azienda', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listEquipment(mockReq({ user: companyWrite11 }), res);
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/ea\.company_id IS NULL OR ea\.company_id IN \(@uca_0\)/);
    expect(params.uca_0).toBe(11);
  });
});

describe('getEquipmentStats — company_access', () => {
  it('utente azienda: SQL include NULL OR IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0 }] });
    const res = mockRes();
    await ctrl.getEquipmentStats(mockReq({ user: companyWrite11 }), res);
    expect(query.mock.calls[0][0]).toMatch(/ea\.company_id IS NULL OR ea\.company_id IN \(@uca_0\)/);
  });
});

describe('getEquipment — company_access', () => {
  it('asset azienda 12 con access solo 11 → 403 FORBIDDEN', async () => {
    mockGetQueries({ id: 5, company_id: 12, name: 'Altro' });
    const res = mockRes();
    await ctrl.getEquipment(mockReq({ params: { id: '5' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('asset studio (company_id NULL) con access list → 200 (condiviso)', async () => {
    mockGetQueries({ id: 6, company_id: null, name: 'Calibro studio' });
    const res = mockRes();
    await ctrl.getEquipment(mockReq({ params: { id: '6' }, user: companyWrite11 }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 6, company_id: null }),
    }));
  });

  it('asset azienda 11 con access 11 → 200', async () => {
    mockGetQueries({ id: 7, company_id: 11, name: 'Proprio' });
    const res = mockRes();
    await ctrl.getEquipment(mockReq({ params: { id: '7' }, user: companyWrite11 }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 7, company_id: 11 }),
    }));
  });
});

describe('createEquipment — company_access', () => {
  it('create fuori scope (azienda 12) → 403, nessun INSERT', async () => {
    const res = mockRes();
    await ctrl.createEquipment(mockReq({
      user: companyWrite11,
      body: { company_id: 12, name: 'Fuori' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('create asset studio da utente azienda → 403', async () => {
    const res = mockRes();
    await ctrl.createEquipment(mockReq({
      user: companyWrite11,
      body: { name: 'Studio' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('studio admin: create asset studio ok', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 99, company_id: null, name: 'Studio' }] });
    const res = mockRes();
    await ctrl.createEquipment(mockReq({
      user: studioAdmin,
      body: { name: 'Studio' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

describe('updateEquipment — company_access', () => {
  it('update asset di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.updateEquipment(mockReq({
      params: { id: '5' },
      user: companyWrite11,
      body: { name: 'Tentativo' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.mock.calls.length).toBe(1);
  });

  it('update asset studio da utente azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 6, company_id: null }] });
    const res = mockRes();
    await ctrl.updateEquipment(mockReq({
      params: { id: '6' },
      user: companyWrite11,
      body: { name: 'Tentativo' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('deleteEquipment — company_access', () => {
  it('delete asset di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.deleteEquipment(mockReq({
      params: { id: '5' },
      user: companyWrite11,
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.mock.calls.length).toBe(1);
  });
});

describe('addCalibration — company_access', () => {
  it('taratura su asset di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12, calibration_frequency_months: 12 }] });
    const res = mockRes();
    await ctrl.addCalibration(mockReq({
      params: { id: '5' },
      user: companyWrite11,
      body: { calibration_date: '2026-01-01' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
