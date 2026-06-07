/**
 * @jest-environment node
 *
 * Test L1 � normCodesImport.service (Fase 3)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./normCatalogLookup.service', () => ({ lookupNormStatus: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const normCatalog = require('./normCatalogLookup.service');
const {
  parseCodeLines,
  inferIssuingBody,
  parseEditionYearFromCode,
  catalogStatusToValidity,
  importNormCodes,
  MAX_CODES_PER_REQUEST,
} = require('./normCodesImport.service');

const ORG_ID = 1001;
const USER_ID = 42;
const FOLDER_ID = 900;

afterEach(() => {
  jest.clearAllMocks();
});

describe('parseCodeLines', () => {
  it('ignora righe vuote e duplicati case-insensitive', () => {
    expect(parseCodeLines('ISO 9001:2015\n\niso 9001:2015\nD.Lgs. 81/2008')).toEqual([
      'ISO 9001:2015',
      'D.Lgs. 81/2008',
    ]);
  });

  it('accetta array', () => {
    expect(parseCodeLines(['UNI EN ISO 9001:2015'])).toEqual(['UNI EN ISO 9001:2015']);
  });
});

describe('inferIssuingBody', () => {
  it('riconosce atti italiani, UE, UNI e ISO', () => {
    expect(inferIssuingBody('D.Lgs. 81/2008')).toBe('IT');
    expect(inferIssuingBody('Reg. UE 2016/679')).toBe('UE');
    expect(inferIssuingBody('UNI EN ISO 9001:2015')).toBe('UNI');
    expect(inferIssuingBody('ISO 9001:2015')).toBe('ISO');
    expect(inferIssuingBody('BS EN ISO 9606-1:2017')).toBe('BSI');
  });
});

describe('parseEditionYearFromCode', () => {
  it('estrae anno da :YYYY o /YYYY', () => {
    expect(parseEditionYearFromCode('UNI EN ISO 12944-6:2001')).toBe(2001);
    expect(parseEditionYearFromCode('D.Lgs. 81/2008')).toBe(2008);
  });
});

describe('catalogStatusToValidity', () => {
  it('mappa stati catalogo verso schema registro', () => {
    expect(catalogStatusToValidity({ status: 'active' })).toBe('vigente');
    expect(catalogStatusToValidity({ status: 'withdrawn' })).toBe('superata');
    expect(catalogStatusToValidity({ status: 'unknown' })).toBe('vigente');
  });
});

describe('importNormCodes', () => {
  function mockFolderLookup(companyId = 55) {
    query.mockImplementation((sql) => {
      if (sql.includes("folder_code = '2.3'") || sql.includes('doc_type = \'folder\'')) {
        return Promise.resolve({ recordset: [{ id: FOLDER_ID, company_id: companyId }] });
      }
      if (sql.includes('JSON_VALUE(type_specific_data')) {
        return Promise.resolve({ recordset: [] });
      }
      if (sql.startsWith('INSERT INTO document_registry')) {
        return Promise.resolve({ recordset: [{ id: 5001 }] });
      }
      return Promise.resolve({ recordset: [] });
    });
  }

  it('crea bozza con type_specific_data e vigore da catalogo', async () => {
    mockFolderLookup();
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'active',
      supersededBy: null,
      catalogUrl: 'https://www.normattiva.it/example',
      checkedAt: '2026-05-29T10:00:00.000Z',
    });

    const result = await importNormCodes(ORG_ID, USER_ID, ['D.Lgs. 81/2008']);

    expect(result.summary.created).toBe(1);
    expect(result.results[0].status).toBe('created');
    expect(result.results[0].documentId).toBe(5001);
    expect(result.results[0].validityStatus).toBe('vigente');

    const insertCall = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO document_registry'));
    expect(insertCall).toBeTruthy();
    const params = insertCall[1];
    expect(params.companyId).toBe(55);
    expect(params.typeSpecificData).toContain('"standard_code":"D.Lgs. 81/2008"');
    expect(params.typeSpecificData).toContain('"validity_status":"vigente"');
    expect(params.typeSpecificData).toContain('"validity_check_url"');
  });

  it('salta duplicati per standard_code nella stessa organizzazione', async () => {
    query.mockImplementation((sql) => {
      if (sql.includes("folder_code = '2.3'")) {
        return Promise.resolve({ recordset: [{ id: FOLDER_ID, company_id: null }] });
      }
      if (sql.includes('JSON_VALUE(type_specific_data')) {
        return Promise.resolve({ recordset: [{ id: 300, title: 'D.Lgs. 81/2008 esistente' }] });
      }
      return Promise.resolve({ recordset: [] });
    });

    const result = await importNormCodes(ORG_ID, USER_ID, ['D.Lgs. 81/2008']);

    expect(result.summary.created).toBe(0);
    expect(result.summary.duplicates).toBe(1);
    expect(result.results[0].status).toBe('duplicate');
    expect(normCatalog.lookupNormStatus).not.toHaveBeenCalled();
  });

  it('segnala warning se lookup unknown ma crea comunque la bozza', async () => {
    mockFolderLookup();
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'unknown',
      supersededBy: null,
      catalogUrl: null,
      checkedAt: '2026-05-29T10:00:00.000Z',
      error: 'timeout',
    });

    const result = await importNormCodes(ORG_ID, USER_ID, ['ISO 99999:2099']);

    expect(result.summary.created).toBe(1);
    expect(result.results[0].status).toBe('created_with_warning');
    expect(result.summary.warnings).toBe(1);
  });

  it('rifiuta pi� di MAX_CODES_PER_REQUEST codici', async () => {
    const codes = Array.from({ length: MAX_CODES_PER_REQUEST + 1 }, (_, i) => `ISO ${i}:2020`);
    await expect(importNormCodes(ORG_ID, USER_ID, codes)).rejects.toMatchObject({
      code: 'TOO_MANY_CODES',
    });
  });
});
