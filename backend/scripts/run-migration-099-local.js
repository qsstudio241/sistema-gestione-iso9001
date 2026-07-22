/**
 * Migration 099 — Tabella management_reviews (Riesame di Direzione ISO 9001 §9.3)
 * Applicare al DB di TEST locale (profilo "test" di database.json)
 *
 * Uso:
 *   cd C:\Dev\ProgettoISO\backend
 *   node scripts/run-migration-099-local.js
 *
 * NON carica .env — legge solo database.json sezione "test".
 */

const sql = require('mssql');
const { loadDatabaseJsonConfigs } = require('./mergeDbEnv');

async function main() {
    const configs = loadDatabaseJsonConfigs();
    const c = configs['test'];
    if (!c) throw new Error('Sezione "test" mancante in backend/config/database.json');

    console.log(`Migration 099 → [${c.database}] su ${c.server}:${c.port}`);

    const pool = await sql.connect({
        server: c.server,
        port: c.port || 1433,
        database: c.database,
        user: c.user,
        password: c.password,
        options: {
            encrypt: c.options?.encrypt ?? false,
            trustServerCertificate: true,
            enableArithAbort: true,
            connectTimeout: c.options?.connectTimeout ?? 30000,
            requestTimeout: c.options?.requestTimeout ?? 30000,
        },
    });

    // Idempotente
    const exists = await pool.request().query(`
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME = 'management_reviews'
    `);

    if (exists.recordset[0].cnt > 0) {
        console.log('  SKIP: tabella management_reviews già presente.');
        await pool.close();
        return;
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

    console.log('  Creazione indici...');
    await pool.request().query(`
        CREATE INDEX IX_mgmt_reviews_org ON management_reviews(organization_id, review_date DESC)
        WHERE is_deleted = 0
    `);
    await pool.request().query(`
        CREATE UNIQUE INDEX IX_mgmt_reviews_uuid ON management_reviews(uuid)
    `);

    console.log('  Verifica...');
    const chk = await pool.request().query(`
        SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'management_reviews'
    `);
    console.log(`  Tabella management_reviews presente: ${chk.recordset[0].cnt === 1}`);

    console.log('  OK: migration 099 applicata con successo.');
    await pool.close();
}

main().catch((e) => {
    console.error('ERRORE migration 099:', e.message);
    process.exit(1);
});
