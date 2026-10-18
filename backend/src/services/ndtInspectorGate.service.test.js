/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const { query } = require('../config/database');
const {
  isJudgmentStatus,
  isNdt9712Qualification,
  evaluateInspectorFromRows,
  evaluateNdtInspectorGate,
  GATE_CODE,
} = require('./ndtInspectorGate.service');
const { resetVisionClockColumnCache } = require('./qualificationExpirySql');
const { VISION_FITNESS_TYPE } = require('../constants/occupationalQualificationTypes');

const TODAY = new Date('2026-08-25T12:00:00Z');

function ndtQual(overrides = {}) {
  return {
    id: 1,
    person_name: 'Mario Rossi',
    personnel_id: 10,
    qualification_type: 'Operatore NDT VT Livello 2',
    ndt_method: 'VT',
    ndt_level: 2,
    expiry_date: '2030-01-01',
    status: 'valida',
    company_id: 48,
    certificate_number: '1234/VT/2/CICPND/2022',
    ...overrides,
  };
}

function visionQual(overrides = {}) {
  return {
    id: 99,
    person_name: 'Mario Rossi',
    personnel_id: 10,
    qualification_type: VISION_FITNESS_TYPE,
    expiry_date: '2028-06-01',
    status: 'valida',
    company_id: 48,
    ...overrides,
  };
}

describe('isJudgmentStatus', () => {
  it('completed e approved richiedono il gate; draft no', () => {
    expect(isJudgmentStatus('completed')).toBe(true);
    expect(isJudgmentStatus('approved')).toBe(true);
    expect(isJudgmentStatus('draft')).toBe(false);
    expect(isJudgmentStatus(null)).toBe(false);
  });
});

describe('isNdt9712Qualification', () => {
  it('riconosce NDT/9712 e scarta il certificato oculistico', () => {
    expect(isNdt9712Qualification(ndtQual())).toBe(true);
    expect(isNdt9712Qualification({ qualification_type: 'Certificazione NDT ISO 9712', ndt_method: 'PT' })).toBe(true);
    expect(isNdt9712Qualification({ qualification_type: VISION_FITNESS_TYPE, ndt_method: null })).toBe(false);
    expect(isNdt9712Qualification({ qualification_type: 'Saldatore ISO 9606-1', ndt_method: null })).toBe(false);
  });
});

