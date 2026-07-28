-- =============================================================================
-- Migration 135 — Note verifica efficacia azione correttiva (ISO 9001 §10.2.1 e)
-- Il drawer NC segue ora la sequenza operativa ISO: trattamento → verifica
-- attuazione del trattamento → valutazione azione correttiva → cause → azioni →
-- verifica efficacia. `verification_notes` resta la verifica di attuazione del
-- trattamento; serve un campo distinto per il riesame di efficacia dell'azione
-- correttiva, altrimenti i due esiti si sovrascrivono a vicenda.
-- Idempotente.
-- =============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT 'Migration 135: NC effectiveness_verification_notes';
PRINT '';

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'effectiveness_verification_notes'
)
BEGIN
    ALTER TABLE dbo.non_conformities ADD effectiveness_verification_notes NVARCHAR(MAX) NULL;
    PRINT '  Colonna effectiveness_verification_notes aggiunta a non_conformities';
END
ELSE
BEGIN
    PRINT '  Colonna effectiveness_verification_notes gia presente — skip';
END
GO

PRINT 'Migration 135 completata.';
GO
