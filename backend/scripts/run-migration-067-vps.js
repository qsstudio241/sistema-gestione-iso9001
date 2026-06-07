/**
 * Migration 067 VPS: knowledge_chunks.standard_id (filtro norma AI)
 * Uso: scp to VPS, then: node /tmp/run-migration-067-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

const SQL_067 = `
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'standard_id'
)
BEGIN
  ALTER TABLE knowledge_chunks ADD standard_id INT NULL;
END;

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE name = 'IX_knowledge_chunks_standard'
    AND object_id = OBJECT_ID('knowledge_chunks')
)
BEGIN
  CREATE INDEX IX_knowledge_chunks_standard
    ON knowledge_chunks(organization_id, standard_id);
END;
`;

async function main() {
  const pool = await getPool();
  await pool.request().query(SQL_067);
  console.log('[067] OK - standard_id su knowledge_chunks');
  const verify = await pool.request().query(`
    SELECT c.name FROM sys.columns c
    JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = 'knowledge_chunks' AND c.name = 'standard_id'
  `);
  console.log('[067] verify columns:', JSON.stringify(verify.recordset));
  const idx = await pool.request().query(`
    SELECT name FROM sys.indexes
    WHERE name = 'IX_knowledge_chunks_standard' AND object_id = OBJECT_ID('knowledge_chunks')
  `);
  console.log('[067] verify index:', JSON.stringify(idx.recordset));
  await pool.close();
}

main().catch((err) => {
  console.error('[067] ERRORE:', err.message);
  process.exit(1);
});