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

jest.mock('../services/contractReviewWorkflow.service', () => {
  const actual = jest.requireActual('../services/contractReviewWorkflow.service');
  return {
    ...actual,
    evaluateTransitionBlockers: jest.fn().mockResolvedValue({ blocked: false, missing: [] }),
  };
});

jest.mock('../services/contractReviewNotification.service', () => ({
  notifyAfterStatusTransition: jest.fn().mockResolvedValue(null),
  notifyAfterAssigneeChange: jest.fn().mockResolvedValue(null),
}));

jest.mock('../services/aiProviderAdapter', () => ({
  chat: jest.fn(),
  getActiveProvider: jest.fn(() => 'gemini'),
}));

jest.mock('../services/aiContextBuilder.service', () => ({
  buildReviewRequirementsContext: jest.fn().mockResolvedValue({
    systemPrompt: 'SYS',
    userPrompt: 'USR',
    contextSummary: 'ctx',
  }),
}));

jest.mock('../services/aiOrganizationContext.service', () => ({
  enrichSystemPromptWithOrganization: jest.fn(async (p) => p),
}));

const { query, getPool, sql } = require('../config/database');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
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

  it('rifiuta company_id fuori organizzazione (400)', async () => {
    query.mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({ body: { title: 'Test', company_id: 999 } });
    const res = mockRes();
    await ctrl.createCase(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/non appartiene/);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

// ─── updateCase — commercial_customer_id ─────────────────────────────────────
describe('updateCase — commercial_customer_id', () => {
  const existingCase = {
    id: 12,
    status: 'DRAFT',
    title: 'Caso LM&CO',
    organization_id: ORG_ID,
    company_id: 55,
    commercial_customer_id: null,
    commercial_customer_name: 'PT.MAIDO',
    commercial_customer_ref: null,
    notes: null,
    external_ref: null,
    current_assignee_id: null,
  };

  it('collega controparte e sincronizza snapshot name/ref', async () => {
    query
      .mockResolvedValueOnce({ recordset: [existingCase] })
      .mockResolvedValueOnce({
        recordset: [{
          id: 9,
          name: 'PT.MAIDO',
          external_ref: 'PT001',
          role: 'end_customer',
          company_id: 55,
          organization_id: ORG_ID,
          is_active: 1,
        }],
      })
      .mockResolvedValueOnce({
        recordset: [{
          ...existingCase,
          commercial_customer_id: 9,
          commercial_customer_name: 'PT.MAIDO',
          commercial_customer_ref: 'PT001',
        }],
      });

    const req = mockReq({
      params: { id: '12' },
      body: { commercial_customer_id: 9 },
    });
    const res = mockRes();
    await ctrl.updateCase(req, res);

    expect(query.mock.calls[2][0]).toContain('commercial_customer_id = @commercialCustomerId');
    expect(query.mock.calls[2][1]).toMatchObject({
      commercialCustomerId: 9,
      commercialCustomerName: 'PT.MAIDO',
      commercialCustomerRef: 'PT001',
    });
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ commercial_customer_id: 9 }),
    );
  });

  it('rifiuta controparte non dell\'azienda (400)', async () => {
    query
      .mockResolvedValueOnce({ recordset: [existingCase] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      params: { id: '12' },
      body: { commercial_customer_id: 999 },
    });
    const res = mockRes();
    await ctrl.updateCase(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('VALIDATION_ERROR');
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

// ─── linkDocument (supplier_id S2) ───────────────────────────────────────────
describe('linkDocument', () => {
  const CASE_ID = 10;
  const DOC_ID = 55;
  const SUPPLIER_ID = 3;

  it('collega documento con supplier_id valido (201)', async () => {
    const linked = {
      id: 100,
      case_id: CASE_ID,
      document_id: DOC_ID,
      counterparty: 'supplier',
      supplier_id: SUPPLIER_ID,
    };
    query
      .mockResolvedValueOnce({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] })
      .mockResolvedValueOnce({ recordset: [{ id: DOC_ID }] })
      .mockResolvedValueOnce({ recordset: [{ id: SUPPLIER_ID }] })
      .mockResolvedValueOnce({ recordset: [linked] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: {
        document_id: DOC_ID,
        counterparty: 'supplier',
        direction: 'in',
        supplier_id: SUPPLIER_ID,
      },
    });
    const res = mockRes();
    await ctrl.linkDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(linked);
    const insertCall = query.mock.calls[3];
    expect(insertCall[1]).toMatchObject({ supplierId: SUPPLIER_ID, cp: 'supplier' });
  });

  it('supplier_id inesistente → 400', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] })
      .mockResolvedValueOnce({ recordset: [{ id: DOC_ID }] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: {
        document_id: DOC_ID,
        counterparty: 'supplier',
        supplier_id: 999,
      },
    });
    const res = mockRes();
    await ctrl.linkDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/Fornitore non trovato/);
  });

  it('supplier_id non valido → 400', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] })
      .mockResolvedValueOnce({ recordset: [{ id: DOC_ID }] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: {
        document_id: DOC_ID,
        counterparty: 'supplier',
        supplier_id: 'abc',
      },
    });
    const res = mockRes();
    await ctrl.linkDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/supplier_id non valido/);
  });

  it('ignora supplier_id se counterparty non è supplier', async () => {
    const linked = { id: 101, case_id: CASE_ID, document_id: DOC_ID, supplier_id: null };
    query
      .mockResolvedValueOnce({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] })
      .mockResolvedValueOnce({ recordset: [{ id: DOC_ID }] })
      .mockResolvedValueOnce({ recordset: [linked] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: {
        document_id: DOC_ID,
        counterparty: 'customer',
        supplier_id: SUPPLIER_ID,
      },
    });
    const res = mockRes();
    await ctrl.linkDocument(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const insertCall = query.mock.calls[2];
    expect(insertCall[1]).toMatchObject({ supplierId: null });
  });
});

