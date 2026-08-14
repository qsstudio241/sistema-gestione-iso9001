/**
 * Migration 146 (VPS TEST) — campi riga M03 su risks.
 * Uso: node /tmp/run-migration-146-test-vps.js
 */
require('/var/www/sgq-backend-test/node_modules/dotenv').config({
  path: '/var/www/sgq-backend-test/.env.test',
});
const { query } = require('/var/www/sgq-backend-test/src/config/database');

const SQL = `
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'evaluated_element'
)
BEGIN
  ALTER TABLE risks ADD evaluated_element NVARCHAR(200) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'context_text'
)
BEGIN
  ALTER TABLE risks ADD context_text NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'interested_parties_text'
)
BEGIN
  ALTER TABLE risks ADD interested_parties_text NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'current_actions'
)
BEGIN
  ALTER TABLE risks ADD current_actions NVARCHAR(MAX) NULL;
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'further_actions'
)
BEGIN
  ALTER TABLE risks ADD further_actions NVARCHAR(MAX) NULL;
END
`;

async function main() {
  try {
    console.log('[146-test] DB=', process.env.DB_DATABASE || '(default)');
    await query(SQL);
    await query(SQL);
    const check = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'risks'
        AND COLUMN_NAME IN ('evaluated_element','context_text','interested_parties_text','current_actions','further_actions')
      ORDER BY COLUMN_NAME
    `);
    const names = (check.recordset || []).map((r) => r.COLUMN_NAME);
    console.log('[146-test] colonne:', names.join(', '));
    if (names.length !== 5) {
      console.error('[146-test] ATTESI 5 campi, trovati', names.length);
      process.exit(1);
    }
    console.log('[146-test] OK (idempotente, seconda esecuzione senza errore)');
    process.exit(0);
  } catch (e) {
    console.error('[146-test] FAIL', e.message);
    process.exit(1);
  }
}
main();
