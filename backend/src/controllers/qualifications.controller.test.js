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
 * Test L1 — hardDeleteQualification (Elimina reale, distinta dalla Revoca).
 * Verifica i gate di sicurezza: solo bozze mai approvate, senza conferme
 * semestrali, senza legami import/rinnovo/WPS. Gap analysis 26/07/2026:
 * funzione nuova aggiunta per rispondere alla domanda "Approva/Rifiuta sono
 * ridondanti con la revisione staging?" — vedi verdetto in GUIDA_CONSOLIDATA.md.
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

  it('409 se la qualifica è già approvata (approval_status=approvata)', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'approvata', approved_at: null, certificate_file_url: null }] },
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('CANNOT_DELETE_APPROVED');
  });

  it('409 se rifiutata ma già approvata in passato (approved_at valorizzato)', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'rifiutata', approved_at: '2026-01-01', certificate_file_url: null }] },
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('CANNOT_DELETE_APPROVED');
  });

  it('409 se esistono conferme semestrali registrate', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'bozza', approved_at: null, certificate_file_url: null }] },
      { recordset: [{ cnt: 1 }] }, // confirmations
    ]));
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(409);
    expect(res.body.code).toBe('HAS_CONFIRMATIONS');
  });

  it('409 se collegata a un documento importato', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'bozza', approved_at: null, certificate_file_url: null }] },
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
      { recordset: [{ id: 1, company_id: 5, approval_status: 'bozza', approved_at: null, certificate_file_url: null }] },
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
      { recordset: [{ id: 1, company_id: 5, approval_status: 'bozza', approved_at: null, certificate_file_url: null }] },
    ]));
    assertMutatingAllowed.mockResolvedValue({ status: 403, body: { error: 'Permesso negato', code: 'AUTH_FORBIDDEN' } });
    const { req, res } = makeReqRes();

    await hardDeleteQualification(req, res);

    expect(res.statusCode).toBe(403);
  });

  it('elimina con successo una bozza mai approvata e senza legami', async () => {
    getPool.mockResolvedValue(makePool([
      { recordset: [{ id: 1, company_id: 5, approval_status: 'bozza', approved_at: null, certificate_file_url: null }] },
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
