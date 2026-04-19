/**
 * Migration 041: organizations.vat_number, organizations.logo_url
 * Eseguire: cd backend && node scripts/run-migration-041.js
 * (opzionale: NODE_ENV=development|production come in config/database.json)
 */
require('dotenv').config();
const { resolveDbSection } = require('./mergeDbEnv');
const sql = require('mssql');

const env = process.env.NODE_ENV || 'development';
const c = resolveDbSection(env);

const config = {
  server: c.server,
  port: c.port || 1433,
  database: c.database,
  user: c.user,
  password: c.password,
  options: c.options || { trustServerCertificate: true, encrypt: true },
};

const SQL_041 = `
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'vat_number'
)
BEGIN
    ALTER TABLE dbo.organizations ADD vat_number NVARCHAR(32) NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'logo_url'
)
BEGIN
    ALTER TABLE dbo.organizations ADD logo_url NVARCHAR(500) NULL;
END
`;

async function run() {
  let pool;
  try {
    pool = await sql.connect(config);
    console.log(`Connesso al DB (${config.database} / env=${env}). Esecuzione migration 041...\n`);
    await pool.request().query(SQL_041);

    const check = await pool.request().query(`
      SELECT COLUMN_NAME
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'organizations'
        AND COLUMN_NAME IN ('vat_number', 'logo_url')
      ORDER BY COLUMN_NAME
    `);
    const names = check.recordset.map((r) => r.COLUMN_NAME);
    console.log('\n=== VERIFICA ===');
    console.log('  Colonne presenti:', names.join(', ') || '(nessuna — errore)');
    const ok = names.includes('vat_number') && names.includes('logo_url');
    if (!ok) {
      console.error('\n❌ Migration 041 incompleta (manca una colonna).');
      process.exit(1);
    }
    console.log('\n=== MIGRATION 041 COMPLETATA ===');
  } catch (err) {
    console.error('Errore:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

run();
