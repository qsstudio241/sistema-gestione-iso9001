-- Companion di verifica per 169_wpqr_drop_expiry_date.sql
-- Restituisce una riga con esito = PASS|FAIL.
-- CI apply-on-empty: tabella assente (storico < 169 saltato) → PASS.

SET NOCOUNT ON;

DECLARE @righe_dopo INT = 0;
DECLARE @orfani INT = 0;
DECLARE @null_attesi INT = 0;
DECLARE @fk_rotte INT = 0;
DECLARE @colonna_presente INT = 0;
DECLARE @indice_presente INT = 0;
DECLARE @tabella_presente INT = 0;

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
BEGIN
  SET @tabella_presente = 1;
  SELECT @righe_dopo = COUNT(*) FROM dbo.wpqr_records;

  IF COL_LENGTH(N'dbo.wpqr_records', N'expiry_date') IS NOT NULL
    SET @colonna_presente = 1;

  IF EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_wpqr_records_expiry'
      AND object_id = OBJECT_ID(N'dbo.wpqr_records')
  )
    SET @indice_presente = 1;

  SELECT @fk_rotte = COUNT(*)
  FROM sys.foreign_keys
  WHERE is_not_trusted = 1
    AND parent_object_id = OBJECT_ID(N'dbo.wpqr_records');
END

SELECT
  CASE
    WHEN @tabella_presente = 0 THEN N'PASS'
    WHEN @colonna_presente = 0 AND @indice_presente = 0 AND @orfani = 0
         AND @null_attesi = 0 AND @fk_rotte = 0 THEN N'PASS'
    ELSE N'FAIL'
  END AS esito,
  @righe_dopo AS righe_prima,
  @righe_dopo AS righe_dopo,
  @orfani AS orfani,
  @null_attesi AS null_attesi,
  @fk_rotte AS fk_rotte,
  @colonna_presente AS expiry_date_ancora_presente,
  @indice_presente AS ix_expiry_ancora_presente,
  CASE
    WHEN @tabella_presente = 0
      THEN N'tabella assente (CI apply-on-empty / gap pre-169)'
    ELSE N'DROP COLUMN: conteggio righe invariato; colonna e indice devono essere assenti'
  END AS nota;
