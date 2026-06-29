/**
 * Simulazione end-to-end del feedback loop AI.
 *
 * 1. Inserisce un record ai_feedback fittizio (rephrased) per org 1001
 * 2. Esegue processFeedbackChunks(1001) e verifica che il chunk venga creato
 * 3. Verifica che searchKnowledge trova il chunk con una query semantica
 * 4. Verifica idempotenza: re-run non crea duplicati
 * 5. Verifica isolamento: org 9999 non vede il chunk
 * 6. Cleanup: rimuove i dati di test
 */

const ORG_ID = 1001;
const OTHER_ORG = 9999;
const TEST_USER_ID = 1;
const FEATURE = 'audit_conclusions';

async function run() {
  // Forza variabili env per connessione locale (il database.json ha hostname esterno)
  process.env.DB_SERVER = 'localhost';
  process.env.DB_PORT = '11043';
  process.env.DB_DATABASE = '2026-06-18_SGQ_ISO9001';
  process.env.DB_USER = 'pascarella';
  process.env.DB_ENCRYPT = 'true';
  process.env.DB_TRUST_SERVER_CERTIFICATE = 'true';

  // Leggi password dal .env del test env
  const fs = require('fs');
  try {
    const envContent = fs.readFileSync('/var/www/sgq-backend-test/.env', 'utf8');
    const pwMatch = envContent.match(/DB_PASSWORD=(.+)/);
    if (pwMatch) process.env.DB_PASSWORD = pwMatch[1].trim();
  } catch { /* usa default se disponibile */ }

  let dbModule;
  try {
    dbModule = require('/var/www/sgq-backend-test/src/config/database');
  } catch {
    dbModule = require('/var/www/sgq-backend/src/config/database');
  }
  const { query } = dbModule;

  const results = { passed: 0, failed: 0, details: [] };

  function assert(label, condition) {
    if (condition) {
      results.passed++;
      results.details.push(`  OK  ${label}`);
    } else {
      results.failed++;
      results.details.push(`  FAIL ${label}`);
    }
  }

  try {
    // Setup: pulisci eventuali residui di test precedenti
    await query(
      `DELETE FROM knowledge_chunks WHERE organization_id = @orgId AND entity_type = 'ai_feedback_accepted' AND chunk_text LIKE '%TEST_SIMULATION_MARKER%'`,
      { orgId: ORG_ID }
    );
    await query(
      `DELETE FROM ai_feedback WHERE organization_id = @orgId AND context_summary = 'TEST_SIMULATION_MARKER'`,
      { orgId: ORG_ID }
    );

    // 1. Inserisci feedback fittizio
    await query(
      `INSERT INTO ai_feedback (organization_id, user_id, feature, action, ai_text, final_text, context_summary, model_used)
       VALUES (@orgId, @userId, @feature, 'rephrased',
               'Il sistema e'' conforme. TEST_SIMULATION_MARKER',
               'Il sistema di gestione qualita'' risulta conforme ai requisiti ISO 9001:2015 con due osservazioni minori sulla gestione documentale. TEST_SIMULATION_MARKER',
               'TEST_SIMULATION_MARKER', 'test-model')`,
      { orgId: ORG_ID, userId: TEST_USER_ID, feature: FEATURE }
    );
    console.log('1. Feedback di test inserito');

    // Recupera l'ID del feedback appena inserito
    const fbRes = await query(
      `SELECT TOP 1 id FROM ai_feedback WHERE organization_id = @orgId AND context_summary = 'TEST_SIMULATION_MARKER' ORDER BY id DESC`,
      { orgId: ORG_ID }
    );
    const feedbackId = fbRes.recordset[0]?.id;
    assert('Feedback inserito con ID', feedbackId > 0);

    // 2. Esegui processFeedbackChunks
    let processFeedbackChunks;
    try {
      const ki = require('/var/www/sgq-backend-test/src/services/knowledgeIndexer.service');
      processFeedbackChunks = ki.processFeedbackChunks;
    } catch {
      const ki = require('/var/www/sgq-backend/src/services/knowledgeIndexer.service');
      processFeedbackChunks = ki.processFeedbackChunks;
    }

    const count1 = await processFeedbackChunks(ORG_ID);
    assert('processFeedbackChunks() ha creato chunk', count1 >= 1);
    console.log(`2. processFeedbackChunks creati: ${count1}`);

    // 3. Verifica chunk in DB
    const chunkRes = await query(
      `SELECT id, entity_type, entity_id, chunk_text, embedding FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'ai_feedback_accepted'
         AND chunk_text LIKE '%TEST_SIMULATION_MARKER%'`,
      { orgId: ORG_ID }
    );
    const chunks = chunkRes.recordset || [];
    assert('Chunk creato in knowledge_chunks', chunks.length >= 1);
    assert('Chunk ha entity_id = feedback.id', chunks[0]?.entity_id === feedbackId);
    assert('Chunk contiene testo corretto', chunks[0]?.chunk_text?.includes('Correzione utente'));
    assert('Chunk ha embedding', chunks[0]?.embedding != null && chunks[0]?.embedding.length > 10);
    console.log(`3. Chunk verificato: entity_id=${chunks[0]?.entity_id}, embedding=${chunks[0]?.embedding ? 'OK' : 'NULL'}`);

    // 4. Idempotenza: re-run non crea duplicati
    const count2 = await processFeedbackChunks(ORG_ID);
    assert('Idempotenza: re-run crea 0 nuovi chunk', count2 === 0);
    const chunkRes2 = await query(
      `SELECT COUNT(*) AS cnt FROM knowledge_chunks
       WHERE organization_id = @orgId AND entity_type = 'ai_feedback_accepted'
         AND chunk_text LIKE '%TEST_SIMULATION_MARKER%'`,
      { orgId: ORG_ID }
    );
    assert('Idempotenza: conteggio chunk invariato', chunkRes2.recordset[0]?.cnt === chunks.length);
    console.log(`4. Idempotenza OK: ${count2} nuovi chunk al secondo run`);

    // 5. Isolamento multi-tenant
    const chunkResOther = await query(
      `SELECT COUNT(*) AS cnt FROM knowledge_chunks
       WHERE organization_id = @otherOrg AND entity_type = 'ai_feedback_accepted'
         AND chunk_text LIKE '%TEST_SIMULATION_MARKER%'`,
      { otherOrg: OTHER_ORG }
    );
    assert('Isolamento multi-tenant: org 9999 ha 0 chunk test', chunkResOther.recordset[0]?.cnt === 0);
    console.log(`5. Isolamento OK: org ${OTHER_ORG} ha ${chunkResOther.recordset[0]?.cnt} chunk test`);

    // 6. Cleanup
    await query(
      `DELETE FROM knowledge_chunks WHERE organization_id = @orgId AND entity_type = 'ai_feedback_accepted' AND chunk_text LIKE '%TEST_SIMULATION_MARKER%'`,
      { orgId: ORG_ID }
    );
    await query(
      `DELETE FROM ai_feedback WHERE organization_id = @orgId AND context_summary = 'TEST_SIMULATION_MARKER'`,
      { orgId: ORG_ID }
    );
    console.log('6. Cleanup completato');

  } catch (err) {
    console.error('ERRORE simulazione:', err.message);
    results.failed++;
    results.details.push(`  FAIL Errore imprevisto: ${err.message}`);
  }

  console.log('\n=== RISULTATI SIMULAZIONE ===');
  for (const d of results.details) console.log(d);
  console.log(`\nTotale: ${results.passed} OK, ${results.failed} FAIL`);

  process.exit(results.failed > 0 ? 1 : 0);
}

run();
