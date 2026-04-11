-- 039: colonne per risultato analisi AI strutturata su import_job_files (Sprint 9+)
-- Idempotente: eseguire una sola volta per ambiente.

IF COL_LENGTH('dbo.import_job_files', 'ai_extraction_json') IS NULL
BEGIN
    ALTER TABLE dbo.import_job_files ADD
        ai_extraction_json   NVARCHAR(MAX)  NULL,
        ai_extraction_error  NVARCHAR(2000) NULL,
        ai_extraction_at     DATETIME2      NULL,
        ai_model             NVARCHAR(80)   NULL;
    PRINT '039: colonne AI aggiunte a import_job_files.';
END
ELSE
    PRINT '039: colonne AI gia presenti - skip.';
