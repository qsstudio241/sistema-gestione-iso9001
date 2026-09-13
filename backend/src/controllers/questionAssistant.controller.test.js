/**
 * questionAssistant.controller.test.js — Test L1 per AI Assistant quesiti checklist
 * 
 * Verifica:
 * - hasOfficialSource=true se norm_chunks presente
 * - notifica admin creata se fonte mancante (prima volta oggi)
 * - nessuna notifica duplicata se già notificato oggi
 */

const { describe, it, expect, beforeAll, afterAll } = require('@jest/globals');
const request = require('supertest');
const express = require('express');
const { query, closePool } = require('../config/database');
const { verifyToken } = require('../middleware/auth.middleware');
const questionAssistantRoutes = require('../routes/questionAssistant.routes');

// Mock middleware auth
jest.mock('../middleware/auth.middleware', () => ({
  verifyToken: (req, res, next) => {
    req.user = {
      id: 1,
      organization_id: 1001,
      role: 'admin',
      licenses: [{ module_code: 'ai_chat', expires_at: null }],
    };
    next();
  },
}));

// Mock AI provider (evita chiamate reali a Gemini/Anthropic)
jest.mock('../services/aiProviderAdapter', () => ({
  chat: jest.fn(async (messages) => {
    return '**Esito suggerito:** C (Conforme)\n**Motivazione:** Requisito soddisfatto con evidenze documentali adeguate.\n**Gap evidenze:** Nessun gap';
  }),
}));

// Mock RAG retrieval
jest.mock('../services/normChunker.service', () => ({
  searchSimilar: jest.fn(async (queryText, orgId, options) => {
    // Simula chunk trovati se standard presente
    if (options.standardCodes && options.standardCodes.includes('ISO_9001_2015')) {
      return [
        {
          chunk_text: '§7.1.2 Risorse - L\'organizzazione deve determinare e fornire le risorse necessarie...',
          standard_code: 'ISO_9001_2015',
          page: 15,
        },
      ];
    }
    return [];
  }),
}));

const app = express();
app.use(express.json());
app.use('/api/v1/ai', questionAssistantRoutes);

const API_ENDPOINT = '/api/v1/ai/question-assistant';

