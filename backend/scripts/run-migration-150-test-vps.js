/**
 * Migration 150 (VPS TEST) — risk_reviews.
 * Uso: node /tmp/run-migration-150-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL = fs.readFileSync('/tmp/150_risk_reviews.sql', 'utf8');

async function main() {
  try {
    console.log('[150-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    const tab = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'risk_reviews'
    `);
    if (!(tab.recordset || []).length) {
      console.error('[150-test] tabella assente');
      process.exit(1);
    }
    console.log('[150-test] OK risk_reviews');
    process.exit(0);
  } catch (e) {
    console.error('[150-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
