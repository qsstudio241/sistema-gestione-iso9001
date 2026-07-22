/**
 * Test L1 — qualificationIngest.service
 * Copre: mapPipelineFieldsToReview (operator_name + campi ISO 14732) e
 * commitQualificationFromFields (INSERT con nuove colonne welding_type/single_multi_run/
 * qualification_method e campi 092 già esistenti).
 */

jest.mock('../config/database', () => ({
  getPool: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock('./personnelQualificationLink.service', () => ({
  resolvePersonnelForQualification: jest.fn().mockResolvedValue({
    ok: true, personnelId: 55, personName: 'Luigi Verdi',
  }),
}));

const { getPool } = require('../config/database');
const {
  mapPipelineFieldsToReview,
  commitQualificationFromFields,
} = require('./qualificationIngest.service');

describe('qualificationIngest.service — mapPipelineFieldsToReview', () => {
  it('legge operator_name (schema qualifica_14732) come nome titolare', () => {
    const out = mapPipelineFieldsToReview({
      operator_name: 'Luigi Verdi',
      equipment_type: 'Robot MIG/MAG',
      welding_type: 'automatic',
      single_multi_run: 'multi',
      qualification_method: 'iso_15614',
    }, 'qualifica operatore ISO 14732 saldatura automatica', 'file.pdf');

    expect(out.person_name).toBe('Luigi Verdi');
    expect(out.operator_name).toBe('Luigi Verdi');
    expect(out.equipment_type).toBe('Robot MIG/MAG');
    expect(out.welding_type).toBe('automatic');
    expect(out.single_multi_run).toBe('multi');
    expect(out.qualification_method).toBe('iso_15614');
    expect(out.qualification_type).toBe('Operatore ISO 14732');
  });

  it('welder_name (patentino_saldatore) resta prioritario se presente', () => {
    const out = mapPipelineFieldsToReview({
      welder_name: 'Mario Rossi',
      operator_name: 'Altro Nome',
    }, 'patentino saldatore 9606-1', 'file.pdf');
    expect(out.person_name).toBe('Mario Rossi');
  });
});

describe('qualificationIngest.service — commitQualificationFromFields (14732)', () => {
  function makeRequestMock() {
    const req = { input: jest.fn().mockReturnThis() };
    req.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });
    return req;
  }

  it('inserisce welding_type/single_multi_run/qualification_method nella query INSERT', async () => {
    const dupCheckReq = makeRequestMock();
    dupCheckReq.query = jest.fn().mockResolvedValue({ recordset: [{ cnt: 0 }] });

    const insertReq = { input: jest.fn().mockReturnThis() };
    insertReq.query = jest.fn().mockResolvedValue({ recordset: [{ id: 501 }] });

    let callCount = 0;
    const pool = {
      request: jest.fn(() => {
        callCount += 1;
        return callCount === 1 ? dupCheckReq : insertReq;
      }),
    };
    getPool.mockResolvedValue(pool);

    const result = await commitQualificationFromFields({
      operator_name: 'Luigi Verdi',
      certificate_number: 'CERT-14732-01',
      equipment_type: 'Testa SAW',
      welding_type: 'mechanized',
      single_multi_run: 'single',
      qualification_method: 'production_test',
      exam_date: '2026-01-10',
      expiry_date: '2032-01-10',
    }, 10, 20, { qualificationType: 'Operatore ISO 14732' });

    expect(result.qualification_id).toBe(501);
    expect(insertReq.input).toHaveBeenCalledWith('weldingType', 'mechanized');
    expect(insertReq.input).toHaveBeenCalledWith('singleMultiRun', 'single');
    expect(insertReq.input).toHaveBeenCalledWith('qualMethod', 'production_test');
    expect(insertReq.input).toHaveBeenCalledWith('equipType', 'Testa SAW');
    expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('welding_type'));
    expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('single_multi_run'));
    expect(insertReq.query).toHaveBeenCalledWith(expect.stringContaining('qualification_method'));
  });
});