describe('POST /ai/question-assistant', () => {
  const testOrgId = 1001;
  const testStandardCode = 'ISO_9001_2015';

  beforeAll(async () => {
    // Cleanup test data
    try {
      await query(
        `DELETE FROM ai_assistant_usage WHERE organization_id = @orgId`,
        { orgId: testOrgId }
      );
      await query(
        `DELETE FROM ai_assistant_notifications WHERE organization_id = @orgId`,
        { orgId: testOrgId }
      );
      await query(
        `DELETE FROM alerts WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
        { orgId: testOrgId }
      );
    } catch (err) {
      console.warn('[TEST SETUP] Cleanup warnings (non bloccante):', err.message);
    }
  });

  afterAll(async () => {
    // Cleanup after tests
    try {
      await query(
        `DELETE FROM ai_assistant_usage WHERE organization_id = @orgId`,
        { orgId: testOrgId }
      );
      await query(
        `DELETE FROM ai_assistant_notifications WHERE organization_id = @orgId`,
        { orgId: testOrgId }
      );
      await query(
        `DELETE FROM alerts WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
        { orgId: testOrgId }
      );
    } catch (err) {
      console.warn('[TEST CLEANUP] Warnings (non bloccante):', err.message);
    }
    await closePool();
  });

  it('ritorna hasOfficialSource=true se norm_chunks presente per lo standard', async () => {
    // Seed document_registry + norm_chunks (se non già presenti)
    try {
      const checkNorm = await query(
        `SELECT id FROM document_registry 
         WHERE organization_id = @orgId AND standard_code = @stdCode AND validity_status = 'active'`,
        { orgId: testOrgId, stdCode: testStandardCode }
      );

      if (!checkNorm.recordset || checkNorm.recordset.length === 0) {
        // Crea entry fittizia per test
        await query(
          `INSERT INTO document_registry 
            (organization_id, standard_code, title, edition, document_type, validity_status, upload_date)
           VALUES (@orgId, @stdCode, 'ISO 9001:2015', '2025', 'norm_source', 'active', GETDATE())`,
          { orgId: testOrgId, stdCode: testStandardCode }
        );
      }

      const checkChunks = await query(
        `SELECT id FROM norm_chunks 
         WHERE organization_id = @orgId AND standard_code = @stdCode`,
        { orgId: testOrgId, stdCode: testStandardCode }
      );

      if (!checkChunks.recordset || checkChunks.recordset.length === 0) {
        // Crea chunk fittizio
        await query(
          `INSERT INTO norm_chunks 
            (organization_id, standard_code, chunk_text, chunk_index, embedding)
           VALUES (@orgId, @stdCode, 'Test chunk', 0, NULL)`,
          { orgId: testOrgId, stdCode: testStandardCode }
        );
      }
    } catch (err) {
      console.warn('[TEST SEED] Errore seed norm_chunks (potrebbe già esistere):', err.message);
    }

    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'conformity_assessment',
        question: {
          id: 'q_test_1',
          clauseRef: '7.1.2',
          standardCode: testStandardCode,
          text: 'L\'organizzazione ha determinato e fornito le risorse necessarie?',
          currentStatus: 'NV',
          notes: 'Verificato organigramma',
        },
        attachments: [],
        auditContext: { auditId: 999, companyId: 789 },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.hasOfficialSource).toBe(true);
    expect(res.body.data.sourceDisclaimer).toContain('✅');
  });

  it('crea notifica admin se fonte mancante (prima volta oggi)', async () => {
    const testStandardNoSource = 'ISO_14001_2015';

    // Assicurati che non ci siano norm_chunks per questo standard
    await query(
      `DELETE FROM norm_chunks WHERE organization_id = @orgId AND standard_code = @stdCode`,
      { orgId: testOrgId, stdCode: testStandardNoSource }
    );

    // Rimuovi notifiche precedenti per test pulito
    await query(
      `DELETE FROM ai_assistant_notifications 
       WHERE organization_id = @orgId AND standard_code = @stdCode`,
      { orgId: testOrgId, stdCode: testStandardNoSource }
    );

    await query(
      `DELETE FROM alerts 
       WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
      { orgId: testOrgId }
    );

    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'conformity_assessment',
        question: {
          clauseRef: '4.1',
          standardCode: testStandardNoSource,
          text: 'L\'organizzazione ha determinato il contesto esterno?',
          currentStatus: 'NV',
        },
        attachments: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.data.hasOfficialSource).toBe(false);
    expect(res.body.data.sourceDisclaimer).toContain('⚠️');

    // Verifica notifica creata
    const alertCheck = await query(
      `SELECT id, title, message FROM alerts 
       WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
      { orgId: testOrgId }
    );

    expect(alertCheck.recordset.length).toBeGreaterThan(0);
    const alert = alertCheck.recordset[0];
    expect(alert.title).toContain('AI usata senza norma ufficiale');
    expect(alert.message).toContain('ISO 14001');
  });

  it('non crea notifica duplicata se già notificato oggi per stessa coppia org+standard', async () => {
    const testStandardNoSource = 'ISO_45001_2018';

    // Cleanup
    await query(
      `DELETE FROM norm_chunks WHERE organization_id = @orgId AND standard_code = @stdCode`,
      { orgId: testOrgId, stdCode: testStandardNoSource }
    );

    // Seed notifica già presente oggi
    const today = new Date().toISOString().split('T')[0];
    await query(
      `DELETE FROM ai_assistant_notifications 
       WHERE organization_id = @orgId AND standard_code = @stdCode`,
      { orgId: testOrgId, stdCode: testStandardNoSource }
    );

    await query(
      `INSERT INTO ai_assistant_notifications 
        (organization_id, standard_code, notification_date)
       VALUES (@orgId, @stdCode, @today)`,
      { orgId: testOrgId, stdCode: testStandardNoSource, today }
    );

    // Conta alert prima della richiesta
    const alertsBefore = await query(
      `SELECT COUNT(*) as cnt FROM alerts 
       WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
      { orgId: testOrgId }
    );

    const countBefore = alertsBefore.recordset[0].cnt;

    // Fai richiesta
    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'conformity_assessment',
        question: {
          clauseRef: '6.1',
          standardCode: testStandardNoSource,
          text: 'L\'organizzazione ha identificato i pericoli?',
        },
      });

    expect(res.status).toBe(200);

    // Verifica nessun nuovo alert creato
    const alertsAfter = await query(
      `SELECT COUNT(*) as cnt FROM alerts 
       WHERE organization_id = @orgId AND alert_type = 'ai_usage_no_source'`,
      { orgId: testOrgId }
    );

    const countAfter = alertsAfter.recordset[0].cnt;
    expect(countAfter).toBe(countBefore); // Nessun nuovo alert
  });

  it('ritorna 400 se mode non valido', async () => {
    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'invalid_mode',
        question: { text: 'Test' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Mode non valido');
  });

  it('ritorna 400 se question.text mancante', async () => {
    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'conformity_assessment',
        question: {},
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Parametri mancanti');
  });

  it('estrae suggestedStatus correttamente da risposta AI', async () => {
    const res = await request(app)
      .post(API_ENDPOINT)
      .send({
        mode: 'conformity_assessment',
        question: {
          text: 'Test conformità',
          standardCode: 'ISO_9001_2015',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.data.suggestedStatus).toBe('C'); // Mock ritorna C
  });
});
