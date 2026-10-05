-- TYPE: transform
-- BACKFILL: SQL
-- VERIFY: NNN_verify.sql
-- ROLLBACK: NNN_rollback.sql
--
-- Template NUOVA migrazione transform/destructive (>= 169).
-- Copiare come NNN_descrizione.sql + NNN_verify.sql + NNN_rollback.sql.
-- Convenzione: le colonne VECCHIE restano fino a una migrazione di cleanup successiva.
-- BACKFILL ammessi: none | SQL | Rielaborazioni
--   - SQL = UPDATE/INSERT in questo file
--   - Rielaborazioni = voce in Fatturazione → Rielaborazioni (PDF già in /uploads)

-- 1) Nuova colonna (nullable) — la vecchia non si tocca.
IF COL_LENGTH('dbo.esempio_tabella', 'nuovo_campo') IS NULL
BEGIN
  ALTER TABLE dbo.esempio_tabella ADD nuovo_campo NVARCHAR(100) NULL;
END
GO

-- 2) Backfill SQL: copia i valori, non cancellare la fonte.
UPDATE dbo.esempio_tabella
SET nuovo_campo = LTRIM(RTRIM(vecchio_campo))
WHERE nuovo_campo IS NULL
  AND vecchio_campo IS NOT NULL;
GO
