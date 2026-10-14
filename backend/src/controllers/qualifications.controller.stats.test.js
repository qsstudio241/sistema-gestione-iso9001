/**
 * @jest-environment node
 */

/**
 * Test L1 — GET /qualifications/stats: stesso scope (Ambito azienda + tab) della lista,
 * stessi bucket "situazione" della lista (fonte unica SITUAZIONE_BUCKET_SQL), input anomali.
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

const { getPool } = require('../config/database');
const {
  getStats,
  listQualifications,
  SITUAZIONE_BUCKET_SQL,
  buildQualificationTypeScope,
  QUALIFICATION_TAB_FAMILY_SQL,
  parseCompanyIdParam,
} = require('./qualifications.controller');

function makePool(statsRow) {
  const inputs = {};
  const queryMock = jest.fn().mockImplementation((sql) => {
    if (/COUNT\(\*\) AS total,/.test(sql)) {
      return Promise.resolve({
        recordset: [statsRow || { total: 0, valide: 0, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0 }],
      });
    }
    if (/COUNT\(\*\)/.test(sql)) return Promise.resolve({ recordset: [{ total: 0 }] });
    return Promise.resolve({ recordset: [] });
  });
  const reqObj = {
    input: jest.fn((k, v) => { inputs[k] = v; return reqObj; }),
    query: queryMock,
  };
  return { pool: { request: jest.fn(() => reqObj) }, queryMock, inputs };
}

function run(handler, query, user = { organization_id: 10 }) {
  const req = { query, user };
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  return handler(req, res).then(() => res);
}

const statsSql = (queryMock) => queryMock.mock.calls.map(([s]) => s).find((s) => /COUNT\(\*\) AS total,/.test(s)) || '';
const listSql = (queryMock) => queryMock.mock.calls.map(([s]) => s).find((s) => s.includes('SELECT q.*')) || '';

describe('getStats — scope Ambito azienda + tab', () => {
  beforeEach(() => jest.clearAllMocks());

  it('senza parametri conta tutta l\'organizzazione (nessun filtro azienda/tipo)', async () => {
    const { pool, queryMock, inputs } = makePool({ total: 5, valide: 5, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0 });
    getPool.mockResolvedValue(pool);
    const res = await run(getStats, {});
    const sql = statsSql(queryMock);
    expect(sql).not.toContain('@companyId');
    expect(sql).not.toContain('@qualType');
    expect(inputs.orgId).toBe(10);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 5, valide: 5, urgent: 0 }));
  });

  it('company_id restringe le card all\'Ambito (come la lista)', async () => {
    const { pool, queryMock, inputs } = makePool();
    getPool.mockResolvedValue(pool);
    await run(getStats, { company_id: '48' });
    expect(statsSql(queryMock)).toContain('q.company_id = @companyId');
    expect(inputs.companyId).toBe(48);
    expect(inputs.orgId).toBe(10);
  });

  it('qualification_type restringe le card al tab attivo con lo stesso criterio della lista', async () => {
    const stats = makePool();
    getPool.mockResolvedValue(stats.pool);
    await run(getStats, { company_id: '48', qualification_type: 'iso9606_1' });
    const clause = buildQualificationTypeScope('iso9606_1').clause;
    expect(statsSql(stats.queryMock)).toContain(clause);
    expect(statsSql(stats.queryMock)).toContain("= N'iso9606_1'");

    const list = makePool();
    getPool.mockResolvedValue(list.pool);
    await run(listQualifications, { company_id: '48', qualification_type: 'iso9606_1' });
    expect(listSql(list.queryMock)).toContain(clause);
    expect(list.inputs.qualType).toBeUndefined();
  });

  it.each(['iso9606_1', 'iso9606_2', 'iso14732', 'ndt', 'iso14731', 'pes_pav', 'salute_mansione', 'generico'])('tab %s: stessa clausola in lista e statistiche', async (tab) => {
    const stats = makePool();
    getPool.mockResolvedValue(stats.pool);
    await run(getStats, { qualification_type: tab });
    const list = makePool();
    getPool.mockResolvedValue(list.pool);
    await run(listQualifications, { qualification_type: tab });
    const clause = buildQualificationTypeScope(tab).clause;
    expect(clause).toBeTruthy();
    expect(statsSql(stats.queryMock)).toContain(clause);
    expect(listSql(list.queryMock)).toContain(clause);
  });

  it('i tab sono una partizione: stessa espressione di famiglia, una clausola distinta per tab, generico = complemento (ELSE)', () => {
    const clauses = ['iso9606_1', 'iso9606_2', 'iso14732', 'ndt', 'iso14731', 'pes_pav', 'salute_mansione', 'generico']
      .map((t) => buildQualificationTypeScope(t).clause);
    expect(new Set(clauses).size).toBe(8);
    for (const c of clauses) expect(c).toContain(QUALIFICATION_TAB_FAMILY_SQL);
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("ELSE 'generico'");
  });

  it('sigle NDT/PES/PAV valgono solo come parola intera (nessun match per sottostringa)', () => {
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("[^A-Za-z][VMPUER]T[^A-Za-z]");
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("[^A-Za-z]PES[^A-Za-z]");
    expect(QUALIFICATION_TAB_FAMILY_SQL).toContain("[^A-Za-z]PAV[^A-Za-z]");
    expect(QUALIFICATION_TAB_FAMILY_SQL).not.toMatch(/LIKE '%(VT|PT|MT|UT|RT|ET|PES|PAV)%'/);
  });

  it('9606 senza suffisso confluisce in 9606-1; 9606-2 ha la sua famiglia', () => {
    expect(QUALIFICATION_TAB_FAMILY_SQL).toMatch(/LIKE '%9606%'[^\n]*THEN 'iso9606_1'/);
    expect(QUALIFICATION_TAB_FAMILY_SQL).toMatch(/LIKE '%9606-2%' THEN 'iso9606_2'/);
  });

  it('chiavi non-tab (metodo NDT, pes/pav) restano a LIKE con parametro legato', () => {
    expect(buildQualificationTypeScope('iso9712_ut')).toEqual({ clause: 'q.qualification_type LIKE @qualType', like: '%UT%' });
    expect(buildQualificationTypeScope('pav').like).toBe('%PAV%');
  });

  it('nessuna riga: i contatori sono 0, non null (COALESCE)', async () => {
    const { pool, queryMock } = makePool();
    getPool.mockResolvedValue(pool);
    const res = await run(getStats, {});
    expect(statsSql(queryMock)).toContain('COALESCE(SUM(');
    expect(res.json).toHaveBeenCalledWith({
      total: 0, valide: 0, in_scadenza_60: 0, in_scadenza_30: 0, scadute: 0, non_attive: 0, urgent: 0,
    });
  });
});

describe('getStats / lista — input anomali', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['abc'],
    ['12abc'],
    ['-5'],
    ['1.5'],
    ["1; DROP TABLE qualifications--"],
    ['9'.repeat(40)],
    [['1', '2']],
  ])('company_id %j -> 400 INVALID_COMPANY_ID senza eseguire query', async (bad) => {
    for (const handler of [getStats, listQualifications]) {
      const { pool, queryMock } = makePool();
      getPool.mockResolvedValue(pool);
      const res = await run(handler, { company_id: bad });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_COMPANY_ID' }));
      expect(queryMock).not.toHaveBeenCalled();
    }
  });

  it('company_id vuoto o assente = nessun filtro', () => {
    expect(parseCompanyIdParam('')).toEqual({ value: null });
    expect(parseCompanyIdParam(undefined)).toEqual({ value: null });
    expect(parseCompanyIdParam('  ')).toEqual({ value: null });
    expect(parseCompanyIdParam('0048')).toEqual({ value: 48 });
  });

  it('tab sconosciuto o stringa SQL-like: resta un parametro legato, mai testo SQL', async () => {
    const evil = "x'; DROP TABLE qualifications;--";
    const { pool, queryMock, inputs } = makePool();
    getPool.mockResolvedValue(pool);
    const res = await run(getStats, { qualification_type: evil });
    expect(res.status).not.toHaveBeenCalledWith(500);
    expect(statsSql(queryMock)).not.toContain('DROP TABLE');
    expect(inputs.qualType).toBe(`%${evil}%`);
  });

  it('qualification_type molto lungo viene troncato a 100 caratteri', () => {
    const scope = buildQualificationTypeScope('a'.repeat(5000));
    expect(scope.like).toBe(`%${'a'.repeat(100)}%`);
  });

  it('isolamento multi-tenant: company_id di un\'altra organizzazione non rimuove il filtro organization_id', async () => {
    const { pool, queryMock, inputs } = makePool();
    getPool.mockResolvedValue(pool);
    await run(getStats, { company_id: '999999' }, { organization_id: 77 });
    expect(statsSql(queryMock)).toContain('q.organization_id = @orgId');
    expect(inputs.orgId).toBe(77);
    expect(inputs.companyId).toBe(999999);
  });
});

describe('Bucket situazione — fonte unica lista/card', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ogni card di getStats usa lo stesso SQL del filtro ?situazione= della lista', async () => {
    const stats = makePool();
    getPool.mockResolvedValue(stats.pool);
    await run(getStats, {});
    const sqlStats = statsSql(stats.queryMock);
    for (const [bucket, sql] of Object.entries(SITUAZIONE_BUCKET_SQL)) {
      expect(sqlStats).toContain(sql);
      const key = bucket === 'urgenti_30' ? 'urgenti_30' : bucket;
      const list = makePool();
      getPool.mockResolvedValue(list.pool);
      await run(listQualifications, { situazione: key });
      expect(listSql(list.queryMock)).toContain(sql);
    }
  });

  it('"Valide" non dipende dallo stato salvato (una riga marcata scaduta ma con data effettiva futura resta contata)', () => {
    expect(SITUAZIONE_BUCKET_SQL.valide).not.toContain("q.status = 'valida'");
    expect(SITUAZIONE_BUCKET_SQL.valide).toContain("q.status NOT IN ('revocata','sospesa')");
  });

  it('i bucket sono una partizione: ogni bucket attivo esclude sospese/revocate, non_attive le include', () => {
    for (const k of ['valide', 'in_scadenza_60', 'urgenti_30', 'scadute']) {
      expect(SITUAZIONE_BUCKET_SQL[k]).toContain("q.status NOT IN ('revocata','sospesa')");
    }
    expect(SITUAZIONE_BUCKET_SQL.non_attive).toBe("q.status IN ('sospesa','revocata')");
  });
});

describe('Ordinamento lista — scadenza effettiva con spareggio per id', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ORDER BY usa la data effettiva (non expiry_date), senza data in coda, spareggio q.id', async () => {
    const { pool, queryMock } = makePool();
    getPool.mockResolvedValue(pool);
    await run(listQualifications, {});
    const sql = listSql(queryMock).replace(/\s+/g, ' ');
    const order = sql.slice(sql.indexOf('ORDER BY'), sql.indexOf('OFFSET'));
    expect(order).toContain('q.next_confirmation_due');
    expect(order).toContain('q.cpd_valid_until');
    expect(order).toMatch(/q\.person_name ASC, q\.id ASC/);
    expect(order).not.toMatch(/ORDER BY CASE WHEN q\.expiry_date IS NULL/);
  });
});
