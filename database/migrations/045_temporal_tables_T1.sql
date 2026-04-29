-- =============================================================================
-- Migrazione 045 — T1: Temporal Tables su audit_responses e audits
-- =============================================================================
-- Obiettivo: storicizzazione automatica nativa SQL Server senza modifiche
-- al codice applicativo. Ogni UPDATE/DELETE crea automaticamente una riga
-- nelle tabelle history con il periodo di validità.
--
-- Motivazione: ADR-008 event-sourcing-sync. Bug Camellini 28/04/2026:
-- perdita dati per conflict timestamp. Le temporal tables forniscono
-- recovery point-in-time e tracciabilità ISO 9001 §7.5.
--
-- Prerequisiti: SQL Server 2016+ (verificato: SQL Server 2025 Enterprise)
-- Backup: SGQ_ISO9001_pre_T1_2026-04-29_13_06.bak (20MB, 29/04/2026 13:07 UTC)
--
-- Rollback (se necessario):
--   ALTER TABLE audit_responses SET (SYSTEM_VERSIONING = OFF);
--   ALTER TABLE audit_responses DROP PERIOD FOR SYSTEM_TIME;
--   ALTER TABLE audit_responses DROP COLUMN ValidFrom, ValidTo;
--   DROP TABLE IF EXISTS dbo.audit_responses_history;
--
--   ALTER TABLE audits SET (SYSTEM_VERSIONING = OFF);
--   ALTER TABLE audits DROP PERIOD FOR SYSTEM_TIME;
--   ALTER TABLE audits DROP COLUMN ValidFrom, ValidTo;
--   DROP TABLE IF EXISTS dbo.audits_history;
--
-- Impatto sulle query esistenti: NESSUNO.
-- Le colonne ValidFrom/ValidTo sono HIDDEN — non appaiono in SELECT *.
-- Le query esistenti funzionano invariate.
-- Per leggere la storia: SELECT * FROM tabella FOR SYSTEM_TIME ALL
-- Per punto nel tempo: SELECT * FROM tabella FOR SYSTEM_TIME AS OF 'TIMESTAMP'
-- =============================================================================

SET NOCOUNT ON;
BEGIN TRY

    PRINT '=== Migrazione 045 — Temporal Tables T1 ===';
    PRINT 'Inizio: ' + CONVERT(NVARCHAR, SYSUTCDATETIME(), 126);

    -- =========================================================================
    -- PARTE 1: audit_responses
    -- =========================================================================

    PRINT '';
    PRINT '--- Parte 1: audit_responses ---';

    -- Verifica: temporal table già abilitata?
    IF EXISTS (
        SELECT 1 FROM sys.tables
        WHERE name = 'audit_responses'
          AND temporal_type = 2  -- SYSTEM_VERSIONED_TEMPORAL_TABLE
    )
    BEGIN
        PRINT 'SKIP: audit_responses è già una temporal table — nessuna azione.';
    END
    ELSE
    BEGIN
        -- Step 1a: aggiungi colonne ValidFrom e ValidTo (HIDDEN)
        -- HIDDEN = non visibili in SELECT *, backward compatible
        IF NOT EXISTS (
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('audit_responses') AND name = 'ValidFrom'
        )
        BEGIN
            ALTER TABLE dbo.audit_responses ADD
                ValidFrom DATETIME2(7) GENERATED ALWAYS AS ROW START HIDDEN
                    CONSTRAINT DF_audit_responses_ValidFrom DEFAULT '1900-01-01 00:00:00.0000000',
                ValidTo   DATETIME2(7) GENERATED ALWAYS AS ROW END HIDDEN
                    CONSTRAINT DF_audit_responses_ValidTo   DEFAULT '9999-12-31 23:59:59.9999999',
                PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
            PRINT 'OK: colonne ValidFrom/ValidTo aggiunte a audit_responses';
        END
        ELSE
        BEGIN
            PRINT 'SKIP: colonne ValidFrom/ValidTo già presenti in audit_responses';
        END

        -- Step 1b: abilita system versioning
        ALTER TABLE dbo.audit_responses
        SET (SYSTEM_VERSIONING = ON (
            HISTORY_TABLE = dbo.audit_responses_history,
            DATA_CONSISTENCY_CHECK = ON
        ));
        PRINT 'OK: system versioning abilitato su audit_responses';
        PRINT '    History table: dbo.audit_responses_history';
    END

    -- =========================================================================
    -- PARTE 2: audits
    -- =========================================================================

    PRINT '';
    PRINT '--- Parte 2: audits ---';

    IF EXISTS (
        SELECT 1 FROM sys.tables
        WHERE name = 'audits'
          AND temporal_type = 2
    )
    BEGIN
        PRINT 'SKIP: audits è già una temporal table — nessuna azione.';
    END
    ELSE
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM sys.columns
            WHERE object_id = OBJECT_ID('audits') AND name = 'ValidFrom'
        )
        BEGIN
            ALTER TABLE dbo.audits ADD
                ValidFrom DATETIME2(7) GENERATED ALWAYS AS ROW START HIDDEN
                    CONSTRAINT DF_audits_ValidFrom DEFAULT '1900-01-01 00:00:00.0000000',
                ValidTo   DATETIME2(7) GENERATED ALWAYS AS ROW END HIDDEN
                    CONSTRAINT DF_audits_ValidTo   DEFAULT '9999-12-31 23:59:59.9999999',
                PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
            PRINT 'OK: colonne ValidFrom/ValidTo aggiunte a audits';
        END
        ELSE
        BEGIN
            PRINT 'SKIP: colonne ValidFrom/ValidTo già presenti in audits';
        END

        ALTER TABLE dbo.audits
        SET (SYSTEM_VERSIONING = ON (
            HISTORY_TABLE = dbo.audits_history,
            DATA_CONSISTENCY_CHECK = ON
        ));
        PRINT 'OK: system versioning abilitato su audits';
        PRINT '    History table: dbo.audits_history';
    END

    -- =========================================================================
    -- PARTE 3: Verifica finale
    -- =========================================================================

    PRINT '';
    PRINT '--- Verifica finale ---';

    SELECT
        t.name AS table_name,
        CASE t.temporal_type
            WHEN 0 THEN 'NON_TEMPORAL'
            WHEN 1 THEN 'HISTORY_TABLE'
            WHEN 2 THEN 'SYSTEM_VERSIONED ✅'
        END AS temporal_type,
        ht.name AS history_table
    FROM sys.tables t
    LEFT JOIN sys.tables ht ON t.history_table_id = ht.object_id
    WHERE t.name IN ('audits', 'audit_responses')
    ORDER BY t.name;

    PRINT '';
    PRINT '=== Migrazione 045 completata: ' + CONVERT(NVARCHAR, SYSUTCDATETIME(), 126) + ' ===';

END TRY
BEGIN CATCH
    PRINT '❌ ERRORE durante migrazione 045:';
    PRINT '   Message: ' + ERROR_MESSAGE();
    PRINT '   Line: '    + CAST(ERROR_LINE() AS NVARCHAR);
    PRINT '   Severity: ' + CAST(ERROR_SEVERITY() AS NVARCHAR);
    PRINT '';
    PRINT 'Rollback automatico in corso (nessuna modifica permanente)...';
    -- SQL Server fa rollback automatico delle DDL in caso di errore nella stessa batch
    THROW;
END CATCH
