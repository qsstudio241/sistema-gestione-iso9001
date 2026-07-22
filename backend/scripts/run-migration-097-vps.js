/**
 * Migration 097 — backfill controparti + projects.end_customer_id
 * Uso VPS: node /tmp/run-migration-097-vps.js
 */
const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '097_counterparties_backfill.sql');
const FALLBACK_SQL = '/tmp/097_counterparties_backfill.sql';

async function run() {
  console.log('Migration 097 — counterparties backfill');
  const sqlFile = fs.existsSync(sqlPath) ? sqlPath : FALLBACK_SQL;
  if (!fs.existsSync(sqlFile)) {
    console.error('File SQL non trovato:', sqlFile);
    process.exit(1);
  }
  const batches = fs
    .readFileSync(sqlFile, 'utf8')
    .split(/\r?\nGO\r?\n/i)
    .map((b) => b.trim())
    .filter(Boolean);
  for (const batch of batches) {
    await query(batch);
  }
  const verify = await query(`
    SELECT
      (SELECT COUNT(*) FROM company_counterparties) AS counterparties_total,
      (SELECT COUNT(*) FROM commercial_cases WHERE commercial_customer_id IS NOT NULL) AS cases_with_fk,
      (SELECT COUNT(*) FROM sys.columns
        WHERE object_id = OBJECT_ID('projects') AND name = 'end_customer_id') AS projects_col
  `);
  console.log('VERIFICA OK:', verify.recordset[0]);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
