/**
 * run-migration-095.js — commercial_customer_name / commercial_customer_ref su commercial_cases
 * Uso: node backend/scripts/run-migration-095.js
 */
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.development || dbConfigAll.production || dbConfigAll;
const sqlPath = path.join(__dirname, '../../database/migrations/095_commercial_customer.sql');
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
        console.log('Migration 095 eseguita.');
    } finally {
        await pool.close();
    }
}

runMigration().catch((err) => {
    console.error('ERRORE Migration 095:', err.message);
    process.exit(1);
});

