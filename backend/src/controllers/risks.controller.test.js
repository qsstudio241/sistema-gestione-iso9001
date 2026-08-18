/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

const { getPool } = require('../config/database');
const { createRisk, updateRisk, listRisks, listRiskReviews, listRiskReviewsScope, detectRisksImport, importRisks, setCompanyPgScale } = require('./risks.controller');
const { buildM03TemplateBuffer } = require('../utils/excelRisksM03Detector');

const USER = { organization_id: 1001, user_id: 7, company_access: [] };

function mockReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    ...overrides,
    user: { ...USER, ...(overrides.user || {}) },
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function buildPool() {
  const queryMock = jest.fn();
  const inputMock = jest.fn();
  getPool.mockResolvedValue({
    request: jest.fn(() => {
      const r = { query: queryMock };
      r.input = jest.fn((...args) => {
        inputMock(...args);
        return r;
      });
      return r;
    }),
  });
  return { queryMock, inputMock };
}

function findSql(queryMock, re) {
  const hit = queryMock.mock.calls.find(([sql]) => re.test(String(sql)));
  return hit ? hit[0] : undefined;
}

function hasSql(queryMock, re) {
  return Boolean(findSql(queryMock, re));
}

const M03_FIELDS = {
  evaluated_element: 'Processo commerciale',
  context_text: 'Mercato in calo',
  interested_parties_text: 'Clienti chiave',
  current_actions: 'Review mensile offerte',
  further_actions: 'Formazione commerciale',
};

