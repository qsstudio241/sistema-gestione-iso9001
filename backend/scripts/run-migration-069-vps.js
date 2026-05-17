/**
 * run-migration-069-vps.js
 * Migration 069: wpqr_records missing cols + wps_welders + project_welders tables
 * Uso: scp to VPS, then: node /tmp/run-migration-069-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  // Step 1: testing_body column on wpqr_records
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('wpqr_records') AND name = 'testing_body'
    )
    ALTER TABLE wpqr_records ADD testing_body NVARCHAR(100) NULL
  `);
  console.log('Step 1 OK: wpqr_records.testing_body ensured');

  // Step 2: welder_name column on wpqr_records
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('wpqr_records') AND name = 'welder_name'
    )
    ALTER TABLE wpqr_records ADD welder_name NVARCHAR(100) NULL
  `);
  console.log('Step 2 OK: wpqr_records.welder_name ensured');

  // Step 3: certificate_number column on wpqr_records
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM sys.columns
      WHERE object_id = OBJECT_ID('wpqr_records') AND name = 'certificate_number'
    )
    ALTER TABLE wpqr_records ADD certificate_number NVARCHAR(100) NULL
  `);
  console.log('Step 3 OK: wpqr_records.certificate_number ensured');

  // Step 4: wps_welders table
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('wps_welders'))
    CREATE TABLE wps_welders (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      wps_id           INT NOT NULL,
      qualification_id INT NOT NULL,
      assigned_date    DATE NULL,
      notes            NVARCHAR(500) NULL,
      organization_id  INT NOT NULL,
      created_at       DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Step 4 OK: wps_welders table ensured');

  // Step 5: wps_welders indexes
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wps_welders_org_wps')
    CREATE INDEX IX_wps_welders_org_wps ON wps_welders(organization_id, wps_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wps_welders_qual')
    CREATE INDEX IX_wps_welders_qual ON wps_welders(qualification_id)
  `);
  console.log('Step 5 OK: wps_welders indexes ensured');

  // Step 6: wps_welders FK
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wps_welders_org')
    ALTER TABLE wps_welders
      ADD CONSTRAINT FK_wps_welders_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wps_welders_wps')
    ALTER TABLE wps_welders
      ADD CONSTRAINT FK_wps_welders_wps FOREIGN KEY (wps_id) REFERENCES welding_procedures(id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wps_welders_qual')
    ALTER TABLE wps_welders
      ADD CONSTRAINT FK_wps_welders_qual FOREIGN KEY (qualification_id) REFERENCES qualifications(id)
  `);
  console.log('Step 6 OK: wps_welders FKs ensured');

  // Step 7: project_welders table
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('project_welders'))
    CREATE TABLE project_welders (
      id               INT IDENTITY(1,1) PRIMARY KEY,
      project_id       INT NOT NULL,
      qualification_id INT NOT NULL,
      wps_id           INT NULL,
      assigned_date    DATE NULL,
      notes            NVARCHAR(500) NULL,
      organization_id  INT NOT NULL,
      created_at       DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Step 7 OK: project_welders table ensured');

  // Step 8: project_welders indexes
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_proj_welders_org_proj')
    CREATE INDEX IX_proj_welders_org_proj ON project_welders(organization_id, project_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_proj_welders_qual')
    CREATE INDEX IX_proj_welders_qual ON project_welders(qualification_id)
  `);
  console.log('Step 8 OK: project_welders indexes ensured');

  // Step 9: project_welders FK
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_proj_welders_org')
    ALTER TABLE project_welders
      ADD CONSTRAINT FK_proj_welders_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_proj_welders_proj')
    ALTER TABLE project_welders
      ADD CONSTRAINT FK_proj_welders_proj FOREIGN KEY (project_id) REFERENCES projects(id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_proj_welders_qual')
    ALTER TABLE project_welders
      ADD CONSTRAINT FK_proj_welders_qual FOREIGN KEY (qualification_id) REFERENCES qualifications(id)
  `);
  console.log('Step 9 OK: project_welders FKs ensured');

  // Verify
  const check1 = await pool.request().query(`
    SELECT c.name FROM sys.columns c
    WHERE c.object_id = OBJECT_ID('wpqr_records')
      AND c.name IN ('testing_body','welder_name','certificate_number')
  `);
  console.log('Verify wpqr_records new cols:', check1.recordset.map(r => r.name).join(', '));

  for (const tbl of ['wps_welders', 'project_welders']) {
    const c = await pool.request().query(
      `SELECT COUNT(*) AS cols FROM sys.columns WHERE object_id = OBJECT_ID('${tbl}')`
    );
    console.log(`Verify ${tbl}: ${c.recordset[0].cols} columns`);
  }

  process.exit(0);
}

main().catch(err => { console.error('MIGRATION 069 FAILED:', err.message); process.exit(1); });
