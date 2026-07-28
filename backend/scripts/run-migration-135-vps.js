/**
 * Migration 135 — effectiveness_verification_notes su non_conformities
 * Verifica efficacia azione correttiva (ISO 9001 §10.2.1 e), distinta dalla
 * verifica di attuazione del trattamento (`verification_notes`).
 *
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-135-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const colCheck = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities'
              AND COLUMN_NAME = 'effectiveness_verification_notes'
        `);
        if (colCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE dbo.non_conformities
                ADD effectiveness_verification_notes NVARCHAR(MAX) NULL
            `);
            console.log('[135] Colonna effectiveness_verification_notes aggiunta');
        } else {
            console.log('[135] Colonna effectiveness_verification_notes gia esistente — skip');
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities'
              AND COLUMN_NAME = 'effectiveness_verification_notes'
        `);
        console.log('[135] Verifica:', JSON.stringify(verify.recordset));
        console.log('[135] Migrazione completata.');
    } catch (err) {
        console.error('[135] ERRORE:', err.message);
        process.exitCode = 1;
    } finally {
        process.exit(process.exitCode || 0);
    }
}

run();