describe('createRisk — riga M03 e P×G', () => {
  it('persiste i cinque campi e restituisce score = P × G', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock.mockResolvedValue({
      recordset: [{ risk_id: 42, probability: 3, impact: 2 }],
    });
    const req = mockReq({
      body: {
        title: 'Perdita commessa',
        company_id: 3,
        probability: 3,
        impact: 2,
        ...M03_FIELDS,
      },
    });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data.risk_id).toBe(42);
    expect(payload.data.probability).toBe(3);
    expect(payload.data.impact).toBe(2);
    expect(payload.data.score).toBe(6);
    expect(payload.data.score_level).toBe('medio');

    const insertSql = findSql(queryMock, /INSERT INTO risks/);
    expect(insertSql).toMatch(/evaluated_element/);
    expect(insertSql).toMatch(/context_text/);
    expect(insertSql).toMatch(/interested_parties_text/);
    expect(insertSql).toMatch(/current_actions/);
    expect(insertSql).toMatch(/further_actions/);
    expect(insertSql).toMatch(/residual_probability/);
    expect(insertSql).toMatch(/effectiveness_note/);

    const inputs = inputMock.mock.calls.map(([k, v]) => [k, v]);
    expect(inputs).toEqual(expect.arrayContaining([
      ['evaluated_element', 'Processo commerciale'],
      ['context_text', 'Mercato in calo'],
      ['interested_parties_text', 'Clienti chiave'],
      ['current_actions', 'Review mensile offerte'],
      ['further_actions', 'Formazione commerciale'],
      ['probability', 3],
      ['impact', 2],
      ['residual_probability', null],
      ['residual_impact', null],
    ]));
  });

  it('persiste P/G residui e restituisce residual_score', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock.mockResolvedValue({
      recordset: [{
        risk_id: 43, probability: 3, impact: 3,
        residual_probability: 1, residual_impact: 2,
      }],
    });
    const req = mockReq({
      body: {
        title: 'Perdita commessa',
        company_id: 3,
        probability: 3,
        impact: 3,
        residual_probability: 1,
        residual_impact: 2,
        effectiveness_note: 'Azione in corso, da riesaminare',
      },
    });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.data.score).toBe(9);
    expect(payload.data.residual_score).toBe(2);
    expect(payload.data.residual_score_level).toBe('basso');
    expect(inputMock.mock.calls).toEqual(expect.arrayContaining([
      ['residual_probability', 1],
      ['residual_impact', 2],
      ['effectiveness_note', 'Azione in corso, da riesaminare'],
    ]));
  });

  it('rifiuta residual_impact=4 con 400, senza INSERT', async () => {
    const { queryMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [{ risk_pg_max: 3 }] });
    const req = mockReq({
      body: { title: 'x', probability: 2, impact: 2, residual_impact: 4, company_id: 3 },
    });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(hasSql(queryMock, /INSERT INTO risks/)).toBe(false);
  });

  it('accetta G=5 se l\'azienda ha scala 1-5', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_pg_max: 5 }] })
      .mockResolvedValueOnce({ recordset: [{ risk_id: 44, probability: 2, impact: 5 }] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      body: { title: 'x', probability: 2, impact: 5, company_id: 3 },
    });
    const res = mockRes();
    await createRisk(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json.mock.calls[0][0].data.score).toBe(10);
    expect(inputMock).toHaveBeenCalledWith('impact', 5);
  });

  it('rifiuta G=4 (draft M03) con 400, senza INSERT', async () => {
    const { queryMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [{ risk_pg_max: 3 }] });
    const req = mockReq({ body: { title: 'x', probability: 2, impact: 4, company_id: 3 } });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(hasSql(queryMock, /INSERT INTO risks/)).toBe(false);
  });

  it('persiste metodo SWOT, quadrante e segno G', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock.mockResolvedValue({
      recordset: [{ risk_id: 55, probability: 2, impact: 3, analysis_method: 'swot_signed', swot_quadrant: 'T', impact_sign: -1 }],
    });
    const req = mockReq({
      body: {
        title: 'Minaccia mercato',
        company_id: 3,
        probability: 2,
        impact: 3,
        analysis_method: 'swot_signed',
        swot_quadrant: 'T',
        impact_sign: -1,
      },
    });
    const res = mockRes();
    await createRisk(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(inputMock).toHaveBeenCalledWith('analysis_method', 'swot_signed');
    expect(inputMock).toHaveBeenCalledWith('swot_quadrant', 'T');
    expect(inputMock).toHaveBeenCalledWith('impact_sign', -1);
  });

  it('rifiuta P=5 (FMEA) con 400', async () => {
    const { queryMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [{ risk_pg_max: 3 }] });
    const req = mockReq({ body: { title: 'x', probability: 5, impact: 2, company_id: 3 } });
    const res = mockRes();
    await createRisk(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(hasSql(queryMock, /INSERT INTO risks/)).toBe(false);
  });

  it('senza company_id → 400 COMPANY_REQUIRED, senza INSERT', async () => {
    const { queryMock } = buildPool();
    const req = mockReq({ body: { title: 'x', probability: 2, impact: 2 } });
    const res = mockRes();
    await createRisk(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('COMPANY_REQUIRED');
    expect(hasSql(queryMock, /INSERT INTO risks/)).toBe(false);
  });
});

