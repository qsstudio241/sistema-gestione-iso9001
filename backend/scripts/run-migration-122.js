/**
 * Migration 122: campi specifici ISO 14732 (welding_type, single_multi_run, qualification_method) su qualifications
 * Eseguire in locale: node backend/scripts/run-migration-122.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_PATH = path.join(__dirname, '../../database/migrations/122_qualifications_14732_fields.sql');

const EXPECTED = ['welding_type', 'single_multi_run', 'qualification_method'];

async function run() {
    const SQL = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

    console.log('[122] Connessione al database...');
    const pool = await sql.connect(dbConfig);
    console.log('[122] Connesso.');

    for (let i = 0; i < batches.length; i += 1) {
        console.log(`[122] Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
    }

    const verify = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'qualifications'
          AND COLUMN_NAME IN ('${EXPECTED.join("','")}')
        ORDER BY COLUMN_NAME
    `);
    const found = verify.recordset.map((r) => r.COLUMN_NAME);
    console.log('[122] Colonne verificate:', found.join(', '));
    const missing = EXPECTED.filter((c) => !found.includes(c));
    if (missing.length) {
        throw new Error(`Colonne mancanti dopo migrazione: ${missing.join(', ')}`);
    }

    await pool.close();
    console.log('[122] Migration completata OK');
}

run().catch((err) => {
    console.error('[122] ERRORE:', err.message);
    process.exit(1);
});
