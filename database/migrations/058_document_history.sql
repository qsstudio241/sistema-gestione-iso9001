-- ============================================================================
-- Migration 058: Audit Trail documenti (document_history)
-- ============================================================================
-- Traccia ogni modifica ai record di document_registry per compliance
-- ISO 9001:2015 §7.5 (informazioni documentate).
-- Puramente additiva, idempotente.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 058: Document History (Audit Trail)';
PRINT '================================================================================';
PRINT '';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_history' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.document_history (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        document_id     INT            NOT NULL,
        changed_by      INT            NULL,
        change_type     NVARCHAR(50)   NOT NULL
            CONSTRAINT CK_doc_history_type CHECK (change_type IN (
                'created','updated','status_changed','moved',
                'tagged','untagged','related','unrelated'
            )),
        field_changed   NVARCHAR(100)  NULL,
        old_value       NVARCHAR(MAX)  NULL,
        new_value       NVARCHAR(MAX)  NULL,
        changed_at      DATETIME2      NOT NULL DEFAULT GETDATE()
    );
    PRINT '  Tabella document_history creata';
END
ELSE
    PRINT '  Tabella document_history gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_history_document')
BEGIN
    ALTER TABLE dbo.document_history
    ADD CONSTRAINT FK_doc_history_document
        FOREIGN KEY (document_id) REFERENCES dbo.document_registry(id);
    PRINT '  FK document_history -> document_registry creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_history_user')
BEGIN
    ALTER TABLE dbo.document_history
    ADD CONSTRAINT FK_doc_history_user
        FOREIGN KEY (changed_by) REFERENCES dbo.users(user_id);
    PRINT '  FK document_history -> users creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_history_doc_date' AND object_id = OBJECT_ID('document_history'))
BEGIN
    CREATE INDEX IX_doc_history_doc_date ON dbo.document_history(document_id, changed_at DESC);
    PRINT '  Indice IX_doc_history_doc_date creato';
END
GO

PRINT '';
PRINT 'Migration 058 completata.';
GO
