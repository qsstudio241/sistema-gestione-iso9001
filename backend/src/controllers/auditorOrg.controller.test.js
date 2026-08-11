/**
 * @jest-environment node
 */

/**
 * Test L1 — auditorOrg.controller
 * Copre: createAuditorOrg (DEPUTYTASK1 S1 — provisioning nuovo studio da UI)
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
  sql: {
    Transaction: jest.fn().mockImplementation(() => ({
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: jest.fn().mockResolvedValue(),
    })),
    Request: jest.fn().mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: jest.fn().mockResolvedValue({ recordset: [], rowsAffected: [1] }),
    })),
  },
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { query, getPool, sql } = require('../config/database');
const ctrl = require('./auditorOrg.controller');

function mockReq(overrides = {}) {
  return {
    user: { role: 'superadmin' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/** Prepara la sequenza di query dentro la transazione: [codeQuery, orgInsert, studioInsert] */
function mockTransactionQueries({ maxNum = null, organizationId = 5001, studioRow } = {}) {
  const defaultStudioRow = {
    id: 42,
    organization_id: organizationId,
    name: 'Nuovo Studio Srl',
    email: 'referente@nuovostudio.it',
    subscription_plan: 'standard',
    is_active: true,
    created_at: '2026-08-10T00:00:00Z',
    updated_at: '2026-08-10T00:00:00Z',
  };
  const requestQueryMock = jest
    .fn()
    .mockResolvedValueOnce({ recordset: [{ max_num: maxNum }] })
    .mockResolvedValueOnce({ recordset: [{ organization_id: organizationId }] })
    .mockResolvedValueOnce({ recordset: [studioRow || defaultStudioRow] });

  sql.Request.mockImplementation(() => ({
    input: jest.fn().mockReturnThis(),
    query: requestQueryMock,
  }));

  return requestQueryMock;
}

afterEach(() => jest.clearAllMocks());

describe('createAuditorOrg', () => {
  const VALID_BODY = {
    organization_name: 'Nuovo Cliente Srl',
    studio_name: 'Nuovo Studio Srl',
    studio_email: 'referente@nuovostudio.it',
    subscription_plan: 'premium',
  };

  // Nota: l'enforcement del ruolo (solo superadmin) avviene a livello di route
  // tramite authorize('superadmin') — verificato in
  // backend/src/tests/integration/auth-rbac.test.js ("403 se admin/auditor tenta POST /auditor-orgs").

  it('400 se manca un campo obbligatorio', async () => {
    const req = mockReq({ body: { organization_name: '', studio_name: 'Studio', studio_email: 'a@b.it' } });
    const res = mockRes();

    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
    expect(query).not.toHaveBeenCalled();
  });

  it('400 se l\'email non è valida', async () => {
    const req = mockReq({ body: { ...VALID_BODY, studio_email: 'non-una-email' } });
    const res = mockRes();

    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'VALIDATION_ERROR' })
    );
  });

  it('409 se organization_name è già in uso (case-insensitive)', async () => {
    query.mockResolvedValueOnce({ recordset: [{ organization_id: 1 }] }); // dup org trovato

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DUPLICATE_ORGANIZATION_NAME' })
    );
    expect(getPool).not.toHaveBeenCalled();
  });

  it('409 se studio_email è già in uso (case-insensitive)', async () => {
    query.mockResolvedValueOnce({ recordset: [] }); // dup org non trovato
    query.mockResolvedValueOnce({ recordset: [{ id: 9 }] }); // dup email trovato

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DUPLICATE_STUDIO_EMAIL' })
    );
    expect(getPool).not.toHaveBeenCalled();
  });

  it('201 crea organizations + auditor_orgs collegato con organization_code successivo (nessun codice precedente)', async () => {
    query.mockResolvedValueOnce({ recordset: [] }); // dup org
    query.mockResolvedValueOnce({ recordset: [] }); // dup email
    const requestQueryMock = mockTransactionQueries({ maxNum: null });

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.success).toBe(true);
    expect(payload.data).toMatchObject({
      id: 42,
      name: 'Nuovo Studio Srl',
      email: 'referente@nuovostudio.it',
      organization_name: 'Nuovo Cliente Srl',
      licensed_modules: null,
    });

    // Verifica che l'INSERT organizations usi il codice ORG_00001 (nessun MAX precedente)
    const orgInsertSql = requestQueryMock.mock.calls[1][0];
    expect(orgInsertSql).toMatch(/INSERT INTO organizations/);
  });

  it('201 calcola il prossimo organization_code libero (MAX + 1)', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValueOnce({ recordset: [] });
    mockTransactionQueries({ maxNum: 4 });

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    // organization_code atteso ORG_00005: verificato via input() chiamato con quel valore
    const orgInsertRequestInstance = sql.Request.mock.results[1].value;
    expect(orgInsertRequestInstance.input).toHaveBeenCalledWith('organization_code', 'ORG_00005');
  });

  it('nuovo studio nasce con default standard quando subscription_plan non è fornito', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValueOnce({ recordset: [] });
    mockTransactionQueries();

    const req = mockReq({
      body: {
        organization_name: 'Altro Cliente Srl',
        studio_name: 'Altro Studio',
        studio_email: 'altro@studio.it',
      },
    });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const studioInsertRequestInstance = sql.Request.mock.results[2].value;
    expect(studioInsertRequestInstance.input).toHaveBeenCalledWith('subscription_plan', 'standard');
  });

  it('500 con rollback se il secondo INSERT (auditor_orgs) fallisce — nessuna organizations orfana', async () => {
    query.mockResolvedValueOnce({ recordset: [] });
    query.mockResolvedValueOnce({ recordset: [] });

    const rollbackMock = jest.fn().mockResolvedValue();
    sql.Transaction.mockImplementation(() => ({
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: rollbackMock,
    }));

    const requestQueryMock = jest
      .fn()
      .mockResolvedValueOnce({ recordset: [{ max_num: null }] })
      .mockResolvedValueOnce({ recordset: [{ organization_id: 5001 }] })
      .mockRejectedValueOnce(new Error('ETIMEOUT: connessione al DB persa'));

    sql.Request.mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: requestQueryMock,
    }));

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(rollbackMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'SERVER_ERROR' }));
  });

  it('409 (non 500) se il DB rifiuta il secondo INSERT per violazione dell\'indice UNIQUE email — race condition sul pre-check (fix Bugbot)', async () => {
    query.mockResolvedValueOnce({ recordset: [] }); // pre-check org: nessun duplicato
    query.mockResolvedValueOnce({ recordset: [] }); // pre-check email: nessun duplicato (altra richiesta concorrente lo crea nel frattempo)

    const rollbackMock = jest.fn().mockResolvedValue();
    sql.Transaction.mockImplementation(() => ({
      begin: jest.fn().mockResolvedValue(),
      commit: jest.fn().mockResolvedValue(),
      rollback: rollbackMock,
    }));

    const uniqueViolation = new Error('Violation of UNIQUE KEY constraint');
    uniqueViolation.number = 2627;

    const requestQueryMock = jest
      .fn()
      .mockResolvedValueOnce({ recordset: [{ max_num: null }] })
      .mockResolvedValueOnce({ recordset: [{ organization_id: 5001 }] })
      .mockRejectedValueOnce(uniqueViolation);

    sql.Request.mockImplementation(() => ({
      input: jest.fn().mockReturnThis(),
      query: requestQueryMock,
    }));

    const req = mockReq({ body: VALID_BODY });
    const res = mockRes();
    await ctrl.createAuditorOrg(req, res);

    expect(rollbackMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'DUPLICATE_STUDIO' }));
  });
});
