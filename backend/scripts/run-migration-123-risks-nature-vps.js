require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

const SQL = `
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'nature'
)
BEGIN
  ALTER TABLE risks
    ADD nature NVARCHAR(20) NOT NULL DEFAULT 'risk'
    CONSTRAINT CK_risks_nature CHECK (nature IN ('risk', 'opportunity'));
END
`;

async function main() {
  try {
    await query(SQL);
    console.log('Migration 123 OK — colonna nature aggiunta a risks');
  } catch (e) {
    console.error('Migration 123 ERRORE:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
main();
