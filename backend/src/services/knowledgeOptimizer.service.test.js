/**
 * @jest-environment node
 *
 * Test L1 — knowledgeOptimizer: schema reale di knowledge_chunks.
 * La tabella ha `last_indexed_at` e NON ha `created_at` (migrazione 062):
 * il job notturno falliva con "Invalid column name 'created_at'".
 * Il mock DB simula SQL Server: errore se una query usa `created_at` non
 * qualificato (le query su ai_usage_log usano alias `ul.created_at`, colonna valida).
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ chat: jest.fn(), embed: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const {
  deduplicateChunks,
  pruneStaleChunks,
  detectGaps,
  runOptimization,
} = require('./knowledgeOptimizer.service');

const ORG = 100;

const UNQUALIFIED_CREATED_AT = /(?<![\w.])created_at\b/i;
const KC_CREATED_AT = /\bkc\.created_at\b/i;

function referencesMissingCreatedAt(sql) {
  return UNQUALIFIED_CREATED_AT.test(sql) || KC_CREATED_AT.test(sql);
}

const DUP_A = JSON.stringify([1, 0, 0]);
const DUP_B = JSON.stringify([0.99, 0.01, 0]);
const DISTINCT = JSON.stringify([0, 1, 0]);

let executed;
let deletedIds;
let chunkRows;

function installFakeDb() {
  executed = [];
  deletedIds = [];
  query.mockImplementation(async (sql, params = {}) => {
    executed.push(sql);
    if (referencesMissingCreatedAt(sql)) {
      throw new Error("Invalid column name 'created_at'.");
    }
    if (/INSERT INTO ai_optimization_runs/i.test(sql)) return { recordset: [{ id: 1 }] };
    if (/UPDATE ai_optimization_runs/i.test(sql)) return { recordset: [], rowsAffected: [1] };
    if (/SELECT DISTINCT entity_type, company_id/i.test(sql)) {
      return { recordset: [{ entity_type: 'document', company_id: null }] };
    }
    if (/SELECT id, embedding, last_indexed_at FROM knowledge_chunks/i.test(sql)) {
      return { recordset: chunkRows };
    }
    if (/DELETE FROM knowledge_chunks/i.test(sql)) {
      deletedIds.push(...Object.values(params));
      return { recordset: [], rowsAffected: [Object.keys(params).length] };
    }
    if (/SELECT COUNT\(\*\) AS cnt/i.test(sql)) return { recordset: [{ cnt: 3 }] };
    if (/UPDATE kc SET kc\.is_stale/i.test(sql)) return { recordset: [], rowsAffected: [0] };
    if (/SELECT id, name FROM companies/i.test(sql)) {
      return { recordset: [{ id: 7, name: 'Azienda Test' }] };
    }
    if (/GROUP BY company_id, entity_type/i.test(sql)) {
      return { recordset: [{ company_id: 7, entity_type: 'document', cnt: 2 }] };
    }
    return { recordset: [], rowsAffected: [0] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  chunkRows = [
    { id: 30, embedding: DUP_A, last_indexed_at: new Date('2026-05-03T00:00:00Z') },
    { id: 20, embedding: DUP_B, last_indexed_at: new Date('2026-05-02T00:00:00Z') },
    { id: 10, embedding: DISTINCT, last_indexed_at: null },
  ];
  installFakeDb();
});

describe('knowledgeOptimizer — knowledge_chunks usa last_indexed_at, non created_at', () => {
  test('deduplicateChunks non lancia "Invalid column name created_at"', async () => {
    await expect(deduplicateChunks(ORG)).resolves.toEqual({ removed: 1, before: 3, after: 2 });
  });

  test('la SELECT dei chunk usa last_indexed_at (colonna, ORDER BY) con NULL gestito', async () => {
    await deduplicateChunks(ORG);
    const chunkSql = executed.find((s) => /SELECT id, embedding/i.test(s));
    expect(chunkSql).toBeDefined();
    expect(chunkSql).toMatch(/SELECT id, embedding, last_indexed_at FROM knowledge_chunks/i);
    expect(chunkSql).toMatch(/ORDER BY ISNULL\(last_indexed_at,[^)]*\) DESC, id DESC/i);
    expect(referencesMissingCreatedAt(chunkSql)).toBe(false);
  });

  test('dedup mantiene il chunk più recente e rimuove il duplicato più vecchio', async () => {
    await deduplicateChunks(ORG);
    expect(deletedIds).toEqual([20]);
  });

  test('pruneStaleChunks e detectGaps non usano created_at su knowledge_chunks', async () => {
    await expect(pruneStaleChunks(ORG)).resolves.toBeDefined();
    await expect(detectGaps(ORG)).resolves.toEqual([
      expect.objectContaining({ companyId: 7, companyName: 'Azienda Test' }),
    ]);
  });

  test('runOptimization completa dedup, prune e gaps senza errori', async () => {
    const summary = await runOptimization(ORG);
    expect(summary.dedup.error).toBeUndefined();
    expect(summary.prune.error).toBeUndefined();
    expect(Array.isArray(summary.gaps)).toBe(true);
    for (const sql of executed) {
      expect(referencesMissingCreatedAt(sql)).toBe(false);
    }
  });

  test('il mock DB rifiuta davvero created_at non qualificato (guardia del test)', async () => {
    await expect(query('SELECT id, created_at FROM knowledge_chunks')).rejects.toThrow(
      /Invalid column name 'created_at'/
    );
    await expect(
      query('SELECT 1 FROM ai_usage_log ul WHERE ul.created_at >= GETDATE()')
    ).resolves.toBeDefined();
  });
});
