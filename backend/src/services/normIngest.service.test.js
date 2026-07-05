/**
 * @jest-environment node
 */

jest.mock('./documentIngestPipeline.service', () => ({
  runDocumentIngest: jest.fn(),
}));

jest.mock('./normCatalogLookup.service', () => ({
  lookupNormStatus: jest.fn(),
}));

jest.mock('../config/database', () => ({
  query: jest.fn(),
}));

const { runDocumentIngest } = require('./documentIngestPipeline.service');
const normCatalog = require('./normCatalogLookup.service');
const { query } = require('../config/database');
const {
  enrichNormFields,
  extractNormFromPdf,
} = require('./normIngest.service');

describe('normIngest.service (IG-N)', () => {
  afterEach(() => jest.clearAllMocks());

  it('enrichNormFields normalizza ISO/TR 15608 e imposta vigore da catalogo', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'active',
      catalogUrl: 'https://store.uni.com/x',
      checkedAt: '2026-07-04T10:00:00.000Z',
      matchedQuery: 'ISO/TR 15608:2013',
    });

    const out = await enrichNormFields({
      standard_code: 'ISO_TR_15608_2013',
      norm_title: 'Gruppi materiali',
      issuing_body: 'ISO',
    }, []);

    expect(out.fields.standard_code).toBe('ISO/TR 15608:2013');
    expect(out.fields.validity_status).toBe('vigente');
    expect(out.needsReview).toBe(false);
    expect(out.catalog_lookup.status).toBe('active');
  });

  it('enrichNormFields richiede review su ambiguous_match', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'unknown',
      error: 'ambiguous_match',
      catalogUrl: 'https://store.uni.com/search',
      checkedAt: '2026-07-04T10:00:00.000Z',
    });

    const out = await enrichNormFields({
      standard_code: 'UNI EN ISO 9001:2015',
      norm_title: 'Sistemi di gestione',
    }, []);

    expect(out.needsReview).toBe(true);
    expect(out.catalog_lookup.error).toBe('ambiguous_match');
    expect(out.fields.validity_status).toBe('da_verificare');
  });

  it('extractNormFromPdf restituisce pending_review se catalogo ambiguo', async () => {
    runDocumentIngest.mockResolvedValue({
      fields: { standard_code: 'ISO 9001:2015', norm_title: 'Qualità' },
      fieldConfidence: { standard_code: 'medium' },
      warnings: [],
      extractionConfidence: 80,
      aiModel: 'test-model',
      text: 'testo pdf',
    });
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'unknown',
      error: 'ambiguous_match',
      checkedAt: '2026-07-04T10:00:00.000Z',
    });
    query.mockResolvedValue({ recordset: [] });

    const out = await extractNormFromPdf(Buffer.from('%PDF'), 'iso9001.pdf', 1001, 42);

    expect(out.status).toBe('pending_review');
    expect(out.fields.standard_code).toBe('ISO 9001:2015');
    expect(out.parent_folder_id).toBe(42);
  });

  it('extractNormFromPdf restituisce ready_commit se match deterministico', async () => {
    runDocumentIngest.mockResolvedValue({
      fields: { standard_code: 'ISO/TR 15608:2013', norm_title: 'Gruppi materiali' },
      fieldConfidence: { standard_code: 'high' },
      warnings: [],
      extractionConfidence: 85,
      aiModel: 'test-model',
      text: 'x'.repeat(6000),
    });
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'active',
      checkedAt: '2026-07-04T10:00:00.000Z',
    });
    query.mockResolvedValue({ recordset: [] });

    const out = await extractNormFromPdf(Buffer.from('%PDF'), 'iso-tr-15608.pdf', 1001, null);

    expect(out.status).toBe('ready_commit');
    expect(out.text_quality).toBe('good');
  });

  it('extractNormFromPdf segnala duplicate', async () => {
    runDocumentIngest.mockResolvedValue({
      fields: { standard_code: 'ISO/TR 15608:2013' },
      fieldConfidence: {},
      warnings: [],
      extractionConfidence: 90,
      text: 'test',
    });
    normCatalog.lookupNormStatus.mockResolvedValue({ status: 'active', checkedAt: '2026-07-04' });
    query.mockResolvedValue({ recordset: [{ id: 99 }] });

    const out = await extractNormFromPdf(Buffer.from('%PDF'), 'dup.pdf', 1001, null);

    expect(out.status).toBe('duplicate');
    expect(out.standard_code).toBe('ISO/TR 15608:2013');
  });

  it('enrichNormFields preferisce filename se AI estrae codice diverso (15614 vs 9606)', async () => {
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'active',
      catalogUrl: 'https://store.uni.com/uni-en-iso-15614-1-2019',
      checkedAt: '2026-07-05T10:00:00.000Z',
      matchedQuery: 'UNI EN ISO 15614-1:2019',
    });

    const out = await enrichNormFields({
      standard_code: 'EN ISO 9606-1-A2:2015:2015',
      norm_title: 'Prove di qualificazione',
      _fileName: 'UNI EN ISO 15614-1_2019.pdf',
    }, []);

    expect(out.fields.standard_code).toBe('UNI EN ISO 15614-1:2019');
    expect(out.fields.validity_status).toBe('vigente');
    expect(out.needsReview).toBe(false);
  });
});
