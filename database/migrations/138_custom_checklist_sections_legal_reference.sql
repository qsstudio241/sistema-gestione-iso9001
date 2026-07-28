-- =============================================================================
-- Migration 138 — Riferimenti legislativi su sezioni checklist custom (ADR-019 D2)
-- Aggiunge reference_text (testo narrativo) e linked_legislation (stringa parsabile
-- per agente validità normativa) su custom_checklist_sections.
-- Nessuna nuova tabella. Idempotente.
-- Rinumerata da 135 a 138 in fase di merge con main (collisione: main aveva già
-- occupato 135-137 con migrazioni NC/qualifiche/ingest nel frattempo).
-- =============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT 'Migration 138: custom_checklist_sections reference_text + linked_legislation';
PRINT '';

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'reference_text'
)
BEGIN
    ALTER TABLE dbo.custom_checklist_sections ADD reference_text NVARCHAR(MAX) NULL;
    PRINT '  Colonna reference_text aggiunta';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'custom_checklist_sections' AND COLUMN_NAME = 'linked_legislation'
)
BEGIN
    ALTER TABLE dbo.custom_checklist_sections ADD linked_legislation NVARCHAR(MAX) NULL;
    PRINT '  Colonna linked_legislation aggiunta';
END
GO

PRINT 'Migration 138 completata.';
GO
