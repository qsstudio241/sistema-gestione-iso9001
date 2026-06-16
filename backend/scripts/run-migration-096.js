/**
 * Migration 096: company_counterparties + commercial_cases.commercial_customer_id
 */
'use strict';

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8'),
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_PATH = process.env.MIGRATION_SQL_PATH
  || path.join(__dirname, '../../database/migrations/096_company_counterparties.sql');

async function run() {
  let pool;
  try {
    const script = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = script.split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);
    pool = await sql.connect(dbConfig);
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('Migration 096 OK');
    const check = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM sys.tables WHERE name = 'company_counterparties') AS cp_table,
        (SELECT COUNT(*) FROM sys.columns
          WHERE object_id = OBJECT_ID('commercial_cases') AND name = 'commercial_customer_id') AS cc_col
    `);
    console.log('Verifica:', check.recordset[0]);
  } catch (err) {
    console.error('ERRORE migration 096:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
