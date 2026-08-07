/**
 * Migration 139 (VPS) — colonna thickness_max_unlimited su wpqr_records
 * (gap analysis 07/08/2026, WPQR reale VB0377/23, cliente Mason — giunto FW
 * con range spessore aperto "t1 = >=5 ; t2 => 5", nessun limite superiore).
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-139-vps.js
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const pool = await getPool();
    try {
        const check = await pool.request().query(`
            SELECT 1 AS x FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records' AND COLUMN_NAME = 'thickness_max_unlimited'
        `);
        if (check.recordset.length === 0) {
            await pool.request().query(`
                ALTER TABLE wpqr_records ADD thickness_max_unlimited BIT NOT NULL CONSTRAINT DF_wpqr_records_thickness_max_unlimited DEFAULT 0
            `);
            console.log('[139] Colonna thickness_max_unlimited aggiunta');
        } else {
            console.log('[139] Colonna thickness_max_unlimited gia esistente — skip');
        }

        const verify = await pool.request().query(`
            SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_NAME = 'wpqr_records' AND COLUMN_NAME = 'thickness_max_unlimited'
        `);
        console.log('[139] Verifica:', JSON.stringify(verify.recordset[0] || null));
        console.log('[139] Migration completata.');
    } catch (e) {
        console.error('[139] ERRORE:', e.message);
        process.exitCode = 1;
    } finally {
        await pool.close().catch(() => {});
        process.exit();
    }
}
run();