describe('updateRisk — parziale e P×G', () => {
  it('aggiorna solo further_actions', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3, further_actions: 'Vecchio' }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      params: { id: '10' },
      body: { further_actions: 'Nuovo piano' },
    });
    const res = mockRes();

    await updateRisk(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    const updateSql = queryMock.mock.calls[1][0];
    expect(updateSql).toMatch(/further_actions = @further_actions/);
    expect(updateSql).not.toMatch(/title = @title/);
    expect(inputMock.mock.calls).toEqual(expect.arrayContaining([
      ['further_actions', 'Nuovo piano'],
    ]));
  });

  it('svuota il residuo con stringa vuota → null', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3, residual_probability: 2, residual_impact: 2 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      params: { id: '10' },
      body: { residual_probability: '', residual_impact: '' },
    });
    const res = mockRes();

    await updateRisk(req, res);

    expect(res.json).toHaveBeenCalledWith({ success: true });
    const updateSql = queryMock.mock.calls[1][0];
    expect(updateSql).toMatch(/residual_probability = @residual_probability/);
    expect(inputMock.mock.calls).toEqual(expect.arrayContaining([
      ['residual_probability', null],
      ['residual_impact', null],
    ]));
  });

  it('rifiuta impact=4 con 400 e non esegue UPDATE', async () => {
    const { queryMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3 }] })
      .mockResolvedValueOnce({ recordset: [{ risk_pg_max: 3 }] });
    const req = mockReq({
      params: { id: '10' },
      body: { impact: 4 },
    });
    const res = mockRes();

    await updateRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(queryMock.mock.calls.some(([sql]) => /UPDATE risks/.test(sql))).toBe(false);
  });

  it('accetta impact=5 se l\'azienda ha scala 1-5', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3, impact: 3 }] })
      .mockResolvedValueOnce({ recordset: [{ risk_pg_max: 5 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      params: { id: '10' },
      body: { impact: 5 },
    });
    const res = mockRes();
    await updateRisk(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(inputMock).toHaveBeenCalledWith('impact', 5);
  });

  it('solo titolo non scrive snapshot', async () => {
    const { queryMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3, title: 'A', probability: 2, impact: 2 }] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: '10' }, body: { title: 'B' } });
    const res = mockRes();
    await updateRisk(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(queryMock.mock.calls.some(([sql]) => /INSERT INTO risk_reviews/.test(sql))).toBe(false);
  });

  it('cambio G scrive snapshot', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3, organization_id: 1001, impact: 3, probability: 2 }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: '10' }, body: { impact: 2 } });
    const res = mockRes();
    await updateRisk(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(queryMock.mock.calls.some(([sql]) => /INSERT INTO risk_reviews/.test(sql))).toBe(true);
    expect(inputMock).toHaveBeenCalledWith('impact', 2);
  });

  it('PUT form completo P×G imposta impact_sign una sola volta', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({
        recordset: [{
          risk_id: 10, company_id: 3, organization_id: 1001,
          title: 'X', probability: 2, impact: 2, analysis_method: 'pxg', impact_sign: 1,
        }],
      })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({
      params: { id: '10' },
      body: {
        title: 'X',
        probability: 2,
        impact: 2,
        analysis_method: 'pxg',
        swot_quadrant: '',
        impact_sign: 1,
        company_id: 3,
      },
    });
    const res = mockRes();
    await updateRisk(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    const updateSql = findSql(queryMock, /UPDATE risks SET/);
    expect((updateSql.match(/impact_sign\s*=/g) || []).length).toBe(1);
    expect((updateSql.match(/swot_quadrant\s*=/g) || []).length).toBe(1);
    expect(updateSql).toMatch(/impact_sign = 1/);
    expect(updateSql).toMatch(/swot_quadrant = NULL/);
    expect(inputMock).toHaveBeenCalledWith('company_id', 3);
  });

  it('persiste company_id sull\'orfano', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: null, title: 'Orfano' }] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ params: { id: '10' }, body: { company_id: 48 } });
    const res = mockRes();
    await updateRisk(req, res);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(findSql(queryMock, /UPDATE risks SET/)).toMatch(/company_id = @company_id/);
    expect(inputMock).toHaveBeenCalledWith('company_id', 48);
  });
});

describe('listRisks — colonne M03 e score', () => {
  it('include i cinque campi e decora score', async () => {
    const { queryMock } = buildPool();
    queryMock.mockImplementation((sql) => {
      if (/COUNT\(\*\)/.test(sql)) return Promise.resolve({ recordset: [{ total: 1 }] });
      return Promise.resolve({
        recordset: [{
          risk_id: 1,
          title: 'Perdita commessa',
          probability: 3,
          impact: 3,
          ...M03_FIELDS,
        }],
      });
    });
    const req = mockReq({ query: {} });
    const res = mockRes();

    await listRisks(req, res);

    const listSql = queryMock.mock.calls.find(([sql]) => /SELECT r\.risk_id/.test(sql))[0];
    expect(listSql).toMatch(/r\.status <> 'closed'/);
    expect(listSql).toMatch(/r\.evaluated_element/);
    expect(listSql).toMatch(/r\.context_text/);
    expect(listSql).toMatch(/r\.interested_parties_text/);
    expect(listSql).toMatch(/r\.current_actions/);
    expect(listSql).toMatch(/r\.further_actions/);
    expect(listSql).toMatch(/r\.residual_probability/);
    expect(listSql).toMatch(/r\.effectiveness_note/);

    const payload = res.json.mock.calls[0][0];
    expect(payload.data[0].evaluated_element).toBe('Processo commerciale');
    expect(payload.data[0].score).toBe(9);
    expect(payload.data[0].score_level).toBe('alto');
    expect(payload.data[0].residual_score).toBeNull();
  });

  it('include_closed=1 non esclude i chiusi', async () => {
    const { queryMock } = buildPool();
    queryMock.mockImplementation((sql) => {
      if (/COUNT\(\*\)/.test(sql)) return Promise.resolve({ recordset: [{ total: 0 }] });
      return Promise.resolve({ recordset: [] });
    });
    const req = mockReq({ query: { include_closed: '1' } });
    const res = mockRes();
    await listRisks(req, res);
    const listSql = queryMock.mock.calls.find(([sql]) => /SELECT r\.risk_id/.test(sql))[0];
    expect(listSql).not.toMatch(/r\.status <> 'closed'/);
  });
});

