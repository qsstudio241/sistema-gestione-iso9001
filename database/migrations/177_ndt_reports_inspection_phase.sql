-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, colonna NULL senza default; i verbali nuovi ricevono after dall'API)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 177: fase ispezione sul verbale CND (prima / durante / dopo la saldatura).
-- Traccia lo stato del controllo (parafrasi ISO 3834-2 §14). Nessuna soglia ISO 17637.
-- Valori ammessi: before | during | after. I verbali già presenti restano NULL.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.ndt_reports', N'U') IS NULL
BEGIN
    PRINT N'177: dbo.ndt_reports assente - skip.';
END
GO

IF OBJECT_ID(N'dbo.ndt_reports', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ndt_reports', N'inspection_phase') IS NULL
BEGIN
    ALTER TABLE dbo.ndt_reports ADD inspection_phase NVARCHAR(16) NULL;
    PRINT N'177: ndt_reports.inspection_phase aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.ndt_reports', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ndt_reports', N'inspection_phase') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.check_constraints
        WHERE name = N'CK_ndt_reports_inspection_phase'
          AND parent_object_id = OBJECT_ID(N'dbo.ndt_reports')
   )
BEGIN
    ALTER TABLE dbo.ndt_reports
      ADD CONSTRAINT CK_ndt_reports_inspection_phase
      CHECK (inspection_phase IS NULL OR inspection_phase IN (N'before', N'during', N'after'));
    PRINT N'177: CK_ndt_reports_inspection_phase aggiunto.';
END
GO
