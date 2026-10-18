/**
 * @jest-environment node
 *
 * Controlli previsti sulla commessa.
 * Altro studio: 404. Viewer: niente scrittura. La bozza usa la fase salvata
 * e il testo di accettazione inserito, senza una norma inventata.
 */

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const {
  listItems,
  createItem,
  deleteItem,
  generateDrafts,
  parsePercent,
} = require('./projectInspectionItems.controller');

function mockRes() {
  const res = { statusCode: 200, body: null };
  res.status = jest.fn((code) => { res.statusCode = code; return res; });
  res.json = jest.fn((payload) => { res.body = payload; return res; });
  return res;
}

function user(role = 'admin', organizationId = 1005) {
  return { organization_id: organizationId, user_id: 9, role, company_access: [] };
}

const PROJECT = {
  id: 7,
  organization_id: 1005,
  company_id: 49,
  project_code: 'COMM-001',
  client_name: 'Cliente prova',
  deleted_at: null,
};

function sqls() {
  return query.mock.calls.map((call) => String(call[0]));
}

function callMatching(fragment) {
  return query.mock.calls.find((call) => String(call[0]).includes(fragment));
}

afterEach(() => jest.resetAllMocks());

describe('parsePercent', () => {
  it('accetta la virgola e rifiuta un valore fuori da 0-100', () => {
    expect(parsePercent('10,5').value).toBe(10.5);
    expect(parsePercent('').value).toBeNull();
    expect(parsePercent('101').error).toBeTruthy();
    expect(parsePercent('metà').error).toBeTruthy();
  });
});

describe('controlli previsti', () => {
  it('altro studio: 404 e nessuna scrittura', async () => {
    query.mockResolvedValue({ recordset: [] });
    const res = mockRes();
    await createItem({
      user: user('admin', 2000),
      params: { id: '7' },
      body: { method: 'VT', organization_id: 1005 },
    }, res);
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe('PROJECT_NOT_FOUND');
    expect(sqls().some((sql) => sql.includes('INSERT INTO'))).toBe(false);
  });

  it('viewer: 403 e nessun inserimento', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM projects')) return { recordset: [PROJECT] };
      return { recordset: [] };
    });
    const res = mockRes();
    await createItem({
      user: user('viewer'),
      params: { id: '7' },
      body: { method: 'VT', inspection_phase: 'before', acceptance_standard: 'testo utente' },
    }, res);
    expect(res.statusCode).toBe(403);
    expect(sqls().some((sql) => sql.includes('INSERT INTO project_inspection_items'))).toBe(false);
  });

  it('stesso studio: salva con organization_id del token', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM projects')) return { recordset: [PROJECT] };
      if (String(sql).includes('INSERT INTO project_inspection_items')) {
        return { recordset: [{ id: 3, inspection_phase: 'before', method: 'VT', coverage_percent: 10, acceptance_standard: 'testo utente' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await createItem({
      user: user('admin'),
      params: { id: '7' },
      body: {
        method: 'vt',
        inspection_phase: 'before',
        coverage_percent: '10',
        acceptance_standard: 'testo utente',
        organization_id: 9999,
      },
    }, res);
    expect(res.statusCode).toBe(201);
    const params = callMatching('INSERT INTO project_inspection_items')[1];
    expect(params.organization_id).toBe(1005);
    expect(params.method).toBe('VT');
    expect(params.inspection_phase).toBe('before');
    expect(params.acceptance_standard).toBe('testo utente');
  });

  it('il cestino segna deleted_at e la lettura ignora quelle righe', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM projects')) return { recordset: [PROJECT] };
      if (String(sql).includes('UPDATE project_inspection_items')) return { recordset: [{ id: 3 }] };
      return { recordset: [] };
    });
    const deleted = mockRes();
    await deleteItem({ user: user('admin'), params: { id: '7', itemId: '3' } }, deleted);
    expect(deleted.statusCode).toBe(200);
    expect(callMatching('UPDATE project_inspection_items')[0]).toMatch(/deleted_at/);

    const listed = mockRes();
    await listItems({ user: user('admin'), params: { id: '7' } }, listed);
    expect(listed.statusCode).toBe(200);
    expect(callMatching('FROM project_inspection_items')[0]).toMatch(/deleted_at IS NULL/);
  });

  it('tabella assente: la lista resta vuota', async () => {
    query.mockImplementation(async (sql) => {
      if (String(sql).includes('FROM projects')) return { recordset: [PROJECT] };
      throw new Error("Invalid object name 'project_inspection_items'");
    });
    const res = mockRes();
    await listItems({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.table_missing).toBe(true);
  });
});

