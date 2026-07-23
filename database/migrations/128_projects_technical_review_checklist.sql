-- ============================================================
-- Migration 128: Checklist strutturata "Riesame tecnico" §5.3 ISO 3834-3
-- Data: 2026-07-23
-- Additiva, nullable, basso rischio (nessuna riscrittura righe esistenti).
-- ============================================================

IF EXISTS (SELECT 1 FROM sys.objects WHERE name = 'projects' AND type = 'U')
   AND NOT EXISTS (
       SELECT 1 FROM sys.columns
       WHERE object_id = OBJECT_ID('projects') AND name = 'technical_review_checklist'
   )
BEGIN
    ALTER TABLE projects ADD technical_review_checklist NVARCHAR(MAX) NULL;
    PRINT 'Colonna projects.technical_review_checklist aggiunta.';
END
ELSE
    PRINT 'Colonna projects.technical_review_checklist gia presente.';

PRINT 'Migration 128 completata.';