// ─── registerHandoff (H1) ────────────────────────────────────────────────────
describe('registerHandoff', () => {
  const CASE_ID = 10;

  it('registra handoff su caso APPROVED (200)', async () => {
    const approved = { id: CASE_ID, status: 'APPROVED', organization_id: ORG_ID };
    const updated = {
      ...approved,
      handoff_ref: 'COMM-2026-042',
      handoff_at: '2026-06-02T10:00:00Z',
      handoff_by: USER_ID,
    };
    query
      .mockResolvedValueOnce({ recordset: [approved] })
      .mockResolvedValueOnce({ recordset: [updated] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: { handoff_ref: 'COMM-2026-042', notes: 'Note test' },
    });
    const res = mockRes();
    await ctrl.registerHandoff(req, res);

    expect(res.json).toHaveBeenCalledWith(updated);
    expect(query.mock.calls[1][1]).toMatchObject({
      handoffRef: 'COMM-2026-042',
      caseId: CASE_ID,
      organizationId: ORG_ID,
      userId: USER_ID,
    });
  });

  it('rifiuta se status non APPROVED (409)', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: CASE_ID, status: 'FINAL_REVIEW', organization_id: ORG_ID }],
    });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: { handoff_ref: 'COMM-1' },
    });
    const res = mockRes();
    await ctrl.registerHandoff(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toMatch(/solo per casi approvati/);
  });

  it('handoff_ref mancante → 400', async () => {
    query.mockResolvedValueOnce({
      recordset: [{ id: CASE_ID, status: 'APPROVED', organization_id: ORG_ID }],
    });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: { handoff_ref: '   ' },
    });
    const res = mockRes();
    await ctrl.registerHandoff(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/handoff_ref obbligatorio/);
  });

  it('caso non trovato → 404', async () => {
    query.mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: { handoff_ref: 'COMM-1' },
    });
    const res = mockRes();
    await ctrl.registerHandoff(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

// ─── importFromJob ───────────────────────────────────────────────────────────
describe('importFromJob', () => {
  const JOB_ID = 99;
  const jobRow = { id: JOB_ID, title: 'Import RFQ', company_id: 12, notes: 'Note job' };
  const fileRow = {
    id: 501,
    original_name: 'rfq.pdf',
    storage_path: '/tmp/rfq.pdf',
    mime_type: 'application/pdf',
    file_size: 1000,
    status: 'extracted',
    extracted_text: 'Testo estratto dal PDF',
    ai_extraction_json: '{"document_type_guess":"rfq"}',
    commercial_case_id: null,
  };

  function setupImportTransactionMock(createdRow) {
    const tx = {
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    };
    sql.Transaction.mockReturnValue(tx);
    sql.Request.mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({
        recordset: [createdRow || { attachment_id: 1, attachment_uuid: 'uuid-att', file_name: 'rfq.pdf' }],
        rowsAffected: [1],
      }),
    }));
    getPool.mockResolvedValue({});
  }

  it('crea caso da job con file extracted (201)', async () => {
    const created = {
      id: 20,
      uuid: 'case-uuid-20',
      status: 'DRAFT',
      title: 'Import RFQ',
      organization_id: ORG_ID,
    };
    setupImportTransactionMock();
    sql.Request.mockImplementationOnce(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [created] }),
    }));

    query
      .mockResolvedValueOnce({ recordset: [jobRow] })
      .mockResolvedValueOnce({ recordset: [fileRow] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 12 }] });

    const req = mockReq({ body: { job_id: JOB_ID } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const body = res.json.mock.calls[0][0];
    expect(body.case_id).toBe(20);
    expect(body.uuid).toBe('case-uuid-20');
    expect(body.job_id).toBe(JOB_ID);
  });

  it('rifiuta override company_id fuori organizzazione', async () => {
    query
      .mockResolvedValueOnce({ recordset: [jobRow] })
      .mockResolvedValueOnce({ recordset: [fileRow] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] });

    const req = mockReq({ body: { job_id: JOB_ID, company_id: 999 } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toMatch(/non appartiene/);
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('job altra org → 404', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    const req = mockReq({ body: { job_id: JOB_ID } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('file già collegato via commercial_case_id → 409', async () => {
    query
      .mockResolvedValueOnce({ recordset: [jobRow] })
      .mockResolvedValueOnce({
        recordset: [{ ...fileRow, commercial_case_id: 7 }],
      })
      .mockResolvedValueOnce({ recordset: [{ id: 7, uuid: 'existing-uuid' }] });

    const req = mockReq({ body: { job_id: JOB_ID } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('ALREADY_LINKED');
    expect(res.json.mock.calls[0][0].case_id).toBe(7);
  });

  it('file già collegato via allegato → 409', async () => {
    query
      .mockResolvedValueOnce({ recordset: [jobRow] })
      .mockResolvedValueOnce({ recordset: [fileRow] })
      .mockResolvedValueOnce({
        recordset: [{ file_id: 501, case_id: 7, case_uuid: 'existing-uuid' }],
      });

    const req = mockReq({ body: { job_id: JOB_ID } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].code).toBe('ALREADY_LINKED');
  });

  it('job senza file idonei → 400', async () => {
    query
      .mockResolvedValueOnce({ recordset: [jobRow] })
      .mockResolvedValueOnce({ recordset: [{ ...fileRow, status: 'uploaded' }] });

    const req = mockReq({ body: { job_id: JOB_ID } });
    const res = mockRes();
    await ctrl.importFromJob(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].code).toBe('NO_ELIGIBLE_FILES');
  });
});

// ─── analyzeRequirements — persistenza analisi capitolato (slice #2) ──────────
describe('analyzeRequirements — persistenza', () => {
  const CASE_ID = 30;
  const suggestion = {
    identified_requirements: [
      { ref: 'REQ-01', description: 'Materiale S355', assessment: 'to_verify' },
      { ref: 'REQ-02', description: 'Consegna 30gg', assessment: 'gap', gap_detail: 'tempi stretti' },
    ],
    identified_standards: ['ISO 3834-2'],
    overall_risk: 'medium',
    summary: 'Analisi di prova',
  };

  // Mock "intelligente" per testo SQL: indipendente dall'ordine delle chiamate.
  function installQueryMock({ caseRows = [{ id: CASE_ID, organization_id: ORG_ID, company_id: 5 }], analysisId = 77 } = {}) {
    query.mockImplementation((sqlText) => {
      if (/WHERE cc\.id = @caseId/.test(sqlText)) return Promise.resolve({ recordset: caseRows });
      if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) return Promise.resolve({ recordset: [{ id: analysisId }] });
      if (/INSERT INTO commercial_case_extracted_requirements/.test(sqlText)) return Promise.resolve({ recordset: [] });
      return Promise.resolve({ recordset: [] });
    });
  }

  it('persiste job source=text + un requisito per riga e ritorna analysis_id', async () => {
    getActiveProvider.mockReturnValue('gemini');
    chat.mockResolvedValue({ content: JSON.stringify(suggestion), model: 'gemini-2.5-flash' });
    installQueryMock();

    const req = mockReq({ params: { id: String(CASE_ID) }, body: { capitolatoText: 'Capitolato di prova' } });
    const res = mockRes();
    await ctrl.analyzeRequirements(req, res);

    const jobInsert = query.mock.calls.find((c) => /INSERT INTO commercial_case_drawing_extractions/.test(c[0]));
    expect(jobInsert).toBeTruthy();
    expect(jobInsert[0]).toMatch(/'text'/); // source = 'text'
    const reqInserts = query.mock.calls.filter((c) => /INSERT INTO commercial_case_extracted_requirements/.test(c[0]));
    expect(reqInserts).toHaveLength(2);
    expect(reqInserts[0][1]).toMatchObject({ extractionId: 77, fieldKey: 'REQ-01', valueText: 'Materiale S355' });

    const body = res.json.mock.calls[0][0];
    expect(body.analysis_id).toBe(77);
    expect(body.suggestion).toMatchObject({ overall_risk: 'medium' });
  });

  it('ISO-3: unisce EN 10204 rilevata nel testo a identified_standards', async () => {
    getActiveProvider.mockReturnValue('gemini');
    chat.mockResolvedValue({
      content: JSON.stringify({ ...suggestion, identified_standards: ['ISO 3834-2'] }),
      model: 'm',
    });
    installQueryMock();

    const req = mockReq({
      params: { id: String(CASE_ID) },
      body: { capitolatoText: 'Richiesto certificato 3.1 secondo EN 10204 e filo ISO 14341' },
    });
    const res = mockRes();
    await ctrl.analyzeRequirements(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.suggestion.identified_standards).toEqual(
      expect.arrayContaining(['ISO 3834-2', 'EN 10204', 'ISO 14341']),
    );
  });

  it('ISO-3: persiste field_key canonico se presente sulla riga requisito', async () => {
    getActiveProvider.mockReturnValue('gemini');
    chat.mockResolvedValue({
      content: JSON.stringify({
        identified_requirements: [
          {
            ref: 'REQ-01',
            field_key: 'inspection_document_type',
            description: 'Certificato 3.1',
          },
        ],
        identified_standards: [],
        overall_risk: 'low',
        summary: 'ok',
      }),
      model: 'm',
    });
    installQueryMock();

    const req = mockReq({ params: { id: String(CASE_ID) }, body: { capitolatoText: 'x' } });
    const res = mockRes();
    await ctrl.analyzeRequirements(req, res);

    const reqInserts = query.mock.calls.filter((c) => /INSERT INTO commercial_case_extracted_requirements/.test(c[0]));
    expect(reqInserts[0][1]).toMatchObject({
      fieldKey: 'inspection_document_type',
      valueText: 'Certificato 3.1',
    });
  });

  it('provider AI non configurato → 503', async () => {
    getActiveProvider.mockReturnValue(null);
    const req = mockReq({ params: { id: String(CASE_ID) }, body: { capitolatoText: 'x' } });
    const res = mockRes();
    await ctrl.analyzeRequirements(req, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].code).toBe('AI_NOT_CONFIGURED');
  });

  it('persistenza fallita non blocca la risposta (analysis_id null)', async () => {
    getActiveProvider.mockReturnValue('gemini');
    chat.mockResolvedValue({ content: JSON.stringify(suggestion), model: 'm' });
    query.mockImplementation((sqlText) => {
      if (/WHERE cc\.id = @caseId/.test(sqlText)) return Promise.resolve({ recordset: [{ id: CASE_ID, organization_id: ORG_ID, company_id: 5 }] });
      if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) return Promise.reject(new Error('Invalid column name source'));
      return Promise.resolve({ recordset: [] });
    });

    const req = mockReq({ params: { id: String(CASE_ID) }, body: { capitolatoText: 'x' } });
    const res = mockRes();
    await ctrl.analyzeRequirements(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.analysis_id).toBeNull();
    expect(body.suggestion).toMatchObject({ overall_risk: 'medium' });
  });
});

// ─── getCase — espone l'ultima analisi testo persistita ──────────────────────
describe('getCase — text_analysis', () => {
  const CASE_ID = 31;

  it('include text_analysis con suggestion parsata quando presente', async () => {
    query.mockImplementation((sqlText) => {
      if (/WHERE cc\.id = @caseId/.test(sqlText)) return Promise.resolve({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] });
      if (/source = 'text'/.test(sqlText)) return Promise.resolve({ recordset: [{ id: 9, raw_response: '{"summary":"ok","overall_risk":"low"}', created_at: '2026-06-24T10:00:00Z' }] });
      return Promise.resolve({ recordset: [] });
    });

    const req = mockReq({ params: { id: String(CASE_ID) } });
    const res = mockRes();
    await ctrl.getCase(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.text_analysis).toBeTruthy();
    expect(body.text_analysis.id).toBe(9);
    expect(body.text_analysis.suggestion).toMatchObject({ overall_risk: 'low' });
  });

  it('text_analysis null quando nessuna analisi persistita', async () => {
    query.mockImplementation((sqlText) => {
      if (/WHERE cc\.id = @caseId/.test(sqlText)) return Promise.resolve({ recordset: [{ id: CASE_ID, organization_id: ORG_ID }] });
      return Promise.resolve({ recordset: [] });
    });

    const req = mockReq({ params: { id: String(CASE_ID) } });
    const res = mockRes();
    await ctrl.getCase(req, res);

    const body = res.json.mock.calls[0][0];
    expect(body.text_analysis).toBeNull();
  });
});
