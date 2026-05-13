-- ============================================================================
-- Migration 057: Albero documentale + Relazioni tra documenti
-- ============================================================================
-- Aggiunge parent_id e path_cache a document_registry per struttura ad albero.
-- Crea tabella document_relations per link tipizzati tra documenti.
-- Puramente additiva, idempotente.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 057: Albero Documentale + Relazioni';
PRINT '================================================================================';
PRINT '';

-- ??? 1. Colonne albero su document_registry ?????????????????????????????????

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'parent_id')
BEGIN
    ALTER TABLE dbo.document_registry ADD parent_id INT NULL;
    PRINT '  Colonna parent_id aggiunta a document_registry';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'path_cache')
BEGIN
    ALTER TABLE dbo.document_registry ADD path_cache NVARCHAR(500) NULL;
    PRINT '  Colonna path_cache aggiunta a document_registry';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'display_order')
BEGIN
    ALTER TABLE dbo.document_registry ADD display_order INT NULL DEFAULT 0;
    PRINT '  Colonna display_order aggiunta a document_registry';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'is_system_folder')
BEGIN
    ALTER TABLE dbo.document_registry ADD is_system_folder BIT NULL DEFAULT 0;
    PRINT '  Colonna is_system_folder aggiunta a document_registry';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('document_registry') AND name = 'folder_code')
BEGIN
    ALTER TABLE dbo.document_registry ADD folder_code NVARCHAR(10) NULL;
    PRINT '  Colonna folder_code aggiunta a document_registry';
END
GO

-- FK self-referencing per parent_id
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_registry_parent')
BEGIN
    ALTER TABLE dbo.document_registry
    ADD CONSTRAINT FK_doc_registry_parent
        FOREIGN KEY (parent_id) REFERENCES dbo.document_registry(id);
    PRINT '  FK document_registry -> self (parent_id) creata';
END
GO

-- Indici per albero
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_registry_parent' AND object_id = OBJECT_ID('document_registry'))
BEGIN
    CREATE INDEX IX_doc_registry_parent ON dbo.document_registry(parent_id, organization_id);
    PRINT '  Indice IX_doc_registry_parent creato';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_registry_path_cache' AND object_id = OBJECT_ID('document_registry'))
BEGIN
    CREATE INDEX IX_doc_registry_path_cache ON dbo.document_registry(path_cache, organization_id);
    PRINT '  Indice IX_doc_registry_path_cache creato';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_registry_folder_code' AND object_id = OBJECT_ID('document_registry'))
BEGIN
    CREATE INDEX IX_doc_registry_folder_code ON dbo.document_registry(folder_code, organization_id)
        WHERE folder_code IS NOT NULL;
    PRINT '  Indice IX_doc_registry_folder_code creato';
END
GO

-- ??? 2. document_relations ??????????????????????????????????????????????????

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_relations' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.document_relations (
        id                   INT IDENTITY(1,1) PRIMARY KEY,
        organization_id      INT            NOT NULL,
        source_document_id   INT            NOT NULL,
        target_document_id   INT            NOT NULL,
        relation_type        NVARCHAR(30)   NOT NULL
            CONSTRAINT CK_doc_relation_type CHECK (relation_type IN (
                'references','supersedes','implements','requires','attachment_of'
            )),
        notes                NVARCHAR(500)  NULL,
        created_by           INT            NULL,
        created_at           DATETIME2      NOT NULL DEFAULT GETDATE()
    );
    PRINT '  Tabella document_relations creata';
END
ELSE
    PRINT '  Tabella document_relations gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_rel_org')
BEGIN
    ALTER TABLE dbo.document_relations
    ADD CONSTRAINT FK_doc_rel_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_rel_source')
BEGIN
    ALTER TABLE dbo.document_relations
    ADD CONSTRAINT FK_doc_rel_source
        FOREIGN KEY (source_document_id) REFERENCES dbo.document_registry(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_rel_target')
BEGIN
    ALTER TABLE dbo.document_relations
    ADD CONSTRAINT FK_doc_rel_target
        FOREIGN KEY (target_document_id) REFERENCES dbo.document_registry(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_rel_user')
BEGIN
    ALTER TABLE dbo.document_relations
    ADD CONSTRAINT FK_doc_rel_user
        FOREIGN KEY (created_by) REFERENCES dbo.users(user_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_rel_source' AND object_id = OBJECT_ID('document_relations'))
BEGIN
    CREATE INDEX IX_doc_rel_source ON dbo.document_relations(source_document_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_rel_target' AND object_id = OBJECT_ID('document_relations'))
BEGIN
    CREATE INDEX IX_doc_rel_target ON dbo.document_relations(target_document_id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_doc_rel_org' AND object_id = OBJECT_ID('document_relations'))
BEGIN
    CREATE INDEX IX_doc_rel_org ON dbo.document_relations(organization_id);
END
GO

PRINT '';
PRINT 'Migration 057 completata.';
GO
