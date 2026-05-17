/**
 * run-migration-068-vps.js
 * Migration 068: qualification_type ISO 3834 + satisfied_by columns in audit_responses
 * Uso: scp to VPS, then: node /tmp/run-migration-068-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  // Step 1: qualification_type column (if not exists) in qualifications
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'qualification_type'
    )
    ALTER TABLE qualifications ADD qualification_type NVARCHAR(30) NULL
  `);
  console.log('Step 1 OK: qualification_type column ensured');

  // Step 2: welding_process in qualifications
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'welding_process'
    )
    ALTER TABLE qualifications ADD welding_process NVARCHAR(20) NULL
  `);
  console.log('Step 2 OK: welding_process column ensured');

  // Step 3: material_group in qualifications
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'material_group'
    )
    ALTER TABLE qualifications ADD material_group NVARCHAR(50) NULL
  `);
  console.log('Step 3 OK: material_group column ensured');

  // Step 4: position_range in qualifications
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'position_range'
    )
    ALTER TABLE qualifications ADD position_range NVARCHAR(50) NULL
  `);
  console.log('Step 4 OK: position_range column ensured');

  // Step 5: ndt_method in qualifications (VT/MT/PT/UT/RT)
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'ndt_method'
    )
    ALTER TABLE qualifications ADD ndt_method NVARCHAR(10) NULL
  `);
  console.log('Step 5 OK: ndt_method column ensured');

  // Step 6: ndt_level in qualifications (1/2/3)
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('qualifications') AND name = 'ndt_level'
    )
    ALTER TABLE qualifications ADD ndt_level INT NULL
  `);
  console.log('Step 6 OK: ndt_level column ensured');

  // Step 7: satisfied_by columns in audit_responses
  const satCols = [
    { name: 'satisfied_by_standard', type: 'NVARCHAR(20)' },
    { name: 'satisfied_by_clause',   type: 'NVARCHAR(20)' },
    { name: 'satisfied_by_doc_ref',  type: 'NVARCHAR(200)' },
  ];
  for (const col of satCols) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.columns
        WHERE object_id = OBJECT_ID('audit_responses') AND name = '${col.name}'
      )
      ALTER TABLE audit_responses ADD ${col.name} ${col.type} NULL
    `);
    console.log(`Step 7 OK: audit_responses.${col.name} ensured`);
  }

  // Step 8: index on qualification_type
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pq_qual_type')
    CREATE INDEX IX_pq_qual_type ON qualifications(qualification_type)
    WHERE qualification_type IS NOT NULL
  `);
  console.log('Step 8 OK: index on qualification_type');

  // Verify
  const check = await pool.request().query(`
    SELECT c.name FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('qualifications')
      AND c.name IN ('qualification_type','welding_process','material_group','position_range','ndt_method','ndt_level')
  `);
  console.log('Verify qualifications cols:', check.recordset.map(r => r.name).join(', '));

  const check2 = await pool.request().query(`
    SELECT c.name FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('audit_responses')
      AND c.name LIKE 'satisfied_by_%'
  `);
  console.log('Verify audit_responses SAT cols:', check2.recordset.map(r => r.name).join(', '));

  process.exit(0);
}

main().catch(err => { console.error('MIGRATION 068 FAILED:', err.message); process.exit(1); });
