/**
 * @jest-environment node
 *
 * Selettore «Caso Riesame Requisiti» sulla commessa.
 * Stessa azienda, caso esistente nello studio, una sola commessa viva per caso.
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
  getPool: jest.fn(),
  sql: { Transaction: jest.fn(), Request: jest.fn() },
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query, getPool, sql } = require('../config/database');
const { createProject, updateProject } = require('./projects.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

const USER = {
  organization_id: 1005,
  user_id: 9,
  full_name: 'Utente Prova',
  role: 'admin',
  company_access: [],
};

function sqls() {
  return query.mock.calls.map((call) => String(call[0]));
}

function insertParams() {
  const call = query.mock.calls.find((row) => /INSERT INTO projects/i.test(row[0]));
  return call ? call[1] : null;
}

function updateParams() {
  const call = query.mock.calls.find((row) => /UPDATE projects/i.test(String(row[0])));
  return call ? call[1] : null;
}

function useLock() {
  getPool.mockResolvedValue({});
  sql.Transaction.mockImplementation(() => ({
    begin: jest.fn(async () => {}),
    commit: jest.fn(async () => {}),
    rollback: jest.fn(async () => {}),
  }));
  sql.Request.mockImplementation(() => {
    const params = {};
    return {
      input(key, value) { params[key] = value; return this; },
      query: (text) => query(text, params),
    };
  });
}

afterEach(() => jest.resetAllMocks());

describe('createProject — commercial_case_id', () => {
  it('campo assente: non legge i casi e scrive NULL', async () => {
    query.mockResolvedValue({ recordset: [{ id: 70 }] });
    const res = mockRes();
    await createProject({
      user: USER,
      body: { project_code: 'CM-1', company_id: 49, client_name: 'Cliente' },
    }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(sqls().some((sql) => sql.includes('FROM commercial_cases'))).toBe(false);
    expect(insertParams().commercial_case_id).toBeNull();
  });

  it('caso della stessa azienda: salva l\'id sotto il lucchetto del passaggio', async () => {
    useLock();
    query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
      if (text.includes('FROM commercial_cases')) return { recordset: [{ id: 12, company_id: 49 }] };
      if (text.includes('commercial_case_id = @caseId')) return { recordset: [] };
      if (text.includes('INSERT INTO projects')) return { recordset: [{ id: 70 }] };
      return { recordset: [] };
    });
    const res = mockRes();
    await createProject({
      user: USER,
      body: { project_code: 'CM-1', company_id: 49, commercial_case_id: 12 },
    }, res);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(insertParams().commercial_case_id).toBe(12);
    expect(sqls().some((sql) => sql.includes('sgq-handoff-') || sql.includes('sp_getapplock'))).toBe(true);
  });

  it('altra azienda, caso assente o già collegato: niente INSERT', async () => {
    const cases = [
      { body: { commercial_case_id: 12 }, row: { id: 12, company_id: 88 }, other: [], status: 409 },
      { body: { commercial_case_id: 99 }, row: null, other: [], status: 404 },
      { body: { commercial_case_id: 12 }, row: { id: 12, company_id: 49 }, other: [{ id: 3 }], status: 409 },
      { body: { commercial_case_id: 'no' }, row: null, other: [], status: 400 },
    ];
    for (const item of cases) {
      query.mockReset();
      query.mockImplementation(async (sql) => {
        const text = String(sql);
        if (text.includes('FROM commercial_cases')) {
          return { recordset: item.row ? [item.row] : [] };
        }
        if (text.includes('commercial_case_id = @caseId')) return { recordset: item.other };
        if (text.includes('INSERT INTO projects')) return { recordset: [{ id: 70 }] };
        return { recordset: [] };
      });
      const res = mockRes();
      await createProject({
        user: USER,
        body: { project_code: 'CM-1', company_id: 49, ...item.body },
      }, res);
      expect(res.status).toHaveBeenCalledWith(item.status);
      expect(sqls().some((sql) => /INSERT INTO projects/i.test(sql))).toBe(false);
    }
  });

  it('viewer: 403, nessun collegamento', async () => {
    query.mockResolvedValue({ recordset: [] });
    const res = mockRes();
    await createProject({
      user: { ...USER, role: 'viewer' },
      body: { project_code: 'CM-1', company_id: 49, commercial_case_id: 12 },
    }, res);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(sqls().some((sql) => sql.includes('FROM commercial_cases'))).toBe(false);
    expect(sqls().some((sql) => /INSERT INTO projects/i.test(sql))).toBe(false);
  });
});

describe('updateProject — commercial_case_id', () => {
  function arm(caseRow, other = []) {
    useLock();
    query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('sp_getapplock')) return { recordset: [{ lock_result: 0 }] };
      if (text.includes('FROM commercial_cases')) {
        return { recordset: caseRow ? [caseRow] : [] };
      }
      if (text.includes('commercial_case_id = @caseId')) return { recordset: other };
      if (text.includes('SELECT id, company_id')) {
        return { recordset: [{ id: 7, company_id: 49, commercial_case_id: null, deleted_at: null }] };
      }
      return { recordset: [] };
    });
  }

  it('campo assente: non modifica il collegamento già scritto dal passaggio', async () => {
    arm(null);
    const res = mockRes();
    await updateProject({
      user: USER,
      params: { id: '7' },
      body: { notes: 'solo note' },
    }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(sqls().some((sql) => sql.includes('FROM commercial_cases'))).toBe(false);
    expect(updateParams().commercial_case_id).toBeUndefined();
    expect(String(query.mock.calls.find((row) => /UPDATE projects/i.test(row[0]))[0])).not.toContain('commercial_case_id');
  });

  it('stessa azienda, anche se la commessa ha già quel caso', async () => {
    arm({ id: 12, company_id: 49 }, []);
    const res = mockRes();
    await updateProject({
      user: USER,
      params: { id: '7' },
      body: { commercial_case_id: '12' },
    }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(updateParams().commercial_case_id).toBe(12);
  });

  it('svuota il selettore', async () => {
    arm(null);
    const res = mockRes();
    await updateProject({
      user: USER,
      params: { id: '7' },
      body: { commercial_case_id: '' },
    }, res);
    expect(updateParams().commercial_case_id).toBeNull();
    expect(sqls().some((sql) => sql.includes('FROM commercial_cases'))).toBe(false);
  });

  it('caso di un\'altra commessa viva: 409 e niente UPDATE', async () => {
    arm({ id: 12, company_id: 49 }, [{ id: 3 }]);
    const res = mockRes();
    await updateProject({
      user: USER,
      params: { id: '7' },
      body: { commercial_case_id: 12, notes: 'non deve passare' },
    }, res);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(sqls().some((sql) => /UPDATE projects/i.test(sql))).toBe(false);
  });
});
