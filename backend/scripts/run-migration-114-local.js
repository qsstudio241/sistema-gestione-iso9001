/**
 * Migration 114 (local) — ingest_staging IG-3
 * Uso: node backend/scripts/run-migration-114-local.js [production|test]
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

async function main() {
    const profile = process.argv[2] || 'production';
    const c = resolveDbSection(profile);
    console.log(`Migration 114 → [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server,
        port: c.port || 1433,
        database: c.database,
        user: c.user,
        password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false,
            trustServerCertificate: true,
            enableArithAbort: true,
            connectTimeout: 30000,
            requestTimeout: 30000,
        },
    });

    const sqlPath = path.join(__dirname, '../../database/migrations/114_ingest_staging.sql');
    await pool.request().query(fs.readFileSync(sqlPath, 'utf8'));
    console.log('[114] ingest_staging OK');
    await pool.close();
}

main().catch((err) => {
    console.error('[114] FAIL', err.message);
    process.exit(1);
});
