/**
 * Migration 121 (VPS) — Correzione obbligatoria + Valutazione azione correttiva
 * Uso: node /tmp/run-migration-121-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = path.join('/var/www/sgq-backend/database/migrations/121_nc_correction_gate.sql');

async function run() {
    const pool = await getPool();
    try {
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        console.log(`[121] DB=${process.env.DB_DATABASE || '(default)'}`);
        const batches = sql.split(/\nGO\b/i).filter(b => b.trim());
        for (const batch of batches) {
            await pool.request().query(batch);
        }
        const verify = await pool.request().query(`
            SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'non_conformities'
              AND COLUMN_NAME IN ('corrective_action_needed', 'corrective_action_evaluation_notes')
        `);
        if (verify.recordset.length < 2) {
            throw new Error('Colonne non trovate dopo migrazione');
        }
        console.log('[121] corrective_action_needed + corrective_action_evaluation_notes OK');
    } catch (e) {
        console.error('[121] FAIL', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
