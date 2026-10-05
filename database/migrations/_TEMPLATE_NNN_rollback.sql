-- Companion di rollback per una migrazione transform/destructive.
-- Nome reale: NNN_rollback.sql (stesso NNN della migrazione).
-- Ripristina i dati/schema quanto basta per tornare allo stato precedente.
-- NON droppare qui le colonne nuove se la produzione le sta già usando:
-- preferire azzerare il backfill e lasciare la colonna (cleanup in slice dedicata).

SET NOCOUNT ON;

-- Esempio: annulla il backfill (la colonna nuova resta, la vecchia era già lì).
IF COL_LENGTH('dbo.esempio_tabella', 'nuovo_campo') IS NOT NULL
BEGIN
  UPDATE dbo.esempio_tabella
  SET nuovo_campo = NULL
  WHERE nuovo_campo IS NOT NULL;
END
GO

PRINT 'Rollback template: backfill annullato. Verificare i conteggi prima di riprovare.';
