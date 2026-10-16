/**
 * @jest-environment node
 */

/**
 * Copertura e storia rinnovi usano lo stesso semaforo della lista (data effettiva:
 * conferma semestrale 9606/14732, CPD per i coordinatori 14731), non expiry_date da sola.
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
const { getCoverage, getHistory, semaforoForRow } = require('./qualifications.controller');

const NOW = new Date('2026-10-06T12:00:00Z');
const plusDays = (n) => new Date(NOW.getTime() + n * 86400000).toISOString().slice(0, 10);

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'],
  });
});
afterAll(() => jest.useRealTimers());
beforeEach(() => jest.clearAllMocks());

describe('semaforoForRow — data effettiva', () => {
  it('9606 con conferma semestrale imminente ma certificato lontano: arancione', () => {
    expect(semaforoForRow({
      qualification_type: 'Saldatore ISO 9606-1', status: 'valida',
      expiry_date: plusDays(900), next_confirmation_due: plusDays(10),
    })).toBe('arancione');
  });

  it('coordinatore 14731 con CPD scaduto ma titolo lontano: rosso', () => {
    expect(semaforoForRow({
      qualification_type: 'Coordinatore ISO 14731', status: 'valida',
      expiry_date: plusDays(900), cpd_valid_until: plusDays(-3),
    })).toBe('rosso');
  });

  it('coordinatore 14731 con CPD in scadenza a 45 giorni: giallo', () => {
    expect(semaforoForRow({
      qualification_type: 'Coordinatore ISO 14731', status: 'valida',
      expiry_date: null, cpd_valid_until: plusDays(45),
    })).toBe('giallo');
  });
});

describe('getCoverage — semaforo dei qualificati = semaforo della lista', () => {
  it('conferma semestrale prossima: arancione anche con expiry_date lontana', async () => {
    const queries = [];
    const pool = {
      request: () => {
        const req = {
          input() { return req; },
          async query(sql) {
            queries.push(sql);
            if (/FROM projects/.test(sql)) return { recordset: [{ id: 5, project_code: 'COM-001', applicable_wps_ids: '[1]', company_id: 9 }] };
            if (/FROM welding_procedures/.test(sql)) {
              return { recordset: [{ id: 1, wps_code: 'WPS-A', welding_process: '135', base_material_group: '1.1', material_group: null,
                thickness_range_min: 5, thickness_range_max: 10, thickness_range: '5-10', welding_positions: 'PA', position: null }] };
            }
            if (/FROM qualifications/.test(sql)) {
              return { recordset: [{
                id: 201, person_name: 'ZZ_Test', person_code: null, qualification_type: 'ISO 9606-1', status: 'valida',
                approval_status: 'approved', company_name: 'ZZ', welding_process: '135', material_group: '1.1', position_range: 'PA',
                thickness_min_mm: 3, thickness_max_mm: 20, thickness_max_unlimited: false, thickness_range: '3-20', joint_type: 'BW',
                expiry_date: plusDays(900), next_confirmation_due: plusDays(12),
              }] };
            }
            throw new Error(`query inattesa: ${sql}`);
          },
        };
        return req;
      },
    };
    getPool.mockResolvedValue(pool);
    const res = mockRes();
    await getCoverage({ user: { organization_id: 1 }, query: { project_id: '5' } }, res);
    const payload = res.json.mock.calls[0][0];
    expect(payload.coverage[0].qualifiers[0].semaforo).toBe('arancione');
    expect(payload.coverage[0].qualifiers[0].expiry_date).toBe(plusDays(900));
  });
});

describe('getHistory — semaforo con data effettiva', () => {
  it('la riga della catena usa conferma/CPD e la query li seleziona', async () => {
    const sqls = [];
    const pool = {
      request: () => {
        const req = {
          input() { return req; },
          async query(sql) {
            sqls.push(sql);
            if (/SELECT id FROM qualifications/.test(sql)) return { recordset: [{ id: 7 }] };
            return { recordset: [{
              id: 7, issue_date: null, expiry_date: plusDays(900), certificate_number: 'ZZ', qualification_type: 'Saldatore ISO 9606-1',
              next_confirmation_due: plusDays(-5), cpd_valid_until: null, approval_status: null, status: 'valida',
              previous_qualification_id: null, company_name: 'ZZ',
            }] };
          },
        };
        return req;
      },
    };
    getPool.mockResolvedValue(pool);
    const res = mockRes();
    await getHistory({ user: { organization_id: 1 }, params: { id: '7' } }, res);
    const out = res.json.mock.calls[0][0];
    expect(out.history[0].semaforo).toBe('rosso');
    const chainSql = sqls.find((s) => /q\.previous_qualification_id/.test(s));
    expect(chainSql).toMatch(/q\.next_confirmation_due/);
    expect(chainSql).toMatch(/q\.cpd_valid_until/);
    expect(chainSql).toMatch(/q\.qualification_type/);
  });
});
