/**
 * run-migration-065-vps.js
 * Esegue migrazione 065 (source_run_id) sul VPS via SSH.
 * Uso: node /tmp/run-migration-065-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  // Step 1: Add column source_run_id if missing
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'source_run_id'
    )
    ALTER TABLE knowledge_chunks ADD source_run_id INT NULL
  `);
  console.log('Step 1 OK: source_run_id column ensured');

  // Step 2: Add filtered index if missing
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes WHERE name = 'IX_knowledge_chunks_source_run'
    )
    CREATE INDEX IX_knowledge_chunks_source_run ON knowledge_chunks(source_run_id)
    WHERE source_run_id IS NOT NULL
  `);
  console.log('Step 2 OK: index ensured');

  // Verify
  const check = await pool.request().query(`
    SELECT c.name, t.name AS type
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('knowledge_chunks') AND c.name = 'source_run_id'
  `);
  console.log('Verification:', JSON.stringify(check.recordset));

  process.exit(0);
}

main().catch(err => { console.error('MIGRATION FAILED:', err.message); process.exit(1); });
