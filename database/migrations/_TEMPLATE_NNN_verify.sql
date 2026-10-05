-- Companion di verifica per una migrazione transform/destructive.
-- Nome reale: NNN_verify.sql (stesso NNN della migrazione).
-- Deve restituire una riga con colonna esito = PASS|FAIL, più conteggi leggibili.
-- Obbligatori: righe prima/dopo (o equivalente), 0 orfani, 0 NULL attesi, FK intatte.

SET NOCOUNT ON;

DECLARE @righe_prima INT = 0; -- compilare dal backup / query pre-migrazione annotata in PR
DECLARE @righe_dopo INT = 0;
DECLARE @orfani INT = 0;
DECLARE @null_attesi INT = 0;
DECLARE @fk_rotte INT = 0;

IF OBJECT_ID('dbo.esempio_tabella', 'U') IS NOT NULL
BEGIN
  SELECT @righe_dopo = COUNT(*) FROM dbo.esempio_tabella;

  -- Orfani: figli senza padre (adatta le tabelle reali)
  -- SELECT @orfani = COUNT(*)
  -- FROM dbo.esempio_figlio f
  -- LEFT JOIN dbo.esempio_tabella p ON p.id = f.parent_id
  -- WHERE p.id IS NULL;

  -- NULL non ammessi dopo backfill
  SELECT @null_attesi = COUNT(*)
  FROM dbo.esempio_tabella
  WHERE vecchio_campo IS NOT NULL
    AND nuovo_campo IS NULL;

  SELECT @fk_rotte = COUNT(*)
  FROM sys.foreign_keys
  WHERE is_not_trusted = 1
    AND parent_object_id = OBJECT_ID('dbo.esempio_tabella');
END

SELECT
  CASE
    WHEN OBJECT_ID('dbo.esempio_tabella', 'U') IS NULL THEN 'FAIL'
    WHEN @orfani = 0 AND @null_attesi = 0 AND @fk_rotte = 0 THEN 'PASS'
    ELSE 'FAIL'
  END AS esito,
  @righe_prima AS righe_prima,
  @righe_dopo AS righe_dopo,
  @orfani AS orfani,
  @null_attesi AS null_attesi,
  @fk_rotte AS fk_rotte,
  N'Sostituire esempio_tabella / colonne con quelle della migrazione reale' AS nota;
