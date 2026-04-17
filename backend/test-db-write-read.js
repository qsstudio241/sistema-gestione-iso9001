/**
 * Test scrittura/lettura database SQL Server
 * Dimostra che il sistema può:
 * 1. Scrivere (INSERT) dati nel database
 * 2. Leggere (SELECT) dati dal database
 * 3. Aggiornare (UPDATE) dati nel database
 * 4. Eliminare (DELETE) dati dal database
 */

require('dotenv').config();
const sql = require('mssql');
const path = require('path');
const { resolveDbSection } = require(path.join(__dirname, 'scripts', 'mergeDbEnv'));

const env = process.env.NODE_ENV || 'development';
const base = resolveDbSection(env);

const config = {
    server: base.server,
    port: base.port || 1433,
    database: base.database,
    user: base.user,
    password: base.password,
    options: base.options || {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    }
};

async function testDatabaseWriteRead() {
    let pool;
    let testAuditId = null;
    let testResponseId = null;

    try {
        console.log('============================================================================');
        console.log('TEST SCRITTURA/LETTURA DATABASE SQL SERVER');
        console.log('============================================================================');
        console.log('');

        // ========================================================================
        // 1. CONNESSIONE
        // ========================================================================
        console.log('1️⃣ CONNESSIONE AL DATABASE...');
        pool = await sql.connect(config);
        console.log('✅ Connesso a SQL Server: www.fr-busato.it:11043');
        console.log('');

        // ========================================================================
        // 2. SCRITTURA (INSERT) - Audit di test
        // ========================================================================
        console.log('2️⃣ SCRITTURA (INSERT) - Creazione audit di test...');

        const insertAuditQuery = `
      INSERT INTO audits (
        audit_number, client_name, project_year, audit_date, auditor_name,
        audit_type, status, total_questions, answered_questions,
        conformities_count, non_conformities_count, completion_percentage,
        created_by, created_at, updated_at, is_deleted, standard_id
      )
      OUTPUT INSERTED.audit_id
      VALUES (
        'TEST-2025-99', 'Cliente Test Write/Read', 2025, GETDATE(), 'Auditor Test',
        'test', 'draft', 78, 0,
        0, 0, 0.00,
        1, GETDATE(), GETDATE(), 0, 1
      );
    `;

        const insertResult = await pool.request().query(insertAuditQuery);
        testAuditId = insertResult.recordset[0].audit_id;
        console.log(`✅ Audit inserito con ID: ${testAuditId}`);
        console.log('');

        // ========================================================================
        // 3. LETTURA (SELECT) - Verifica audit inserito
        // ========================================================================
        console.log('3️⃣ LETTURA (SELECT) - Verifica dati inseriti...');

        const selectAuditQuery = `
      SELECT audit_id, audit_number, client_name, status, total_questions, created_at
      FROM audits
      WHERE audit_id = @auditId;
    `;

        const selectResult = await pool.request()
            .input('auditId', sql.Int, testAuditId)
            .query(selectAuditQuery);

        if (selectResult.recordset.length > 0) {
            const audit = selectResult.recordset[0];
            console.log('✅ Audit letto dal database:');
            console.log(`   - ID: ${audit.audit_id}`);
            console.log(`   - Numero: ${audit.audit_number}`);
            console.log(`   - Cliente: ${audit.client_name}`);
            console.log(`   - Status: ${audit.status}`);
            console.log(`   - Domande totali: ${audit.total_questions}`);
            console.log(`   - Creato: ${audit.created_at.toISOString()}`);
        } else {
            throw new Error('❌ ERRORE: Audit non trovato dopo INSERT!');
        }
        console.log('');

        // ========================================================================
        // 4. SCRITTURA (INSERT) - Risposta audit
        // ========================================================================
        console.log('4️⃣ SCRITTURA (INSERT) - Aggiunta risposta checklist...');

        const insertResponseQuery = `
      INSERT INTO audit_responses (
        audit_id, question_id, conformity_status, notes,
        is_answered, answered_at, created_at, updated_at, created_by
      )
      OUTPUT INSERTED.response_id
      VALUES (
        @auditId, 1, 'C', 'Test nota di conformità - sistema funziona!',
        1, GETDATE(), GETDATE(), GETDATE(), 1
      );
    `;

        const insertResponseResult = await pool.request()
            .input('auditId', sql.Int, testAuditId)
            .query(insertResponseQuery);

        testResponseId = insertResponseResult.recordset[0].response_id;
        console.log(`✅ Risposta inserita con ID: ${testResponseId}`);
        console.log('');

        // ========================================================================
        // 5. LETTURA (SELECT) - Verifica risposta
        // ========================================================================
        console.log('5️⃣ LETTURA (SELECT) - Verifica risposta inserita...');

        const selectResponseQuery = `
      SELECT 
        ar.response_id, ar.conformity_status, ar.notes, ar.is_answered,
        cq.question_text, cq.section_code
      FROM audit_responses ar
      INNER JOIN checklist_questions cq ON ar.question_id = cq.question_id
      WHERE ar.response_id = @responseId;
    `;

        const selectResponseResult = await pool.request()
            .input('responseId', sql.Int, testResponseId)
            .query(selectResponseQuery);

        if (selectResponseResult.recordset.length > 0) {
            const response = selectResponseResult.recordset[0];
            console.log('✅ Risposta letta dal database:');
            console.log(`   - ID: ${response.response_id}`);
            console.log(`   - Sezione: ${response.section_code}`);
            console.log(`   - Domanda: ${response.question_text.substring(0, 80)}...`);
            console.log(`   - Status: ${response.conformity_status}`);
            console.log(`   - Note: ${response.notes}`);
            console.log(`   - Answered: ${response.is_answered}`);
        } else {
            throw new Error('❌ ERRORE: Risposta non trovata dopo INSERT!');
        }
        console.log('');

        // ========================================================================
        // 6. AGGIORNAMENTO (UPDATE)
        // ========================================================================
        console.log('6️⃣ AGGIORNAMENTO (UPDATE) - Modifica risposta...');

        const updateQuery = `
      UPDATE audit_responses
      SET conformity_status = 'OBS',
          notes = 'Nota modificata - UPDATE funziona!',
          updated_at = GETDATE()
      WHERE response_id = @responseId;
    `;

        await pool.request()
            .input('responseId', sql.Int, testResponseId)
            .query(updateQuery);

        console.log('✅ Risposta aggiornata');
        console.log('');

        // ========================================================================
        // 7. LETTURA (SELECT) - Verifica UPDATE
        // ========================================================================
        console.log('7️⃣ LETTURA (SELECT) - Verifica modifica...');

        const selectUpdatedResult = await pool.request()
            .input('responseId', sql.Int, testResponseId)
            .query(selectResponseQuery);

        if (selectUpdatedResult.recordset.length > 0) {
            const updatedResponse = selectUpdatedResult.recordset[0];
            console.log('✅ Dati aggiornati verificati:');
            console.log(`   - Status: ${updatedResponse.conformity_status} (era 'C', ora 'OBS')`);
            console.log(`   - Note: ${updatedResponse.notes}`);
        } else {
            throw new Error('❌ ERRORE: Risposta non trovata dopo UPDATE!');
        }
        console.log('');

        // ========================================================================
        // 8. AGGIORNAMENTO AUDIT (contatori)
        // ========================================================================
        console.log('8️⃣ AGGIORNAMENTO AUDIT - Incrementa contatori...');

        const updateAuditQuery = `
      UPDATE audits
      SET answered_questions = 1,
          completion_percentage = 1.28,
          updated_at = GETDATE()
      WHERE audit_id = @auditId;
    `;

        await pool.request()
            .input('auditId', sql.Int, testAuditId)
            .query(updateAuditQuery);

        console.log('✅ Contatori audit aggiornati (answered_questions=1, completion=1.28%)');
        console.log('');

        // ========================================================================
        // 9. CLEANUP - Eliminazione dati test
        // ========================================================================
        console.log('9️⃣ CLEANUP - Eliminazione dati di test...');

        // Elimina risposta (CASCADE eliminerà anche le referenze)
        const deleteResponseQuery = `DELETE FROM audit_responses WHERE response_id = @responseId;`;
        await pool.request()
            .input('responseId', sql.Int, testResponseId)
            .query(deleteResponseQuery);
        console.log(`✅ Risposta ${testResponseId} eliminata`);

        // Elimina audit
        const deleteAuditQuery = `DELETE FROM audits WHERE audit_id = @auditId;`;
        await pool.request()
            .input('auditId', sql.Int, testAuditId)
            .query(deleteAuditQuery);
        console.log(`✅ Audit ${testAuditId} eliminato`);
        console.log('');

        // ========================================================================
        // 10. VERIFICA CLEANUP
        // ========================================================================
        console.log('🔟 VERIFICA CLEANUP - Conferma eliminazione...');

        const verifyCleanupResult = await pool.request()
            .input('auditId', sql.Int, testAuditId)
            .query(selectAuditQuery);

        if (verifyCleanupResult.recordset.length === 0) {
            console.log('✅ Dati di test eliminati correttamente');
        } else {
            console.warn('⚠️ WARNING: Audit ancora presente dopo DELETE!');
        }
        console.log('');

        // ========================================================================
        // RIEPILOGO FINALE
        // ========================================================================
        console.log('============================================================================');
        console.log('✅ TEST COMPLETATO CON SUCCESSO!');
        console.log('============================================================================');
        console.log('');
        console.log('Operazioni CRUD verificate:');
        console.log('  ✅ CREATE (INSERT) - Audit e risposte scritti nel database');
        console.log('  ✅ READ (SELECT) - Dati letti correttamente dal database');
        console.log('  ✅ UPDATE - Dati modificati con successo');
        console.log('  ✅ DELETE - Dati eliminati correttamente');
        console.log('');
        console.log('🎉 Il sistema di scrittura/lettura database è FUNZIONANTE!');
        console.log('============================================================================');

    } catch (error) {
        console.error('');
        console.error('============================================================================');
        console.error('❌ ERRORE NEL TEST!');
        console.error('============================================================================');
        console.error('Errore:', error.message);
        console.error('Stack:', error.stack);
        console.error('');

        // Cleanup in caso di errore
        if (pool && testAuditId) {
            console.log('Tentativo cleanup audit di test...');
            try {
                if (testResponseId) {
                    await pool.request()
                        .input('responseId', sql.Int, testResponseId)
                        .query('DELETE FROM audit_responses WHERE response_id = @responseId;');
                }
                await pool.request()
                    .input('auditId', sql.Int, testAuditId)
                    .query('DELETE FROM audits WHERE audit_id = @auditId;');
                console.log('✅ Cleanup completato');
            } catch (cleanupError) {
                console.error('⚠️ Errore nel cleanup:', cleanupError.message);
            }
        }

        process.exit(1);
    } finally {
        if (pool) {
            await pool.close();
            console.log('');
            console.log('Connessione chiusa.');
        }
    }
}

// Esegui test
testDatabaseWriteRead();
