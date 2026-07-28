/**
 * @jest-environment node
 */

/**
 * Test L1 — qualifications.controller
 * Copre: effectiveExpiryDate / semaforoForRow (data guida scadenza + semaforo)
 * per qualifiche ISO 9606-1 (saldatori) e ISO 14732 (operatori) — entrambe con
 * conferma semestrale, a differenza degli altri tipi (solo expiry_date).
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
}));

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
  assertCompanyRead: jest.fn().mockResolvedValue(null),
  hasCompanyAccessRows: jest.fn().mockReturnValue(false),
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));

const { getPool } = require('../config/database');
const { assertMutatingAllowed } = require('../services/companyAccess.service');
const {
  effectiveExpiryDate,
  semaforoForRow,
  hardDeleteQualification,
  createQualification,
} = require('./qualifications.controller');

describe('qualifications.controller — effectiveExpiryDate', () => {
  it('per ISO 9606-1 usa la data più imminente tra expiry e conferma semestrale', () => {
    const q = {
      qualification_type: 'Saldatore ISO 9606-1',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-06-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-06-01');
  });

  it('per ISO 14732 usa la data più imminente tra expiry e conferma semestrale (come 9606)', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2032-01-01',
      next_confirmation_due: '2026-05-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-05-01');
  });

  it('per tipi non 9606/14732 usa solo expiry_date, ignora next_confirmation_due', () => {
    const q = {
      qualification_type: 'Coordinatore ISO 14731',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2026-01-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2030-01-01');
  });

  it('per ISO 14732 senza next_confirmation_due ricade su expiry_date', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: '2031-01-01',
      next_confirmation_due: null,
    };
    expect(effectiveExpiryDate(q)).toBe('2031-01-01');
  });

  it('per ISO 14732 senza expiry_date ricade su next_confirmation_due', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      expiry_date: null,
      next_confirmation_due: '2026-08-01',
    };
    expect(effectiveExpiryDate(q)).toBe('2026-08-01');
  });
});

describe('qualifications.controller — semaforoForRow', () => {
  it('segnala rosso se la conferma semestrale ISO 14732 è già scaduta anche con certificato valido', () => {
    const q = {
      qualification_type: 'Operatore ISO 14732',
      status: 'valida',
      expiry_date: '2030-01-01',
      next_confirmation_due: '2020-01-01',
    };
    expect(semaforoForRow(q)).toBe('rosso');
  });
});

/**
 * Test L1 — hardDeleteQualification (Elimina reale, unica azione di rimozione
 * esposta in UI dal 28/07/2026 — rimossi Approva/Rifiuta/Revoca manuali, v.
 * header qualifications.controller.js). Verifica i gate di sicurezza rimasti:
 * nessuna dipendenza da approval_status, solo assenza di legami reali (conferme
 * semestrali, import, rinnovo, WPS).
 */
describe('qualifications.controller — hardDeleteQualification', () => {
  function makePool(responses) {
    let i = 0;
    return {
      request: jest.fn(() => {
        const resp = responses[i] ?? { recordset: [] };
        i += 1;
        return {
          input: jest.fn().mockReturnThis(),
          query: jest.fn().mockResolvedValue(resp),
        };
      }),
    };
  }

  function makeReqRes(id = '1') {
    const req = {
      params: { id },
      user: { organization_id: 1, user_id: 42, role: 'operatore' },
    };
    const res = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; },
    };
    return { req, res };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    assertMutatingAllowed.mockResolvedValue(null);
  });

  it('404 se la qualifica non esiste nell\'organizzazione', async () => {
    getPool.mockResolvedValue(makePool([{ recordset: [] }]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(404);
  });

  it('409 se esistono conferme semestrali registrate', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: '2026-01-01', certificate_file_url: null }] },
      { recordset: [{ cnt: 1 }] }, // confirmations
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('HAS_CONFIRMATIONS');
  });

  it('409 se collegata a un documento importato', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: '2026-01-01', certificate_file_url: null }] },
      { recordset: [{ cnt: 0 }] }, // confirmations
      { recordset: [{ cnt: 1 }] }, // import links
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('HAS_IMPORT_LINK');
  });

  it('409 se è la versione precedente di un rinnovo', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: '2026-01-01', certificate_file_url: null }] },
      { recordset: [{ cnt: 0 }] }, // confirmations
      { recordset: [{ cnt: 0 }] }, // import links
      { recordset: [{ cnt: 1 }] }, // renewal refs
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('HAS_RENEWAL_LINK');
  });

  it('403 se l\'utente non ha permesso di scrittura sull\'azienda', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: '2026-01-01', certificate_file_url: null }] },
    ]));
    assertMutatingAllowed.mockResolvedValue({ status: 403, body: { error: 'Permesso negato', code: 'AUTH_FORBIDDEN' } });
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('elimina con successo una qualifica attiva (approvata) senza legami — nessun gate su approval_status', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: '2026-01-01', certificate_file_url: null }] },
      { recordset: [{ cnt: 0 }] }, // confirmations
      { recordset: [{ cnt: 0 }] }, // import links
      { recordset: [{ cnt: 0 }] }, // renewal refs
      { recordset: [{ cnt: 0 }] }, // wps_welders
      { recordset: [] },           // DELETE
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
  });
});

