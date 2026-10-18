/**
 * ISO-1b — RBAC company_access sui verbali NDT (CND)
 * Service reale: user.company_access già caricato, nessuna query su user_company_access.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));
jest.mock('../services/ndtInspectorGate.service', () => ({
  GATE_CODE: 'NDT_INSPECTOR_GATE',
  isJudgmentStatus: (s) => s === 'completed' || s === 'approved',
  isNdt9712Qualification: (q) => /9712|NDT/i.test(String((q && q.qualification_type) || ''))
    || ['VT', 'MT', 'PT', 'UT', 'RT'].includes(String((q && q.ndt_method) || '').toUpperCase()),
  evaluateNdtInspectorGate: jest.fn().mockResolvedValue({
    ok: true, reasons: [], qualification: null, vision: { state: 'ok' }, candidates: [],
  }),
}));
jest.mock('../services/ndtReportRegistryPose.service', () => ({
  poseNdtReportInRegistry: jest.fn().mockResolvedValue(null),
}));

const { query } = require('../config/database');
const { evaluateNdtInspectorGate } = require('../services/ndtInspectorGate.service');
const { poseNdtReportInRegistry } = require('../services/ndtReportRegistryPose.service');
const ctrl = require('./ndtReports.controller');

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
    if (sql.includes('FROM ndt_reports')) return { recordset: report ? [report] : [] };
    return { recordset: [] };
  });
}

afterEach(() => {
  jest.clearAllMocks();
  if (typeof ctrl.resetInspectionPhaseColumnCache === 'function') {
    ctrl.resetInspectionPhaseColumnCache();
  }
});

describe('listNdtReports — company_access', () => {
  it('studio senza access list: SQL senza IN (@uca_', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({ user: studioAdmin }), res);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).not.toMatch(/r\.company_id IN/);
    expect(Object.keys(params).some((k) => k.startsWith('uca_'))).toBe(false);
  });

  it('utente con company_access su 11: SQL contiene r.company_id IN', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({ user: companyWrite11 }), res);

    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/r\.company_id IN \(@uca_0\)/);
    expect(params.uca_0).toBe(11);
  });
});

describe('getNdtStats — company_access', () => {
  it('studio senza access list: SQL senza IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0 }] });
    const res = mockRes();
    await ctrl.getNdtStats(mockReq({ user: studioAdmin }), res);
    expect(query.mock.calls[0][0]).not.toMatch(/r\.company_id IN/);
  });

  it('utente con company_access: SQL contiene r.company_id IN', async () => {
    query.mockResolvedValueOnce({ recordset: [{ total: 0 }] });
    const res = mockRes();
    await ctrl.getNdtStats(mockReq({ user: companyWrite11 }), res);
    expect(query.mock.calls[0][0]).toMatch(/r\.company_id IN \(@uca_0\)/);
    expect(query.mock.calls[0][1].uca_0).toBe(11);
  });
});

describe('getNdtReport — company_access', () => {
  it('verbale azienda 12 con access solo 11 → 403 FORBIDDEN', async () => {
    mockGetQueries({ id: 5, company_id: 12, report_number: 'VT-2026-001' });
    const res = mockRes();
    await ctrl.getNdtReport(mockReq({ params: { id: '5' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('verbale senza company_id con access list → 403 FORBIDDEN (non 400)', async () => {
    mockGetQueries({ id: 6, company_id: null, report_number: 'VT-2026-002' });
    const res = mockRes();
    await ctrl.getNdtReport(mockReq({ params: { id: '6' }, user: companyWrite11 }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('verbale azienda 11 con access 11 → 200', async () => {
    mockGetQueries({ id: 7, company_id: 11, report_number: 'VT-2026-003' });
    const res = mockRes();
    await ctrl.getNdtReport(mockReq({ params: { id: '7' }, user: companyWrite11 }), res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 7, company_id: 11 }),
    }));
  });

  it('studio admin senza access list: get ok su qualsiasi azienda', async () => {
    mockGetQueries({ id: 8, company_id: 12, report_number: 'VT-2026-004' });
    const res = mockRes();
    await ctrl.getNdtReport(mockReq({ params: { id: '8' }, user: studioAdmin }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ id: 8, company_id: 12 }),
    }));
  });
});

describe('createNdtReport — company_access', () => {
  it('create fuori scope (azienda 12) → 403, nessun INSERT', async () => {
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: companyWrite11,
      body: { company_id: 12, client: 'Altro' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query).not.toHaveBeenCalled();
  });

  it('studio admin senza access list: create ok', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO ndt_reports')) {
        return { recordset: [{ id: 99, company_id: 12, report_number: 'VT-2026-001' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
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
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', project_id: 12 },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROJECT_COMPANY_MISMATCH' }));
  });
});

describe('updateNdtReport — company_access', () => {
  it('update verbale di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
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
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return { recordset: [{ id: 5, company_id: 12, project_id: 40 }] };
      }
      if (sql.includes('FROM dbo.projects')) {
        return { recordset: [{ id: 40, company_id: 12 }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { company_id: 99, client: 'Altro' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'PROJECT_COMPANY_MISMATCH' }));
  });
});

describe('deleteNdtReport — company_access', () => {
  it('delete verbale di altra azienda → 403', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, company_id: 12 }] });
    const res = mockRes();
    await ctrl.deleteNdtReport(mockReq({
      params: { id: '5' },
      user: companyWrite11,
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(query.mock.calls.length).toBe(1);
  });
});

describe('gate ispettore 9712 + visione', () => {
  beforeEach(() => {
    evaluateNdtInspectorGate.mockResolvedValue({
      ok: true, reasons: [], qualification: null, vision: { state: 'ok' }, candidates: [],
    });
  });

  it('create bozza: non chiama il gate', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO ndt_reports')) {
        return { recordset: [{ id: 99, company_id: 12, report_number: 'VT-2026-001' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', status: 'draft' },
    }), res);
    expect(evaluateNdtInspectorGate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('create completed senza 9712 → 409, nessun INSERT', async () => {
    evaluateNdtInspectorGate.mockResolvedValue({
      ok: false,
      reasons: ['Nessun patentino ISO 9712 in anagrafica per Studio Admin.'],
      qualification: null,
      vision: { state: 'missing' },
      candidates: [],
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', status: 'completed', inspector: 'Studio Admin', report_type: 'VT' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NDT_INSPECTOR_GATE' }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO ndt_reports'))).toBe(false);
  });

  it('update completed senza visione → 409', async () => {
    evaluateNdtInspectorGate.mockResolvedValue({
      ok: false,
      reasons: ['Idoneit\u00e0 visiva assente. Caricare il certificato oculistico in Qualifiche.'],
      qualification: { id: 1, ndt_method: 'VT', ndt_level: 2 },
      vision: { state: 'missing' },
      candidates: [],
    });
    query.mockResolvedValueOnce({
      recordset: [{ id: 5, company_id: 12, project_id: null, report_type: 'VT', inspector: 'Mario Rossi' }],
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { status: 'completed', inspector: 'Mario Rossi' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NDT_INSPECTOR_GATE',
    }));
  });

  it('GET eligibility restituisce ok + candidati', async () => {
    evaluateNdtInspectorGate.mockResolvedValue({
      ok: true,
      reasons: [],
      qualification: { id: 1, person_name: 'Mario Rossi', ndt_method: 'VT', ndt_level: 2 },
      vision: { state: 'ok' },
      candidates: [{ person_name: 'Mario Rossi', ndt_method: 'VT' }],
    });
    const res = mockRes();
    await ctrl.getInspectorEligibility(mockReq({
      user: studioAdmin,
      query: { inspector: 'Mario Rossi', report_type: 'VT', company_id: '12' },
    }), res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ ok: true }),
    }));
  });

  it('GET eligibility fuori company_access → 403, non valuta il gate', async () => {
    const res = mockRes();
    await ctrl.getInspectorEligibility(mockReq({
      user: companyWrite11,
      query: { inspector: 'Mario Rossi', report_type: 'VT', company_id: '12' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));
    expect(evaluateNdtInspectorGate).not.toHaveBeenCalled();
  });

  it('GET eligibility in scope: passa allowedCompanyIds', async () => {
    const res = mockRes();
    await ctrl.getInspectorEligibility(mockReq({
      user: companyWrite11,
      query: { inspector: 'Mario Rossi', report_type: 'VT', company_id: '11' },
    }), res);
    expect(evaluateNdtInspectorGate).toHaveBeenCalledWith(expect.objectContaining({
      companyId: 11,
      allowedCompanyIds: [11],
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('CND-7 — posa Registro su Completa', () => {
  beforeEach(() => {
    evaluateNdtInspectorGate.mockResolvedValue({
      ok: true, reasons: [], qualification: null, vision: { state: 'ok' }, candidates: [],
    });
    poseNdtReportInRegistry.mockResolvedValue(null);
  });

  it('update completed: chiama pose e include registry_pose nella risposta', async () => {
    poseNdtReportInRegistry.mockResolvedValue({
      document_id: 501,
      created: true,
      folder_code: '9.3',
      parent_id: 10,
      folder_missing: false,
      message: 'Verbale posato nel Registro Documenti (cartella 9.3).',
    });
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 5, company_id: 12, project_id: null, report_type: 'VT', inspector: 'Mario Rossi',
          }],
        };
      }
      if (sql.includes('UPDATE ndt_reports SET')) return { recordset: [] };
      if (sql.includes('company_name')) {
        return {
          recordset: [{
            id: 5,
            company_id: 12,
            report_number: 'VT-2026-001',
            report_type: 'VT',
            status: 'completed',
            inspector: 'Mario Rossi',
            company_name: 'Cliente',
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { status: 'completed', inspector: 'Mario Rossi' },
    }), res);

    expect(poseNdtReportInRegistry).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: ORG_ID,
      report: expect.objectContaining({ id: 5, status: 'completed' }),
    }));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      registry_pose: expect.objectContaining({ document_id: 501, folder_missing: false }),
    }));
  });

  it('update draft: non chiama pose', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 5, company_id: 12, project_id: null, report_type: 'VT', inspector: 'Mario Rossi',
          }],
        };
      }
      if (sql.includes('company_name')) {
        return {
          recordset: [{
            id: 5, company_id: 12, report_number: 'VT-2026-001', status: 'draft',
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi' },
    }), res);
    expect(poseNdtReportInRegistry).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(res.json.mock.calls[0][0].registry_pose).toBeUndefined();
  });
});

describe('inspection_phase prima / durante / dopo', () => {
  function insertParams() {
    const call = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ndt_reports'));
    return call && call[1];
  }

  it('create senza fase: salva after', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO ndt_reports')) {
        return { recordset: [{ id: 99, report_number: 'VT-2026-001' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', status: 'draft' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertParams().inspection_phase).toBe('after');
    expect(String(query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ndt_reports'))[0]))
      .toMatch(/inspection_phase/);
  });

  it('create during: salva during', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (sql.includes('INSERT INTO ndt_reports')) {
        return { recordset: [{ id: 100, report_number: 'VT-2026-002' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', status: 'draft', inspection_phase: 'during' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertParams().inspection_phase).toBe('during');
  });

  it('create con fase sconosciuta → 400, nessun INSERT', async () => {
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, client: 'Cliente', inspection_phase: 'lux-350' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NDT_PHASE_INVALID' }));
    expect(query).not.toHaveBeenCalled();
  });

  it('lista filtra per before', async () => {
    mockListQueries();
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({
      user: studioAdmin,
      query: { inspection_phase: 'before' },
    }), res);
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/r\.inspection_phase = @inspection_phase/);
    expect(sql).toMatch(/r\.inspection_phase/);
    expect(params.inspection_phase).toBe('before');
  });

  it('lista con fase sconosciuta → 400', async () => {
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({
      user: studioAdmin,
      query: { inspection_phase: 'dopo-saldatura' },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(query).not.toHaveBeenCalled();
  });

  it('update scrive before e non tocca una fase assente nel body', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 5, company_id: 12, project_id: null, report_type: 'VT',
            inspector: 'Mario Rossi', inspection_phase: 'after',
          }],
        };
      }
      return { recordset: [] };
    });
    const resKeep = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi' },
    }), resKeep);
    const keepCall = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE ndt_reports'));
    expect(keepCall[1].inspection_phase).toBe('after');

    query.mockClear();
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 5, company_id: 12, project_id: null, report_type: 'VT',
            inspector: 'Mario Rossi', inspection_phase: 'after',
          }],
        };
      }
      return { recordset: [] };
    });
    const resSet = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '5' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi', inspection_phase: 'before' },
    }), resSet);
    const setCall = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE ndt_reports'));
    expect(setCall[1].inspection_phase).toBe('before');
    expect(resSet.status).not.toHaveBeenCalledWith(400);
  });

  it('update di un verbale con fase vuota non scrive after se il body non sceglie la fase', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 8, company_id: 12, project_id: null, report_type: 'VT',
            inspector: 'Mario Rossi', inspection_phase: null,
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '8' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi', inspection_phase: '' },
    }), res);
    const upd = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE ndt_reports'));
    expect(res.status).not.toHaveBeenCalledWith(400);
    expect(upd[1].inspection_phase).toBeNull();
  });

  it('update di un verbale con fase vuota scrive before se il body lo sceglie', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 8, company_id: 12, project_id: null, report_type: 'VT',
            inspector: 'Mario Rossi', inspection_phase: null,
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '8' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi', inspection_phase: 'before' },
    }), res);
    const upd = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE ndt_reports'));
    expect(upd[1].inspection_phase).toBe('before');
  });

  it('update di un verbale con fase vuota scrive after solo se il body lo sceglie', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('FROM ndt_reports WHERE id = @id') && sql.includes('company_id')) {
        return {
          recordset: [{
            id: 8, company_id: 12, project_id: null, report_type: 'VT',
            inspector: 'Mario Rossi', inspection_phase: null,
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.updateNdtReport(mockReq({
      params: { id: '8' },
      user: studioAdmin,
      body: { status: 'draft', inspector: 'Mario Rossi', inspection_phase: 'after' },
    }), res);
    const upd = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE ndt_reports'));
    expect(upd[1].inspection_phase).toBe('after');
  });
});

describe('listNdtReports senza colonna inspection_phase (migrazione 177 assente)', () => {
  afterEach(() => {
    if (typeof ctrl.resetInspectionPhaseColumnCache === 'function') {
      ctrl.resetInspectionPhaseColumnCache();
    }
  });

  it('risponde 200 e rilancia la SELECT senza la colonna', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('inspection_phase')) {
        throw new Error("Invalid column name 'inspection_phase'.");
      }
      if (String(sql).includes('COUNT(*) AS total')) return { recordset: [{ total: 1 }] };
      return { recordset: [{ id: 7, report_number: 'VT-2020-004', client: 'Officina' }] };
    });
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({ user: studioAdmin }), res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: [expect.objectContaining({ id: 7, report_number: 'VT-2020-004' })],
    }));
    const dataSql = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('OFFSET'));
    expect(dataSql.length).toBeGreaterThan(0);
    expect(dataSql[dataSql.length - 1]).not.toMatch(/inspection_phase/);
  });

  it('filtro fase con colonna assente non va in errore SQL', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('inspection_phase')) {
        throw new Error("Invalid column name 'inspection_phase'.");
      }
      if (String(sql).includes('COUNT(*) AS total')) return { recordset: [{ total: 1 }] };
      return { recordset: [{ id: 7, report_number: 'VT-2020-004' }] };
    });
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({
      user: studioAdmin,
      query: { inspection_phase: 'before' },
    }), res);
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    const dataSql = query.mock.calls.map(([sql]) => String(sql)).filter((sql) => sql.includes('OFFSET'));
    expect(dataSql[dataSql.length - 1]).not.toMatch(/inspection_phase/);
  });

  it('un altro errore SQL resta 500', async () => {
    query.mockRejectedValue(new Error('timeout di rete'));
    const res = mockRes();
    await ctrl.listNdtReports(mockReq({ user: studioAdmin }), res);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'NDT_LIST_ERROR' }));
  });
});

describe('inspector_qualification_id', () => {
  const patent = {
    id: 41,
    person_name: 'Mario Rossi',
    certificate_number: 'VT-99',
    qualification_type: 'Certificazione NDT ISO 9712',
    ndt_method: 'VT',
    ndt_level: 2,
    company_id: 12,
    status: 'valida',
    deleted_at: null,
  };

  function mockCreateQueries() {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM qualifications')) return { recordset: [patent] };
      if (String(sql).includes('COUNT(*) AS cnt')) return { recordset: [{ cnt: 0 }] };
      if (String(sql).includes('INSERT INTO ndt_reports')) return { recordset: [{ id: 99 }] };
      return { recordset: [] };
    });
  }

  it('salva l\'id e il nome del patentino, anche se il testo inviato è diverso', async () => {
    mockCreateQueries();
    evaluateNdtInspectorGate.mockClear();
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: {
        company_id: 12,
        client: 'Cliente',
        status: 'draft',
        inspector: 'Nome sbagliato',
        inspector_qualification_id: 41,
      },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    const params = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO ndt_reports'))[1];
    expect(params.inspector_qualification_id).toBe(41);
    expect(params.inspector).toBe('Mario Rossi');
    expect(evaluateNdtInspectorGate).not.toHaveBeenCalled();
  });

  it('in completamento il gate legge l\'id del patentino', async () => {
    mockCreateQueries();
    evaluateNdtInspectorGate.mockClear();
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: {
        company_id: 12,
        client: 'Cliente',
        status: 'completed',
        inspector_qualification_id: 41,
      },
    }), res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(evaluateNdtInspectorGate).toHaveBeenCalledWith(expect.objectContaining({
      qualificationId: 41,
      inspectorName: 'Mario Rossi',
      reportType: 'VT',
    }));
  });

  it('rifiuta un collegamento che non è un patentino ISO 9712', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM qualifications')) {
        return {
          recordset: [{
            ...patent,
            qualification_type: 'Saldatore ISO 9606-1',
            ndt_method: null,
          }],
        };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await ctrl.createNdtReport(mockReq({
      user: studioAdmin,
      body: { company_id: 12, status: 'draft', inspector_qualification_id: 41 },
    }), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      code: 'NDT_INSPECTOR_QUALIFICATION_NOT_9712',
    }));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO ndt_reports'))).toBe(false);
  });
});
