/**
 * @jest-environment node
 */

/**
 * Test L1 — managementReviews.controller :: getInputSummary (§9.3.2)
 * Copre:
 *  - aggregazione dati NC/obiettivi/audit/fornitori/reclami/rischi/riesame precedente
 *  - applicazione filtro company_id opzionale (G6)
 *  - scope multi-tenant su organization_id
 *  - gestione errori per-blocco (try/catch → zeri + nota, risposta sempre 200)
 *  - guard RBAC su accesso azienda (assertCompanyRead)
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));

jest.mock('../utils/logger', () => ({
  info:  jest.fn(),
  error: jest.fn(),
  warn:  jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn(async () => []),
  companyAccessSqlFilter:    jest.fn(() => ({ clause: null, params: {} })),
  assertCompanyRead:         jest.fn(async () => null),
  assertMutatingAllowed:     jest.fn(async () => null),
  sendAccessDenied:          jest.fn((res, denial) =>
    res.status(denial.status || 403).json({ error: denial.message || 'Accesso negato' })),
}));

const { getPool } = require('../config/database');
const { assertCompanyRead } = require('../services/companyAccess.service');
const ctrl = require('./managementReviews.controller');

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
  res.json   = jest.fn().mockReturnValue(res);
  res.set    = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Crea un pool fittizio in cui ogni pool.request() condivide lo stesso
 * queryMock (risultati in sequenza) e registra tutte le .input() su inputMock.
 */
function buildPool() {
  const queryMock = jest.fn();
  const inputMock = jest.fn();
  const request = () => {
    const r = { query: queryMock };
    r.input = jest.fn((k, v) => { inputMock(k, v); return r; });
    return r;
  };
  getPool.mockResolvedValue({ request });
  return { queryMock, inputMock };
}

// Risultati "tutto ok" nell'ordine delle 9 query di getInputSummary
function okResults() {
  return [
    { recordset: [{ open_count: 5, overdue_count: 2, closed_period: 10 }] },       // 1. NC summary
    { recordset: [{ nc_id: 1, nc_number: 'NC-1', description: 'Difetto saldatura',
                    severity: 'major', status: 'open', due_date: '2026-01-10' }] }, // 2. NC dettaglio
    { recordset: [{ total: 4, achieved: 3 }] },                                     // 3. Obiettivi
    { recordset: [{ conducted: 2, planned: 1 }] },                                  // 4. Audit
    { recordset: [{ evaluated: 3, avg_score: 87.3 }] },                             // 5. Fornitori
    { recordset: [{ total: 7 }] },                                                  // 6. Reclami
    { recordset: [{ open_count: 4, mitigated_closed_period: 2, high_priority: 1 }] }, // 7. Rischi
    { recordset: [{ review_number: 'RD-2025-001', review_date: '2025-12-01',
                    output_improvements: 'x', output_sgq_changes: 'y', output_resources: 'z' }] }, // 8. Riesame prec.
    { recordset: [{ clause_ref: '9.3', clause_title: 'Riesame di direzione', last_verified: '2026-03-01' }] }, // 9. Copertura norm.
  ];
}

afterEach(() => jest.clearAllMocks());

describe('getInputSummary — aggregazione blocchi §9.3.2', () => {
  it('aggrega NC, obiettivi, audit, fornitori, reclami, rischi e riesame precedente', async () => {
    const { queryMock } = buildPool();
    okResults().forEach((r) => queryMock.mockResolvedValueOnce(r));

    const req = mockReq();
    const res = mockRes();
    await ctrl.getInputSummary(req, res);

    expect(res.status).not.toHaveBeenCalled();
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    const d = payload.data;

    expect(d.nc).toMatchObject({ open: 5, overdue: 2, total_closed_period: 10 });
    expect(d.nc.details).toHaveLength(1);
    expect(d.nc.details[0]).toMatchObject({ number: 'NC-1', severity: 'major' });
    expect(d.objectives).toMatchObject({ total: 4, achieved: 3, percentage: 75 });
    expect(d.audits).toMatchObject({ conducted: 2, planned: 1 });
    expect(d.suppliers).toMatchObject({ evaluated: 3, avg_score: 87.3 });
    expect(d.complaints).toMatchObject({ total: 7 });
    expect(d.risks).toMatchObject({ open: 4, mitigated_closed_period: 2, high_priority: 1 });
    expect(d.previous_review).toMatchObject({ review_number: 'RD-2025-001' });
    expect(d.norm_coverage[0]).toMatchObject({ clause: '9.3', status: 'ok' });
  });

  it('disabilita la cache HTTP (Cache-Control: no-store)', async () => {
    const { queryMock } = buildPool();
    okResults().forEach((r) => queryMock.mockResolvedValueOnce(r));

    const res = mockRes();
    await ctrl.getInputSummary(mockReq(), res);

    expect(res.set).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });
});

