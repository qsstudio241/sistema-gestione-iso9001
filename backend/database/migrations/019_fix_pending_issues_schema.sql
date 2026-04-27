/**
 * Migration 019 - Fix pending_issues schema
 *
 * Allinea lo schema della tabella pending_issues (creata in 018)
 * con le query effettive del controller e il flusso applicativo:
 *
 * 1. target_audit_id ? nullable (popola lazily al primo GET /pending-issues del re-audit)
 * 2. Aggiunge 'in_progress' al CHECK constraint di status
 * 3. Aggiunge colonna follow_up_notes (alias funzionale di resolution_notes per il controller)
 *
 * SAFE TO RUN MULTIPLE TIMES
 */

USE SGQ_ISO9001;
GO

-- ============================================================
-- 1. Rendi target_audit_id nullable (era NOT NULL)
-- ============================================================
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.pending_issues')
      AND name = 'target_audit_id'
      AND is_nullable = 0
)
BEGIN
    -- Elimina la FK prima di alterare la colonna
    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pending_issues_target_audit')
    BEGIN
        ALTER TABLE [dbo].[pending_issues]
        DROP CONSTRAINT [FK_pending_issues_target_audit];
        PRINT '? FK_pending_issues_target_audit eliminata per alter colonna';
    END

    ALTER TABLE [dbo].[pending_issues]
    ALTER COLUMN [target_audit_id] INT NULL;
    PRINT '? target_audit_id reso nullable';

    -- Ricrea la FK senza CASCADE (non possiamo avere CASCADE su colonna nullable con altra FK CASCADE)
    ALTER TABLE [dbo].[pending_issues]
    ADD CONSTRAINT [FK_pending_issues_target_audit]
    FOREIGN KEY ([target_audit_id]) REFERENCES [dbo].[audits]([audit_id])
    ON DELETE SET NULL;
    PRINT '? FK_pending_issues_target_audit ricreata con ON DELETE SET NULL';
END
ELSE
BEGIN
    PRINT '??  target_audit_id già nullable - skip';
END
GO

-- ============================================================
-- 2. Aggiorna CHECK constraint status per includere 'in_progress'
-- ============================================================
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_pending_issues_status')
BEGIN
    ALTER TABLE [dbo].[pending_issues]
    DROP CONSTRAINT [CK_pending_issues_status];
    PRINT '? CK_pending_issues_status eliminato per ricreare';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_pending_issues_status')
BEGIN
    ALTER TABLE [dbo].[pending_issues]
    ADD CONSTRAINT [CK_pending_issues_status]
    CHECK ([status] IN ('open', 'in_progress', 'resolved', 'persists'));
    PRINT '? CK_pending_issues_status ricreato con in_progress';
END
GO

-- ============================================================
-- 3. Aggiunge follow_up_notes (alias per resolution_notes nel controller)
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.pending_issues')
      AND name = 'follow_up_notes'
)
BEGIN
    ALTER TABLE [dbo].[pending_issues]
    ADD [follow_up_notes] NVARCHAR(MAX) NULL;
    PRINT '? Colonna follow_up_notes aggiunta';
END
ELSE
BEGIN
    PRINT '??  follow_up_notes già presente - skip';
END
GO

-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'pending_issues'
ORDER BY ORDINAL_POSITION;
GO

PRINT '';
PRINT '=== Migration 019 completata ===';
