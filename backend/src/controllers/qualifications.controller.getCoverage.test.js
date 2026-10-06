/**
 * @jest-environment node
 */

/**
 * COV-4 — golden payload GET /qualifications/coverage (getCoverage).
 * Costruito sul codice PRIMA del refactor (ponte wpsWelderCoverage): il contratto di risposta
 * (chiavi e valori) deve restare identico dopo la delega al registry welder_9606.
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
const { getCoverage } = require('./qualifications.controller');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

/** Pool fittizio: risponde per tabella e registra SQL + parametri. */
function mockPool({ project, wps = [], quals = [] }) {
  const calls = [];
  const pool = {
    request: () => {
      const params = {};
      const req = {
        input(name, value) { params[name] = value; return req; },
        async query(sql) {
          calls.push({ sql, params: { ...params } });
          if (/FROM projects/.test(sql)) return { recordset: project ? [project] : [] };
          if (/FROM welding_procedures/.test(sql)) return { recordset: wps };
          if (/FROM qualifications/.test(sql)) return { recordset: quals };
          throw new Error(`query inattesa: ${sql}`);
        },
      };
      return req;
    },
  };
  getPool.mockResolvedValue(pool);
  return calls;
}

const project = { id: 5, project_code: 'COM-001', applicable_wps_ids: '[1,2,3]', company_id: 9 };

const wpsRows = [
  { id: 1, wps_code: 'WPS-A', welding_process: '135', base_material_group: '1.1', material_group: null,
    thickness_range_min: 5, thickness_range_max: 10, thickness_range: '5-10', welding_positions: 'PA', position: null },
  { id: 2, wps_code: 'WPS-B', welding_process: '111', base_material_group: null, material_group: '8.1',
    thickness_range_min: null, thickness_range_max: null, thickness_range: null, welding_positions: null, position: 'PF' },
  { id: 3, wps_code: 'WPS-C', welding_process: '141', base_material_group: '1.1', material_group: null,
    thickness_range_min: 3, thickness_range_max: 6, thickness_range: '3-6', welding_positions: 'PA', position: null },
];

const base = {
  qualification_type: 'ISO 9606-1', status: 'valida', approval_status: 'approved',
  next_confirmation_due: '2027-03-01', company_name: 'Acme Srl',
};

const qualRows = [
  { ...base, id: 101, person_name: 'Rossi Mario', person_code: 'R01', welding_process: '135',
    material_group: '1.1, 1.2', position_range: 'PA, PF', thickness_min_mm: 3, thickness_max_mm: 20,
    thickness_max_unlimited: false, thickness_range: '3-20', joint_type: 'BW', expiry_date: '2027-12-01' },
  { ...base, id: 102, person_name: 'Bianchi Luca', person_code: 'B02', qualification_type: 'ISO 14732',
    welding_process: '111', material_group: null, position_range: 'PF', thickness_min_mm: 3,
    thickness_max_mm: null, thickness_max_unlimited: true, thickness_range: null, joint_type: 'FW',
    expiry_date: '2026-10-20' },
  { ...base, id: 103, person_name: 'Verdi Anna', person_code: 'V03', welding_process: '135',
    material_group: '1.1', position_range: 'PA', thickness_min_mm: 12, thickness_max_mm: 30,
    thickness_max_unlimited: false, thickness_range: '12-30', joint_type: 'BW', expiry_date: '2027-12-01' },
  { ...base, id: 104, person_name: 'Neri Paolo', person_code: 'N04', welding_process: '135',
    material_group: '1.1', position_range: 'PA', thickness_min_mm: 3, thickness_max_mm: 20,
    thickness_max_unlimited: false, thickness_range: '3-20', joint_type: 'BW', expiry_date: '2025-01-01' },
  { ...base, id: 105, person_name: 'Gialli Sara', person_code: 'G05', welding_process: '135',
    material_group: '1.1', position_range: 'PA', thickness_min_mm: 3, thickness_max_mm: 20,
    thickness_max_unlimited: false, thickness_range: '3-20', joint_type: 'BW', expiry_date: '2027-12-01',
    next_confirmation_due: '2026-04-01' },
];

