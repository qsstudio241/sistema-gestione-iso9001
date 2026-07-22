/**
 * run-migration-098.js — NC Action Plan multi-fonte
 * Aggiunge source_category, source_origin_text, organization_id a non_conformities
 * e rende audit_id nullable per supportare NC da rischi, riesame, miglioramento, ecc.
 *
 * Uso: node backend/scripts/run-migration-098.js
 */
const sql = require('mssql');
const path = require('path');
const fs = require('fs');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const dbConfig = dbConfigAll.development || dbConfigAll.production || dbConfigAll;
const sqlPath = path.join(__dirname, '../../database/migrations/098_nc_action_plan.sql');
const SQL = fs.readFileSync(sqlPath, 'utf8');

async function runMigration() {
    const batches = SQL
        .split(/^\s*GO\s*$/gim)
        .map(b => b.trim())
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
        for (let i = 0; i < batches.length; i++) {
            console.log(`Batch ${i + 1}/${batches.length}...`);
            await pool.request().query(batches[i]);
        }
        console.log('Migration 098 completata con successo.');
    } finally {
        await pool.close();
    }
}

runMigration().catch(err => {
    console.error('ERRORE migration 098:', err.message);
    process.exit(1);
});
