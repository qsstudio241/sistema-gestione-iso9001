-- Migration 049: aggiunge colonna promoted_local_nc_id a non_conformities
-- Traccia l'UUID React locale della NC da cui ha origine la promozione (S-A6).
-- Usata per idempotenza: se la stessa NC locale viene promossa due volte,
-- il backend restituisce quella già esistente senza duplicare.

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'promoted_local_nc_id'
)
BEGIN
    ALTER TABLE non_conformities
    ADD promoted_local_nc_id NVARCHAR(36) NULL;
    PRINT 'Colonna promoted_local_nc_id aggiunta a non_conformities';
END
ELSE
BEGIN
    PRINT 'Colonna promoted_local_nc_id già presente — skip';
END
GO
