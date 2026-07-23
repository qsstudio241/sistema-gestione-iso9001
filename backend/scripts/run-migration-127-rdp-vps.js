/**
 * Migration 127 — Modulo RDP (Rapporto di Prova, Scenario 4 — Mason)
 * document_type su audits + rdp_reports + rdp_sections + rdp_tests + attachments.rdp_test_id
 *
 * Uso (solo su VPS, via SSH — vedi backend/scripts/run-on-vps.ps1):
 *   node /tmp/run-migration-127-rdp-vps.js
 *
 * NON eseguire su produzione senza conferma esplicita del committente (vedi task brief).
 */

require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { getPool } = require('/var/www/sgq-backend/src/config/database');

const STEPS = [
    {
        name: 'audits.document_type (colonna)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.audits') AND name = 'document_type')
BEGIN
    ALTER TABLE dbo.audits ADD document_type NVARCHAR(20) NOT NULL DEFAULT 'audit';
    PRINT 'Colonna document_type aggiunta.';
END
ELSE PRINT 'Colonna document_type gia esistente — skip.';
`,
    },
    {
        name: 'CK_audits_doc_type (constraint)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_audits_doc_type')
BEGIN
    ALTER TABLE dbo.audits ADD CONSTRAINT CK_audits_doc_type CHECK (document_type IN ('audit', 'sal', 'rdp'));
    PRINT 'Constraint CK_audits_doc_type aggiunto.';
END
ELSE PRINT 'Constraint CK_audits_doc_type gia esistente — skip.';
`,
    },
    {
        name: 'rdp_reports (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_reports')
BEGIN
    CREATE TABLE rdp_reports (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        uuid                    UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        organization_id         INT           NOT NULL,
        company_id              INT           NULL,
        report_number           NVARCHAR(30)  NULL,
        report_year             INT           NOT NULL DEFAULT YEAR(GETDATE()),
        client                  NVARCHAR(200) NULL,
        supplier_name           NVARCHAR(200) NULL,
        project_name            NVARCHAR(300) NULL,
        purpose                 NVARCHAR(500) NULL,
        welded_element_type     NVARCHAR(300) NULL,
        drawing_reference       NVARCHAR(300) NULL,
        inspection_date         DATE          NULL,
        mason_inspector         NVARCHAR(200) NULL,
        client_inspector        NVARCHAR(200) NULL,
        average_score           DECIMAL(4,2)  NULL,
        notes                   NVARCHAR(MAX) NULL,
        status                  NVARCHAR(20)  NOT NULL DEFAULT 'draft',
        is_deleted              BIT           NOT NULL DEFAULT 0,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        created_by              INT           NULL
    );
    CREATE INDEX IX_rdp_reports_org ON rdp_reports (organization_id);
    CREATE INDEX IX_rdp_reports_company ON rdp_reports (company_id);
    CREATE INDEX IX_rdp_reports_status ON rdp_reports (status, is_deleted);
    CREATE UNIQUE INDEX UX_rdp_reports_uuid ON rdp_reports (uuid);
    CREATE UNIQUE INDEX UX_rdp_reports_org_number ON rdp_reports (organization_id, report_number) WHERE report_number IS NOT NULL;
    PRINT 'rdp_reports creata.';
