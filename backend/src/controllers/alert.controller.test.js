/**
 * @jest-environment node
 *
 * Badge menu Qualifiche (GET /alerts/count) e lista alert (GET /alerts): stessa scadenza effettiva,
 * stessi bucket e stesso alias `q` delle card della pagina Qualifiche.
 */

jest.mock('../config/database', () => ({ getPool: jest.fn() }));

jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn((list, alias, col, prefix) => (
    list.length
      ? { clause: `${alias}.${col} IN (@${prefix}_0)`, params: { [`${prefix}_0`]: list[0].company_id } }
      : { clause: '', params: {} }
  )),
}));

const { getPool } = require('../config/database');
const { ensureCompanyAccessLoaded } = require('../services/companyAccess.service');
const { EFFECTIVE_SQL, SITUAZIONE_BUCKET_SQL } = require('../services/qualificationExpirySql');
const { getAlertCount, getAlerts } = require('./alert.controller');

function makePool({ qualRow = { expired: 0, expiring: 0 }, qualList = [] } = {}) {
  const sqls = [];
  const pool = {
    request: jest.fn(() => {
      const r = { input: jest.fn().mockReturnThis() };
      r.query = jest.fn(async (sql) => {
        sqls.push(sql);
        if (/FROM document_registry/.test(sql) && /COUNT\(\*\)/.test(sql)) return { recordset: [{ cnt: 2 }] };
        if (/FROM non_conformities/.test(sql)) return { recordset: [{ cnt: 1 }] };
        if (/AS expired/.test(sql)) return { recordset: [qualRow] };
        if (/FROM qualifications q/.test(sql)) return { recordset: qualList };
        return { recordset: [] };
      });
      return r;
    }),
  };
  return { pool, sqls };
}

const mkRes = () => ({ json: jest.fn(), status: jest.fn().mockReturnThis() });
const req = { user: { organization_id: 7 }, query: {} };

describe('alert.controller — qualifiche allineate alle card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureCompanyAccessLoaded.mockResolvedValue([]);
  });

  it('count: badge = Scadute + Urgenti 30gg, con le due componenti esposte', async () => {
    const { pool, sqls } = makePool({ qualRow: { expired: 23, expiring: 1 } });
    getPool.mockResolvedValue(pool);
    const res = mkRes();
    await getAlertCount(req, res);
    expect(res.json).toHaveBeenCalledWith({
      total: 2 + 1 + 24,
      documents: 2,
      nc: 1,
      qualifications: 24,
      qualifications_expired: 23,
      qualifications_expiring: 1,
    });
    const qualSql = sqls.find((s) => /AS expired/.test(s));
    expect(qualSql).toContain(SITUAZIONE_BUCKET_SQL.scadute);
    expect(qualSql).toContain(SITUAZIONE_BUCKET_SQL.urgenti_30);
  });

  it('count: l\'espressione di scadenza include il CPD 14731 e l\'alias patentino (come le card)', async () => {
    const { pool, sqls } = makePool();
    getPool.mockResolvedValue(pool);
    await getAlertCount(req, mkRes());
    const qualSql = sqls.find((s) => /AS expired/.test(s));
    expect(qualSql).toContain('cpd_valid_until');
    expect(qualSql).toContain('patentino_saldatore');
  });

  it('count: utente con accesso per azienda -> filtro sull\'alias q (non sul nome tabella), conteggio non azzerato', async () => {
    ensureCompanyAccessLoaded.mockResolvedValue([{ company_id: 48 }]);
    const { pool, sqls } = makePool({ qualRow: { expired: 2, expiring: 3 } });
    getPool.mockResolvedValue(pool);
    const res = mkRes();
    await getAlertCount(req, res);
    const qualSql = sqls.find((s) => /AS expired/.test(s));
    expect(qualSql).toMatch(/AND q\.company_id IN \(@uca_q_0\)/);
    expect(qualSql).not.toMatch(/qualifications\.company_id/);
    expect(res.json.mock.calls[0][0].qualifications).toBe(5);
  });

  it('count: errore sulla tabella qualifiche non blocca il resto', async () => {
    const { pool } = makePool();
    const original = pool.request;
    pool.request = jest.fn(() => {
      const r = original();
      const q = r.query;
      r.query = jest.fn(async (sql) => {
        if (/AS expired/.test(sql)) throw new Error('Invalid object name');
        return q(sql);
      });
      return r;
    });
    getPool.mockResolvedValue(pool);
    const res = mkRes();
    await getAlertCount(req, res);
    expect(res.json.mock.calls[0][0]).toMatchObject({ documents: 2, qualifications: 0, qualifications_expired: 0, qualifications_expiring: 0 });
  });

  it('lista: usa la stessa scadenza effettiva e lo stesso filtro stato delle card', async () => {
    const { pool, sqls } = makePool({ qualList: [{ id: 1, title: 'ZZ', status: 'valida', effective_due: '2026-10-20', alert_type: 'expiring', days_remaining: 6 }] });
    getPool.mockResolvedValue(pool);
    const res = mkRes();
    await getAlerts(req, res);
    const listSql = sqls.find((s) => /AS effective_due/.test(s));
    expect(listSql).toContain(EFFECTIVE_SQL);
    expect(listSql).toContain("q.status NOT IN ('revocata','sospesa')");
    expect(res.json.mock.calls[0][0].alerts.some((a) => a.item_kind === 'qualification')).toBe(true);
  });
});