describe('getCoverage — golden payload (COV-4)', () => {
  beforeAll(() => {
    jest.useFakeTimers({
      now: new Date('2026-10-06T12:00:00Z'),
      doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'],
    });
  });
  afterAll(() => jest.useRealTimers());
  beforeEach(() => jest.clearAllMocks());

  test('400 senza project_id', async () => {
    const res = mockRes();
    await getCoverage({ user: { organization_id: 1 }, query: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'project_id richiesto.' });
  });

  test('404 commessa non trovata', async () => {
    mockPool({ project: null });
    const res = mockRes();
    await getCoverage({ user: { organization_id: 1 }, query: { project_id: '5' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: 'Commessa non trovata.' });
  });

  test('commessa senza WPS: has_wps false e summary a zero', async () => {
    mockPool({ project: { ...project, applicable_wps_ids: '[]' } });
    const res = mockRes();
    await getCoverage({ user: { organization_id: 1 }, query: { project_id: '5' } }, res);
    expect(res.json).toHaveBeenCalledWith({
      project_id: 5,
      project_code: 'COM-001',
      has_wps: false,
      coverage: [],
      summary: { total: 0, covered: 0, partial: 0, uncovered: 0 },
    });
  });

  test('payload completo: esito, qualified_count, qualifiers, semaforo, coverage_detail', async () => {
    const calls = mockPool({ project, wps: wpsRows, quals: qualRows });
    const res = mockRes();
    await getCoverage({ user: { organization_id: 1 }, query: { project_id: '5' } }, res);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(res.json.mock.calls[0][0]).toEqual(GOLDEN);

    const qualCall = calls.find((c) => /FROM qualifications/.test(c.sql));
    expect(qualCall.sql).toMatch(/LIKE '%9606%' OR q\.qualification_type LIKE '%14732%'/);
    expect(qualCall.sql).toMatch(/q\.thickness_max_unlimited/);
    expect(qualCall.params).toEqual({ orgId: 1, projCompId: 9 });
  });
});

const GOLDEN = {
  project_id: 5,
  project_code: 'COM-001',
  has_wps: true,
  coverage: [
    {
      wps_id: 1,
      wps_code: 'WPS-A',
      welding_process: '135',
      material_group: '1.1',
      thickness_range_min: 5,
      thickness_range_max: 10,
      welding_positions: 'PA',
      qualified_count: 1,
      esito: 'verde',
      qualifiers: [
        {
          id: 101,
          person_name: 'Rossi Mario',
          person_code: 'R01',
          company_name: 'Acme Srl',
          expiry_date: '2027-12-01',
          semaforo: 'verde',
          coverage_detail: {
            process: 'ok', thickness: 'ok', material_group: 'ok', position: 'ok', overall: 'ok',
          },
        },
      ],
    },
    {
      wps_id: 2,
      wps_code: 'WPS-B',
      welding_process: '111',
      material_group: '8.1',
      thickness_range_min: null,
      thickness_range_max: null,
      welding_positions: 'PF',
      qualified_count: 1,
      esito: 'giallo',
      qualifiers: [
        {
          id: 102,
          person_name: 'Bianchi Luca',
          person_code: 'B02',
          company_name: 'Acme Srl',
          expiry_date: '2026-10-20',
          semaforo: 'arancione',
          coverage_detail: {
            process: 'ok', thickness: 'ok', material_group: 'unverifiable', position: 'ok', overall: 'partial',
          },
        },
      ],
    },
    {
      wps_id: 3,
      wps_code: 'WPS-C',
      welding_process: '141',
      material_group: '1.1',
      thickness_range_min: 3,
      thickness_range_max: 6,
      welding_positions: 'PA',
      qualified_count: 0,
      esito: 'rosso',
      qualifiers: [],
    },
  ],
  summary: { total: 3, covered: 1, partial: 1, uncovered: 1 },
};
