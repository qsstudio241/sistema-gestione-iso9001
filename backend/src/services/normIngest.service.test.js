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

jest.mock('./normCodesImport.service', () => ({
  resolveNormFolderId: jest.fn(),
}));

jest.mock('./documentTreeProvisioner.service', () => ({
  calculatePathCache: jest.fn(),
}));

jest.mock('./figureIngest.service', () => ({
  ingestFiguresFromPdf: jest.fn(),
}));

jest.mock('./normChunker.service', () => ({
  indexDocument: jest.fn().mockResolvedValue(undefined),
}));

const { runDocumentIngest } = require('./documentIngestPipeline.service');
const normCatalog = require('./normCatalogLookup.service');
const { query } = require('../config/database');
const { resolveNormFolderId } = require('./normCodesImport.service');
const { calculatePathCache } = require('./documentTreeProvisioner.service');
const { ingestFiguresFromPdf } = require('./figureIngest.service');
const {
  enrichNormFields,
  extractNormFromPdf,
  commitNormFromFields,
  applyNormToExistingDocument,
  assertFolderIsNorms,
  listFolderNormPdfs,
  checkNormDuplicate,
} = require('./normIngest.service');

const NORM_FIELDS = {
  standard_code: 'ISO 9001:2015',
  norm_title: 'Sistemi di gestione per la qualità',
  issuing_body: 'ISO',
  edition_year: 2015,
  validity_status: 'vigente',
};