describe('listRiskReviews', () => {
  it('404 se la riga non esiste', async () => {
    const { queryMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [] });
    const req = mockReq({ params: { id: '9' } });
    const res = mockRes();
    await listRiskReviews(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('restituisce snapshot decorati', async () => {
    const { queryMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 9, risk_pg_max: 3 }] })
      .mockResolvedValueOnce({
        recordset: [{
          id: 1, risk_id: 9, probability: 2, impact: 3, impact_sign: -1,
          analysis_method: 'swot_signed', residual_probability: 1, residual_impact: 1,
          recorded_at: '2026-08-15T12:00:00.000Z', recorded_by_name: 'Marco',
        }],
      });
    const req = mockReq({ params: { id: '9' } });
    const res = mockRes();
    await listRiskReviews(req, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data[0].score).toBe(6);
    expect(payload.data[0].signed_score).toBe(-6);
    expect(payload.data[0].residual_score).toBe(1);
    expect(payload.data[0].recorded_by_name).toBe('Marco');
  });
});

describe('listRiskReviewsScope — ROO-17', () => {
  it('senza company_id → 400 COMPANY_REQUIRED', async () => {
    const req = mockReq({ query: { from: '2026-01-01', to: '2026-12-31' } });
    const res = mockRes();
    await listRiskReviewsScope(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('COMPANY_REQUIRED');
  });

  it('from > to → 400 INVALID_RANGE', async () => {
    const req = mockReq({ query: { company_id: '48', from: '2026-12-31', to: '2026-01-01' } });
    const res = mockRes();
    await listRiskReviewsScope(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('INVALID_RANGE');
  });

  it('filtra company_id e date, decora score', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_pg_max: 3 }] })
      .mockResolvedValueOnce({
        recordset: [{
          id: 4, risk_id: 9, company_id: 48, probability: 2, impact: 3, impact_sign: 1,
          analysis_method: 'pxg', recorded_at: '2026-03-02T10:00:00.000Z', recorded_by_name: 'Marco',
        }],
      });
    const req = mockReq({ query: { company_id: '48', from: '2026-01-01', to: '2026-06-30' } });
    const res = mockRes();
    await listRiskReviewsScope(req, res);
    const sql = findSql(queryMock, /FROM risk_reviews rv/);
    expect(sql).toMatch(/rv\.company_id = @companyId/);
    expect(sql).toMatch(/CAST\(rv\.recorded_at AS date\)/);
    expect(sql).toMatch(/LEFT JOIN risks r/);
    expect(sql).not.toMatch(/r\.is_deleted = 0/);
    expect(inputMock).toHaveBeenCalledWith('companyId', 48);
    expect(inputMock).toHaveBeenCalledWith('fromDay', '2026-01-01');
    expect(inputMock).toHaveBeenCalledWith('toDay', '2026-06-30');
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data[0].score).toBe(6);
    expect(payload.meta).toEqual({ company_id: 48, from: '2026-01-01', to: '2026-06-30' });
  });
});

