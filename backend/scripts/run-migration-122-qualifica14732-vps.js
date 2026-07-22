/**
 * Migration 122 (VPS) — Campi ISO 14732 (welding_type, single_multi_run, qualification_method) su qualifications
 * Uso: node /tmp/run-migration-122-qualifica14732-vps.js
 * Nota: rinominato per evitare collisione con lo script "run-migration-122-vps.js" di un'altra
 * sessione parallela (context_factors/interested_parties, PR merged separatamente su main).
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = path.join('/var/www/sgq-backend/database/migrations/122_qualifications_14732_fields.sql');

async function run() {
    const pool = await getPool();
    try {
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        console.log(`[122] DB=${process.env.DB_DATABASE || '(default)'}`);
        const batches = sql.split(/\nGO\b/i).filter(b => b.trim());
        for (const batch of batches) {
            await pool.request().query(batch);
        }
        const verify = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'qualifications'
              AND COLUMN_NAME IN ('welding_type', 'single_multi_run', 'qualification_method')
        `);
        if (verify.recordset.length < 3) {
            throw new Error('Colonne non trovate dopo migrazione');
        }
        console.log('[122] welding_type + single_multi_run + qualification_method OK');
    } catch (e) {
        console.error('[122] FAIL', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
