-- ============================================================================
-- Migration 112: management_reviews.input_monitoring
-- Input §9.3.2 c)5 — risultati di monitoraggio e misurazione
-- ============================================================================
-- Additiva, idempotente, nullable. Nessun USE (runner solo-TEST #742).
-- DDL ricostruito da backend/scripts/run-migration-112-local.js e
-- run-migration-112-vps.js (stessa ALTER). Già applicata su TEST 2026-10-07.
-- ============================================================================

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('management_reviews') AND name = 'input_monitoring'
)
BEGIN
    ALTER TABLE management_reviews ADD input_monitoring NVARCHAR(MAX) NULL;
    PRINT 'input_monitoring aggiunto';
END
ELSE
    PRINT 'input_monitoring gia esistente — skip';
