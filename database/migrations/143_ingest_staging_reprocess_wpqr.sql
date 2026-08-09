-- Migration 143: supporto "rielaborazione" (backfill) su ingest_staging per WPQR
-- Richiesta committente 08/08/2026: generalizza il meccanismo di
-- rielaborazione (migrazione 137, prima solo per `qualifications`) alla
-- tabella `wpqr_records` — i 7 WPQR già in produzione ingerite prima dei fix
-- 07-08/08/2026 (preheat_temp, interpass_temp, throat_test_mm, product_type,
-- rotated_position, thickness_max_unlimited) possono ora essere recuperate
-- dal PDF originale già conservato, senza richiedere un nuovo upload.
--
-- Stesso pattern esatto di target_qualification_id (migrazione 137): una
-- colonna dedicata (non una FK polimorfica) per restare coerenti con
-- l'implementazione esistente — vedi backend/src/services/ingestStaging.service.js
-- e backend/src/data/reprocessTableAdapters.js.
--
-- Idempotente: verifica esistenza colonne prima di ALTER.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ingest_staging') AND name = 'target_wpqr_id')
BEGIN
    ALTER TABLE ingest_staging ADD target_wpqr_id INT NULL;
    PRINT 'Colonna target_wpqr_id aggiunta a ingest_staging.';
END
ELSE
BEGIN
    PRINT 'Colonna target_wpqr_id gia'' presente, nessuna azione.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ingest_staging_target_wpqr'
)
BEGIN
    ALTER TABLE ingest_staging
        ADD CONSTRAINT FK_ingest_staging_target_wpqr
        FOREIGN KEY (target_wpqr_id) REFERENCES wpqr_records(id) ON DELETE SET NULL;
    PRINT 'FK FK_ingest_staging_target_wpqr aggiunta.';
END
ELSE
BEGIN
    PRINT 'FK FK_ingest_staging_target_wpqr gia'' presente, nessuna azione.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ingest_staging_target_wpqr' AND object_id = OBJECT_ID('ingest_staging')
)
BEGIN
    CREATE INDEX IX_ingest_staging_target_wpqr
        ON ingest_staging (target_wpqr_id, field_scope, review_status)
        WHERE target_wpqr_id IS NOT NULL;
    PRINT 'Indice IX_ingest_staging_target_wpqr creato.';
END
ELSE
BEGIN
    PRINT 'Indice IX_ingest_staging_target_wpqr gia'' presente, nessuna azione.';
END

PRINT 'Migration 143 completata.';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ingest_staging' AND COLUMN_NAME = 'target_wpqr_id';
