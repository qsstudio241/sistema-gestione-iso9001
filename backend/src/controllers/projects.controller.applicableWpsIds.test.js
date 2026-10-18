/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { createProject, updateProject, getProject, listProjects } = require('./projects.controller');

function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
}

const USER = {
  organization_id: 1003,
  user_id: 9,
  full_name: 'Utente Prova',
  role: 'admin',
  company_access: [],
};

function wpsRows(ids) {
  return { recordset: ids.map((id) => ({ id, company_id: 47 })) };
}

async function create(applicable_wps_ids, { wpsIds = null, expectStatus = 201 } = {}) {
  query.mockResolvedValue({ recordset: [] });
  if (wpsIds) query.mockResolvedValueOnce(wpsRows(wpsIds));
  if (expectStatus === 201) query.mockResolvedValueOnce({ recordset: [{ id: 70 }] });
  const res = mockRes();
  await createProject({
    user: USER,
    body: { project_code: 'CM-1', company_id: 47, client_name: 'Cliente', applicable_wps_ids },
  }, res);
  expect(res.status).toHaveBeenCalledWith(expectStatus);
  if (expectStatus !== 201) return null;
  const insert = query.mock.calls.find((call) => /INSERT INTO projects/i.test(call[0]));
  return insert[1].applicable_wps_ids;
}

async function update(applicable_wps_ids, { wpsIds = null, expectStatus = 200 } = {}) {
  query.mockResolvedValue({ recordset: [] });
  query.mockResolvedValueOnce({
    recordset: [{ id: 7, company_id: 47, end_customer_id: null, client_name: null }],
  });
  if (wpsIds) query.mockResolvedValueOnce(wpsRows(wpsIds));
  const res = mockRes();
  await updateProject({ user: USER, params: { id: '7' }, body: { applicable_wps_ids } }, res);
  if (expectStatus !== 200) {
    expect(res.status).toHaveBeenCalledWith(expectStatus);
    return null;
  }
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  const wrote = query.mock.calls.find((call) => /^UPDATE projects/i.test(String(call[0]).trim()));
  return wrote[1].applicable_wps_ids;
}

afterEach(() => jest.resetAllMocks());

describe('createProject — applicable_wps_ids', () => {
  it('array -> JSON array canonico', async () => {
    expect(await create([1, 2], { wpsIds: [1, 2] })).toBe('[1,2]');
  });

  it('stringa JSON (client in cache) -> parse, nessuna doppia serializzazione', async () => {
    expect(await create('[1,2]', { wpsIds: [1, 2] })).toBe('[1,2]');
  });

  it('valore già annidato -> riportato al formato canonico', async () => {
    expect(await create('["[1,2]"]', { wpsIds: [1, 2] })).toBe('[1,2]');
  });

  it('assente -> NULL; id non valido -> 400 senza INSERT', async () => {
    expect(await create(undefined)).toBeNull();
    query.mockReset();
    expect(await create(['x', -1, 4], { expectStatus: 400 })).toBeNull();
    expect(query.mock.calls.some((call) => /INSERT INTO projects/i.test(call[0]))).toBe(false);
    query.mockReset();
    expect(await create(['1e2'], { expectStatus: 400 })).toBeNull();
  });
});

describe('updateProject — applicable_wps_ids', () => {
  it('array -> JSON array canonico', async () => {
    expect(await update([3, 4], { wpsIds: [3, 4] })).toBe('[3,4]');
  });

  it('stringa JSON -> parse, nessun annidamento', async () => {
    expect(await update('[3,4]', { wpsIds: [3, 4] })).toBe('[3,4]');
  });

  it('salvataggi ripetuti restano stabili (niente annidamento a ogni auto-save)', async () => {
    let stored = await update('[3,4]', { wpsIds: [3, 4] });
    for (let i = 0; i < 3; i += 1) {
      query.mockReset();
      stored = await update(stored, { wpsIds: [3, 4] });
    }
    expect(stored).toBe('[3,4]');
  });

  it('null -> NULL, lista vuota -> []', async () => {
    expect(await update(null)).toBeNull();
    query.mockReset();
    expect(await update([])).toBe('[]');
  });
});

describe('getProject / listProjects — lettura tollerante', () => {
  it('getProject: valore annidato -> dettagli WPS cercati con id numerici corretti', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: 3, applicable_wps_ids: '["[1,2]"]' }] })
      .mockResolvedValueOnce({ recordset: [{ id: 1, wps_code: 'A' }, { id: 2, wps_code: 'B' }] })
      .mockResolvedValueOnce({ recordset: [] });
    const res = mockRes();
    await getProject({ user: USER, params: { id: '3' } }, res);
    const wpsCall = query.mock.calls.find((call) => /FROM welding_procedures/.test(call[0]));
    expect(wpsCall[0]).toMatch(/deleted_at IS NULL/);
    expect(wpsCall[1]).toEqual({ organization_id: 1003, wpsId0: 1, wpsId1: 2 });
    expect(res.json.mock.calls[0][0].data.wps_details).toHaveLength(2);
  });

  it('getProject: valore corrotto non numerico -> nessuna query WPS', async () => {
    query
      .mockResolvedValueOnce({ recordset: [{ id: 3, applicable_wps_ids: '["[\\"x\\"]"]' }] })
      .mockResolvedValueOnce({ recordset: [] });
    const res = mockRes();
    await getProject({ user: USER, params: { id: '3' } }, res);
    expect(query.mock.calls.some((c) => /welding_procedures/.test(c[0]))).toBe(false);
    expect(res.json.mock.calls[0][0].data.wps_details).toEqual([]);
  });
});
