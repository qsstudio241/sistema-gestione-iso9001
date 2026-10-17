/**
 * @jest-environment node
 */

/**
 * Test L1 — confirmSemiannual: una conferma che riporta la scadenza effettiva nel futuro
 * rimette "valida" una riga con stato salvato "scaduta" (card e riga restano coerenti).
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  assertCompanyRead: jest.fn().mockResolvedValue(null),
  hasCompanyAccessRows: jest.fn().mockReturnValue(false),
  sendAccessDenied: jest.fn(),
}));
jest.mock('../services/qualificationIngest.service', () => ({ extractQualificationFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));
jest.mock('../services/weldingCoordinatorAuth.service', () => ({
  ...jest.requireActual('../services/weldingCoordinatorAuth.service'),
  canUserConfirmSemiannual: jest.fn().mockResolvedValue({ allowed: true, reason: 'studio_admin', primary: null }),
}));

const { getPool } = require('../config/database');
const { confirmSemiannual } = require('./qualifications.controller');

function makePool(row) {
  const updates = [];
  const mkReq = (store) => {
    const r = { inputs: {}, input: jest.fn((k, v) => { r.inputs[k] = v; return r; }),
      query: jest.fn(async (sql) => { if (store) store.push({ sql, inputs: { ...r.inputs } }); return { recordset: [row] }; }) };
    return r;
  };
  const tx = { begin: jest.fn(), commit: jest.fn(), rollback: jest.fn(), request: jest.fn(() => mkReq(updates)) };
  return { pool: { request: jest.fn(() => mkReq(null)), transaction: jest.fn(() => tx) }, updates, tx };
}

const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

async function confirm(row, body = {}) {
  const { pool, updates } = makePool(row);
  getPool.mockResolvedValue(pool);
  const req = { params: { id: '5' }, body, user: { organization_id: 10, user_id: 1, role: 'admin', name: 'Admin' } };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await confirmSemiannual(req, res);
  const upd = updates.find((u) => /UPDATE qualifications/.test(u.sql));
  return { res, upd };
}

const base = {
  id: 5, company_id: 1, qualification_type: 'Saldatore ISO 9606-1', approval_status: 'approvata',
  last_confirmation_date: null, user_name: 'Admin',
};

describe('confirmSemiannual — stato salvato obsoleto', () => {
  beforeEach(() => jest.clearAllMocks());

  it('scaduta + conferma di oggi + certificato valido: riporta lo stato a valida', async () => {
    const { res, upd } = await confirm({ ...base, status: 'scaduta', expiry_date: day(400), next_confirmation_due: day(-30) });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(upd.inputs.reviveStatus).toBe(1);
    expect(upd.sql).toContain("status = CASE WHEN @reviveStatus = 1 AND status = 'scaduta' THEN 'valida' ELSE status END");
  });

  it('scaduta ma certificato già scaduto: resta scaduta (la scadenza effettiva è nel passato)', async () => {
    const { upd } = await confirm({ ...base, status: 'scaduta', expiry_date: day(-10), next_confirmation_due: day(-30) });
    expect(upd.inputs.reviveStatus).toBe(0);
  });

  it('conferma retrodatata oltre 6 mesi: la nuova scadenza è già passata, resta scaduta', async () => {
    const { upd } = await confirm({ ...base, status: 'scaduta', expiry_date: day(400), next_confirmation_due: day(-300) }, { confirmed_at: day(-250) });
    expect(upd.inputs.reviveStatus).toBe(0);
  });

  it('le colonne DATE di mssql arrivano come oggetti Date: il confronto resta corretto', async () => {
    const pastExpiry = await confirm({ ...base, status: 'scaduta', expiry_date: new Date(`${day(-40)}T00:00:00.000Z`), next_confirmation_due: new Date(`${day(-20)}T00:00:00.000Z`) });
    expect(pastExpiry.upd.inputs.reviveStatus).toBe(0);
    const futureExpiry = await confirm({ ...base, status: 'scaduta', expiry_date: new Date(`${day(400)}T00:00:00.000Z`), next_confirmation_due: new Date(`${day(-20)}T00:00:00.000Z`) });
    expect(futureExpiry.upd.inputs.reviveStatus).toBe(1);
  });

  it('stato già valida: non viene toccato', async () => {
    const { upd } = await confirm({ ...base, status: 'valida', expiry_date: day(400), next_confirmation_due: day(-30) });
    expect(upd.inputs.reviveStatus).toBe(0);
  });

  it('sospesa/revocata: conferma rifiutata (400), nessun UPDATE', async () => {
    const { res, upd } = await confirm({ ...base, status: 'sospesa', expiry_date: day(400), next_confirmation_due: day(-30) });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(upd).toBeUndefined();
  });
});
