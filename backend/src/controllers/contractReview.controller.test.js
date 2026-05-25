/**
 * @jest-environment node
 */

/**
 * Test L1 — contractReview.controller
 * Copre: isTransitionAllowed, requiresTransitionReason, listCases, createCase,
 *        transitionStatus, generateChecklist, saveChecklistAnswer
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
  sql: {
    Transaction: jest.fn().mockImplementation(() => ({
      begin:    jest.fn().mockResolvedValue(),
      commit:   jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    })),
    Request: jest.fn().mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [1] }),
    })),
  },
}));

jest.mock('../utils/logger', () => ({
  info:  jest.fn(),
  error: jest.fn(),
  warn:  jest.fn(),
  debug: jest.fn(),
}));

const { query, getPool, sql } = require('../config/database');
const ctrl = require('./contractReview.controller');

const ORG_ID = 42;
const USER_ID = 7;

function mockReq(overrides = {}) {
  return {
    user: { organization_id: ORG_ID, user_id: USER_ID },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

afterEach(() => jest.clearAllMocks());

// ─── listCases ───────────────────────────────────────────────────────────────
describe('listCases', () => {
  it('restituisce tutti i casi senza filtro', async () => {
    const cases = [{ id: 1, status: 'DRAFT', title: 'Test' }];
    query.mockResolvedValueOnce({ recordset: cases });

    const req = mockReq({ query: {} });
    const res = mockRes();
    await ctrl.listCases(req, res);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toMatchObject({ organizationId: ORG_ID, filterStatus: null });
    expect(res.json).toHaveBeenCalledWith(cases);
  });

  it('filtra per status valido', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ query: { status: 'DRAFT' } });
    const res = mockRes();
    await ctrl.listCases(req, res);
    expect(query.mock.calls[0][1]).toMatchObject({ filterStatus: 'DRAFT' });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it('rifiuta status non valido (400)', async () => {
    const req = mockReq({ query: { status: 'INVALID' } });
    const res = mockRes();
    await ctrl.listCases(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── createCase ──────────────────────────────────────────────────────────────
describe('createCase', () => {
  function setupTransactionMock(insertedRow) {
    const txReqInsert = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [insertedRow] }),
    };
    const txReqHist = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const tx = {
      begin:    jest.fn().mockResolvedValue(),
      commit:   jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };
    sql.Transaction.mockReturnValue(tx);
    let callCount = 0;
    sql.Request.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? txReqInsert : txReqHist;
    });
    getPool.mockResolvedValue({});
  }

  it('crea il caso e risponde 201', async () => {
    const created = { id: 10, status: 'DRAFT', title: 'Commessa A', organization_id: ORG_ID };
    setupTransactionMock(created);

    const req = mockReq({ body: { title: 'Commessa A' } });
    const res = mockRes();
    await ctrl.createCase(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it('rifiuta titolo vuoto (400)', async () => {
    const req = mockReq({ body: { title: '   ' } });
    const res = mockRes();
    await ctrl.createCase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rifiuta company_id non numerico (400)', async () => {
    const req = mockReq({ body: { title: 'Test', company_id: 'abc' } });
    const res = mockRes();
    await ctrl.createCase(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── transitionStatus ────────────────────────────────────────────────────────
describe('transitionStatus', () => {
  function setupTransitionMocks(currentStatus) {
    const caseRow = { id: 5, status: currentStatus, organization_id: ORG_ID };
    const lockReq = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [caseRow] }),
    };
    const updReq = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const histReq = {
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
    };
    const tx = {
      begin:    jest.fn().mockResolvedValue(),
      commit:   jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };
    sql.Transaction.mockReturnValue(tx);
    let cnt = 0;
    sql.Request.mockImplementation(() => {
      cnt++;
      if (cnt === 1) return lockReq;
      if (cnt === 2) return updReq;
      return histReq;
    });
    getPool.mockResolvedValue({});
    // Ultima query (fetchCaseRow dopo commit)
    query.mockResolvedValue({ recordset: [{ ...caseRow }] });
  }

  it('DRAFT → INTAKE_REVIEW transizione consentita', async () => {
    setupTransitionMocks('DRAFT');
    const req = mockReq({ params: { id: '5' }, body: { to_status: 'INTAKE_REVIEW' } });
    const res = mockRes();
    await ctrl.transitionStatus(req, res);
    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });

  it('DRAFT → APPROVED transizione non consentita (400)', async () => {
    setupTransitionMocks('DRAFT');
    const req = mockReq({ params: { id: '5' }, body: { to_status: 'APPROVED' } });
    const res = mockRes();
    await ctrl.transitionStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('INVALID_TRANSITION');
  });

  it('CANCELLED richiede motivazione', async () => {
    setupTransitionMocks('QUOTE_SENT');
    const req = mockReq({ params: { id: '5' }, body: { to_status: 'CANCELLED' } });
    const res = mockRes();
    await ctrl.transitionStatus(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
  });

  it('CANCELLED con motivazione è consentito', async () => {
    setupTransitionMocks('QUOTE_SENT');
    const req = mockReq({ params: { id: '5' }, body: { to_status: 'CANCELLED', reason: 'Cliente ha ritirato la richiesta' } });
    const res = mockRes();
    await ctrl.transitionStatus(req, res);
    expect(res.json).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(400);
  });
});

// ─── generateChecklist ───────────────────────────────────────────────────────
describe('generateChecklist', () => {
  function setupChecklistMocks(caseRow) {
    const tx = {
      begin:    jest.fn().mockResolvedValue(),
      commit:   jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };
    sql.Transaction.mockReturnValue(tx);
    sql.Request.mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [1] }),
    }));
    getPool.mockResolvedValue({});
    // fetchCaseRow + SELECT lista
    query
      .mockResolvedValueOnce({ recordset: [caseRow] })
      .mockResolvedValueOnce({ recordset: [{ id: 1, phase: 'preliminary', item_ref: 'P1', item_text: 'Req.tecnici' }] });
  }

  it('genera checklist preliminare (201)', async () => {
    setupChecklistMocks({ id: 2, status: 'INTAKE_REVIEW', organization_id: ORG_ID });
    const req = mockReq({ params: { id: '2' }, body: { phase: 'preliminary' } });
    const res = mockRes();
    await ctrl.generateChecklist(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.phase).toBe('preliminary');
  });

  it('rifiuta phase non valida (400)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 2, status: 'DRAFT', organization_id: ORG_ID }] });
    const req = mockReq({ params: { id: '2' }, body: { phase: 'invalid' } });
    const res = mockRes();
    await ctrl.generateChecklist(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// ─── saveChecklistAnswer ─────────────────────────────────────────────────────
describe('saveChecklistAnswer', () => {
  it('salva risposta yes (200)', async () => {
    const updated = { id: 3, answer: 'yes', notes: '' };
    query
      .mockResolvedValueOnce({ recordset: [{ id: 5, status: 'INTAKE_REVIEW', organization_id: ORG_ID }] })
      .mockResolvedValueOnce({ recordset: [updated] });

    const req = mockReq({
      params: { id: '5', itemId: '3' },
      body: { answer: 'yes', notes: 'tutto ok' },
    });
    const res = mockRes();
    await ctrl.saveChecklistAnswer(req, res);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('rifiuta answer non valido (400)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ id: 5, status: 'DRAFT', organization_id: ORG_ID }] });
    const req = mockReq({
      params: { id: '5', itemId: '3' },
      body: { answer: 'INVALID' },
    });
    const res = mockRes();
    await ctrl.saveChecklistAnswer(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
