-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, colonna NULL senza default; i verbali già emessi restano senza id)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 179: collegamento del verbale CND al patentino ISO 9712.
-- Nullable, senza vincolo di chiave esterna: il nome in inspector resta lo snapshot per il Word.
-- I verbali già presenti restano NULL e continuano a usare il nome.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.ndt_reports', N'U') IS NULL
BEGIN
    PRINT N'179: dbo.ndt_reports assente - skip.';
END
GO

IF OBJECT_ID(N'dbo.ndt_reports', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.ndt_reports', N'inspector_qualification_id') IS NULL
BEGIN
    ALTER TABLE dbo.ndt_reports ADD inspector_qualification_id INT NULL;
    PRINT N'179: ndt_reports.inspector_qualification_id aggiunta.';
END
GO
