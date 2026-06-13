/**
 * run-migration-090.js — template Word scheda NC (scope nc)
 * Uso: node backend/scripts/run-migration-090.js
 */
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.development || dbConfigAll.production || dbConfigAll;
const sqlPath = path.join(__dirname, '../../database/migrations/090_nc_report_templates.sql');
const SQL = fs.readFileSync(sqlPath, 'utf8');

async function runMigration() {
    const batches = SQL
        .split(/^\s*GO\s*$/gim)
        .map((batch) => batch.trim())
        .filter(Boolean);

    const pool = await sql.connect({
        server: dbConfig.server,
        database: dbConfig.database,
        user: dbConfig.user,
        password: dbConfig.password,
        options: {
            encrypt: dbConfig.options?.encrypt ?? true,
            trustServerCertificate: dbConfig.options?.trustServerCertificate ?? true,
        },
    });

    try {
        for (let i = 0; i < batches.length; i += 1) {
            console.log(`Batch ${i + 1}/${batches.length}...`);
            await pool.request().query(batches[i]);
        }
        console.log('Migration 090 eseguita.');
    } finally {
        await pool.close();
    }
}

runMigration().catch((err) => {
    console.error('ERRORE migration 090:', err.message);
    process.exit(1);
});
