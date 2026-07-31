-- =============================================================================
-- SCRIPT CANCELLAZIONE AUDIT CON TUTTI I DATI COLLEGATI
-- Sistema Gestione ISO 9001 - SGQ_ISO9001
-- 
-- UTILIZZO:
--   1. Sostituire @AUDIT_ID con l'ID numerico dell'audit da cancellare
--      (verificabile con la query di ricerca in fondo allo script)
--   2. Eseguire prima la sezione "ANTEPRIMA" per vedere cosa verrà eliminato
--   3. Eseguire la sezione "CANCELLAZIONE" solo dopo aver verificato l'anteprima
--
-- ATTENZIONE:
--   - I file fisici allegati in /uploads/ sul server NON vengono rimossi da
--     questo script. Dopo la cancellazione, rimuoverli manualmente via SSH:
--     ls /var/www/sgq-backend/uploads/
--   - Operazione IRREVERSIBILE. Eseguire un backup prima se necessario.
-- =============================================================================

USE SGQ_ISO9001;
GO

-- ============================================================
-- PARAMETRO: sostituire con l'ID dell'audit da cancellare
-- ============================================================
DECLARE @AUDIT_ID INT = 0;   -- <-- INSERIRE QUI L'AUDIT_ID

-- ============================================================
-- SEZIONE 1: RICERCA AUDIT (eseguire per individuare l'ID)
-- ============================================================
SELECT
    audit_id,
    audit_uuid,
    audit_number,
    client_name,
    status,
    audit_date,
    created_at
FROM audits
ORDER BY audit_id DESC;

-- ============================================================
-- SEZIONE 2: ANTEPRIMA DATI CHE VERRANNO ELIMINATI
-- (eseguire prima di procedere con la cancellazione)
-- ============================================================
SELECT 'audit' AS tabella, COUNT(*) AS righe
    FROM audits WHERE audit_id = @AUDIT_ID
UNION ALL
SELECT 'audit_responses', COUNT(*)
    FROM audit_responses WHERE audit_id = @AUDIT_ID
UNION ALL
SELECT 'attachments', COUNT(*)
    FROM attachments WHERE audit_id = @AUDIT_ID
UNION ALL
SELECT 'non_conformities', COUNT(*)
    FROM non_conformities WHERE audit_id = @AUDIT_ID
UNION ALL
SELECT 'pending_issues (come target)', COUNT(*)
    FROM pending_issues WHERE target_audit_id = @AUDIT_ID
UNION ALL
SELECT 'pending_issues (come source)', COUNT(*)
    FROM pending_issues WHERE source_audit_id = @AUDIT_ID
UNION ALL
SELECT 'audit_standards', COUNT(*)
    FROM audit_standards WHERE audit_id = @AUDIT_ID
UNION ALL
SELECT 'audit_history', COUNT(*)
    FROM audit_history WHERE audit_id = @AUDIT_ID;

-- Mostra i path degli allegati fisici da rimuovere manualmente
SELECT
    attachment_id,
    file_name,
    storage_path,
    file_size,
    created_at
FROM attachments
WHERE audit_id = @AUDIT_ID
ORDER BY created_at;

-- ============================================================
-- SEZIONE 3: CANCELLAZIONE (decommentare dopo aver verificato)
-- ============================================================

/*
BEGIN TRANSACTION;

BEGIN TRY

    -- Salva info audit prima di cancellare (per log)
    DECLARE @audit_info NVARCHAR(200);
    SELECT @audit_info = CONCAT(audit_number, ' - ', client_name, ' (', status, ')')
    FROM audits WHERE audit_id = @AUDIT_ID;

    IF @audit_info IS NULL
    BEGIN
        RAISERROR('Audit con ID %d non trovato.', 16, 1, @AUDIT_ID);
        ROLLBACK TRANSACTION;
        RETURN;
    END

    PRINT 'Cancellazione audit: ' + @audit_info;

    -- 1. pending_issues dove questo audit è TARGET (il nuovo re-audit)
    DELETE FROM pending_issues WHERE target_audit_id = @AUDIT_ID;
    PRINT CONCAT('  pending_issues (target): ', @@ROWCOUNT, ' righe');

    -- 2. pending_issues dove questo audit è SOURCE (audit precedente referenziato)
    --    Opzione A: elimina i pending_issues del re-audit corrente che puntano a questo
    --    Opzione B: metti source_audit_id a NULL (se vuoi conservare i re-audit successivi)
    DELETE FROM pending_issues WHERE source_audit_id = @AUDIT_ID;
    PRINT CONCAT('  pending_issues (source): ', @@ROWCOUNT, ' righe');

    -- 3. Risposte checklist
    DELETE FROM audit_responses WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  audit_responses: ', @@ROWCOUNT, ' righe');

    -- 4. Allegati (i file fisici vanno rimossi manualmente dal FS)
    DELETE FROM attachments WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  attachments: ', @@ROWCOUNT, ' righe');

    -- 5. Non conformità
    DELETE FROM non_conformities WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  non_conformities: ', @@ROWCOUNT, ' righe');

    -- 6. Standard associati
    DELETE FROM audit_standards WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  audit_standards: ', @@ROWCOUNT, ' righe');

    -- 7. Storico audit
    DELETE FROM audit_history WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  audit_history: ', @@ROWCOUNT, ' righe');

    -- 8. Audit record principale
    DELETE FROM audits WHERE audit_id = @AUDIT_ID;
    PRINT CONCAT('  audits: ', @@ROWCOUNT, ' righe');

    COMMIT TRANSACTION;
    PRINT '=== CANCELLAZIONE COMPLETATA: ' + @audit_info + ' ===';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'ERRORE - rollback eseguito';
    PRINT ERROR_MESSAGE();
END CATCH;
*/

-- ============================================================
-- SEZIONE 4: PULIZIA FILE FISICI (comandi SSH da eseguire dopo)
-- ============================================================
-- Dopo la cancellazione DB, rimuovere i file fisici con:
--
-- Elenco file da rimuovere:
SELECT storage_path FROM attachments WHERE audit_id = @AUDIT_ID;
--
-- Poi via SSH:
--   ssh spascarella@sistemi.fr-busato.it -p 1122
--   rm /var/www/sgq-backend/<storage_path>   (per ogni file listato sopra)
--   Oppure in bulk se tutti nella stessa cartella:
--   find /var/www/sgq-backend/uploads/ -name "*" -newer <data> -delete
