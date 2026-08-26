/**
 * Migration 159 (VPS) — campi Stud Welding / P+T / doppio materiale su wpqr_records
 * (STUD-1, Mason 25/08/2026). Nessun range ISO 14555.
 * Uso (solo su VPS, via SSH):
 *   node /tmp/run-migration-159-vps.js
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
        console.log(`[159] Colonna ${column} aggiunta`);
    } else {
        console.log(`[159] Colonna ${column} gia esistente — skip`);
    }
}

async function run() {
    const pool = await getPool();
    try {
        await ensureColumn(pool, 'wpqr_records', 'qualifying_element',
            'ALTER TABLE wpqr_records ADD qualifying_element NVARCHAR(20)');
        await ensureColumn(pool, 'wpqr_records', 'base_material_group_2',
            'ALTER TABLE wpqr_records ADD base_material_group_2 NVARCHAR(50)');
        await ensureColumn(pool, 'wpqr_records', 'base_material_spec_2',
            'ALTER TABLE wpqr_records ADD base_material_spec_2 NVARCHAR(100)');

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records'
              AND COLUMN_NAME IN (
                'qualifying_element', 'base_material_group_2', 'base_material_spec_2'
              )
            ORDER BY COLUMN_NAME
        `);
        console.log('[159] Verifica:', JSON.stringify(verify.recordset, null, 2));
        console.log('[159] Migration completata.');
    } catch (e) {
        console.error('[159] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
