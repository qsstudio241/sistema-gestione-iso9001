/**
 * Migration 094: qualification_confirmations + is_primary_welding_coordinator
 */
'use strict';

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_PATH = process.env.MIGRATION_SQL_PATH
    || path.join(__dirname, '../../database/migrations/094_qualification_semiannual_confirmations.sql');

async function run() {
    let pool;
    try {
        const script = fs.readFileSync(SQL_PATH, 'utf8');
        const batches = script.split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);
        pool = await sql.connect(dbConfig);
        for (const batch of batches) {
            await pool.request().query(batch);
        }
        console.log('Migration 094 OK');
        const check = await pool.request().query(`
            SELECT
              (SELECT COUNT(*) FROM sys.columns WHERE object_id=OBJECT_ID('company_personnel') AND name='is_primary_welding_coordinator') AS primary_col,
              (SELECT COUNT(*) FROM sys.tables WHERE name='qualification_confirmations') AS conf_table
        `);
        console.log('Verifica:', check.recordset[0]);
    } catch (err) {
        console.error('ERRORE migration 094:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

run();
