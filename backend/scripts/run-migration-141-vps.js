/**
 * Migration 141 (VPS) — preheat_temp/interpass_temp/throat_test_mm su wpqr_records
 * (gap analysis 07/08/2026, GAP_WPQR_ESTENSIONI_ANNEX_B).
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-141-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function ensureColumn(pool, table, column, ddl) {
    const check = await pool.request().query(`
        SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'
    `);
    if (check.recordset.length === 0) {
        await pool.request().query(ddl);
        console.log(`[141] Colonna ${column} aggiunta`);
    } else {
        console.log(`[141] Colonna ${column} gia esistente — skip`);
    }
}

async function run() {
    const pool = await getPool();
    try {
        await ensureColumn(pool, 'wpqr_records', 'preheat_temp',
            "ALTER TABLE wpqr_records ADD preheat_temp NVARCHAR(60)");
        await ensureColumn(pool, 'wpqr_records', 'interpass_temp',
            "ALTER TABLE wpqr_records ADD interpass_temp NVARCHAR(60)");
        await ensureColumn(pool, 'wpqr_records', 'throat_test_mm',
            "ALTER TABLE wpqr_records ADD throat_test_mm DECIMAL(10,2)");

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records'
              AND COLUMN_NAME IN ('preheat_temp', 'interpass_temp', 'throat_test_mm')
            ORDER BY COLUMN_NAME
        `);
        console.log('[141] Verifica:', JSON.stringify(verify.recordset, null, 2));
        console.log('[141] Migration completata.');
    } catch (e) {
        console.error('[141] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
