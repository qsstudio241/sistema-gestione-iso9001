/**
 * Migration 040: organizations.audit_report_prefix + audit_daily_sequences
 * Eseguire: cd backend && NODE_ENV=production node scripts/run-migration-040.js
 */
require('dotenv').config();
const path = require('path');
const configs = require(path.join(__dirname, '..', 'config', 'database.json'));
let c = configs.production || configs.development;
if (process.env.DB_SERVER) {
  c = {
    ...c,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE || c.database,
    user: process.env.DB_USER || c.user,
    password: process.env.DB_PASSWORD || c.password,
  };
}
const sql = require('mssql');

const config = {
  server: c.server,
  port: c.port || 1433,
  database: c.database,
  user: c.user,
  password: c.password,
  options: { trustServerCertificate: true, encrypt: true },
};

const SQL_040 = `
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'audit_report_prefix'
)
BEGIN
    ALTER TABLE dbo.organizations ADD audit_report_prefix NVARCHAR(16) NULL;
    PRINT '040: colonna organizations.audit_report_prefix aggiunta';
END
ELSE
    PRINT '040: colonna organizations.audit_report_prefix gia presente';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_daily_sequences' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.audit_daily_sequences (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id INT NOT NULL,
        prefix NVARCHAR(16) NOT NULL,
        sequence_date DATE NOT NULL,
        last_seq INT NOT NULL CONSTRAINT DF_audit_daily_sequences_last DEFAULT (0),
        updated_at DATETIME2(7) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_audit_daily_sequences_org_prefix_day
            UNIQUE (organization_id, prefix, sequence_date),
        CONSTRAINT FK_audit_daily_sequences_org
            FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id)
    );
    CREATE INDEX IX_audit_daily_sequences_lookup
        ON dbo.audit_daily_sequences (organization_id, prefix, sequence_date);
    PRINT '040: tabella audit_daily_sequences creata';
END
ELSE
    PRINT '040: tabella audit_daily_sequences gia presente';
`;

async function run() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log('Connesso al DB. Esecuzione migration 040...\n');
    await pool.request().query(SQL_040);

    const col = await pool.request().query(`
      SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'audit_report_prefix'
    `);
    const tab = await pool.request().query(`
      SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'audit_daily_sequences'
    `);
    console.log('\n=== VERIFICA ===');
    console.log('  Colonna audit_report_prefix:', col.recordset[0].n > 0 ? 'OK' : 'MANCANTE');
    console.log('  Tabella audit_daily_sequences:', tab.recordset[0].n > 0 ? 'OK' : 'MANCANTE');
    console.log('\n=== MIGRATION 040 COMPLETATA ===');
  } catch (err) {
    console.error('Errore:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
