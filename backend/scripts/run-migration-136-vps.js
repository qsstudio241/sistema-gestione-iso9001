/**
 * Migration 136 — transfer_mode su qualifications
 * Metodo di trasferimento (ISO 9606-1 §5.2/§9.3) per qualifiche saldatore su
 * processi ad arco con filo continuo (131/135/136/138). Colonna nullable,
 * nessun impatto sui record esistenti.
 *
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-136-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const colCheck = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'qualifications'
              AND COLUMN_NAME = 'transfer_mode'
        `);
        if (colCheck.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE dbo.qualifications
                ADD transfer_mode NVARCHAR(20) NULL
            `);
            console.log('[136] Colonna transfer_mode aggiunta');
        } else {
            console.log('[136] Colonna transfer_mode gia esistente — skip');
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'qualifications'
              AND COLUMN_NAME = 'transfer_mode'
        `);
        console.log('[136] Verifica:', JSON.stringify(verify.recordset));
        console.log('[136] Migrazione completata.');
    } catch (err) {
        console.error('[136] ERRORE:', err.message);
        process.exitCode = 1;
    } finally {
        process.exit(process.exitCode || 0);
    }
}

run();
