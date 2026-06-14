/**
 * Migration 097: backfill controparti + projects.end_customer_id
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
  || path.join(__dirname, '../../database/migrations/097_counterparties_backfill.sql');

async function run() {
  let pool;
  try {
    const script = fs.readFileSync(SQL_PATH, 'utf8');
    const batches = script.split(/\r?\nGO\r?\n/i).map((b) => b.trim()).filter(Boolean);
    pool = await sql.connect(dbConfig);
    for (const batch of batches) {
      await pool.request().query(batch);
    }
    console.log('Migration 097 OK');
    const check = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM company_counterparties) AS counterparties_total,
        (SELECT COUNT(*) FROM commercial_cases WHERE commercial_customer_id IS NOT NULL) AS cases_with_fk,
        (SELECT COUNT(*) FROM commercial_cases
          WHERE commercial_customer_name IS NOT NULL
            AND LTRIM(RTRIM(commercial_customer_name)) <> ''
            AND commercial_customer_id IS NULL) AS cases_text_only,
        (SELECT COUNT(*) FROM sys.columns
          WHERE object_id = OBJECT_ID('projects') AND name = 'end_customer_id') AS projects_col
    `);
    console.log('Verifica:', check.recordset[0]);
  } catch (err) {
    console.error('ERRORE migration 097:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
