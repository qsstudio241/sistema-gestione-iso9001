/**
 * Migration 066 VPS: organizations.ai_context_notes (contesto AI studio)
 * Uso: scp to VPS, then: node /tmp/run-migration-066-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_066 = `
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'ai_context_notes'
)
BEGIN
  ALTER TABLE dbo.organizations ADD ai_context_notes NVARCHAR(2000) NULL;
END;
`;

async function main() {
  const pool = await getPool();
  await pool.request().query(SQL_066);
  console.log('[066] OK - ai_context_notes su organizations');
  const verify = await pool.request().query(`
    SELECT c.name, t.name AS table_name
    FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'organizations' AND c.name = 'ai_context_notes'
  `);
  console.log('[066] verify:', JSON.stringify(verify.recordset));
  await pool.close();
}

main().catch((err) => {
  console.error('[066] ERRORE:', err.message);
  process.exit(1);
});