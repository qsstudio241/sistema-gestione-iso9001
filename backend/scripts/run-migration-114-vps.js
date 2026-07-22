/**
 * Migration 114 (VPS) — ingest_staging per revisione pre-commit IG-3
 * Uso: node /tmp/run-migration-114-vps.js (via scp + ssh sul VPS)
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const sqlPath = path.join('/var/www/sgq-backend/database/migrations/114_ingest_staging.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const pool = await getPool();
    await pool.request().query(sql);
    console.log('[114] ingest_staging OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[114] FAIL', err.message);
    process.exit(1);
});
