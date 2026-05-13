-- =============================================================================
-- Migrazione 048 � Temporal Table su audit_custom_checklist_responses
-- =============================================================================
-- Motivazione: parit� con migration 045 (audit_responses + audits).
-- ADR-008: ogni entit� audit deve avere storicizzazione automatica.
-- Prerequisiti: SQL Server 2016+ (verificato: SQL Server 2025 Enterprise)
--
-- Rollback:
--   ALTER TABLE audit_custom_checklist_responses SET (SYSTEM_VERSIONING = OFF);
--   ALTER TABLE audit_custom_checklist_responses DROP PERIOD FOR SYSTEM_TIME;
--   ALTER TABLE audit_custom_checklist_responses DROP COLUMN ValidFrom;
--   ALTER TABLE audit_custom_checklist_responses DROP COLUMN ValidTo;
--   DROP TABLE IF EXISTS dbo.audit_custom_checklist_responses_history;
-- =============================================================================

PRINT '=== Migration 048: Temporal Table audit_custom_checklist_responses ===';

-- 1. Se temporal table gi� attiva: disabilita, rimuovi period e colonne (idempotente)
IF EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'audit_custom_checklist_responses'
      AND temporal_type = 2  -- SYSTEM_VERSIONED
)
BEGIN
    ALTER TABLE [dbo].[audit_custom_checklist_responses]
        SET (SYSTEM_VERSIONING = OFF);
    ALTER TABLE [dbo].[audit_custom_checklist_responses]
        DROP PERIOD FOR SYSTEM_TIME;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.audit_custom_checklist_responses') AND name = 'ValidFrom')
        ALTER TABLE [dbo].[audit_custom_checklist_responses] DROP COLUMN ValidFrom;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.audit_custom_checklist_responses') AND name = 'ValidTo')
        ALTER TABLE [dbo].[audit_custom_checklist_responses] DROP COLUMN ValidTo;
    DROP TABLE IF EXISTS [dbo].[audit_custom_checklist_responses_history];
    PRINT '[RESET] Temporal table rimossa per riapplicazione';
END

-- 2. Aggiungi colonne ValidFrom/ValidTo HIDDEN
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.audit_custom_checklist_responses')
      AND name = 'ValidFrom'
)
BEGIN
    ALTER TABLE [dbo].[audit_custom_checklist_responses]
        ADD ValidFrom DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN
                CONSTRAINT DF_cust_resp_ValidFrom DEFAULT '2000-01-01 00:00:00',
            ValidTo   DATETIME2 GENERATED ALWAYS AS ROW END   HIDDEN
                CONSTRAINT DF_cust_resp_ValidTo   DEFAULT '9999-12-31 23:59:59.9999999',
            PERIOD FOR SYSTEM_TIME (ValidFrom, ValidTo);
    PRINT '[OK] Colonne ValidFrom/ValidTo aggiunte';
END
ELSE
    PRINT '[SKIP] Colonne ValidFrom/ValidTo gi� presenti';

-- 3. Crea history table e abilita system versioning
IF NOT EXISTS (
    SELECT 1 FROM sys.tables
    WHERE name = 'audit_custom_checklist_responses_history'
)
BEGIN
    ALTER TABLE [dbo].[audit_custom_checklist_responses]
        SET (SYSTEM_VERSIONING = ON (
            HISTORY_TABLE = dbo.audit_custom_checklist_responses_history,
            DATA_CONSISTENCY_CHECK = ON
        ));
    PRINT '[OK] System versioning abilitato';
    PRINT '[OK] History table: dbo.audit_custom_checklist_responses_history';
END
ELSE
    PRINT '[SKIP] History table gi� presente';

-- 4. Verifica finale
PRINT '';
PRINT '=== Stato temporal tables post-migration 048 ===';
SELECT
    t.name                AS tabella,
    t.temporal_type_desc  AS tipo,
    h.name                AS history_table
FROM sys.tables t
LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
WHERE t.name IN (
    'audits',
    'audit_responses',
    'audit_custom_checklist_responses'
)
ORDER BY t.name;

PRINT '=== Migration 048 completata ===';
