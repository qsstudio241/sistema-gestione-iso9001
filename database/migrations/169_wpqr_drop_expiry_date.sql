-- TYPE: destructive
-- BACKFILL: none
-- VERIFY: 169_verify.sql
-- ROLLBACK: 169_rollback.sql
--
-- Cleanup: rimuove expiry_date da wpqr_records.
-- ISO 15614 / 15613 / 14555 non prevedono scadenza calendario tipo patentino 9606.
-- NON tocca qualifications.expiry_date (ISO 9606) né welding_procedures.expiry_date (WPS).
-- Idempotente: indice/colonna assenti → no-op. Tabella assente (CI apply-on-empty) → no-op.
--
-- PRE-DROP (eseguire a mano su PROD prima del deploy, se il Cloud non ha già annotato
-- il conteggio nel body della PR):
--   SELECT
--     COUNT(*) AS wpqr_totali,
--     SUM(CASE WHEN expiry_date IS NOT NULL THEN 1 ELSE 0 END) AS wpqr_con_expiry
--   FROM dbo.wpqr_records;
-- I valori NON NULL andranno persi (la colonna non è prevista dalle norme WPQR).

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NULL
BEGIN
  PRINT N'169: tabella dbo.wpqr_records assente — skip (apply-on-empty / gap pre-169).';
END
ELSE
BEGIN
  IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_wpqr_records_expiry'
      AND object_id = OBJECT_ID(N'dbo.wpqr_records')
  )
  BEGIN
    DROP INDEX IX_wpqr_records_expiry ON dbo.wpqr_records;
    PRINT N'169: indice IX_wpqr_records_expiry rimosso.';
  END
  ELSE
    PRINT N'169: indice IX_wpqr_records_expiry già assente — skip.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'expiry_date') IS NOT NULL
BEGIN
  ALTER TABLE dbo.wpqr_records DROP COLUMN expiry_date;
  PRINT N'169: colonna wpqr_records.expiry_date rimossa.';
END
ELSE
  PRINT N'169: colonna wpqr_records.expiry_date già assente o tabella assente — skip.';
GO
