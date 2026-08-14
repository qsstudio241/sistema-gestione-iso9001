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
const { createRisk, updateRisk, listRisks } = require('./risks.controller');

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

    const insertSql = queryMock.mock.calls[0][0];
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
    const req = mockReq({
      body: { title: 'x', probability: 2, impact: 2, residual_impact: 4 },
    });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rifiuta G=4 (draft M03) con 400, senza INSERT', async () => {
    const { queryMock } = buildPool();
    const req = mockReq({ body: { title: 'x', probability: 2, impact: 4 } });
    const res = mockRes();

    await createRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it('rifiuta P=5 (FMEA) con 400', async () => {
    buildPool();
    const req = mockReq({ body: { title: 'x', probability: 5, impact: 2 } });
    const res = mockRes();
    await createRisk(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
  });
});

describe('updateRisk — parziale e P×G', () => {
  it('aggiorna solo further_actions', async () => {
    const { queryMock, inputMock } = buildPool();
    queryMock
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3 }] })
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
      .mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3 }] })
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
    queryMock.mockResolvedValueOnce({ recordset: [{ risk_id: 10, company_id: 3 }] });
    const req = mockReq({
      params: { id: '10' },
      body: { impact: 4 },
    });
    const res = mockRes();

    await updateRisk(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/1 e 3/);
    expect(queryMock).toHaveBeenCalledTimes(1);
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
});
