/**
 * Migration 147 (VPS TEST) — residuo P×G + nota efficacia su risks.
 * Uso: node /tmp/run-migration-147-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');

const SQL = `
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'residual_probability'
)
BEGIN
  ALTER TABLE risks ADD residual_probability TINYINT NULL
    CONSTRAINT CK_risks_residual_probability
    CHECK (residual_probability IS NULL OR residual_probability BETWEEN 1 AND 3);
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'residual_impact'
)
BEGIN
  ALTER TABLE risks ADD residual_impact TINYINT NULL
    CONSTRAINT CK_risks_residual_impact
    CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 3);
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'effectiveness_note'
)
BEGIN
  ALTER TABLE risks ADD effectiveness_note NVARCHAR(MAX) NULL;
END
`;

async function main() {
  try {
    console.log('[147-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    await query(SQL);
    const check = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'risks'
        AND COLUMN_NAME IN ('residual_probability','residual_impact','effectiveness_note')
      ORDER BY COLUMN_NAME
    `);
    const names = (check.recordset || []).map((r) => r.COLUMN_NAME);
    console.log('[147-test] colonne:', names.join(', '));
    if (names.length !== 3) {
      console.error('[147-test] ATTESI 3 campi, trovati', names.length);
      process.exit(1);
    }
    console.log('[147-test] OK (idempotente, seconda esecuzione senza errore)');
    process.exit(0);
  } catch (e) {
    console.error('[147-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
