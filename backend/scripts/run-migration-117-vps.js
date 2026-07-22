/**
 * Migration 117 (VPS) — SAL gap implementation status + history.
 * Uso: .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-117-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = path.join('/var/www/sgq-backend/database/migrations/117_sal_gap_implementation_status.sql');

async function run() {
    const pool = await getPool();
    try {
        const SQL = fs.readFileSync(SQL_PATH, 'utf8');
        const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
        for (let i = 0; i < batches.length; i += 1) {
            console.log(`[117] Batch ${i + 1}/${batches.length}...`);
            await pool.request().query(batches[i]);
        }
        const verify = await pool.request().query(`
            SELECT
                (SELECT COUNT(*) FROM sys.tables WHERE name = 'requirement_implementation_status') AS status_tbl,
                (SELECT COUNT(*) FROM sys.tables WHERE name = 'requirement_implementation_history') AS hist_tbl
        `);
        const row = verify.recordset[0];
        if (row.status_tbl !== 1 || row.hist_tbl !== 1) {
            throw new Error('Tabelle migration 117 non verificate');
        }
        console.log('[117] Migration completata.');
    } catch (e) {
        console.error('[117] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
