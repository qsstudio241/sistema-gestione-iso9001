-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, nessuna riorganizzazione dati)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Template NUOVA migrazione additiva (>= 169).
-- Copiare come NNN_descrizione.sql (prossimo numero libero su origin/main).
-- Idempotente: controllare esistenza colonna/tabella prima di CREATE/ALTER.
-- Non droppare colonne vecchie in questa slice.

-- Esempio: nuova colonna nullable (non rompe i record esistenti).
IF COL_LENGTH('dbo.esempio_tabella', 'nuova_colonna') IS NULL
BEGIN
  ALTER TABLE dbo.esempio_tabella ADD nuova_colonna NVARCHAR(100) NULL;
END
GO
