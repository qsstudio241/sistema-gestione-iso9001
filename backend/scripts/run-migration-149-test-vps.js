/**
 * Migration 149 (VPS TEST) — analysis_method + SWOT sign.
 * Uso: node /tmp/run-migration-149-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL = fs.readFileSync('/tmp/149_risks_analysis_method.sql', 'utf8');

async function main() {
  try {
    console.log('[149-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    const col = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'risks'
        AND COLUMN_NAME IN ('analysis_method','swot_quadrant','impact_sign')
      ORDER BY COLUMN_NAME
    `);
    const names = (col.recordset || []).map((r) => r.COLUMN_NAME);
    console.log('[149-test] colonne', names.join(','));
    if (names.length !== 3) {
      console.error('[149-test] attese 3 colonne');
      process.exit(1);
    }
    console.log('[149-test] OK');
    process.exit(0);
  } catch (e) {
    console.error('[149-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
