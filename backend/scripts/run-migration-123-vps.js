require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

const SQL = `
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_risk_id'
)
BEGIN
  ALTER TABLE non_conformities ADD source_risk_id INT NULL;
END
`;

async function main() {
  try {
    await query(SQL);
    console.log('Migration 123 OK — source_risk_id aggiunto a non_conformities');
  } catch (e) {
    console.error('Migration 123 ERRORE:', e.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}
main();
