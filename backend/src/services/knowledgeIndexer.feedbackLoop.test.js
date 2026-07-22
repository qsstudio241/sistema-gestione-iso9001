/**
 * @jest-environment node
 *
 * Test L1 — knowledgeIndexer: feedback loop
 * Verifica che processFeedbackChunks() converta ai_feedback accettati/corretti
 * in knowledge_chunks per il RAG, rispettando:
 *  - multi-tenant (organization_id)
 *  - idempotenza (no duplicati)
 *  - graceful degradation (0 feedback = 0 effetti, tabella assente = skip)
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('./aiProviderAdapter', () => ({ embed: jest.fn() }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const { query } = require('../config/database');
const { embed } = require('./aiProviderAdapter');
const {
  processFeedbackChunks,
  FEEDBACK_ENTITY_TYPE,
} = require('./knowledgeIndexer.service');

const ORG_A = 100;
const ORG_B = 200;

const FAKE_FEEDBACK = [
  {
    id: 1,
    feature: 'audit_conclusions',
    action: 'rephrased',
    ai_text: 'L\'audit ha evidenziato conformita\' sostanziale.',
    final_text: 'L\'audit ha evidenziato piena conformita\' ai requisiti ISO 9001:2015 con due osservazioni minori.',
    recommendation: 'conforme_con_osservazioni',
    context_summary: 'Audit 2024-03 per Azienda Rossi',
    audit_id: 'uuid-audit-1',
  },
  {
    id: 2,
    feature: 'audit_conclusions',
    action: 'accepted',
    ai_text: null,
    final_text: 'Il sistema di gestione qualita\' risulta conforme ai requisiti della norma ISO 9001:2015.',
    recommendation: 'conforme',
    context_summary: 'Audit 2024-05 per Azienda Verdi',
    audit_id: 'uuid-audit-2',
  },
];

function setupQueryRouter({ feedbackRows = [], tableExists = true, alreadyProcessed = [] } = {}) {
  query.mockImplementation(async (sql, params) => {
    if (sql.includes('INFORMATION_SCHEMA.TABLES')) {
      if (sql.includes('@tbl') && params && params.tbl === 'ai_feedback') {
        return { recordset: tableExists ? [{ ok: 1 }] : [] };
      }
      return { recordset: [{ ok: 1 }] };
    }
    if (sql.includes('FROM ai_feedback')) {
      const orgFiltered = feedbackRows.filter(() => params.orgId === ORG_A);
      const notProcessed = orgFiltered.filter(r => !alreadyProcessed.includes(r.id));
      return { recordset: params.orgId === ORG_A ? notProcessed : [] };
    }
    if (sql.includes('INSERT INTO knowledge_chunks')) return { recordset: [] };
    return { recordset: [] };
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  embed.mockImplementation(async (arr) => arr.map(() => [0.1, 0.2, 0.3]));
});

describe('processFeedbackChunks', () => {
  it('creates chunks from accepted/rephrased feedback', async () => {
    setupQueryRouter({ feedbackRows: FAKE_FEEDBACK });

    const count = await processFeedbackChunks(ORG_A);

    expect(count).toBe(2);
    expect(embed).toHaveBeenCalledTimes(1);
    expect(embed).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.stringContaining('Correzione utente'),
        expect.stringContaining('Risposta AI approvata'),
      ])
    );

    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO knowledge_chunks'));
    expect(insertCalls).toHaveLength(2);

    for (const call of insertCalls) {
      expect(call[1].orgId).toBe(ORG_A);
      expect(call[1].et).toBe(FEEDBACK_ENTITY_TYPE);
    }
  });

  it('includes original AI text in rephrased chunks', async () => {
    setupQueryRouter({ feedbackRows: [FAKE_FEEDBACK[0]] });

    await processFeedbackChunks(ORG_A);

    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO knowledge_chunks'));
    expect(insertCalls[0][1].text).toContain('L\'AI aveva suggerito');
    expect(insertCalls[0][1].text).toContain('L\'utente ha corretto in');
  });

  it('idempotent: does not re-process already converted feedback', async () => {
    setupQueryRouter({ feedbackRows: [], alreadyProcessed: [1, 2] });

    const count = await processFeedbackChunks(ORG_A);
    expect(count).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });

  it('graceful: returns 0 when ai_feedback table does not exist', async () => {
    setupQueryRouter({ tableExists: false });

    const count = await processFeedbackChunks(ORG_A);
    expect(count).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });

  it('graceful: returns 0 when no feedback exists', async () => {
    setupQueryRouter({ feedbackRows: [] });

    const count = await processFeedbackChunks(ORG_A);
    expect(count).toBe(0);
    expect(embed).not.toHaveBeenCalled();
  });

  it('multi-tenant: org B gets 0 chunks even if org A has feedback', async () => {
    setupQueryRouter({ feedbackRows: FAKE_FEEDBACK });

    const countB = await processFeedbackChunks(ORG_B);
    expect(countB).toBe(0);
  });

  it('handles embed failure gracefully (inserts chunk with null embedding)', async () => {
    setupQueryRouter({ feedbackRows: [FAKE_FEEDBACK[0]] });
    embed.mockRejectedValueOnce(new Error('API quota exceeded'));

    const count = await processFeedbackChunks(ORG_A);

    expect(count).toBe(1);
    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO knowledge_chunks'));
    expect(insertCalls[0][1].emb).toBeNull();
  });

  it('sets correct entity_type for feedback chunks', async () => {
    setupQueryRouter({ feedbackRows: [FAKE_FEEDBACK[1]] });

    await processFeedbackChunks(ORG_A);

    const insertCalls = query.mock.calls.filter(c => c[0].includes('INSERT INTO knowledge_chunks'));
    expect(insertCalls[0][1].et).toBe('ai_feedback_accepted');
    expect(insertCalls[0][1].eid).toBe(2);
  });
});