describe('getInputSummary — scope organization_id', () => {
  it('passa sempre organization_id come parametro di ogni blocco', async () => {
    const { queryMock, inputMock } = buildPool();
    okResults().forEach((r) => queryMock.mockResolvedValueOnce(r));

    await ctrl.getInputSummary(mockReq(), mockRes());

    const orgCalls = inputMock.mock.calls.filter(([k]) => k === 'orgId');
    expect(orgCalls.length).toBeGreaterThan(0);
    orgCalls.forEach(([, v]) => expect(v).toBe(ORG_ID));
    // Le query NC e obiettivi devono filtrare per organizzazione
    expect(queryMock.mock.calls[0][0]).toMatch(/organization_id/);
  });
});

describe('getInputSummary — filtro company_id opzionale (G6)', () => {
  it('con company_id applica il filtro SQL e registra il parametro su ogni blocco', async () => {
    const { queryMock, inputMock } = buildPool();
    okResults().forEach((r) => queryMock.mockResolvedValueOnce(r));

    await ctrl.getInputSummary(mockReq({ query: { company_id: '7' } }), mockRes());

    // guard RBAC interrogata per l'azienda richiesta
    expect(assertCompanyRead).toHaveBeenCalledWith(expect.anything(), 7);
    // parametro companyId iniettato come intero
    const companyCalls = inputMock.mock.calls.filter(([k]) => k === 'companyId');
    expect(companyCalls.length).toBeGreaterThan(0);
    companyCalls.forEach(([, v]) => expect(v).toBe(7));
    // SQL del blocco NC contiene il filtro azienda
    expect(queryMock.mock.calls[0][0]).toContain('a.company_id = @companyId');
  });

  it('senza company_id non inietta il parametro né il filtro azienda', async () => {
    const { queryMock, inputMock } = buildPool();
    okResults().forEach((r) => queryMock.mockResolvedValueOnce(r));

    await ctrl.getInputSummary(mockReq(), mockRes());

    expect(assertCompanyRead).not.toHaveBeenCalled();
    const companyCalls = inputMock.mock.calls.filter(([k]) => k === 'companyId');
    expect(companyCalls.length).toBe(0);
    expect(queryMock.mock.calls[0][0]).not.toContain('@companyId');
  });

  it('nega l\'accesso (403) se assertCompanyRead rifiuta l\'azienda', async () => {
    buildPool();
    assertCompanyRead.mockResolvedValueOnce({ status: 403, message: 'Accesso azienda negato' });

    const res = mockRes();
    await ctrl.getInputSummary(mockReq({ query: { company_id: '99' } }), res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('getInputSummary — gestione errori per-blocco', () => {
  it('se un blocco fallisce ritorna zeri + nota senza far cadere la risposta', async () => {
    const { queryMock } = buildPool();
    // 1° blocco (NC summary) fallisce, i restanti 8 vanno a buon fine
    queryMock.mockRejectedValueOnce(new Error('DB timeout'));
    okResults().slice(1).forEach((r) => queryMock.mockResolvedValueOnce(r));

    const res = mockRes();
    await ctrl.getInputSummary(mockReq(), res);

    expect(res.status).not.toHaveBeenCalled();
    const d = res.json.mock.calls[0][0].data;
    expect(d.nc.open).toBe(0);
    expect(d.nc.note).toBe('Dato non disponibile');
    // gli altri blocchi restano popolati correttamente
    expect(d.objectives).toMatchObject({ total: 4, achieved: 3, percentage: 75 });
    expect(d.complaints.total).toBe(7);
  });
});
