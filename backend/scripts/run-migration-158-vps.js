/**
 * Migration 158 (VPS) — thickness_t1_*/thickness_t2_* su wpqr_records
 * (WPQR-T1T2, Mason 25/08/2026).
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-158-vps.js
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
        console.log(`[158] Colonna ${column} aggiunta`);
    } else {
        console.log(`[158] Colonna ${column} gia esistente — skip`);
    }
}

async function run() {
    const pool = await getPool();
    try {
        await ensureColumn(pool, 'wpqr_records', 'thickness_t1_min',
            'ALTER TABLE wpqr_records ADD thickness_t1_min DECIMAL(8,2)');
        await ensureColumn(pool, 'wpqr_records', 'thickness_t1_max',
            'ALTER TABLE wpqr_records ADD thickness_t1_max DECIMAL(8,2)');
        await ensureColumn(pool, 'wpqr_records', 'thickness_t1_max_unlimited',
            'ALTER TABLE wpqr_records ADD thickness_t1_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t1_max_unlimited DEFAULT 0');
        await ensureColumn(pool, 'wpqr_records', 'thickness_t2_min',
            'ALTER TABLE wpqr_records ADD thickness_t2_min DECIMAL(8,2)');
        await ensureColumn(pool, 'wpqr_records', 'thickness_t2_max',
            'ALTER TABLE wpqr_records ADD thickness_t2_max DECIMAL(8,2)');
        await ensureColumn(pool, 'wpqr_records', 'thickness_t2_max_unlimited',
            'ALTER TABLE wpqr_records ADD thickness_t2_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_t2_max_unlimited DEFAULT 0');

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records'
              AND COLUMN_NAME IN (
                'thickness_t1_min', 'thickness_t1_max', 'thickness_t1_max_unlimited',
                'thickness_t2_min', 'thickness_t2_max', 'thickness_t2_max_unlimited'
              )
            ORDER BY COLUMN_NAME
        `);
        console.log('[158] Verifica:', JSON.stringify(verify.recordset, null, 2));
        console.log('[158] Migration completata.');
    } catch (e) {
        console.error('[158] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
