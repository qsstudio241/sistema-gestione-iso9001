/**
 * Migration 148 (VPS TEST) — scala P/G per azienda.
 * Uso: node /tmp/run-migration-148-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL = fs.readFileSync('/tmp/148_companies_risk_pg_max.sql', 'utf8');

async function main() {
  try {
    console.log('[148-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    const col = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'companies' AND COLUMN_NAME = 'risk_pg_max'
    `);
    const chk = await query(`
      SELECT name FROM sys.check_constraints
      WHERE name IN ('CHK_risks_prob','CHK_risks_impact','CK_companies_risk_pg_max')
    `);
    console.log('[148-test] colonna', (col.recordset || []).map((r) => r.COLUMN_NAME).join(','));
    console.log('[148-test] check', (chk.recordset || []).map((r) => r.name).join(','));
    if (!col.recordset.length) {
      console.error('[148-test] manca companies.risk_pg_max');
      process.exit(1);
    }
    console.log('[148-test] OK');
    process.exit(0);
  } catch (e) {
    console.error('[148-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