END
ELSE PRINT 'rdp_reports gia esistente — skip.';
`,
    },
    {
        name: 'rdp_sections (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_sections')
BEGIN
    CREATE TABLE rdp_sections (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        report_id               INT           NOT NULL,
        sort_order              INT           NOT NULL DEFAULT 0,
        title                   NVARCHAR(300) NOT NULL,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_rdp_sections_report ON rdp_sections (report_id, sort_order);
    PRINT 'rdp_sections creata.';
END
ELSE PRINT 'rdp_sections gia esistente — skip.';
`,
    },
    {
        name: 'FK rdp_sections -> rdp_reports',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rdp_sections_report')
BEGIN
    ALTER TABLE rdp_sections ADD CONSTRAINT FK_rdp_sections_report
        FOREIGN KEY (report_id) REFERENCES rdp_reports (id);
    PRINT 'FK_rdp_sections_report aggiunta.';
END
`,
    },
    {
        name: 'rdp_tests (tabella)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'rdp_tests')
BEGIN
    CREATE TABLE rdp_tests (
        id                      INT IDENTITY(1,1) PRIMARY KEY,
        section_id              INT           NOT NULL,
        sort_order              INT           NOT NULL DEFAULT 0,
        reference_code          NVARCHAR(100) NULL,
        test_name               NVARCHAR(MAX) NOT NULL,
        expected_value          NVARCHAR(500) NULL,
        measured_value          NVARCHAR(500) NULL,
        evidence_notes          NVARCHAR(MAX) NULL,
        score                   DECIMAL(3,1)  NULL,
        result_code             NVARCHAR(10)  NULL,
        created_at              DATETIME2     NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2     NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_rdp_tests_section ON rdp_tests (section_id, sort_order);
    PRINT 'rdp_tests creata.';
END
ELSE PRINT 'rdp_tests gia esistente — skip.';
`,
    },
    {
        name: 'FK rdp_tests -> rdp_sections',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rdp_tests_section')
BEGIN
    ALTER TABLE rdp_tests ADD CONSTRAINT FK_rdp_tests_section
        FOREIGN KEY (section_id) REFERENCES rdp_sections (id);
    PRINT 'FK_rdp_tests_section aggiunta.';
END
`,
    },
    {
        name: 'CK_rdp_tests_result_code (constraint)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_rdp_tests_result_code')
BEGIN
    ALTER TABLE rdp_tests ADD CONSTRAINT CK_rdp_tests_result_code
        CHECK (result_code IS NULL OR result_code IN ('C', 'NC', 'OSS', 'OM', 'NA', 'NV'));
    PRINT 'Constraint CK_rdp_tests_result_code aggiunto.';
END
`,
    },
    {
        name: 'attachments.rdp_test_id (colonna)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'rdp_test_id')
BEGIN
    ALTER TABLE dbo.attachments ADD rdp_test_id INT NULL;
    PRINT 'Colonna rdp_test_id aggiunta.';
END
ELSE PRINT 'Colonna rdp_test_id gia esistente — skip.';
`,
    },
    {
        name: 'FK attachments.rdp_test_id -> rdp_tests',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_attachments_rdp_test_id')
BEGIN
    ALTER TABLE dbo.attachments ADD CONSTRAINT FK_attachments_rdp_test_id
        FOREIGN KEY (rdp_test_id) REFERENCES dbo.rdp_tests(id);
    PRINT 'FK_attachments_rdp_test_id aggiunta.';
END
ELSE PRINT 'FK_attachments_rdp_test_id gia esistente — skip.';
`,
    },
    {
        name: 'IX_attachments_rdp_test_id (indice)',
        sql: `
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_attachments_rdp_test_id' AND object_id = OBJECT_ID('dbo.attachments'))
BEGIN
    CREATE INDEX IX_attachments_rdp_test_id ON dbo.attachments (rdp_test_id) WHERE rdp_test_id IS NOT NULL;
    PRINT 'Indice IX_attachments_rdp_test_id creato.';
END
ELSE PRINT 'Indice IX_attachments_rdp_test_id gia esistente — skip.';
`,
    },
];

async function run() {
    const pool = await getPool();
    try {
        for (const step of STEPS) {
            console.log(`[127] Eseguo: ${step.name}`);
            const result = await pool.request().query(step.sql);
            if (result.recordset && result.recordset.length > 0) {
                console.log('     Output:', result.recordset);
            }
        }
        console.log('[127] Migration RDP completata.');
    } catch (e) {
        console.error('[127] ERRORE:', e.message);
        process.exit(1);
    } finally {
        await pool.close().catch(() => {});
        process.exit(0);
    }
}

run();
