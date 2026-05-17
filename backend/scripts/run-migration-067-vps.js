/**
 * run-migration-067-vps.js
 * Migration 067: welding_procedures, wpqr_records, projects (ISO 3834)
 * Uso: scp to VPS, then: node /tmp/run-migration-067-vps.js
 */
process.chdir('/var/www/sgq-backend');
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const pool = await getPool();

  // Step 1: welding_procedures (WPS)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('welding_procedures'))
    CREATE TABLE welding_procedures (
      id                     INT IDENTITY(1,1) PRIMARY KEY,
      organization_id        INT NOT NULL,
      company_id             INT NULL,
      wps_code               NVARCHAR(50) NOT NULL,
      revision               NVARCHAR(20) NULL,
      welding_process        NVARCHAR(20) NULL,
      material_group         NVARCHAR(50) NULL,
      filler_material        NVARCHAR(100) NULL,
      shielding_gas          NVARCHAR(50) NULL,
      joint_type             NVARCHAR(20) NULL,
      position               NVARCHAR(50) NULL,
      thickness_range_min    DECIMAL(8,2) NULL,
      thickness_range_max    DECIMAL(8,2) NULL,
      pipe_diameter_min      DECIMAL(8,2) NULL,
      preheat_temp           NVARCHAR(50) NULL,
      interpass_temp         NVARCHAR(50) NULL,
      pwht                   NVARCHAR(200) NULL,
      qualification_standard NVARCHAR(50) NULL,
      status                 NVARCHAR(20) NOT NULL DEFAULT 'vigente',
      attachment_id          INT NULL,
      notes                  NVARCHAR(MAX) NULL,
      created_by             INT NULL,
      created_at             DATETIME2 NOT NULL DEFAULT GETDATE(),
      updated_at             DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Step 1 OK: welding_procedures created');

  // Step 2: wpqr_records
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('wpqr_records'))
    CREATE TABLE wpqr_records (
      id                         INT IDENTITY(1,1) PRIMARY KEY,
      organization_id            INT NOT NULL,
      wps_id                     INT NULL,
      wpqr_code                  NVARCHAR(50) NOT NULL,
      test_date                  DATE NULL,
      issuing_body               NVARCHAR(100) NULL,
      vt_result                  NVARCHAR(20) NULL,
      rt_result                  NVARCHAR(20) NULL,
      ut_result                  NVARCHAR(20) NULL,
      mt_result                  NVARCHAR(20) NULL,
      pt_result                  NVARCHAR(20) NULL,
      tensile_result             NVARCHAR(50) NULL,
      bend_result                NVARCHAR(50) NULL,
      impact_result              NVARCHAR(50) NULL,
      hardness_result            NVARCHAR(50) NULL,
      macro_result               NVARCHAR(50) NULL,
      validity_range_description NVARCHAR(500) NULL,
      expiry_date                DATE NULL,
      attachment_id              INT NULL,
      notes                      NVARCHAR(MAX) NULL,
      created_by                 INT NULL,
      created_at                 DATETIME2 NOT NULL DEFAULT GETDATE(),
      updated_at                 DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Step 2 OK: wpqr_records created');

  // Step 3: projects (commesse ISO 3834)
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('projects'))
    CREATE TABLE projects (
      id                       INT IDENTITY(1,1) PRIMARY KEY,
      organization_id          INT NOT NULL,
      company_id               INT NULL,
      project_code             NVARCHAR(50) NOT NULL,
      client_name              NVARCHAR(200) NULL,
      client_company_id        INT NULL,
      description              NVARCHAR(MAX) NULL,
      start_date               DATE NULL,
      end_date                 DATE NULL,
      applicable_wps_ids       NVARCHAR(MAX) NULL,
      status                   NVARCHAR(30) NOT NULL DEFAULT 'offerta',
      requirements_review_date DATE NULL,
      technical_review_date    DATE NULL,
      notes                    NVARCHAR(MAX) NULL,
      created_by               INT NULL,
      created_at               DATETIME2 NOT NULL DEFAULT GETDATE(),
      updated_at               DATETIME2 NOT NULL DEFAULT GETDATE()
    )
  `);
  console.log('Step 3 OK: projects created');

  // Step 4: FK per welding_procedures
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wps_org')
    ALTER TABLE welding_procedures
      ADD CONSTRAINT FK_wps_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wps_company')
    ALTER TABLE welding_procedures
      ADD CONSTRAINT FK_wps_company FOREIGN KEY (company_id) REFERENCES companies(id)
  `);
  console.log('Step 4 OK: welding_procedures FKs');

  // Step 5: FK per wpqr_records
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wpqr_org')
    ALTER TABLE wpqr_records
      ADD CONSTRAINT FK_wpqr_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);

  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wpqr_wps')
    ALTER TABLE wpqr_records
      ADD CONSTRAINT FK_wpqr_wps FOREIGN KEY (wps_id) REFERENCES welding_procedures(id)
  `);
  console.log('Step 5 OK: wpqr_records FKs');

  // Step 6: FK per projects
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_proj_org')
    ALTER TABLE projects
      ADD CONSTRAINT FK_proj_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
  `);
  console.log('Step 6 OK: projects FKs');

  // Step 7: Indexes
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wps_org_company')
    CREATE INDEX IX_wps_org_company ON welding_procedures(organization_id, company_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_wpqr_org_wps')
    CREATE INDEX IX_wpqr_org_wps ON wpqr_records(organization_id, wps_id)
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_proj_org_company')
    CREATE INDEX IX_proj_org_company ON projects(organization_id, company_id)
  `);
  console.log('Step 7 OK: indexes created');

  // Verify
  for (const tbl of ['welding_procedures', 'wpqr_records', 'projects']) {
    const c = await pool.request().query(
      `SELECT COUNT(*) AS cols FROM sys.columns WHERE object_id = OBJECT_ID('${tbl}')`
    );
    console.log(`Verify ${tbl}: ${c.recordset[0].cols} columns`);
  }

  process.exit(0);
}

main().catch(err => { console.error('MIGRATION 067 FAILED:', err.message); process.exit(1); });
