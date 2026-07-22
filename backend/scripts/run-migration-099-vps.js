/**
 * Migration 099 — Tabella management_reviews (Riesame di Direzione ISO 9001 §9.3)
 * Applicare al DB di PRODUZIONE via VPS.
 *
 * Uso (da Windows con run-on-vps.ps1):
 *   .\backend\scripts\run-on-vps.ps1 -Script backend\scripts\run-migration-099-vps.js
 */

// Carica le variabili d'ambiente dal .env del backend sul VPS
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });

const { getPool } = require('/var/www/sgq-backend/src/config/database');

async function main() {
    console.log('Migration 099 — DB di produzione');
    const pool = await getPool();

    const exists = await pool.request().query(`
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'management_reviews'
    `);

    if (exists.recordset[0].cnt > 0) {
        console.log('  SKIP: tabella management_reviews già presente.');
        process.exit(0);
    }

    console.log('  Creazione tabella management_reviews...');
    await pool.request().query(`
        CREATE TABLE management_reviews (
          id               INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_management_reviews PRIMARY KEY,
          uuid             UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
          organization_id  INT NOT NULL,
          company_id       INT NULL,
          review_number    NVARCHAR(50)  NOT NULL,
          review_date      DATE          NOT NULL,
          status           NVARCHAR(20)  NOT NULL DEFAULT 'draft'
              CONSTRAINT CK_mgmt_review_status CHECK (status IN ('draft','finalized','approved')),
          chairperson      NVARCHAR(200) NULL,
          participants     NVARCHAR(MAX) NULL,
          input_previous_actions NVARCHAR(MAX) NULL,
          input_audits           NVARCHAR(MAX) NULL,
          input_nc_corrective    NVARCHAR(MAX) NULL,
          input_objectives       NVARCHAR(MAX) NULL,
          input_complaints       NVARCHAR(MAX) NULL,
          input_suppliers        NVARCHAR(MAX) NULL,
          input_resources        NVARCHAR(MAX) NULL,
          input_improvements     NVARCHAR(MAX) NULL,
          output_improvements    NVARCHAR(MAX) NULL,
          output_sgq_changes     NVARCHAR(MAX) NULL,
          output_resources       NVARCHAR(MAX) NULL,
          notes            NVARCHAR(MAX) NULL,
          created_by       INT NULL,
          created_at       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          updated_at       DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
          is_deleted       BIT NOT NULL DEFAULT 0
        )
    `);

    await pool.request().query(`
        CREATE INDEX IX_mgmt_reviews_org ON management_reviews(organization_id, review_date DESC)
        WHERE is_deleted = 0
    `);
    await pool.request().query(`
        CREATE UNIQUE INDEX IX_mgmt_reviews_uuid ON management_reviews(uuid)
    `);

    const chk = await pool.request().query(
        `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME='management_reviews'`
    );
    console.log(`  Verifica tabella: ${chk.recordset[0].cnt === 1 ? 'OK' : 'FAIL'}`);
    console.log('  OK: migration 099 applicata con successo in produzione.');
    process.exit(0);
}

main().catch((e) => {
    console.error('ERRORE migration 099 VPS:', e.message);
    process.exit(1);
});
