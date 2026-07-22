/**
 * Migration 091: colonne v1 saldatura/NDT su qualifications
 * Eseguire in locale: node backend/scripts/run-migration-091.js
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');

const dbConfigAll = require(path.join(__dirname, '../config/database.json'));
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_PATH = path.join(__dirname, '../../database/migrations/091_qualifications_v1_welding_ndt.sql');

async function run() {
    const SQL = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = SQL.split(/^\s*GO\s*$/gim).map((b) => b.trim()).filter(Boolean);

    console.log('[091] Connessione al database...');
    const pool = await sql.connect(dbConfig);
    console.log('[091] Connesso.');

    for (let i = 0; i < batches.length; i += 1) {
        console.log(`[091] Batch ${i + 1}/${batches.length}...`);
        await pool.request().query(batches[i]);
    }

    const verify = await pool.request().query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'qualifications'
          AND COLUMN_NAME IN ('welding_process','material_group','position_range','ndt_method','ndt_level')
        ORDER BY COLUMN_NAME
    `);
    console.log('[091] Colonne verificate:', verify.recordset.map((r) => r.COLUMN_NAME).join(', '));

    await pool.close();
    console.log('[091] Migration completata OK');
}

run().catch((err) => {
    console.error('[091] ERRORE:', err.message);
    process.exit(1);
});