describe('evaluateInspectorFromRows', () => {
  const base = {
    inspectorName: 'Mario Rossi',
    reportType: 'VT',
    companyId: 48,
    today: TODAY,
  };

  it('ok se 9712 VT liv.2 valido e visione ok (studio o azienda)', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual()],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(true);
    expect(out.reasons).toEqual([]);
    expect(out.qualification.ndt_method).toBe('VT');
    expect(out.qualification.ndt_level).toBe(2);
    expect(out.vision.state).toBe('ok');
  });

  it('accetta visione su altra company dello stesso tenant (ispettore studio su cliente)', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      companyId: 99,
      ndtQuals: [ndtQual({ company_id: 1 })],
      visionRows: [visionQual({ company_id: 1 })],
    });
    expect(out.ok).toBe(true);
  });

  it('fallisce senza nome ispettore e propone candidati del metodo', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      inspectorName: '',
      ndtQuals: [ndtQual(), ndtQual({ id: 2, person_name: 'Luigi Bianchi', ndt_method: 'PT' })],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/ispettore/i);
    expect(out.candidates.map((c) => c.person_name)).toEqual(['Mario Rossi']);
  });

  it('fallisce se manca il patentino 9712', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/Nessun patentino ISO 9712/);
  });

  it('fallisce se il metodo del verbale non è coperto', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      reportType: 'UT',
      ndtQuals: [ndtQual()],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/non copre il metodo UT/);
  });

  it('fallisce se il patentino è scaduto', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual({ expiry_date: '2020-01-01' })],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/scaduto/);
  });

  it('fallisce se livello 1 (interpretazione autonoma §5.3.2)', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual({ ndt_level: 1 })],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/livello 2 o 3/i);
  });

  it('fallisce se visione assente', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual()],
      visionRows: [],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/Idoneit/);
    expect(out.vision.state).toBe('missing');
  });

  it('fallisce se visione scaduta (anche tipo legacy)', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual()],
      visionRows: [visionQual({
        qualification_type: 'Certificato acuit\u00e0 visiva',
        expiry_date: '2020-01-01',
      })],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/visiva scaduta/);
    expect(out.vision.state).toBe('expired');
  });

  it('con due omonimi usa il patentino collegato, non l\'altro', () => {
    const valido = ndtQual({ id: 41, personnel_id: 10, certificate_number: 'VT-OK' });
    const scaduto = ndtQual({
      id: 42,
      personnel_id: 11,
      certificate_number: 'VT-OLD',
      expiry_date: '2020-01-01',
    });
    const byName = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [valido, scaduto],
      visionRows: [visionQual(), visionQual({ id: 100, personnel_id: 11 })],
    });
    expect(byName.ok).toBe(true);
    expect(byName.qualification.id).toBe(41);
    expect(byName.candidates.map((c) => c.qualification_id)).toEqual([41]);

    const byId = evaluateInspectorFromRows({
      ...base,
      qualificationId: 42,
      ndtQuals: [valido, scaduto],
      visionRows: [visionQual(), visionQual({ id: 100, personnel_id: 11 })],
    });
    expect(byId.ok).toBe(false);
    expect(byId.reasons[0]).toMatch(/scaduto/);
    expect(byId.qualification.id).toBe(42);
  });

  it('rifiuta un id di patentino che non è più in anagrafica', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      qualificationId: 99,
      ndtQuals: [ndtQual()],
      visionRows: [visionQual()],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toMatch(/non è più in anagrafica/);
  });

  it('fallisce se il test dei colori è passato anche con la visita ancora valida', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual()],
      visionRows: [visionQual({
        expiry_date: null,
        near_vision_expiry_date: '2030-01-01',
        colour_vision_expiry_date: '2020-01-01',
      })],
    });
    expect(out.ok).toBe(false);
    expect(out.vision.state).toBe('expired');
    expect(out.reasons[0]).toContain('2020-01-01');
  });

  it('non sblocca il verbale se la scadenza unica è già passata e una sola data nuova è futura', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      ndtQuals: [ndtQual()],
      visionRows: [visionQual({
        expiry_date: '2020-01-01',
        near_vision_expiry_date: '2027-01-01',
        colour_vision_expiry_date: null,
      })],
    });
    expect(out.ok).toBe(false);
    expect(out.vision.state).toBe('expired');
    expect(out.reasons[0]).toContain('2020-01-01');
    expect(out.reasons[0]).not.toContain('2027-01-01');
  });

  it('la scritta scaduta il non slitta al giorno prima se la data è mezzanotte UTC', () => {
    const out = evaluateInspectorFromRows({
      ...base,
      today: new Date('2026-06-02T12:00:00.000Z'),
      ndtQuals: [ndtQual()],
      visionRows: [visionQual({
        expiry_date: new Date('2026-06-01T00:00:00.000Z'),
        near_vision_expiry_date: null,
        colour_vision_expiry_date: null,
      })],
    });
    expect(out.ok).toBe(false);
    expect(out.reasons[0]).toContain('2026-06-01');
    expect(out.reasons[0]).not.toContain('2026-05-31');
  });
});

describe('evaluateNdtInspectorGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetVisionClockColumnCache();
  });

  it('carica qualifiche + visione e valuta', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('ndt_method')) {
        return { recordset: [ndtQual()] };
      }
      return { recordset: [visionQual()] };
    });
    const out = await evaluateNdtInspectorGate({
      organizationId: 1001,
      companyId: 48,
      inspectorName: 'Mario Rossi',
      reportType: 'VT',
    });
    expect(out.ok).toBe(true);
    expect(GATE_CODE).toBe('NDT_INSPECTOR_GATE');
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('filtra le qualifiche sulle aziende consentite (company_access)', async () => {
    query.mockImplementation(async () => ({ recordset: [] }));
    await evaluateNdtInspectorGate({
      organizationId: 1001,
      inspectorName: 'Mario Rossi',
      reportType: 'VT',
      allowedCompanyIds: [11],
    });
    const sql = query.mock.calls[0][0];
    const params = query.mock.calls[0][1];
    expect(sql).toMatch(/q\.company_id IN \(@acq_0\)/);
    expect(params.acq_0).toBe(11);
  });

  it('se le colonne 178 non ci sono il controllo ispettore non va in errore', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('ndt_method')) return { recordset: [ndtQual()] };
      if (/near_vision_expiry_date/.test(sql)) {
        throw new Error("Invalid column name 'colour_vision_expiry_date'.");
      }
      return {
        recordset: [visionQual({ expiry_date: '2020-01-01' })],
      };
    });
    const out = await evaluateNdtInspectorGate({
      organizationId: 1001,
      inspectorName: 'Mario Rossi',
      reportType: 'VT',
    });
    expect(out.ok).toBe(false);
    expect(out.vision.state).toBe('expired');
    expect(out.reasons[0]).toContain('2020-01-01');
    const visionSql = query.mock.calls.map((c) => c[0]).filter((sql) => !sql.includes('ndt_method'));
    expect(visionSql.some((sql) => !/near_vision_expiry_date/.test(sql))).toBe(true);
  });
});
