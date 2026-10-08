-- ============================================================================
-- Migration 113: non_conformities.management_review_id + FK + indice filtrato
-- Collegamento NC al Riesame di Direzione (§9.3.3 → Piano Azioni)
-- ============================================================================
-- Additiva, idempotente. Statement separati (colonna, FK, indice).
-- Nessun USE (runner solo-TEST #742). Nessun ON DELETE (i riesami sono soft-deleted).
-- FK WITH NOCHECK: su TEST/PROD resta not_trusted (piano §0b).
-- DDL ricostruito da backend/scripts/run-migration-113-local.js e
-- run-migration-113-vps.js (stessi guard). Già applicata su TEST 2026-10-07.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('non_conformities') AND name = 'management_review_id'
)
BEGIN
    ALTER TABLE non_conformities ADD management_review_id INT NULL;
    PRINT 'management_review_id aggiunto';
END
ELSE
    PRINT 'management_review_id gia presente — skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_management_review')
BEGIN
    ALTER TABLE non_conformities WITH NOCHECK
        ADD CONSTRAINT FK_nc_management_review
            FOREIGN KEY (management_review_id) REFERENCES management_reviews(id);
    PRINT 'FK_nc_management_review aggiunto';
END
ELSE
    PRINT 'FK_nc_management_review gia presente — skip';
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_nc_management_review' AND object_id = OBJECT_ID('non_conformities')
)
BEGIN
    CREATE INDEX IX_nc_management_review ON non_conformities(management_review_id)
        WHERE management_review_id IS NOT NULL;
    PRINT 'IX_nc_management_review creato';
END
ELSE
    PRINT 'IX_nc_management_review gia presente — skip';