describe('bozze verbali dai controlli previsti', () => {
  const item = {
    id: 3,
    inspection_phase: 'before',
    method: 'VT',
    coverage_percent: 10,
    acceptance_standard: 'testo utente di accettazione',
  };

  function mockGenerate({ openDraft = null, phaseMissing = false } = {}) {
    query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('FROM projects')) return { recordset: [PROJECT] };
      if (text.includes('FROM project_inspection_items')) return { recordset: [item] };
      if (text.includes('COUNT(*)')) return { recordset: [{ cnt: 0 }] };
      if (text.includes('SELECT TOP 1')) {
        if (phaseMissing && text.includes('inspection_phase')) {
          throw new Error("Invalid column name 'inspection_phase'");
        }
        return { recordset: openDraft ? [openDraft] : [] };
      }
      if (text.includes('INSERT INTO ndt_reports')) {
        return { recordset: [{ id: 44, report_number: 'VT-2026-001', report_type: 'VT', status: 'draft' }] };
      }
      return { recordset: [] };
    });
  }

  it('crea la bozza con la fase salvata e il testo inserito, senza 5817', async () => {
    mockGenerate();
    const res = mockRes();
    await generateDrafts({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.created).toHaveLength(1);
    expect(res.body.data.created[0].inspection_phase).toBe('before');
    const params = callMatching('INSERT INTO ndt_reports')[1];
    expect(params.inspection_phase).toBe('before');
    expect(params.quality_level).toBeNull();
    expect(params.joint_type).toBeNull();
    expect(params.organization_id).toBe(1005);
    expect(params.company_id).toBe(49);
    expect(params.notes).toContain('testo utente di accettazione');
    expect(params.notes).not.toMatch(/5817/);
    expect(params.status).toBe('draft');
  });

  it('la seconda richiesta non duplica la bozza già aperta', async () => {
    mockGenerate({ openDraft: { id: 44, report_number: 'VT-2026-001' } });
    const res = mockRes();
    await generateDrafts({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.body.data.already).toHaveLength(1);
    expect(res.body.data.created).toHaveLength(0);
    expect(sqls().some((sql) => sql.includes('INSERT INTO ndt_reports'))).toBe(false);
  });

  it('senza la colonna fase riprova e non forza dopo', async () => {
    mockGenerate({ phaseMissing: true });
    const res = mockRes();
    await generateDrafts({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.data.created[0].inspection_phase).toBeNull();
    const insert = callMatching('INSERT INTO ndt_reports')[0];
    expect(insert).not.toMatch(/inspection_phase/);
  });

  it('stesso metodo e fase, testo diverso: nasce una seconda bozza', async () => {
    const other = { ...item, id: 4, acceptance_standard: 'altro testo utente' };
    const inserted = [];
    query.mockImplementation(async (sql, params) => {
      const text = String(sql);
      if (text.includes('FROM projects')) return { recordset: [PROJECT] };
      if (text.includes('FROM project_inspection_items')) return { recordset: [item, other] };
      if (text.includes('COUNT(*)')) return { recordset: [{ cnt: inserted.length }] };
      if (text.includes('SELECT TOP 1')) {
        const hit = inserted.find((row) => row.notes === params.notes && row.inspection_phase === params.phase);
        return { recordset: hit ? [hit] : [] };
      }
      if (text.includes('INSERT INTO ndt_reports')) {
        const row = { id: 44 + inserted.length, report_number: params.report_number, notes: params.notes, inspection_phase: params.inspection_phase };
        inserted.push(row);
        return { recordset: [{ id: row.id, report_number: row.report_number, report_type: 'VT', status: 'draft' }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await generateDrafts({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.body.data.created).toHaveLength(2);
    expect(res.body.data.already).toHaveLength(0);
    expect(inserted.map((row) => row.notes).join('\n')).toContain('altro testo utente');
    expect(inserted.map((row) => row.notes).join('\n')).not.toMatch(/5817/);
  });

  it('senza metodo non nasce un verbale', async () => {
    query.mockImplementation(async (sql) => {
      const text = String(sql);
      if (text.includes('FROM projects')) return { recordset: [PROJECT] };
      if (text.includes('FROM project_inspection_items')) {
        return { recordset: [{ ...item, method: null }] };
      }
      return { recordset: [] };
    });
    const res = mockRes();
    await generateDrafts({ user: user('admin'), params: { id: '7' } }, res);
    expect(res.body.data.skipped).toEqual([{ id: 3, reason: 'senza metodo' }]);
    expect(sqls().some((sql) => sql.includes('INSERT INTO ndt_reports'))).toBe(false);
  });
});
