/**
 * run-migration-038.js — Sprint 9: import batch PDF (job + file) senza API esterne
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');

const dbConfigAll = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../config/database.json'), 'utf8')
);
const env = process.env.NODE_ENV || 'production';
const dbConfig = dbConfigAll[env] || dbConfigAll.production || dbConfigAll;

const SQL_038_JOBS = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'import_jobs' AND type = 'U')
BEGIN
    CREATE TABLE dbo.import_jobs (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        company_id          INT            NULL,
        created_by          INT            NULL,
        title               NVARCHAR(255)  NOT NULL CONSTRAINT DF_import_jobs_title DEFAULT (N'Import documenti'),
        status              NVARCHAR(40)   NOT NULL CONSTRAINT DF_import_jobs_status DEFAULT ('draft'),
        document_type_hint  NVARCHAR(80)   NULL,
        notes               NVARCHAR(MAX)  NULL,
        created_at          DATETIME2      NOT NULL CONSTRAINT DF_import_jobs_ca DEFAULT (GETDATE()),
        updated_at          DATETIME2      NOT NULL CONSTRAINT DF_import_jobs_ua DEFAULT (GETDATE()),
        CONSTRAINT PK_import_jobs PRIMARY KEY CLUSTERED (id),
        CONSTRAINT CK_import_jobs_status CHECK (status IN ('draft','ready','processing','review','completed','failed'))
    );
    CREATE NONCLUSTERED INDEX IX_import_jobs_org ON dbo.import_jobs(organization_id);
    PRINT 'Tabella import_jobs creata.';
END
ELSE PRINT 'Tabella import_jobs gia esistente - skip.';
`;

const SQL_038_FILES = `
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE name = 'import_job_files' AND type = 'U')
BEGIN
    CREATE TABLE dbo.import_job_files (
        id                  INT IDENTITY(1,1) NOT NULL,
        job_id              INT            NOT NULL,
        original_name       NVARCHAR(500)  NOT NULL,
        storage_path        NVARCHAR(2000) NOT NULL,
        mime_type           NVARCHAR(120)  NULL,
        file_size           INT            NULL,
        status              NVARCHAR(40)   NOT NULL CONSTRAINT DF_ijf_status DEFAULT ('uploaded'),
        extracted_text      NVARCHAR(MAX)  NULL,
        confidence_score    DECIMAL(5,2)   NULL,
        reviewer_notes      NVARCHAR(MAX)  NULL,
        reviewed_by         INT            NULL,
        reviewed_at         DATETIME2      NULL,
        error_message       NVARCHAR(MAX)  NULL,
        created_at          DATETIME2      NOT NULL CONSTRAINT DF_ijf_ca DEFAULT (GETDATE()),
        updated_at          DATETIME2      NOT NULL CONSTRAINT DF_ijf_ua DEFAULT (GETDATE()),
        CONSTRAINT PK_import_job_files PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_ijf_job FOREIGN KEY (job_id) REFERENCES dbo.import_jobs(id) ON DELETE CASCADE,
        CONSTRAINT CK_ijf_status CHECK (status IN ('uploaded','extracted','reviewed','error'))
    );
    CREATE NONCLUSTERED INDEX IX_ijf_job ON dbo.import_job_files(job_id);
    PRINT 'Tabella import_job_files creata.';
END
ELSE PRINT 'Tabella import_job_files gia esistente - skip.';
`;

async function runMigration() {
    let pool;
    try {
        console.log('Connessione al database per migration 038...');
        pool = await sql.connect(dbConfig);
        await pool.request().query(SQL_038_JOBS);
        await pool.request().query(SQL_038_FILES);
        console.log('Migration 038 completata.');
    } catch (err) {
        console.error('Errore migration 038:', err.message);
        process.exit(1);
    } finally {
        if (pool) await pool.close();
    }
}

runMigration();
