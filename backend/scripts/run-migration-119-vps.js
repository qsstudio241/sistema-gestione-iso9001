/**
 * Migration 119 (VPS) — allarga norm_document_sources.norm_title a NVARCHAR(500)
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
    const sqlPath = path.join('/var/www/sgq-backend/database/migrations/119_norm_title_widen.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const pool = await getPool();
    console.log(`[119] DB=${process.env.DB_DATABASE || '(default)'}`);
    await pool.request().query(sql);
    console.log('[119] norm_title NVARCHAR(500) OK');
    process.exit(0);
}

run().catch((err) => {
    console.error('[119] FAIL', err.message);
    process.exit(1);
});