function mockCommitDb({ documentId = 501, attachmentId = 77, sourceId = 12, withAttachment = true } = {}) {
  resolveNormFolderId.mockResolvedValue({ id: 23, company_id: 8 });
  calculatePathCache.mockResolvedValue('Norme / ISO 9001');
  const rows = [
    { recordset: [{ id: documentId }] },
    { recordset: [] },
  ];
  if (withAttachment) {
    rows.push({ recordset: [{ attachment_id: attachmentId }] });
    rows.push({ recordset: [] });
  }
  rows.push({ recordset: [{ id: sourceId }] });
  rows.forEach((row) => query.mockResolvedValueOnce(row));
}

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
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("'obsoleto'"),
      expect.any(Object),
    );
  });

  it('extractNormFromPdf consente re-upload se esiste solo copia obsoleta', async () => {
    runDocumentIngest.mockResolvedValue({
      fields: { standard_code: 'ISO/TR 15608:2013' },
      fieldConfidence: {},
      warnings: [],
      extractionConfidence: 90,
      text: 'test',
    });
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'withdrawn',
      checkedAt: '2026-07-05T10:00:00.000Z',
    });
    query.mockResolvedValue({ recordset: [] });

    const out = await extractNormFromPdf(Buffer.from('%PDF'), 'iso-tr-15608.pdf', 1001, null);

    expect(out.status).toBe('ready_commit');
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

  it('commitNormFromFields chiama ingestFiguresFromPdf con path e organizationId', async () => {
    mockCommitDb();
    ingestFiguresFromPdf.mockResolvedValue({ figures: [], count: 0 });

    const out = await commitNormFromFields(NORM_FIELDS, 1001, {
      userId: 7,
      filePath: '/tmp/norma-test.pdf',
      fileName: 'ISO-9001.pdf',
    });

    expect(out.document_id).toBe(501);
    expect(ingestFiguresFromPdf).toHaveBeenCalledTimes(1);
    expect(ingestFiguresFromPdf).toHaveBeenCalledWith({
      organizationId: 1001,
      companyId: 8,
      pdfPath: '/tmp/norma-test.pdf',
    });
  });

  it('commitNormFromFields resta ok se ingestFiguresFromPdf throw', async () => {
    mockCommitDb({ documentId: 602 });
    ingestFiguresFromPdf.mockRejectedValue(new Error('CLIP down'));

    const out = await commitNormFromFields(NORM_FIELDS, 1004, {
      userId: 7,
      filePath: '/tmp/norma-clip-fail.pdf',
      fileName: 'ISO-9001.pdf',
    });

    expect(out.document_id).toBe(602);
    expect(out.standard_code).toBe('ISO 9001:2015');
    expect(ingestFiguresFromPdf).toHaveBeenCalledWith({
      organizationId: 1004,
      companyId: 8,
      pdfPath: '/tmp/norma-clip-fail.pdf',
    });
  });

  it('extractNormFromPdf esclude il documento corrente dal duplicate (ingest cartella)', async () => {
    runDocumentIngest.mockResolvedValue({
      fields: { standard_code: 'ISO 9001:2015', norm_title: 'Qualità' },
      fieldConfidence: { standard_code: 'high' },
      warnings: [],
      extractionConfidence: 90,
      text: 'x'.repeat(6000),
    });
    normCatalog.lookupNormStatus.mockResolvedValue({
      status: 'active',
      checkedAt: '2026-08-21T10:00:00.000Z',
    });
    query.mockResolvedValue({ recordset: [] });

    const out = await extractNormFromPdf(
      Buffer.from('%PDF'),
      'iso9001.pdf',
      1001,
      23,
      { excludeDocumentId: 88 },
    );

    expect(out.status).toBe('ready_commit');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('@excludeId'),
      expect.objectContaining({ excludeId: 88, code: 'ISO 9001:2015' }),
    );
  });

  it('checkNormDuplicate è falso se l\'unico match è il documento escluso', async () => {
    query.mockResolvedValue({ recordset: [] });
    const dup = await checkNormDuplicate('ISO 9001:2015', 1001, 88);
    expect(dup).toBe(false);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('id <> @excludeId'),
      expect.objectContaining({ excludeId: 88 }),
    );
  });

  it('applyNormToExistingDocument aggiorna il record e non fa INSERT in document_registry', async () => {
    ingestFiguresFromPdf.mockResolvedValue({ figures: [], count: 0 });
    query
      .mockResolvedValueOnce({ recordset: [{ id: 88, company_id: 8, parent_id: 23, title: 'iso9001.pdf' }] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [] })
      .mockResolvedValueOnce({ recordset: [{ id: 12 }] });

    const out = await applyNormToExistingDocument(88, NORM_FIELDS, 1001, {
      userId: 7,
      filePath: '/uploads/import/iso9001.pdf',
      fileName: 'iso9001.pdf',
      extractedText: 'x'.repeat(6000),
      textQuality: 'good',
    });

    expect(out.document_id).toBe(88);
    expect(out.standard_code).toBe('ISO 9001:2015');
    const sqls = query.mock.calls.map((c) => String(c[0]));
    expect(sqls.some((s) => /INSERT INTO document_registry/i.test(s))).toBe(false);
    expect(sqls.some((s) => /UPDATE document_registry/i.test(s))).toBe(true);
    expect(ingestFiguresFromPdf).toHaveBeenCalledWith({
      organizationId: 1001,
      companyId: 8,
      pdfPath: '/uploads/import/iso9001.pdf',
    });
  });

  it('assertFolderIsNorms rifiuta una cartella che non è 2.3', async () => {
    query.mockResolvedValue({ recordset: [{ id: 9, company_id: 8, folder_code: '2.2' }] });
    await expect(assertFolderIsNorms(1001, 9)).rejects.toMatchObject({ code: 'FOLDER_NOT_NORMS' });
  });

  it('listFolderNormPdfs filtra per document_ids', async () => {
    query.mockResolvedValue({
      recordset: [
        { id: 11, file_name: 'a.pdf', storage_path: '/a.pdf' },
        { id: 12, file_name: 'b.pdf', storage_path: '/b.pdf' },
      ],
    });
    const rows = await listFolderNormPdfs(1001, 23, [12]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(12);
  });

  it('commitNormFromFields non chiama ingest figure senza filePath', async () => {
    mockCommitDb({ withAttachment: false });

    const out = await commitNormFromFields(NORM_FIELDS, 1001, {
      userId: 7,
      fileName: 'ISO-9001.pdf',
    });

    expect(out.document_id).toBe(501);
    expect(ingestFiguresFromPdf).not.toHaveBeenCalled();
  });
});
