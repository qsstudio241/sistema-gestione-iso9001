/**
 * Migration 115 (VPS PROD) — import_extraction_feedback IG-4
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const sqlPath = path.join('/var/www/sgq-backend/database/migrations/115_import_extraction_feedback.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const pool = await getPool();
    console.log(`[115] DB=${process.env.DB_DATABASE || '(default)'}`);
    await pool.request().query(sql);
    console.log('[115] import_extraction_feedback OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[115] FAIL', err.message);
    process.exit(1);
});
