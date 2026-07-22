'use strict';
/**
 * Migration 117 (local) — SAL gap implementation status + history.
 * Uso: node backend/scripts/run-migration-117-local.js production
 */
const fs = require('fs');
const path = require('path');
const sql = require('mssql');
const { resolveDbSection } = require('./mergeDbEnv');

const SQL_PATH = path.join(__dirname, '../../database/migrations/117_sal_gap_implementation_status.sql');

async function main() {
    const profile = process.argv[2] || 'production';
    const c = resolveDbSection(profile);
    console.log(`Migration 117 → [${c.database}] su ${c.server}:${c.port || 1433}`);

    const SQL = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

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
            requestTimeout: 120000,
        },
    });

    for (let i = 0; i < batches.length; i += 1) {
        console.log(`  Batch ${i + 1}/${batches.length}...`);
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

    await pool.close();
    console.log('OK: migration 117 applicata.');
    process.exit(0);
}

main().catch((e) => {
    console.error('ERRORE migration 117:', e.message);
    process.exit(1);
});
