/**
 * Migration 118 (VPS) — NC source_category sal_gap per SAL Fase 3.
 * Uso: .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-118-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = path.join('/var/www/sgq-backend/database/migrations/118_nc_source_category_sal_gap.sql');

async function run() {
    const pool = await getPool();
    try {
        const SQL = fs.readFileSync(SQL_PATH, 'utf8');
        const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);
        for (let i = 0; i < batches.length; i += 1) {
            console.log(`[118] Batch ${i + 1}/${batches.length}...`);
            await pool.request().query(batches[i]);
        }
        const verify = await pool.request().query(`
            SELECT cc.definition
            FROM sys.check_constraints cc
            WHERE cc.name = 'CK_nc_source_category'
        `);
        const def = verify.recordset[0]?.definition || '';
        if (!def.includes('sal_gap')) {
            throw new Error('Constraint CK_nc_source_category senza sal_gap');
        }
        console.log('[118] Migration completata.');
    } catch (e) {
        console.error('[118] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}
run();
