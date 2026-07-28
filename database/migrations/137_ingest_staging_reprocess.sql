-- Migration 137: supporto "rielaborazione" (backfill) su ingest_staging
-- Richiesta committente 28/07/2026: quando aggiungiamo un campo nuovo
-- all'estrazione AI (es. transfer_mode su qualifiche saldatore), i documenti
-- gia' ingestiti prima dell'aggiunta possono essere rielaborati dal PDF
-- originale (gia' conservato in uploads/) SENZA richiedere un nuovo upload.
--
-- Una riga di ingest_staging con target_qualification_id valorizzato non è una
-- NUOVA proposta di qualifica (INSERT), ma una proposta di AGGIORNAMENTO di un
-- record esistente limitata ai campi in field_scope — vedi
-- backend/src/services/ingestStaging.service.js (confirmStaging: branch
-- "modalita' rielaborazione") e backend/scripts/reprocess-qualifications.js.
--
-- Idempotente: verifica esistenza colonne prima di ALTER.

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ingest_staging') AND name = 'target_qualification_id')
BEGIN
    ALTER TABLE ingest_staging ADD target_qualification_id INT NULL;
    PRINT 'Colonna target_qualification_id aggiunta a ingest_staging.';
END
ELSE
BEGIN
    PRINT 'Colonna target_qualification_id gia'' presente, nessuna azione.';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('ingest_staging') AND name = 'field_scope')
BEGIN
    ALTER TABLE ingest_staging ADD field_scope NVARCHAR(200) NULL;
    PRINT 'Colonna field_scope aggiunta a ingest_staging.';
END
ELSE
BEGIN
    PRINT 'Colonna field_scope gia'' presente, nessuna azione.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ingest_staging_target_qualification'
)
BEGIN
    ALTER TABLE ingest_staging
        ADD CONSTRAINT FK_ingest_staging_target_qualification
        FOREIGN KEY (target_qualification_id) REFERENCES qualifications(id) ON DELETE SET NULL;
    PRINT 'FK FK_ingest_staging_target_qualification aggiunta.';
END
ELSE
BEGIN
    PRINT 'FK FK_ingest_staging_target_qualification gia'' presente, nessuna azione.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ingest_staging_target_qual' AND object_id = OBJECT_ID('ingest_staging')
)
BEGIN
    CREATE INDEX IX_ingest_staging_target_qual
        ON ingest_staging (target_qualification_id, field_scope, review_status)
        WHERE target_qualification_id IS NOT NULL;
    PRINT 'Indice IX_ingest_staging_target_qual creato.';
END
ELSE
BEGIN
    PRINT 'Indice IX_ingest_staging_target_qual gia'' presente, nessuna azione.';
END

PRINT 'Migration 137 completata.';

-- VERIFICA FINALE
SELECT COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ingest_staging' AND COLUMN_NAME IN ('target_qualification_id', 'field_scope');
