/**
 * @jest-environment node
 *
 * Test L1 — knowledgeIndexer: indicizzazione note audit (audit_response_note).
 *
 * Verifica:
 *  - Solo note con testo significativo (>20 char) vengono indicizzate
 *  - company_id derivato dall'audit (isolamento per azienda)
 *  - organization_id = @orgId sempre presente (zero leakage cross-org)
 *  - buildText include clausola, domanda, esito e nota
 *  - Note vuote o troppo corte vengono saltate
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ embed: jest.fn() }));
jest.mock('./documentTextExtractor.service', () => ({ extractDocumentText: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const { INDEXABLE_ENTITIES } = require('./knowledgeIndexer.service');

const ORG = 100;
const OTHER_ORG = 999;

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockImplementation(async (arr) => arr.map(() => [0.1, 0.2, 0.3]));
});

const auditResponseNoteEntity = INDEXABLE_ENTITIES.find(
  (e) => e.entity_type === 'audit_response_note'
);

describe('audit_response_note entity definition', () => {
  it('esiste in INDEXABLE_ENTITIES', () => {
    expect(auditResponseNoteEntity).toBeDefined();
    expect(auditResponseNoteEntity.entity_type).toBe('audit_response_note');
  });

  it('SQL include filtro organization_id = @orgId', () => {
    expect(auditResponseNoteEntity.sql).toMatch(/organization_id\s*=\s*@orgId/);
  });

  it('SQL filtra note non vuote con lunghezza minima', () => {
    expect(auditResponseNoteEntity.sql).toMatch(/notes\s+IS\s+NOT\s+NULL/i);
    expect(auditResponseNoteEntity.sql).toMatch(/LEN\(ar\.notes\)\s*>/);
  });

  it('SQL esclude audit cancellati', () => {
    expect(auditResponseNoteEntity.sql).toMatch(/status\s*!=\s*'deleted'/);
  });

  it('SQL include JOIN con checklist_questions per contesto clausola', () => {
    expect(auditResponseNoteEntity.sql).toMatch(/JOIN\s+checklist_questions/i);
  });
});

describe('audit_response_note buildText', () => {
  const build = auditResponseNoteEntity.buildText;

  it('genera testo con tutti i campi', () => {
    const text = build({
      audit_number: 'AUD-2026-001',
      audit_date: '2026-01-15',
      company_name: 'Acme Srl',
      section_code: '7.1.2',
      question_text: 'Le risorse sono adeguate?',
      conformity_status: 'OSS',
      notes: 'Necessario potenziare il reparto qualita con nuove risorse.',
    });
    expect(text).toContain('AUD-2026-001');
    expect(text).toContain('Acme Srl');
    expect(text).toContain('7.1.2');
    expect(text).toContain('Le risorse sono adeguate?');
    expect(text).toContain('OSS');
    expect(text).toContain('Necessario potenziare');
  });

  it('gestisce campi mancanti senza errori', () => {
    const text = build({
      notes: 'Solo una nota senza contesto clausola o azienda disponibile.',
    });
    expect(text).toContain('Solo una nota');
    expect(text).not.toContain('undefined');
  });

  it('include la nota come "Note consulente:"', () => {
    const text = build({
      notes: 'Osservazione importante sulla gestione documentale',
    });
    expect(text).toContain('Note consulente:');
    expect(text).toContain('Osservazione importante');
  });
});

describe('indexAllEntities — audit_response_note scope e isolamento', () => {
  function setupQueryRouter(responseRows) {
    query.mockImplementation(async (sql, params) => {
      if (sql.includes('INFORMATION_SCHEMA.TABLES')) return { recordset: [{ ok: 1 }] };
      if (sql.includes('FROM audit_responses ar') && sql.includes('checklist_questions')) {
        return { recordset: responseRows };
      }
      if (sql.trim().startsWith('DELETE')) return { rowsAffected: [0] };
      if (sql.includes('INSERT INTO knowledge_chunks')) return { recordset: [] };
      return { recordset: [] };
    });
  }

  const sampleNotes = [
    {
      id: 101, company_id: 5, standard_id: 1,
      audit_number: 'AUD-001', audit_date: '2026-03-10',
      conformity_status: 'C', notes: 'Il sistema di gestione della qualita e ben strutturato e documentato.',
      section_code: '4.4', question_text: 'Il SGQ e documentato?',
      company_name: 'ClientA',
    },
    {
      id: 102, company_id: 8, standard_id: 1,
      audit_number: 'AUD-002', audit_date: '2026-04-20',
      conformity_status: 'OSS', notes: 'Si suggerisce di migliorare la tracciabilita dei documenti interni.',
      section_code: '7.5', question_text: 'Gestione documenti adeguata?',
      company_name: 'ClientB',
    },
  ];

  it('indicizza note con company_id corretto dall\'audit', async () => {
    setupQueryRouter(sampleNotes);

    const { indexAllEntities } = require('./knowledgeIndexer.service');
    await indexAllEntities(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    const noteInserts = inserts.filter((p) => p.et === 'audit_response_note');
    expect(noteInserts.length).toBe(2);

    const byEntity = (eid) => noteInserts.filter((p) => p.eid === eid);
    byEntity(101).forEach((p) => expect(p.cid).toBe(5));
    byEntity(102).forEach((p) => expect(p.cid).toBe(8));
  });

  it('nessun leakage cross-org: tutti i parametri orgId = ORG', async () => {
    setupQueryRouter(sampleNotes);

    const { indexAllEntities } = require('./knowledgeIndexer.service');
    await indexAllEntities(ORG);

    for (const [, params] of query.mock.calls) {
      if (params && 'orgId' in params) {
        expect(params.orgId).toBe(ORG);
        expect(params.orgId).not.toBe(OTHER_ORG);
      }
    }
  });

  it('skip note troppo corte (filtro SQL, 0 righe dal DB)', async () => {
    // Note corte (<20 char) sono filtrate a livello SQL (LEN > 20).
    // Simuliamo il DB che restituisce 0 righe per queste note.
    setupQueryRouter([]);

    const { indexAllEntities } = require('./knowledgeIndexer.service');
    await indexAllEntities(ORG);

    const inserts = query.mock.calls
      .filter(([sql]) => sql.includes('INSERT INTO knowledge_chunks'))
      .map(([, p]) => p);

    const noteInserts = inserts.filter((p) => p.et === 'audit_response_note');
    expect(noteInserts.length).toBe(0);
  });
});
