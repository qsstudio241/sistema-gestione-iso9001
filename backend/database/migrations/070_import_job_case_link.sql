-- Migration 070: link bidirezionale import job ↔ caso Riesame (slice R3)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.commercial_cases') AND name = 'source_import_job_id'
)
BEGIN
    ALTER TABLE dbo.commercial_cases ADD source_import_job_id INT NULL;
    PRINT 'Colonna commercial_cases.source_import_job_id aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.import_job_files') AND name = 'commercial_case_id'
)
BEGIN
    ALTER TABLE dbo.import_job_files ADD commercial_case_id INT NULL;
    PRINT 'Colonna import_job_files.commercial_case_id aggiunta.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_cc_source_import_job')
BEGIN
    ALTER TABLE dbo.commercial_cases
    ADD CONSTRAINT FK_cc_source_import_job FOREIGN KEY (source_import_job_id) REFERENCES dbo.import_jobs(id);
    PRINT 'FK_cc_source_import_job creata.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ijf_commercial_case')
BEGIN
    ALTER TABLE dbo.import_job_files
    ADD CONSTRAINT FK_ijf_commercial_case FOREIGN KEY (commercial_case_id) REFERENCES dbo.commercial_cases(id);
    PRINT 'FK_ijf_commercial_case creata.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cc_source_import_job' AND object_id = OBJECT_ID('dbo.commercial_cases')
)
BEGIN
    CREATE INDEX IX_cc_source_import_job ON dbo.commercial_cases(source_import_job_id);
    PRINT 'Indice IX_cc_source_import_job creato.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ijf_commercial_case' AND object_id = OBJECT_ID('dbo.import_job_files')
)
BEGIN
    CREATE INDEX IX_ijf_commercial_case ON dbo.import_job_files(commercial_case_id);
    PRINT 'Indice IX_ijf_commercial_case creato.';
END
GO

-- Backfill link da allegati esistenti (caso R2 pre-R3)
UPDATE f
SET f.commercial_case_id = a.commercial_case_id
FROM dbo.import_job_files f
INNER JOIN dbo.attachments a
    ON a.storage_path = f.storage_path AND a.commercial_case_id IS NOT NULL
WHERE f.commercial_case_id IS NULL;
GO

UPDATE cc
SET cc.source_import_job_id = f.job_id
FROM dbo.commercial_cases cc
INNER JOIN dbo.import_job_files f ON f.commercial_case_id = cc.id
WHERE cc.source_import_job_id IS NULL;
GO

PRINT 'Migration 070 import job case link completata.';
GO
