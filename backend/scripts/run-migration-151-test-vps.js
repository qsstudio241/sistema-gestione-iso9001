/**
 * Migration 151 (VPS TEST) — analysis_method + SWOT sign (ROO-15).
 * Ex 149 su TEST: rinumerata perché MC-1 ha preso 149_material_certificates.
 * Uso: node /tmp/run-migration-151-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL_CANDIDATES = [
  '/var/www/sgq-backend-test/database/migrations/151_risks_analysis_method.sql',
  '/tmp/151_risks_analysis_method.sql',
];

function resolveSqlPath() {
  const found = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('SQL 151 non trovato. Copia 151_risks_analysis_method.sql in ' + SQL_CANDIDATES.join(' o '));
  }
  return found;
}

async function main() {
  try {
    const sqlPath = resolveSqlPath();
    console.log('[151-test] DB=', process.env.DB_DATABASE || '(default)');
    console.log('[151-test] SQL=', sqlPath);
    await query(fs.readFileSync(sqlPath, 'utf8'));
    const col = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'risks'
        AND COLUMN_NAME IN ('analysis_method','swot_quadrant','impact_sign')
      ORDER BY COLUMN_NAME
    `);
    const names = (col.recordset || []).map((r) => r.COLUMN_NAME);
    console.log('[151-test] colonne', names.join(','));
    if (names.length !== 3) {
      console.error('[151-test] attese 3 colonne');
      process.exit(1);
    }
    console.log('[151-test] OK');
    process.exit(0);
  } catch (e) {
    console.error('[151-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
