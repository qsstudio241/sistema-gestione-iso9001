/**
 * Migrazione 062 — knowledge_chunks
 * Eseguire sul VPS: node /tmp/run-migration-062-vps.js
 */
const sql = require('/var/www/sgq-backend/node_modules/mssql');

const config = {
  server: 'localhost',
  port: 11043,
  database: 'SGQ_ISO9001',
  user: 'pascarella',
  password: '#Gestione2025@',
  options: { encrypt: true, trustServerCertificate: true },
};

async function run() {
  const pool = await sql.connect(config);
  console.log('Connected to DB');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'knowledge_chunks')
    CREATE TABLE knowledge_chunks (
      id                INT IDENTITY(1,1) PRIMARY KEY,
      organization_id   INT NOT NULL,
      entity_type       NVARCHAR(50) NOT NULL,
      entity_id         INT NULL,
      chunk_text        NVARCHAR(MAX) NOT NULL,
      embedding         NVARCHAR(MAX) NULL,
      last_indexed_at   DATETIME2 DEFAULT GETDATE()
    );
  `);
  console.log('Table knowledge_chunks created (or already exists)');

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_knowledge_chunks_org')
      CREATE INDEX IX_knowledge_chunks_org ON knowledge_chunks(organization_id, entity_type);
  `);
  console.log('Index created (or already exists)');

  await pool.close();
  console.log('Migration 062 complete');
  process.exit(0);
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
