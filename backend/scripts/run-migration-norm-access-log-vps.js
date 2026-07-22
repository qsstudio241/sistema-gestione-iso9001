'use strict';
/**
 * Migrazione: crea tabella norm_access_log su VPS (HK-7)
 * Idempotente (IF NOT EXISTS).
 * Uso: .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-norm-access-log-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function run() {
  const pool = await getPool();
  try {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'norm_access_log'
      )
      BEGIN
        CREATE TABLE norm_access_log (
          id              INT IDENTITY(1,1) PRIMARY KEY,
          organization_id INT NOT NULL DEFAULT 0,
          standard_code   NVARCHAR(100) NOT NULL,
          source          NVARCHAR(50)  NOT NULL,
          created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
        );
        PRINT 'norm_access_log creata';
      END
      ELSE
        PRINT 'norm_access_log esiste gia — skip';
    `);
    console.log('[norm-access-log] Migrazione completata.');
  } catch (err) {
    console.error('[norm-access-log] ERRORE:', err.message);
    process.exit(1);
  } finally {
    await pool.close().catch(() => {});
    process.exit(0);
  }
}
run();
