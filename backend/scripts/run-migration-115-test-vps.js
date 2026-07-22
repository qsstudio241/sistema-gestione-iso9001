/**
 * Migration 115 (VPS TEST) — import_extraction_feedback IG-4
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
    path: '/var/www/sgq-backend-test/.env.test',
});
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend-test/src/config/database');

async function run() {
    const sqlPath = path.join('/var/www/sgq-backend-test/database/migrations/115_import_extraction_feedback.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const pool = await getPool();
    console.log(`[115-test] DB=${process.env.DB_DATABASE || '(default)'}`);
    await pool.request().query(sql);
    console.log('[115-test] import_extraction_feedback OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[115-test] FAIL', err.message);
    process.exit(1);
});
