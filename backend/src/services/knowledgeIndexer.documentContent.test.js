/**
 * @jest-environment node
 *
 * Test L1 — knowledgeIndexer.indexDocumentContents
 * Focus: scope studio-vs-cliente, idempotenza e ASSENZA di leakage cross-org.
 *
 *  - doc cliente (company_id valorizzato) → chunk con company_id
 *  - doc studio (company_id NULL) → chunk org-level (company_id NULL)
 *  - documento non estraibile → saltato (nessun chunk)
 *  - tutte le query restano vincolate a organization_id = @orgId
 *  - DELETE precede gli INSERT (re-index non duplica)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ embed: jest.fn() }));
jest.mock('./documentTextExtractor.service', () => ({ extractDocumentText: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const { indexDocumentContents, DOCUMENT_CONTENT_ENTITY } = require('./knowledgeIndexer.service');

const ORG = 100;
const OTHER_ORG = 999;

function setupQueryRouter(docs) {
  const calls = [];
  query.mockImplementation(async (sql, params) => {
    calls.push({ sql, params: params || {} });
    if (sql.includes('INFORMATION_SCHEMA.TABLES')) return { recordset: [{ ok: 1 }] };
    if (sql.includes('FROM document_registry dr')) return { recordset: docs };
    if (sql.trim().startsWith('DELETE')) return { rowsAffected: [0] };
    if (sql.includes('INSERT INTO knowledge_chunks')) return { recordset: [] };
    return { recordset: [] };
  });
  return calls;
}

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockImplementation(async (arr) => arr.map(() => [0.1, 0.2, 0.3]));
});

describe('indexDocumentContents — scope e isolamento', () => {
  const longText = Array(900).fill('parola').join(' '); // > 400 parole → più chunk
  const studioText = 'Contenuto del documento di studio per il know-how trasversale dello studio.';

  const docs = [
    {
      document_id: 1, company_id: 5, standard_id: 1, title: 'Procedura cliente',
      doc_code: 'PRC-01', revision: '2', type_specific_data: null,
      attachment_id: 11, storage_path: '/f/1.pdf', mime_type: 'application/pdf', file_name: '1.pdf',
    },
    {
      document_id: 2, company_id: null, standard_id: null, title: 'Manuale studio',
      doc_code: 'MAN-STD', revision: '1', type_specific_data: null,
      attachment_id: 12, storage_path: '/f/2.docx',
      mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_name: '2.docx',
    },
    {
      document_id: 3, company_id: 7, standard_id: null, title: 'Scansione',
      doc_code: 'IMG-1', revision: '1', type_specific_data: null,
      attachment_id: 13, storage_path: '/f/3.png', mime_type: 'image/png', file_name: '3.png',
    },
  ];

  function setupExtractor() {
    extractDocumentText.mockImplementation(async (storagePath) => {
      if (storagePath === '/f/1.pdf') return { text: longText };
      if (storagePath === '/f/2.docx') return { text: studioText };
      return { text: null, reason: 'unsupported_format' }; // /f/3.png
    });
  }

  test('chunk cliente hanno company_id; chunk studio hanno company_id NULL', async () => {
    setupExtractor();
    setupQueryRouter(docs);

    const count = await indexDocumentContents(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    const clientChunks = inserts.filter((p) => p.eid === 1);
    const studioChunks = inserts.filter((p) => p.eid === 2);
    const imgChunks = inserts.filter((p) => p.eid === 3);

    // Documento cliente → company_id 5, standard_id 1
    expect(clientChunks.length).toBeGreaterThan(1); // testo lungo → più chunk
    clientChunks.forEach((p) => {
      expect(p.cid).toBe(5);
      expect(p.sid).toBe(1);
      expect(p.et).toBe(DOCUMENT_CONTENT_ENTITY);
    });

    // Documento studio → company_id NULL (know-how trasversale)
    expect(studioChunks.length).toBe(1);
    expect(studioChunks[0].cid).toBeNull();
    expect(studioChunks[0].et).toBe(DOCUMENT_CONTENT_ENTITY);

    // Immagine non estraibile → nessun chunk
    expect(imgChunks.length).toBe(0);

    expect(count).toBe(clientChunks.length + studioChunks.length);
  });

  test('nessun leakage cross-org: ogni query usa solo organization_id = ORG', async () => {
    setupExtractor();
    setupQueryRouter(docs);

    await indexDocumentContents(ORG);

    for (const [sql, params] of query.mock.calls) {
      if (params && 'orgId' in params) {
        expect(params.orgId).toBe(ORG);
        expect(params.orgId).not.toBe(OTHER_ORG);
      }
      // La SELECT documenti deve restare vincolata all'organizzazione
      if (sql.includes('FROM document_registry dr')) {
        expect(sql).toMatch(/organization_id\s*=\s*@orgId/);
      }
    }
  });

  test('idempotenza: DELETE document_content prima di qualsiasi INSERT', async () => {
    setupExtractor();
    setupQueryRouter(docs);

    await indexDocumentContents(ORG);

    const sqls = query.mock.calls.map(([sql]) => sql);
    const deleteIdx = sqls.findIndex((s) => s.trim().startsWith('DELETE') && s.includes('knowledge_chunks'));
    const firstInsertIdx = sqls.findIndex((s) => s.includes('INSERT INTO knowledge_chunks'));

    expect(deleteIdx).toBeGreaterThanOrEqual(0);
    expect(firstInsertIdx).toBeGreaterThan(deleteIdx);

    const deleteParams = query.mock.calls[deleteIdx][1];
    expect(deleteParams.orgId).toBe(ORG);
    expect(deleteParams.et).toBe(DOCUMENT_CONTENT_ENTITY);
  });

  test('embedding serializzato come JSON negli INSERT', async () => {
    setupExtractor();
    setupQueryRouter(docs);

    await indexDocumentContents(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    expect(inserts.length).toBeGreaterThan(0);
    inserts.forEach((p) => {
      expect(typeof p.emb).toBe('string');
      expect(JSON.parse(p.emb)).toEqual([0.1, 0.2, 0.3]);
    });
  });

  test('embed fallito → chunk inserito con embedding NULL (non blocca)', async () => {
    setupExtractor();
    setupQueryRouter(docs);
    embed.mockRejectedValue(new Error('quota'));

    const count = await indexDocumentContents(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    expect(count).toBeGreaterThan(0);
    inserts.forEach((p) => expect(p.emb).toBeNull());
  });

  test('nessun documento con allegato → 0 chunk, nessun INSERT', async () => {
    setupExtractor();
    setupQueryRouter([]);

    const count = await indexDocumentContents(ORG);

    const inserts = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'));
    expect(count).toBe(0);
    expect(inserts.length).toBe(0);
  });

  test('tabelle assenti → degrada con grazia (0 chunk)', async () => {
    query.mockImplementation(async (sql) => {
      if (sql.includes('INFORMATION_SCHEMA.TABLES')) return { recordset: [] }; // tabella non trovata
      return { recordset: [] };
    });

    const count = await indexDocumentContents(ORG);
    expect(count).toBe(0);
  });
});
