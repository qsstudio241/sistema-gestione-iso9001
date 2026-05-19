/**
 * run-migration-070-vps.js
 * Migration 070: colonna audit_date_end su audits (periodo multi-giorno)
 * Uso: scp to VPS, then: node /tmp/run-migration-070-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('dbo.audits') AND name = 'audit_date_end'
    )
    ALTER TABLE dbo.audits ADD audit_date_end DATE NULL
  `);
  console.log('Step 1 OK: audits.audit_date_end ensured');

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
