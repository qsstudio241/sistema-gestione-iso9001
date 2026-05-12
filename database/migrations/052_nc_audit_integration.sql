-- Migration 052: integrazione modulo NC con audit (push automatico)
-- ADR-009 / Sessione 10-05-2026
--
-- Obiettivo:
-- - Tracciare l'origine di una NC: rilievo NC in audit, OSS escalation, manuale
-- - Collegare bidirezionalmente pending_issues <-> non_conformities
-- - Permettere: audit chiuso con licenza NC = push automatico NC/OSS al registro
--   Senza licenza NC: solo pending_issues (legacy, gia funzionante)
-- - Al re-audit, se nc_id presente: stato letto dal modulo NC (in_progress / resolved / verified)
--
-- SAFE: tutte le ALTER sono idempotenti (IF NOT EXISTS).

USE SGQ_ISO9001;
GO

-- ============================================================
-- 1. non_conformities: source_type + source_pending_issue_id + source_question_id
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_type'
)
BEGIN
    ALTER TABLE [dbo].[non_conformities]
    ADD [source_type] NVARCHAR(20) NULL
        CONSTRAINT [CK_nc_source_type] CHECK ([source_type] IN ('audit_nc', 'audit_oss', 'manual', 'reaudit_persists'));
    PRINT 'Colonna non_conformities.source_type aggiunta';
END
ELSE
BEGIN
    PRINT 'Colonna non_conformities.source_type gia presente - skip';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_pending_issue_id'
)
BEGIN
    ALTER TABLE [dbo].[non_conformities]
    ADD [source_pending_issue_id] INT NULL;
    PRINT 'Colonna non_conformities.source_pending_issue_id aggiunta';
END
ELSE
BEGIN
    PRINT 'Colonna non_conformities.source_pending_issue_id gia presente - skip';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_question_id'
)
BEGIN
    ALTER TABLE [dbo].[non_conformities]
    ADD [source_question_id] INT NULL;
    PRINT 'Colonna non_conformities.source_question_id aggiunta';
END
ELSE
BEGIN
    PRINT 'Colonna non_conformities.source_question_id gia presente - skip';
END
GO

-- ============================================================
-- 2. pending_issues: nc_id (link bidirezionale)
-- ============================================================

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'pending_issues' AND COLUMN_NAME = 'nc_id'
)
BEGIN
    ALTER TABLE [dbo].[pending_issues]
    ADD [nc_id] INT NULL;
    PRINT 'Colonna pending_issues.nc_id aggiunta';
END
ELSE
BEGIN
    PRINT 'Colonna pending_issues.nc_id gia presente - skip';
END
GO

-- ============================================================
-- 3. Foreign Key non_conformities.source_pending_issue_id -> pending_issues
-- ============================================================
-- NO CASCADE: cancellare pending non deve cancellare la NC (record storico)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_pending')
BEGIN
    ALTER TABLE [dbo].[non_conformities]
    ADD CONSTRAINT [FK_nc_source_pending]
    FOREIGN KEY ([source_pending_issue_id]) REFERENCES [dbo].[pending_issues]([issue_id])
    ON DELETE NO ACTION;
    PRINT 'FK FK_nc_source_pending aggiunta';
END
ELSE
BEGIN
    PRINT 'FK FK_nc_source_pending gia presente - skip';
END
GO

-- ============================================================
-- 4. Foreign Key non_conformities.source_question_id -> checklist_questions
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_source_question')
BEGIN
    ALTER TABLE [dbo].[non_conformities]
    ADD CONSTRAINT [FK_nc_source_question]
    FOREIGN KEY ([source_question_id]) REFERENCES [dbo].[checklist_questions]([question_id])
    ON DELETE NO ACTION;
    PRINT 'FK FK_nc_source_question aggiunta';
END
ELSE
BEGIN
    PRINT 'FK FK_nc_source_question gia presente - skip';
END
GO

-- ============================================================
-- 5. Foreign Key pending_issues.nc_id -> non_conformities
-- ============================================================
-- ON DELETE SET NULL: se la NC viene eliminata dal modulo, il pending resta orfano (riprende come testo)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_pending_issues_nc')
BEGIN
    ALTER TABLE [dbo].[pending_issues]
    ADD CONSTRAINT [FK_pending_issues_nc]
    FOREIGN KEY ([nc_id]) REFERENCES [dbo].[non_conformities]([nc_id])
    ON DELETE NO ACTION;
    PRINT 'FK FK_pending_issues_nc aggiunta (NO ACTION, evita cascade cycle)';
END
ELSE
BEGIN
    PRINT 'FK FK_pending_issues_nc gia presente - skip';
END
GO

-- ============================================================
-- 6. Indici per query frequenti
-- ============================================================
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_source_pending')
BEGIN
    CREATE INDEX [IX_nc_source_pending]
    ON [dbo].[non_conformities] ([source_pending_issue_id])
    WHERE [source_pending_issue_id] IS NOT NULL;
    PRINT 'Indice IX_nc_source_pending creato';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_pending_issues_nc')
BEGIN
    CREATE INDEX [IX_pending_issues_nc]
    ON [dbo].[pending_issues] ([nc_id])
    WHERE [nc_id] IS NOT NULL;
    PRINT 'Indice IX_pending_issues_nc creato';
END
GO

-- ============================================================
-- 7. Indice composito su (audit_id, source_question_id) per dedup push
-- ============================================================
-- Garantisce idempotenza: stesso audit + stessa domanda -> al massimo 1 NC pushed
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_nc_audit_question_unique')
BEGIN
    CREATE UNIQUE INDEX [IX_nc_audit_question_unique]
    ON [dbo].[non_conformities] ([audit_id], [source_question_id])
    WHERE [source_question_id] IS NOT NULL;
    PRINT 'Indice univoco IX_nc_audit_question_unique creato (idempotenza push)';
END
GO

-- ============================================================
-- VERIFICA FINALE
-- ============================================================
SELECT TOP 5 'non_conformities' AS tabella, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME IN ('source_type', 'source_pending_issue_id', 'source_question_id')
ORDER BY COLUMN_NAME;

SELECT 'pending_issues' AS tabella, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'pending_issues' AND COLUMN_NAME = 'nc_id';
GO

PRINT '';
PRINT '=== Migration 052 completata ===';
