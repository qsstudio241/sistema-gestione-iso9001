/**
 * Migration 095: commercial_customer_name / commercial_customer_ref su commercial_cases
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
  || path.join(__dirname, '../../database/migrations/095_commercial_customer.sql');

async function run() {
  let pool;
  try {
    const script = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = script.split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);
    pool = await sql.connect(dbConfig);
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('Migration 095 OK');
    const check = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'commercial_cases'
        AND COLUMN_NAME IN ('commercial_customer_name', 'commercial_customer_ref')
      ORDER BY COLUMN_NAME
    `);
    const cols = check.recordset.map((r) => r.COLUMN_NAME);
    if (cols.length !== 2) {
      console.error('VERIFICA FALLITA — colonne attese 2, trovate:', cols);
      process.exit(1);
    }
    console.log('Verifica:', cols.join(', '));
  } catch (err) {
    console.error('ERRORE migration 095:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