describe('detectRisksImport / importRisks — M03', () => {
  it('senza file → 400', async () => {
    const req = mockReq({ file: null });
    const res = mockRes();
    await detectRisksImport(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('MISSING_FILE');
  });

  it('template vuoto: canImport false', async () => {
    const req = mockReq({ file: { buffer: buildM03TemplateBuffer(), originalname: 'M03.xlsx' } });
    const res = mockRes();
    await detectRisksImport(req, res);
    const data = res.json.mock.calls[0][0].data;
    expect(data.canImport).toBe(false);
    expect(data.fileName).toBe('M03.xlsx');
    expect(data.layout).toBe('m03');
  });

  it('importa solo le righe create e salta G=4', async () => {
    const { queryMock } = buildPool();
    queryMock.mockImplementation((sql) => {
      if (/risk_pg_max/.test(sql)) return Promise.resolve({ recordset: [{ risk_pg_max: 3 }] });
      return Promise.resolve({ recordset: [{ risk_id: 77 }] });
    });
    const req = mockReq({
      body: {
        company_id: 3,
        fileName: 'm03.xlsx',
        rows: [
          { action: 'create', title: 'A', probability: 2, impact: 2, evaluated_element: 'Comm' },
          { action: 'skip', title: 'B', probability: 2, impact: 4 },
          { action: 'create', title: 'C', probability: 2, impact: 4 },
        ],
      },
    });
    const res = mockRes();
    await importRisks(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { inserted: 1, skipped: 2, risk_ids: [77] },
    });
    expect(queryMock.mock.calls.filter(([sql]) => /INSERT INTO risks/.test(sql))).toHaveLength(1);
  });

  it('imposta la scala azienda 1-5', async () => {
    const { queryMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ used_max: 3 }] })
      .mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ body: { company_id: 3, risk_pg_max: 5 } });
    const res = mockRes();
    await setCompanyPgScale(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { company_id: 3, risk_pg_max: 5, used_max: 3 },
    });
  });

  it('rifiuta scala 1-3 se esistono valori 5', async () => {
    const { queryMock } = buildPool();
    queryMock.mockResolvedValueOnce({ recordset: [{ used_max: 5 }] });
    const req = mockReq({ body: { company_id: 3, risk_pg_max: 3 } });
    const res = mockRes();
    await setCompanyPgScale(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('PG_SCALE_IN_USE');
  });

  it('mapping JSON non valido → 400', async () => {
    const req = mockReq({
      file: { buffer: buildM03TemplateBuffer(), originalname: 'M03.xlsx' },
      body: { mapping: '{not-json' },
    });
    const res = mockRes();
    await detectRisksImport(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('INVALID_MAPPING');
  });

  it('residuo a metà (solo G) viene persistito come coppia vuota', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [{ risk_id: 91 }] });
    const req = mockReq({
      body: {
        company_id: 3,
        rows: [
          {
            action: 'create', title: 'A', probability: 2, impact: 2,
            residual_probability: null, residual_impact: 2,
          },
        ],
      },
    });
    const res = mockRes();
    await importRisks(req, res);
    expect(res.json.mock.calls[0][0].data.inserted).toBe(1);
    expect(inputMock).toHaveBeenCalledWith('residual_probability', null);
    expect(inputMock).toHaveBeenCalledWith('residual_impact', null);
  });

  it('importa nature opportunity dalla riga mappata', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock.mockResolvedValue({ recordset: [{ risk_id: 88 }] });
    const req = mockReq({
      body: {
        company_id: 3,
        rows: [
          { action: 'create', title: 'Nuovo mercato', nature: 'opportunity', probability: 1, impact: 2 },
        ],
      },
    });
    const res = mockRes();
    await importRisks(req, res);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { inserted: 1, skipped: 0, risk_ids: [88] },
    });
    expect(inputMock).toHaveBeenCalledWith('nature', 'opportunity');
  });

  it('senza company_id → 400 COMPANY_REQUIRED, senza INSERT', async () => {
    const { queryMock } = buildPool();
    const req = mockReq({
      body: {
        rows: [{ action: 'create', title: 'A', probability: 2, impact: 2 }],
      },
    });
    const res = mockRes();
    await importRisks(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('COMPANY_REQUIRED');
    expect(hasSql(queryMock, /INSERT INTO risks/)).toBe(false);
  });
});
