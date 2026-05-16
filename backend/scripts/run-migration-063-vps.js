/**
 * Migrazione 063 — aggiunge company_id a knowledge_chunks
 * Eseguire sul VPS: node /tmp/run-migration-063-vps.js
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
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('knowledge_chunks') AND name = 'company_id'
    )
    BEGIN
      ALTER TABLE knowledge_chunks ADD company_id INT NULL;
    END;
  `);
  console.log('Column company_id added (or already exists)');

  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'IX_knowledge_chunks_company'
        AND object_id = OBJECT_ID('knowledge_chunks')
    )
    BEGIN
      CREATE INDEX IX_knowledge_chunks_company
        ON knowledge_chunks(organization_id, company_id);
    END;
  `);
  console.log('Index IX_knowledge_chunks_company created (or already exists)');

  const result = await pool.request().query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'knowledge_chunks' AND COLUMN_NAME = 'company_id'
  `);
  if (result.recordset.length > 0) {
    console.log('Verification OK:', JSON.stringify(result.recordset[0]));
  } else {
    console.error('Verification FAILED: company_id column not found!');
    process.exit(1);
  }

  await pool.close();
  console.log('Migration 063 complete');
  process.exit(0);
}

run().catch(err => { console.error('Migration failed:', err.message); process.exit(1); });
