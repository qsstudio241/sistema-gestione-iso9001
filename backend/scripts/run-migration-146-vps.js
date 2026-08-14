/**
 * Migration 146 (VPS) — campi riga M03 su risks (ROO-4).
 * Uso: node /tmp/run-migration-146-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

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
    await query(SQL);
    const check = await query(`
      SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'risks'
        AND COLUMN_NAME IN ('evaluated_element','context_text','interested_parties_text','current_actions','further_actions')
      ORDER BY COLUMN_NAME
    `);
    const names = (check.recordset || []).map((r) => r.COLUMN_NAME);
    console.log('Migration 146 OK — colonne M03 su risks:', names.join(', '));
    if (names.length !== 5) {
      console.error('ATTESI 5 campi, trovati', names.length);
      process.exit(1);
    }
    process.exit(0);
  } catch (e) {
    console.error('Migration 146 ERRORE:', e.message);
    process.exit(1);
  }
}
main();
