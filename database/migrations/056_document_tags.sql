-- ============================================================================
-- Migration 056: Sistema Tag per Document Registry
-- ============================================================================
-- Crea il sistema di tagging a 2 livelli (categorie + tag) per collegare
-- e organizzare i documenti del registro SGQ.
-- Puramente additiva, idempotente.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 056: Sistema Tag Documenti';
PRINT '================================================================================';
PRINT '';

-- ??? 1. tag_categories ??????????????????????????????????????????????????????

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'tag_categories' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.tag_categories (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT            NULL,
        name            NVARCHAR(100)  NOT NULL,
        color           NVARCHAR(7)    NULL,
        display_order   INT            NOT NULL DEFAULT 0,
        is_system       BIT            NOT NULL DEFAULT 0,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE()
    );
    PRINT '  Tabella tag_categories creata';
END
ELSE
    PRINT '  Tabella tag_categories gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tag_categories_org')
BEGIN
    ALTER TABLE dbo.tag_categories
    ADD CONSTRAINT FK_tag_categories_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);
    PRINT '  FK tag_categories -> organizations creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tag_categories_org' AND object_id = OBJECT_ID('tag_categories'))
BEGIN
    CREATE INDEX IX_tag_categories_org ON dbo.tag_categories(organization_id);
    PRINT '  Indice IX_tag_categories_org creato';
END
GO

-- ??? 2. document_tags ???????????????????????????????????????????????????????

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_tags' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.document_tags (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT            NULL,
        category_id     INT            NULL,
        name            NVARCHAR(100)  NOT NULL,
        slug            NVARCHAR(100)  NOT NULL,
        color           NVARCHAR(7)    NULL,
        is_system       BIT            NOT NULL DEFAULT 0,
        auto_rule       NVARCHAR(MAX)  NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE()
    );
    PRINT '  Tabella document_tags creata';
END
ELSE
    PRINT '  Tabella document_tags gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_document_tags_org')
BEGIN
    ALTER TABLE dbo.document_tags
    ADD CONSTRAINT FK_document_tags_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);
    PRINT '  FK document_tags -> organizations creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_document_tags_category')
BEGIN
    ALTER TABLE dbo.document_tags
    ADD CONSTRAINT FK_document_tags_category
        FOREIGN KEY (category_id) REFERENCES dbo.tag_categories(id);
    PRINT '  FK document_tags -> tag_categories creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_document_tags_org' AND object_id = OBJECT_ID('document_tags'))
BEGIN
    CREATE INDEX IX_document_tags_org ON dbo.document_tags(organization_id);
    PRINT '  Indice IX_document_tags_org creato';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_document_tags_category' AND object_id = OBJECT_ID('document_tags'))
BEGIN
    CREATE INDEX IX_document_tags_category ON dbo.document_tags(category_id);
    PRINT '  Indice IX_document_tags_category creato';
END
GO

-- ??? 3. document_tag_assignments (many-to-many) ?????????????????????????????

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'document_tag_assignments' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.document_tag_assignments (
        document_id     INT            NOT NULL,
        tag_id          INT            NOT NULL,
        source          NVARCHAR(20)   NOT NULL DEFAULT 'manual'
            CONSTRAINT CK_tag_assign_source CHECK (source IN ('manual','auto','import')),
        assigned_at     DATETIME2      NOT NULL DEFAULT GETDATE(),
        assigned_by     INT            NULL,
        CONSTRAINT PK_document_tag_assignments PRIMARY KEY (document_id, tag_id)
    );
    PRINT '  Tabella document_tag_assignments creata';
END
ELSE
    PRINT '  Tabella document_tag_assignments gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tag_assign_document')
BEGIN
    ALTER TABLE dbo.document_tag_assignments
    ADD CONSTRAINT FK_tag_assign_document
        FOREIGN KEY (document_id) REFERENCES dbo.document_registry(id);
    PRINT '  FK tag_assign -> document_registry creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tag_assign_tag')
BEGIN
    ALTER TABLE dbo.document_tag_assignments
    ADD CONSTRAINT FK_tag_assign_tag
        FOREIGN KEY (tag_id) REFERENCES dbo.document_tags(id);
    PRINT '  FK tag_assign -> document_tags creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_tag_assign_user')
BEGIN
    ALTER TABLE dbo.document_tag_assignments
    ADD CONSTRAINT FK_tag_assign_user
        FOREIGN KEY (assigned_by) REFERENCES dbo.users(user_id);
    PRINT '  FK tag_assign -> users creata';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_tag_assign_tag' AND object_id = OBJECT_ID('document_tag_assignments'))
BEGIN
    CREATE INDEX IX_tag_assign_tag ON dbo.document_tag_assignments(tag_id);
    PRINT '  Indice IX_tag_assign_tag creato';
END
GO

PRINT '';
PRINT 'Migration 056 completata.';
GO
