-- Companion di rollback per 169_wpqr_drop_expiry_date.sql
-- Ripristina lo schema (colonna DATE nullable + indice). I valori NON NULL
-- presenti prima del DROP NON sono recuperabili da questo script.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NULL
BEGIN
  PRINT N'169 rollback: tabella dbo.wpqr_records assente — nulla da fare.';
END
ELSE
BEGIN
  IF COL_LENGTH(N'dbo.wpqr_records', N'expiry_date') IS NULL
  BEGIN
    ALTER TABLE dbo.wpqr_records ADD expiry_date DATE NULL;
    PRINT N'169 rollback: colonna expiry_date riaggiunta (valori persi).';
  END
  ELSE
    PRINT N'169 rollback: colonna expiry_date già presente — skip.';

  IF COL_LENGTH(N'dbo.wpqr_records', N'expiry_date') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM sys.indexes
       WHERE name = N'IX_wpqr_records_expiry'
         AND object_id = OBJECT_ID(N'dbo.wpqr_records')
     )
  BEGIN
    CREATE INDEX IX_wpqr_records_expiry
      ON dbo.wpqr_records(organization_id, expiry_date);
    PRINT N'169 rollback: indice IX_wpqr_records_expiry ricreato.';
  END
END
GO
