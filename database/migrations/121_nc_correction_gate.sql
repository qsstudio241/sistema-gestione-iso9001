-- =============================================================================
-- Migration 121 — Correzione obbligatoria + Valutazione azione correttiva
-- ISO 9001:2015 §10.2.1 a) correzione (obbligatoria) / b) valutazione AC
-- =============================================================================

-- 1. Campo "corrective_action_needed" (Sì/No) per documentare §10.2.1 b)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'corrective_action_needed'
)
BEGIN
    ALTER TABLE non_conformities ADD corrective_action_needed NVARCHAR(10) NULL;
    PRINT 'Colonna corrective_action_needed aggiunta a non_conformities';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_nc_corrective_action_needed')
BEGIN
    ALTER TABLE non_conformities
    ADD CONSTRAINT CK_nc_corrective_action_needed
        CHECK (corrective_action_needed IN ('yes', 'no'));
    PRINT 'CK_nc_corrective_action_needed aggiunto';
END
GO

-- 2. Note motivazione per la valutazione §10.2.1 b)
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'corrective_action_evaluation_notes'
)
BEGIN
    ALTER TABLE non_conformities ADD corrective_action_evaluation_notes NVARCHAR(MAX) NULL;
    PRINT 'Colonna corrective_action_evaluation_notes aggiunta a non_conformities';
END
GO

PRINT '=== Migration 121 completata ===';
GO