/**
 * Test L1 — createQualification, sanitizzazione numerica (bug produzione
 * 27/07/2026, cliente Mason). Path manuale (form React QualificationForm),
 * seconda linea di difesa oltre all'ingest AI: valori non numerici su
 * thickness_min_mm/max_mm, pipe_diameter_min_mm/max_mm o ndt_level/training_hours
 * non devono mai arrivare come stringa grezza a `.input()` (mssql), altrimenti
 * SQL Server fallisce con "Error converting data type nvarchar to numeric"
 * sulle colonne DECIMAL/INT di `qualifications`.
 */
describe('qualifications.controller — createQualification sanitizzazione numerica', () => {
  function makeInsertPool() {
    const insertReq = { input: jest.fn().mockReturnThis() };
    insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 900 }] });
    const pool = { request: jest.fn(() => insertReq) };
    return { pool, insertReq };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    assertMutatingAllowed.mockResolvedValue(null);
  });

  it('salva null per thickness/pipe_diameter "N.A." o vuoti invece di rompere la query', async () => {
    const { pool, insertReq } = makeInsertPool();
    getPool.mockResolvedValue(pool);

    const req = {
      body: {
        person_name: 'Blago Lukic',
        qualification_type: 'Saldatore ISO 9606-1',
        joint_type: 'FW',
        product_type: 'T',
        thickness_min_mm: 'N.A.',
        thickness_max_mm: '',
        pipe_diameter_min_mm: 'N.A.',
        pipe_diameter_max_mm: '3-6',
      },
      user: { organization_id: 10, user_id: 20 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createQualification(req, res);

    expect(insertReq.input).toHaveBeenCalledWith('thickMin', null);
    expect(insertReq.input).toHaveBeenCalledWith('thickMax', null);
    expect(insertReq.input).toHaveBeenCalledWith('pipeMin', null);
    expect(insertReq.input).toHaveBeenCalledWith('pipeMax', 3);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('sanitizza ndt_level/training_hours testuali non numerici', async () => {
    const { pool, insertReq } = makeInsertPool();
    getPool.mockResolvedValue(pool);

    const req = {
      body: {
        person_name: 'Anna Bianchi',
        qualification_type: 'Operatore NDT',
        ndt_level: 'N/D',
        training_hours: 'n.a.',
      },
      user: { organization_id: 10, user_id: 20 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createQualification(req, res);

    expect(insertReq.input).toHaveBeenCalledWith('ndtLevel', null);
    expect(insertReq.input).toHaveBeenCalledWith('trainHours', null);
    expect(res.status).not.toHaveBeenCalledWith(500);
  });

  it('preserva valori numerici validi (nessuna regressione)', async () => {
    const { pool, insertReq } = makeInsertPool();
    getPool.mockResolvedValue(pool);

    const req = {
      body: {
        person_name: 'Mario Rossi',
        qualification_type: 'Saldatore ISO 9606-1',
        thickness_min_mm: 4,
        thickness_max_mm: '12,5',
        pipe_diameter_min_mm: 60,
        pipe_diameter_max_mm: '≥120',
      },
      user: { organization_id: 10, user_id: 20 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createQualification(req, res);

    expect(insertReq.input).toHaveBeenCalledWith('thickMin', 4);
    expect(insertReq.input).toHaveBeenCalledWith('thickMax', 12.5);
    expect(insertReq.input).toHaveBeenCalledWith('pipeMin', 60);
    expect(insertReq.input).toHaveBeenCalledWith('pipeMax', 120);
  });
});

/**
 * Test L1 — createQualification, decisione di prodotto 28/07/2026: nessun gate
 * di approvazione interna. Ogni qualifica creata è immediatamente attiva
 * (approval_status='approvata'), sia inviando il campo nel body sia omettendolo.
 */
describe('qualifications.controller — createQualification sempre attiva (no gate approvazione)', () => {
  function makeInsertPool() {
    const insertReq = { input: jest.fn().mockReturnThis() };
    insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 901 }] });
    const pool = { request: jest.fn(() => insertReq) };
    return { pool, insertReq };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    assertMutatingAllowed.mockResolvedValue(null);
  });

  it('forza approval_status=approvata anche se il body non lo specifica', async () => {
    const { pool, insertReq } = makeInsertPool();
    getPool.mockResolvedValue(pool);

    const req = {
      body: { person_name: 'Luca Verdi', qualification_type: 'Saldatore ISO 9606-1' },
      user: { organization_id: 10, user_id: 20 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createQualification(req, res);

    expect(insertReq.input).toHaveBeenCalledWith('approvalStatus', 'approvata');
  });

  it('ignora un approval_status=bozza inviato dal client: resta sempre approvata', async () => {
    const { pool, insertReq } = makeInsertPool();
    getPool.mockResolvedValue(pool);

    const req = {
      body: { person_name: 'Luca Verdi', qualification_type: 'Saldatore ISO 9606-1', approval_status: 'bozza' },
      user: { organization_id: 10, user_id: 20 },
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await createQualification(req, res);

    expect(insertReq.input).toHaveBeenCalledWith('approvalStatus', 'approvata');
  });
});
