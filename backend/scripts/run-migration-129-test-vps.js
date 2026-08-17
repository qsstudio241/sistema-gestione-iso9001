/**
 * Migration 129 (VPS TEST) — companies.iso3834_level.
 * Uso: node /tmp/run-migration-129-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL = fs.readFileSync('/tmp/129_companies_iso3834_level.sql', 'utf8');

async function main() {
  try {
    console.log('[129-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    const col = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'companies' AND COLUMN_NAME = 'iso3834_level'
    `);
    console.log('[129-test] colonna', (col.recordset || []).map((r) => r.COLUMN_NAME).join(','));
    if (!col.recordset.length) {
      console.error('[129-test] manca companies.iso3834_level');
      process.exit(1);
    }
    console.log('[129-test] OK');
    process.exit(0);
  } catch (e) {
    console.error('[129-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
