/**
 * @jest-environment node
 *
 * Test L1 — normValidityChecker.service
 * Copre i 3 casi della slice R1:
 *   A: solo document_registry (no nds) → checker chiamato, DR aggiornato
 *   B: registro + norm_document_sources collegato → entrambi aggiornati
 *   C: norma senza standard_code → saltata
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./normCatalogLookup.service', () => ({ lookupNormStatus: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const normCatalog = require('./normCatalogLookup.service');
const {
  runScheduledValidityCheck,
  runScheduledLegalRegisterCheck,
  parseNormFieldsFromRegistry,
} = require('./normValidityChecker.service');

const ORG_ID = 42;

const OUTDATED_LOOKUP = {
  status: 'withdrawn',
  supersededBy: null,
  catalogUrl: 'https://example.com/norm',
  checkedAt: new Date().toISOString(),
};

const ACTIVE_LOOKUP = {
  status: 'active',
  supersededBy: null,
  catalogUrl: 'https://example.com/norm',
  checkedAt: new Date().toISOString(),
};

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Caso A: solo document_registry (nds_id = null) — norma superata
// ---------------------------------------------------------------------------
describe('Caso A: solo document_registry, norma ritirata', () => {
  const drRow = {
    dr_id: 1,
    dr_title: 'UNI EN ISO 9001:2015',
    dr_doc_code: 'D-001',
    type_specific_data: JSON.stringify({
      standard_code: 'UNI EN ISO 9001',
      edition_year: 2015,
      issuing_body: 'UNI',
      validity_status: 'vigente',
    }),
    nds_id: null,
  };

  beforeEach(() => {
    // 1° call = SELECT, 2° call = UPDATE document_registry
    query
      .mockResolvedValueOnce({ recordset: [drRow] })
      .mockResolvedValueOnce({ rowsAffected: [1] });
    normCatalog.lookupNormStatus.mockResolvedValue(OUTDATED_LOOKUP);
  });

  it('chiama lookupNormStatus con i campi corretti', async () => {
    await runScheduledValidityCheck(ORG_ID);
    expect(normCatalog.lookupNormStatus).toHaveBeenCalledWith('UNI EN ISO 9001', 'UNI');
  });

  it('esegue UPDATE su document_registry con validity_status = superata', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const updateCall = query.mock.calls[1];
    expect(updateCall[0]).toMatch(/UPDATE document_registry/);
    expect(updateCall[0]).toMatch(/JSON_MODIFY/);
    expect(updateCall[1]).toMatchObject({
      drId: 1,
      orgId: ORG_ID,
      validityStatus: 'superata',
    });
  });

  it('NON aggiorna norm_document_sources (nds_id null)', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const allSql = query.mock.calls.map((c) => c[0]);
    const ndsUpdate = allSql.find(
      (s) => s.includes('UPDATE norm_document_sources')
    );
    expect(ndsUpdate).toBeUndefined();
  });

  it('include la norma nell\'array updated', async () => {
    const result = await runScheduledValidityCheck(ORG_ID);
    expect(result.checked).toBe(1);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0]).toMatchObject({
      dr_id: 1,
      standard_code: 'UNI EN ISO 9001',
    });
  });
});

// ---------------------------------------------------------------------------
// Caso B: registro + norm_document_sources — entrambi aggiornati
// ---------------------------------------------------------------------------
describe('Caso B: document_registry + norm_document_sources collegato', () => {
  const drRow = {
    dr_id: 2,
    dr_title: 'ISO 9001:2015',
    dr_doc_code: 'D-002',
    type_specific_data: JSON.stringify({
      standard_code: 'ISO 9001',
      edition_year: 2015,
      issuing_body: 'ISO',
    }),
    nds_id: 99,
  };

  beforeEach(() => {
    // 1° SELECT, 2° UPDATE DR, 3° UPDATE NDS
    query
      .mockResolvedValueOnce({ recordset: [drRow] })
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockResolvedValueOnce({ rowsAffected: [1] });
    normCatalog.lookupNormStatus.mockResolvedValue(OUTDATED_LOOKUP);
  });

  it('aggiorna document_registry', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const drUpdate = query.mock.calls[1];
    expect(drUpdate[0]).toMatch(/UPDATE document_registry/);
    expect(drUpdate[1].drId).toBe(2);
    expect(drUpdate[1].validityStatus).toBe('superata');
  });

  it('aggiorna anche norm_document_sources in mirror', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const ndsUpdate = query.mock.calls[2];
    expect(ndsUpdate[0]).toMatch(/UPDATE norm_document_sources/);
    expect(ndsUpdate[1]).toMatchObject({ id: 99, orgId: ORG_ID });
  });

  it('checked=1, updated ha 1 elemento con nds_id', async () => {
    const result = await runScheduledValidityCheck(ORG_ID);
    expect(result.checked).toBe(1);
    expect(result.updated[0].nds_id).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// Caso B2: registro + norm_document_sources — norma attiva (solo timestamp)
// ---------------------------------------------------------------------------
describe('Caso B2: norma ancora attiva — solo timestamp aggiornato', () => {
  const drRow = {
    dr_id: 3,
    dr_title: 'ISO 14001:2015',
    dr_doc_code: 'D-003',
    type_specific_data: JSON.stringify({
      standard_code: 'ISO 14001',
      edition_year: 2015,
      issuing_body: 'ISO',
      validity_status: 'vigente',
    }),
    nds_id: 55,
  };

  beforeEach(() => {
    query
      .mockResolvedValueOnce({ recordset: [drRow] })
      .mockResolvedValueOnce({ rowsAffected: [1] })
      .mockResolvedValueOnce({ rowsAffected: [1] });
    normCatalog.lookupNormStatus.mockResolvedValue(ACTIVE_LOOKUP);
  });

  it('aggiorna DR ma non mette superata', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const drUpdate = query.mock.calls[1];
    expect(drUpdate[1].validityStatus).toBe('vigente');
  });

  it('aggiorna NDS con solo timestamp (no validity_status=superata nel SQL)', async () => {
    await runScheduledValidityCheck(ORG_ID);
    const ndsUpdate = query.mock.calls[2];
    expect(ndsUpdate[0]).toMatch(/UPDATE norm_document_sources/);
    expect(ndsUpdate[0]).not.toMatch(/validity_status\s*=\s*'superata'/);
  });

  it('updated rimane vuoto', async () => {
    const result = await runScheduledValidityCheck(ORG_ID);
    expect(result.updated).toHaveLength(0);
    expect(result.checked).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Caso C: norma senza standard_code → saltata
// ---------------------------------------------------------------------------
describe('Caso C: norma senza standard_code (guard difensivo)', () => {
  const drRowNoCode = {
    dr_id: 4,
    dr_title: 'Documento senza codice',
    dr_doc_code: 'D-004',
    type_specific_data: JSON.stringify({ issuing_body: 'UNI' }),
    nds_id: null,
  };

  beforeEach(() => {
    query.mockResolvedValueOnce({ recordset: [drRowNoCode] });
  });

  it('non chiama lookupNormStatus', async () => {
    await runScheduledValidityCheck(ORG_ID);
    expect(normCatalog.lookupNormStatus).not.toHaveBeenCalled();
  });

  it('non esegue UPDATE', async () => {
    await runScheduledValidityCheck(ORG_ID);
    expect(query).toHaveBeenCalledTimes(1); // solo la SELECT iniziale
  });

  it('checked=1, updated vuoto', async () => {
    const result = await runScheduledValidityCheck(ORG_ID);
    expect(result.checked).toBe(1);
    expect(result.updated).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Caso D: nessuna norma da verificare → early return
// ---------------------------------------------------------------------------
describe('Caso D: nessuna norma nel registro', () => {
  beforeEach(() => {
    query.mockResolvedValueOnce({ recordset: [] });
  });

  it('restituisce checked=0 e updated vuoto', async () => {
    const result = await runScheduledValidityCheck(ORG_ID);
    expect(result).toEqual({ checked: 0, updated: [] });
  });

  it('non chiama lookupNormStatus', async () => {
    await runScheduledValidityCheck(ORG_ID);
    expect(normCatalog.lookupNormStatus).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Unit test parseNormFieldsFromRegistry
// ---------------------------------------------------------------------------
describe('parseNormFieldsFromRegistry', () => {
  it('estrae tutti i campi da JSON valido', () => {
    const row = {
      type_specific_data: JSON.stringify({
        standard_code: 'ISO 9001',
        edition_year: '2015',
        issuing_body: 'ISO',
        validity_status: 'vigente',
      }),
    };
    expect(parseNormFieldsFromRegistry(row)).toEqual({
      standard_code: 'ISO 9001',
      edition_year: 2015,
      issuing_body: 'ISO',
      validity_status: 'vigente',
    });
  });

  it('restituisce null per tutti i campi se type_specific_data è null', () => {
    expect(parseNormFieldsFromRegistry({ type_specific_data: null })).toEqual({
      standard_code: null,
      edition_year: null,
      issuing_body: null,
      validity_status: null,
    });
  });

  it('gestisce JSON malformato senza eccezione', () => {
    const row = { type_specific_data: 'non-json' };
    expect(() => parseNormFieldsFromRegistry(row)).not.toThrow();
    const result = parseNormFieldsFromRegistry(row);
    expect(result.standard_code).toBeNull();
  });

  it('edition_year viene convertito in intero', () => {
    const row = {
      type_specific_data: JSON.stringify({ standard_code: 'ISO 9001', edition_year: '2015' }),
    };
    expect(parseNormFieldsFromRegistry(row).edition_year).toBe(2015);
  });
});

// ---------------------------------------------------------------------------
// Registro obblighi legali — runScheduledLegalRegisterCheck
// ---------------------------------------------------------------------------
describe('runScheduledLegalRegisterCheck', () => {
  const sectionRow = {
    section_id: 101,
    section_name: '5. IMPIANTI TERMICI',
    linked_legislation: 'D.Lgs. 81/2008 art.28; art.29',
  };

  beforeEach(() => {
    query.mockResolvedValueOnce({ recordset: [sectionRow] });
  });

  it('chiama lookupNormStatus con etichetta Normattiva per ogni atto univoco', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue(ACTIVE_LOOKUP);
    await runScheduledLegalRegisterCheck(ORG_ID);
    expect(normCatalog.lookupNormStatus).toHaveBeenCalledWith('D.Lgs. 81/2008', 'normattiva');
    expect(normCatalog.lookupNormStatus).toHaveBeenCalledTimes(1);
  });

  it('include sezione in updated se atto withdrawn/superseded', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue({
      ...OUTDATED_LOOKUP,
      supersededBy: 'D.Lgs. 99/2099',
    });
    const result = await runScheduledLegalRegisterCheck(ORG_ID);
    expect(result.checked).toBe(1);
    expect(result.updated).toHaveLength(1);
    expect(result.updated[0]).toMatchObject({
      sectionId: 101,
      sectionName: '5. IMPIANTI TERMICI',
      standardCode: 'DLgs_81_2008',
      decreeLabel: 'D.Lgs. 81/2008',
      reason: 'withdrawn',
      supersededBy: 'D.Lgs. 99/2099',
    });
  });

  it('non persiste su DB (solo SELECT)', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue(ACTIVE_LOOKUP);
    await runScheduledLegalRegisterCheck(ORG_ID);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toMatch(/custom_checklist_sections/);
    expect(query.mock.calls[0][0]).not.toMatch(/UPDATE/);
  });

  it('gestisce decreto senza articoli (solo atto)', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({
      recordset: [{
        section_id: 102,
        section_name: 'Capitolo ambiente',
        linked_legislation: 'D.Lgs. 152/2006',
      }],
    });
    normCatalog.lookupNormStatus.mockResolvedValue(ACTIVE_LOOKUP);
    await runScheduledLegalRegisterCheck(ORG_ID);
    expect(normCatalog.lookupNormStatus).toHaveBeenCalledWith('D.Lgs. 152/2006', 'normattiva');
  });

  it('early return se nessuna sezione con linked_legislation', async () => {
    query.mockReset();
    query.mockResolvedValueOnce({ recordset: [] });
    const result = await runScheduledLegalRegisterCheck(ORG_ID);
    expect(result).toEqual({ checked: 0, updated: [] });
    expect(normCatalog.lookupNormStatus).not.toHaveBeenCalled();
  });
});
