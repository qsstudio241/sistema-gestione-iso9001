/**
 * Migration 103 — ndt_reports + ndt_report_items + ndt_report_instruments
 * Prerequisito: migration 101 (equipment_assets) deve essere applicata.
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    {
        name: 'ndt_reports (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_reports')
BEGIN
    CREATE TABLE ndt_reports (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        uuid                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id         INT           NOT NULL,
        company_id              INT           NULL,
        report_type             NVARCHAR(5)   NOT NULL DEFAULT 'VT',
        report_number           NVARCHAR(30)  NULL,
        report_year             INT           NOT NULL DEFAULT YEAR(GETDATE()),
        client                  NVARCHAR(200) NULL,
        job_order               NVARCHAR(200) NULL,
        wps_number              NVARCHAR(100) NULL,
        wps_id                  INT           NULL,
        base_material           NVARCHAR(200) NULL,
        material_standard       NVARCHAR(100) NULL,
        joint_type              NVARCHAR(300) NULL DEFAULT 'SALDATURA AD ANGOLO MONO E MULTI PASSATA',
        quality_level           NVARCHAR(100) NULL DEFAULT 'UNI EN ISO 5817 Lev.C',
        method_params           NVARCHAR(MAX) NULL,
        notes                   NVARCHAR(MAX) NULL DEFAULT 'NULLA DA SEGNALARE, L''ESITO E'' DA RITENERSI SODDISFACENTE.',
        inspection_date         DATE          NULL,
        certificate_date        DATE          NULL,
        responsible             NVARCHAR(200) NULL,
        inspector               NVARCHAR(200) NULL,
        client_representative   NVARCHAR(200) NULL,
        wps_snapshot            NVARCHAR(MAX) NULL,
        status                  NVARCHAR(20)  NOT NULL DEFAULT 'draft',
        is_deleted              BIT           NOT NULL DEFAULT 0,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );
    CREATE INDEX IX_ndt_reports_org ON ndt_reports (organization_id);
    CREATE INDEX IX_ndt_reports_company ON ndt_reports (company_id);
    CREATE INDEX IX_ndt_reports_type_year ON ndt_reports (report_type, report_year);
    CREATE INDEX IX_ndt_reports_status ON ndt_reports (status, is_deleted);
    CREATE UNIQUE INDEX UX_ndt_reports_uuid ON ndt_reports (uuid);
    CREATE UNIQUE INDEX UX_ndt_reports_number ON ndt_reports (report_number) WHERE report_number IS NOT NULL;
    PRINT 'ndt_reports creata.';
END
ELSE PRINT 'ndt_reports gia esistente — skip.';
`
    },
    {
        name: 'ndt_report_items (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_report_items')
BEGIN
    CREATE TABLE ndt_report_items (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        report_id               INT           NOT NULL,
        sort_order              INT           NOT NULL DEFAULT 0,
        position_code           NVARCHAR(100) NULL,
        quantity                NVARCHAR(20)  NULL,
        description             NVARCHAR(500) NULL,
        examined_part           NVARCHAR(100) NULL DEFAULT 'SALDATURA',
        surface_condition       NVARCHAR(5)   NULL DEFAULT 'M/S',
        inspection_percentage   INT           NULL DEFAULT 100,
        defects                 NVARCHAR(200) NULL DEFAULT 'NESSUNO',
        evaluation              NVARCHAR(5)   NULL DEFAULT 'A',
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_ndt_report_items_report ON ndt_report_items (report_id, sort_order);
    PRINT 'ndt_report_items creata.';
END
ELSE PRINT 'ndt_report_items gia esistente — skip.';
`
    },
    {
        name: 'FK ndt_report_items -> ndt_reports',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_report_items_report')
BEGIN
    ALTER TABLE ndt_report_items ADD CONSTRAINT FK_ndt_report_items_report
        FOREIGN KEY (report_id) REFERENCES ndt_reports (id);
    PRINT 'FK_ndt_report_items_report aggiunta.';
END
`
    },
    {
        name: 'ndt_report_instruments (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ndt_report_instruments')
BEGIN
    CREATE TABLE ndt_report_instruments (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        report_id       INT           NOT NULL,
        asset_id        INT           NOT NULL,
        instrument_role NVARCHAR(50)  NULL,
        measured_value  NVARCHAR(500) NULL,
        created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_ndt_report_instruments_report ON ndt_report_instruments (report_id);
    CREATE INDEX IX_ndt_report_instruments_asset ON ndt_report_instruments (asset_id);
    PRINT 'ndt_report_instruments creata.';
END
ELSE PRINT 'ndt_report_instruments gia esistente — skip.';
`
    },
    {
        name: 'FK ndt_report_instruments -> ndt_reports',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_instruments_report')
BEGIN
    ALTER TABLE ndt_report_instruments ADD CONSTRAINT FK_ndt_instruments_report
        FOREIGN KEY (report_id) REFERENCES ndt_reports (id);
    PRINT 'FK_ndt_instruments_report aggiunta.';
END
`
    },
    {
        name: 'FK ndt_report_instruments -> equipment_assets',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ndt_instruments_asset')
BEGIN
    ALTER TABLE ndt_report_instruments ADD CONSTRAINT FK_ndt_instruments_asset
        FOREIGN KEY (asset_id) REFERENCES equipment_assets (id);
    PRINT 'FK_ndt_instruments_asset aggiunta.';
END
`
    }
];

async function run() {
    const pool = await getPool();
    try {
        for (const step of STEPS) {
            console.log(`[103] Eseguo: ${step.name}`);
            const result = await pool.request().query(step.sql);
            if (result.recordset && result.recordset.length > 0) {
                console.log('     Output:', result.recordset);
            }
        }
        console.log('[103] Migration ndt_reports + items + instruments completata.');
    } catch (e) {
        console.error('[103] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
