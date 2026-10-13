/**
 * @jest-environment node
 *
 * Test L1 — S2 applicabilità campi: create/update manuale di qualifiche ISO 14732 azzerano i campi N.A.
 * per famiglia+edizione certa; 9606-1 invariato.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
  ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
  companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
  assertMutatingAllowed: jest.fn().mockResolvedValue(null),
  assertCompanyRead: jest.fn().mockResolvedValue(null),
  hasCompanyAccessRows: jest.fn().mockReturnValue(false),
  sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../services/qualificationIngest.service', () => ({ extractQualificationFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const { getPool } = require('../config/database');
const { createQualification, updateQualification } = require('./qualifications.controller');

const FULL_BODY = {
  person_name: 'Mario Test',
  certificate_number: 'SINT-1',
  welding_process: '121',
  position_range: 'PA, PB',
  material_group: '1.1',
  joint_type: 'BW',
  product_type: 'T',
  filler_material: 'FM1',
  shielding_gas: 'M21',
  weld_details: 'ss nb',
  transfer_mode: 'spray_arc',
  thickness_min_mm: 3,
  thickness_max_mm: 20,
  thickness_max_unlimited: true,
  thickness_s_test_mm: 12,
  thickness_t_test_mm: 8,
  pipe_diameter_min_mm: 60,
  pipe_diameter_max_mm: 120,
  pipe_diameter_test_mm: 100,
  qualification_designation: 'riga stampata',
  welding_position_test: 'PA',
  welding_processes_validity: '121',
  welding_type: 'mechanized',
};

const NA_INPUTS = [
  'matGroup', 'jointType', 'productType', 'filler', 'shieldGas', 'weldDetails', 'transferMode',
  'thickMin', 'thickMax', 'thickSTest', 'thickTTest', 'pipeMin', 'pipeMax', 'pipeTest',
  'designation', 'posTest', 'weldProcValidity', 'thickRangeFinal', 'pipeDiamFinal',
];

const makeRes = () => ({ status: jest.fn().mockReturnThis(), json: jest.fn() });
const user = { organization_id: 10, user_id: 20 };
const inputsOf = (r) => Object.fromEntries(r.input.mock.calls.map(([k, v]) => [k, v]));

async function runCreate(body) {
  const insertReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 900 }] }) };
  getPool.mockResolvedValue({ request: jest.fn(() => insertReq) });
  const res = makeRes();
  await createQualification({ body, user }, res);
  expect(res.status).not.toHaveBeenCalledWith(500);
  return inputsOf(insertReq);
}

async function runUpdate(body) {
  const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 30, company_id: null }] }) };
  const updateReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
  let n = 0;
  getPool.mockResolvedValue({ request: jest.fn(() => { n += 1; return n === 1 ? checkReq : updateReq; }) });
  const res = makeRes();
  await updateQualification({ params: { id: '30' }, body, user }, res);
  expect(res.status).not.toHaveBeenCalledWith(500);
  return inputsOf(updateReq);
}

describe.each([
  ['createQualification', runCreate],
  ['updateQualification', runUpdate],
])('qualifications.controller — %s applicabilità campi', (_name, run) => {
  beforeEach(() => jest.clearAllMocks());

  it('14732:2025: campi N.A. a NULL (nessuna sentinella), posizione compresa', async () => {
    const inputs = await run({ ...FULL_BODY, qualification_type: 'Operatore ISO 14732', standard_ref: 'ISO 14732:2025' });
    for (const k of NA_INPUTS) expect(inputs[k]).toBeNull();
    expect(inputs.posRange).toBeNull();
    expect(inputs.thickMaxUnlimited).toBe(false);
    expect(Object.values(inputs)).not.toContain('NN');
    expect(inputs.weldProc).toBe('121');
    expect(inputs.certNum).toBe('SINT-1');
    expect(inputs.weldingType).toBe('mechanized');
  });

  it('14732:2013: la posizione resta, gli altri N.A. a NULL', async () => {
    const inputs = await run({ ...FULL_BODY, qualification_type: 'Operatore ISO 14732', standard_ref: 'ISO 14732:2013' });
    expect(inputs.posRange).toBe('PA, PB');
    for (const k of NA_INPUTS) expect(inputs[k]).toBeNull();
  });

  it('14732 con edizione ignota: posizione conservata, N.A. in entrambe le edizioni a NULL', async () => {
    const inputs = await run({ ...FULL_BODY, qualification_type: 'Operatore ISO 14732' });
    expect(inputs.posRange).toBe('PA, PB');
    expect(inputs.matGroup).toBeNull();
    expect(inputs.pipeMin).toBeNull();
  });

  it('9606-1 invariato (diametro con prodotto P, spessore, posizione, gruppo materiale)', async () => {
    const inputs = await run({
      ...FULL_BODY,
      qualification_type: 'Saldatore ISO 9606-1',
      standard_ref: 'ISO 9606-1:2017',
      product_type: 'P',
      qualification_designation: '',
    });
    expect(inputs.posRange).toBe('PA, PB');
    expect(inputs.matGroup).toBe('1.1');
    expect(inputs.jointType).toBe('BW');
    expect(inputs.productType).toBe('P');
    expect(inputs.filler).toBe('FM1');
    expect(inputs.thickMin).toBe(3);
    expect(inputs.pipeMin).toBe(60);
    expect(inputs.designation).toEqual(expect.stringContaining('121'));
  });
});
