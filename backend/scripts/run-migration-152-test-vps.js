/**
 * Migration 152 (VPS TEST) — risk_reviews (ROO-16).
 * Ex 150 su TEST: rinumerata insieme a 151 dopo collisione con MC-1 / 149.
 * Uso: node /tmp/run-migration-152-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');
const fs = require('fs');

const SQL_CANDIDATES = [
  '/var/www/sgq-backend-test/database/migrations/152_risk_reviews.sql',
  '/tmp/152_risk_reviews.sql',
];

function resolveSqlPath() {
  const found = SQL_CANDIDATES.find((p) => fs.existsSync(p));
  if (!found) {
    throw new Error('SQL 152 non trovato. Copia 152_risk_reviews.sql in ' + SQL_CANDIDATES.join(' o '));
  }
  return found;
}

async function main() {
  try {
    const sqlPath = resolveSqlPath();
    console.log('[152-test] DB=', process.env.DB_DATABASE || '(default)');
    console.log('[152-test] SQL=', sqlPath);
    await query(fs.readFileSync(sqlPath, 'utf8'));
    const tab = await query(`
      SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_NAME = 'risk_reviews'
    `);
    if (!(tab.recordset || []).length) {
      console.error('[152-test] tabella assente');
      process.exit(1);
    }
    console.log('[152-test] OK risk_reviews');
    process.exit(0);
  } catch (e) {
    console.error('[152-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
