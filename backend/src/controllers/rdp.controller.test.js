/**
 * ISO-1a — RBAC company_access sui Rapporti di Prova
 * Service reale: user.company_access già caricato, nessuna query su user_company_access.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const ctrl = require('./rdp.controller');

const ORG_ID = 1001;

const studioAdmin = {
  user_id: 1,
  role: 'admin',
  organization_id: ORG_ID,
  company_access: [],
  full_name: 'Studio Admin',
};

const companyWrite11 = {
  user_id: 2,
  role: 'viewer',
  organization_id: ORG_ID,
  company_access: [{ company_id: 11, permission: 'write' }],
  full_name: 'Utente Azienda 11',
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

function mockGetQueries(report) {
  query.mockImplementation(async (sql) => {
    if (sql.includes('FROM rdp_reports')) return { recordset: report ? [report] : [] };
    return { recordset: [] };
  });
}

afterEach(() => jest.clearAllMocks());

describe('listRdpReports — company_access', () => {
  it('studio senza access list: SQL senza IN (@uca_', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listRdpReports(mockReq({ user: studioAdmin }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).not.toMatch(/r\.company_id IN/);
    expect(Object.keys(params).some((k) => k.startsWith('uca_'))).toBe(false);
  });

  it('utente con company_access su 11: SQL contiene r.company_id IN', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listRdpReports(mockReq({ user: companyWrite11 }), res);

    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/r\.company_id IN \(@uca_0\)/);
    expect(params.uca_0).toBe(11);
  });
});

describe('getRdpStats — company_access', () => {
  it('studio senza access list: SQL senza IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0, draft: 0, completed: 0, approved: 0, avg_score_overall: null }] });
    const res = mockRes();
    await ctrl.getRdpStats(mockReq({ user: studioAdmin }), res);
    expect(query.mock.calls[0][0]).not.toMatch(/r\.company_id IN/);
  });

  it('utente con company_access: SQL contiene r.company_id IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0, draft: 0, completed: 0, approved: 0, avg_score_overall: null }] });
    const res = mockRes();
    await ctrl.getRdpStats(mockReq({ user: companyWrite11 }), res);
    expect(query.mock.calls[0][0]).toMatch(/r\.company_id IN \(@uca_0\)/);
    expect(query.mock.calls[0][1].uca_0).toBe(11);
  });
});

describe('getRdpReport — company_access', () => {
  it('report azienda 12 con access solo 11 → 403 FORBIDDEN', async () => {
    mockGetQueries({ id: 5, company_id: 12, report_number: 'RDP-2026-001' });
    const res = mockRes();
    await ctrl.getRdpReport(mockReq({ params: { id: '5' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('report senza company_id con access list → 403 FORBIDDEN (non 400)', async () => {
    mockGetQueries({ id: 6, company_id: null, report_number: 'RDP-2026-002' });
    const res = mockRes();
    await ctrl.getRdpReport(mockReq({ params: { id: '6' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('report azienda 11 con access 11 → 200', async () => {
    mockGetQueries({ id: 7, company_id: 11, report_number: 'RDP-2026-003' });
    const res = mockRes();
    await ctrl.getRdpReport(mockReq({ params: { id: '7' }, user: companyWrite11 }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 7, company_id: 11 }),
    }));
  });

  it('studio admin senza access list: get ok su qualsiasi azienda', async () => {
    mockGetQueries({ id: 8, company_id: 12, report_number: 'RDP-2026-004' });
    const res = mockRes();
    await ctrl.getRdpReport(mockReq({ params: { id: '8' }, user: studioAdmin }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 8, company_id: 12 }),
    }));
  });
});

describe('createRdpReport — company_access', () => {
  it('create fuori scope (azienda 12) → 403, nessun INSERT', async () => {
    const res = mockRes();
    await ctrl.createRdpReport(mockReq({
      user: companyWrite11,
      body: { company_id: 12, client: 'Altro' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('studio admin senza access list: create ok', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO rdp_reports')) {
        return { recordset: [{ id: 99, company_id: 12, report_number: 'RDP-2026-001' }] };
      }
      if (sql.includes('FROM rdp_reports')) {
        return { recordset: [{ id: 99, company_id: 12, report_number: 'RDP-2026-001' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createRdpReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('create con project_id di altra azienda → 400', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM dbo.projects')) {
        return { recordset: [{ id: 12, company_id: 99 }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createRdpReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', project_id: 12 },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROJECT_COMPANY_MISMATCH' }));
  });
});

describe('updateRdpReport — company_access', () => {
  it('update RDP di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.updateRdpReport(mockReq({
      params: { id: '5' },
      user: companyWrite11,
      body: { client: 'Tentativo' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(query.mock.calls.length).toBe(1);
  });

  it('cambio azienda senza project_id: 400 se la commessa resta dell\'altra azienda', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT id, company_id, project_id FROM rdp_reports')) {
        return { recordset: [{ id: 5, company_id: 12, project_id: 40 }] };
      }
      if (sql.includes('FROM dbo.projects')) {
        return { recordset: [{ id: 40, company_id: 12 }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateRdpReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { company_id: 99, client: 'Altro' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROJECT_COMPANY_MISMATCH' }));
  });
});

describe('deleteRdpReport — company_access', () => {
  it('delete RDP di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.deleteRdpReport(mockReq({
      params: { id: '5' },
      user: companyWrite11,
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.mock.calls.length).toBe(1);
  });
});
