/**
 * Migration 096 — company_counterparties + commercial_cases.commercial_customer_id
 * Uso VPS: node /tmp/run-migration-096-vps.js
 */
const fs = require('fs');
const path = require('path');
const { query } = require('/var/www/sgq-backend/src/config/database');

const sqlPath = path.join('/var/www/sgq-backend', 'database', 'migrations', '096_company_counterparties.sql');
const FALLBACK_SQL = '/tmp/096_company_counterparties.sql';

async function run() {
  console.log('Migration 096 — company_counterparties');
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
      (SELECT COUNT(*) FROM sys.tables WHERE name = 'company_counterparties') AS cp_table,
      (SELECT COUNT(*) FROM sys.columns
        WHERE object_id = OBJECT_ID('commercial_cases') AND name = 'commercial_customer_id') AS cc_col
  `);
  const row = verify.recordset[0];
  if (row.cp_table !== 1 || row.cc_col !== 1) {
    console.error('VERIFICA FALLITA:', row);
    process.exit(1);
  }
  console.log('VERIFICA OK: company_counterparties + commercial_customer_id');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
