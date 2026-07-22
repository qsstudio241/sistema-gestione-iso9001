/**
 * @jest-environment node
 *
 * Test L1 — knowledgeIndexer: scope dei chunk derivato dall'etichetta ESPLICITA
 * content_scope (migrazione 111), con fallback ai dati legacy.
 *
 *  - content_scope='client'               -> chunk con company_id (scope azienda)
 *  - content_scope='studio' | 'reference' -> chunk org-level (company_id NULL)
 *  - content_scope assente (legacy)       -> fallback al company_id
 *  - organization_id = @orgId sempre presente (zero leakage cross-org)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ embed: jest.fn() }));
jest.mock('./documentTextExtractor.service', () => ({ extractDocumentText: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const { extractDocumentText } = require('./documentTextExtractor.service');
const {
  indexDocumentContents,
  companyIdForContentScope,
  DOCUMENT_CONTENT_ENTITY,
} = require('./knowledgeIndexer.service');

const ORG = 100;
const OTHER_ORG = 999;

const STUDIO_TEXT = 'Contenuto del know-how dello studio, valido come riferimento trasversale.';

function setupQueryRouter(docs) {
  query.mockImplementation(async (sql) => {
    if (sql.includes('INFORMATION_SCHEMA.TABLES')) return { recordset: [{ ok: 1 }] };
    if (sql.includes('FROM document_registry dr')) return { recordset: docs };
    if (sql.trim().startsWith('DELETE')) return { rowsAffected: [0] };
    if (sql.includes('INSERT INTO knowledge_chunks')) return { recordset: [] };
    return { recordset: [] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockImplementation(async (arr) => arr.map(() => [0.1, 0.2, 0.3]));
  extractDocumentText.mockResolvedValue({ text: STUDIO_TEXT });
});

describe('companyIdForContentScope', () => {
  it("'client' -> usa company_id", () => {
    expect(companyIdForContentScope({ content_scope: 'client', company_id: 5 })).toBe(5);
  });
  it("'studio' -> null (org-level)", () => {
    expect(companyIdForContentScope({ content_scope: 'studio', company_id: 5 })).toBeNull();
  });
  it("'reference' -> null (org-level)", () => {
    expect(companyIdForContentScope({ content_scope: 'reference', company_id: 5 })).toBeNull();
  });
  it('legacy (content_scope assente) -> fallback al company_id', () => {
    expect(companyIdForContentScope({ company_id: 7 })).toBe(7);
    expect(companyIdForContentScope({ company_id: null })).toBeNull();
  });
});

describe('indexDocumentContents — scope derivato da content_scope', () => {
  const docs = [
    { document_id: 10, company_id: 5, content_scope: 'client', standard_id: 1,
      storage_path: '/f/a.pdf', mime_type: 'application/pdf', file_name: 'a.pdf' },
    { document_id: 11, company_id: null, content_scope: 'studio', standard_id: null,
      storage_path: '/f/b.docx', mime_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', file_name: 'b.docx' },
    { document_id: 12, company_id: null, content_scope: 'reference', standard_id: null,
      storage_path: '/f/c.pdf', mime_type: 'application/pdf', file_name: 'c.pdf' },
    // Documento "client" ma con company_id valorizzato anche se anomalo
    { document_id: 13, company_id: 8, content_scope: 'client', standard_id: null,
      storage_path: '/f/d.pdf', mime_type: 'application/pdf', file_name: 'd.pdf' },
  ];

  it('client -> company_id; studio/reference -> NULL', async () => {
    setupQueryRouter(docs);
    await indexDocumentContents(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    const byDoc = (eid) => inserts.filter((p) => p.eid === eid);

    expect(byDoc(10).length).toBeGreaterThan(0);
    byDoc(10).forEach((p) => expect(p.cid).toBe(5));   // client
    byDoc(13).forEach((p) => expect(p.cid).toBe(8));   // client
    byDoc(11).forEach((p) => expect(p.cid).toBeNull()); // studio
    byDoc(12).forEach((p) => expect(p.cid).toBeNull()); // reference

    inserts.forEach((p) => expect(p.et).toBe(DOCUMENT_CONTENT_ENTITY));
  });

  it('nessun leakage: ogni INSERT/SELECT vincolato a organization_id = ORG', async () => {
    setupQueryRouter(docs);
    await indexDocumentContents(ORG);

    for (const [sql, params] of query.mock.calls) {
      if (params && 'orgId' in params) {
        expect(params.orgId).toBe(ORG);
        expect(params.orgId).not.toBe(OTHER_ORG);
      }
      if (sql.includes('FROM document_registry dr')) {
        expect(sql).toMatch(/organization_id\s*=\s*@orgId/);
        expect(sql).toMatch(/content_scope/);
      }
    }
  });

  it('documento legacy (content_scope NULL) -> fallback company_id', async () => {
    setupQueryRouter([
      { document_id: 20, company_id: 3, content_scope: null, standard_id: null,
        storage_path: '/f/x.pdf', mime_type: 'application/pdf', file_name: 'x.pdf' },
    ]);
    await indexDocumentContents(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    expect(inserts.length).toBeGreaterThan(0);
    inserts.forEach((p) => expect(p.cid).toBe(3));
  });
});
