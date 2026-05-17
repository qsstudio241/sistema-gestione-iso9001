/**
 * run-migration-066-vps.js
 * Migration 066: type_specific_data in document_registry + studio_document_schemas
 * Uso: scp to VPS, then: node /tmp/run-migration-066-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  // Step 1: type_specific_data in document_registry
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('document_registry') AND name = 'type_specific_data'
    )
    ALTER TABLE document_registry ADD type_specific_data NVARCHAR(MAX) NULL
  `);
  console.log('Step 1 OK: document_registry.type_specific_data added');

  // Step 2: studio_document_schemas table
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('studio_document_schemas'))
    CREATE TABLE studio_document_schemas (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      organization_id  INT NOT NULL,
      schema_key       NVARCHAR(50) NOT NULL,
      label            NVARCHAR(100) NOT NULL,
      base_type        NVARCHAR(50) NULL,
      fields_json      NVARCHAR(MAX) NOT NULL,
      ai_prompt_extra  NVARCHAR(MAX) NULL,
      is_active        BIT NOT NULL DEFAULT 1,
      created_at       DATETIME2 NOT NULL DEFAULT GETDATE(),
      updated_at       DATETIME2 NOT NULL DEFAULT GETDATE(),
      CONSTRAINT UQ_studio_schema UNIQUE (organization_id, schema_key)
    )
  `);
  console.log('Step 2 OK: studio_document_schemas created');

  // Step 3: FK organization_id
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_studio_schemas_org'
    )
    ALTER TABLE studio_document_schemas
      ADD CONSTRAINT FK_studio_schemas_org
      FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);
  console.log('Step 3 OK: FK organization_id added');

  // Verify
  const check1 = await pool.request().query(`
    SELECT c.name, t.name AS type FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('document_registry') AND c.name = 'type_specific_data'
  `);
  console.log('Verify type_specific_data:', JSON.stringify(check1.recordset));

  const check2 = await pool.request().query(`
    SELECT COUNT(*) AS col_count FROM sys.columns
    WHERE object_id = OBJECT_ID('studio_document_schemas')
  `);
  console.log('Verify studio_document_schemas columns:', JSON.stringify(check2.recordset));

  process.exit(0);
}

main().catch(err => { console.error('MIGRATION 066 FAILED:', err.message); process.exit(1); });
