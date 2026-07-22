/**
 * Migration 114 (VPS TEST) — ingest_staging su DB test 2026-06-18_SGQ_ISO9001
 * Uso: node /tmp/run-migration-114-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
    path: '/var/www/sgq-backend-test/.env.test',
});
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend-test/src/config/database');

async function run() {
    const sqlPath = path.join('/var/www/sgq-backend-test/database/migrations/114_ingest_staging.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const pool = await getPool();
    const dbName = process.env.DB_DATABASE || '(default)';
    console.log(`[114-test] DB=${dbName}`);
    await pool.request().query(sql);
    const check = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM sys.tables WHERE name = 'ingest_staging'
    `);
    console.log('[114-test] ingest_staging presente:', check.recordset[0].cnt === 1 ? 'OK' : 'MISSING');
    process.exit(0);
}

run().catch((err) => {
    console.error('[114-test] FAIL', err.message);
    process.exit(1);
});
