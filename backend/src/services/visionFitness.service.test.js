/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
  getPool: jest.fn(),
}));

const { getPool } = require('../config/database');
const {
  requiresVisionFitness,
  findVisionFitnessGaps,
  normalizePersonName,
} = require('./visionFitness.service');
const {
  VISION_FITNESS_TYPE,
  OCCUPATIONAL_QUALIFICATION_TYPES,
  isVisionFitnessType,
  isOccupationalQualificationType,
} = require('../constants/occupationalQualificationTypes');

describe('occupationalQualificationTypes — unificazione visione', () => {
  it('ha 3 tipi form (visione unica + medica + sorveglianza)', () => {
    expect(OCCUPATIONAL_QUALIFICATION_TYPES).toHaveLength(3);
    expect(OCCUPATIONAL_QUALIFICATION_TYPES[0]).toBe(VISION_FITNESS_TYPE);
  });

  it('riconosce alias legacy acuità/Ishihara come visione', () => {
    expect(isVisionFitnessType('Certificato acuità visiva')).toBe(true);
    expect(isVisionFitnessType('Certificato visione cromatica (Ishihara)')).toBe(true);
    expect(isVisionFitnessType(VISION_FITNESS_TYPE)).toBe(true);
    expect(isOccupationalQualificationType('Certificato acuità visiva')).toBe(true);
  });
});

describe('requiresVisionFitness', () => {
  it('richiede visione per NDT e VT, non per il certificato stesso', () => {
    expect(requiresVisionFitness('Certificazione NDT ISO 9712')).toBe(true);
    expect(requiresVisionFitness('Ispettore esame visivo VT')).toBe(true);
    expect(requiresVisionFitness(VISION_FITNESS_TYPE)).toBe(false);
    expect(requiresVisionFitness('Saldatore ISO 9606-1')).toBe(false);
  });
});

describe('normalizePersonName', () => {
  it('normalizza spazi e case', () => {
    expect(normalizePersonName('  Luigi   LA FORGIA ')).toBe('luigi la forgia');
  });
});

function mockPool(requiringRows, visionRows) {
  const makeRequest = (rows) => {
    const req = {
      input() { return req; },
      query: jest.fn().mockResolvedValue({ recordset: rows }),
    };
    return req;
  };
  let call = 0;
  getPool.mockResolvedValue({
    request() {
      call += 1;
      return call === 1 ? makeRequest(requiringRows) : makeRequest(visionRows);
    },
  });
}

describe('findVisionFitnessGaps', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('segnala missing se NDT senza certificato visione', async () => {
    mockPool(
      [{
        id: 1,
        person_name: 'Mario Rossi',
        personnel_id: 10,
        qualification_type: 'Certificazione NDT ISO 9712',
        ndt_method: 'UT',
        expiry_date: '2030-01-01',
        status: 'valida',
        company_id: 1,
        company_name: 'Demo',
      }],
      [],
    );
    const { gaps, summary } = await findVisionFitnessGaps(100);
    expect(summary.missing).toBe(1);
    expect(gaps[0].vision_state).toBe('missing');
    expect(gaps[0].person_name).toBe('Mario Rossi');
  });

  it('non segnala gap se visione valida presente (anche tipo legacy)', async () => {
    mockPool(
      [{
        id: 1,
        person_name: 'Mario Rossi',
        personnel_id: 10,
        qualification_type: 'Certificazione NDT ISO 9712',
        ndt_method: 'UT',
        expiry_date: '2030-01-01',
        status: 'valida',
        company_id: 1,
        company_name: 'Demo',
      }],
      [{
        id: 99,
        person_name: 'Mario Rossi',
        personnel_id: 10,
        qualification_type: 'Certificato acuità visiva',
        expiry_date: '2031-06-01',
        status: 'valida',
        company_id: 1,
      }],
    );
    const { gaps, summary } = await findVisionFitnessGaps(100);
    expect(summary.ok).toBe(1);
    expect(gaps).toHaveLength(0);
  });

  it('segnala expired se visione scaduta', async () => {
    mockPool(
      [{
        id: 1,
        person_name: 'Mario Rossi',
        personnel_id: 10,
        qualification_type: 'Certificazione NDT ISO 9712',
        ndt_method: 'PT',
        expiry_date: '2030-01-01',
        status: 'valida',
        company_id: 1,
        company_name: 'Demo',
      }],
      [{
        id: 99,
        person_name: 'Mario Rossi',
        personnel_id: 10,
        qualification_type: VISION_FITNESS_TYPE,
        expiry_date: '2020-01-01',
        status: 'valida',
        company_id: 1,
      }],
    );
    const { gaps, summary } = await findVisionFitnessGaps(100);
    expect(summary.expired).toBe(1);
    expect(gaps[0].vision_state).toBe('expired');
  });
});
