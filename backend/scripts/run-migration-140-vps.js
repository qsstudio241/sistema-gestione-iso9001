/**
 * Migration 140 (VPS) — colonna thickness_max_unlimited su qualifications
 * (fix bug fail-open in qualificationCoverage.js — ISO 3834-2 §8.2, checkThickness
 * trattava sempre un qualMax NULL come "nessun limite").
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-140-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const check = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'thickness_max_unlimited'
        `);
        if (check.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE qualifications ADD thickness_max_unlimited BIT NOT NULL CONSTRAINT DF_qualifications_thickness_max_unlimited DEFAULT 0
            `);
            console.log('[140] Colonna thickness_max_unlimited aggiunta');
        } else {
            console.log('[140] Colonna thickness_max_unlimited gia esistente — skip');
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'thickness_max_unlimited'
        `);
        console.log('[140] Verifica:', JSON.stringify(verify.recordset[0] || null));
        console.log('[140] Migration completata.');
    } catch (e) {
        console.error('[140] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
