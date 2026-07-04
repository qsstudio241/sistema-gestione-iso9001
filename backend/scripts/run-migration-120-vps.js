/**
 * Migration 120 (VPS) — tabella ingest_reference_patterns (ADR-017 Livello B)
 * Uso: node /tmp/run-migration-120-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const fs = require('fs');
const path = require('path');
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_PATH = path.join('/var/www/sgq-backend/database/migrations/120_ingest_reference_patterns.sql');

async function run() {
    const pool = await getPool();
    try {
        const sql = fs.readFileSync(SQL_PATH, 'utf8');
        console.log(`[120] DB=${process.env.DB_DATABASE || '(default)'}`);
        await pool.request().query(sql);
        const verify = await pool.request().query(`
            SELECT 1 AS ok FROM sys.tables WHERE name = 'ingest_reference_patterns'
        `);
        if (!verify.recordset[0]?.ok) {
            throw new Error('Tabella ingest_reference_patterns non trovata dopo migrazione');
        }
        console.log('[120] ingest_reference_patterns OK');
    } catch (e) {
        console.error('[120] FAIL', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
