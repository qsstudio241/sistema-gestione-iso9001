-- ============================================================================
-- Migration 117: SAL Fase 0 — motore dati gap analysis operativa
-- Tabelle requirement_implementation_status + requirement_implementation_history
-- Pattern SQL Server: statement separati, IF NOT EXISTS idempotente, FK senza ON DELETE
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 117: SAL gap implementation status + history';
PRINT '================================================================================';
PRINT '';

-- --- 1. Tabella requirement_implementation_status --------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'requirement_implementation_status')
BEGIN
    CREATE TABLE dbo.requirement_implementation_status (
        id                    INT IDENTITY(1,1) NOT NULL,
        organization_id       INT               NOT NULL,
        company_id            INT               NOT NULL,
        norm_requirement_id   INT               NOT NULL,
        standard_code         NVARCHAR(50)      NOT NULL,
        status                NVARCHAR(20)      NOT NULL,
        conformity_hint       NVARCHAR(10)      NULL,
        notes                 NVARCHAR(MAX)     NULL,
        responsible           NVARCHAR(200)     NULL,
        due_date              DATE              NULL,
        evidence_document_ids NVARCHAR(MAX)     NULL,
        created_at            DATETIME2         NOT NULL CONSTRAINT DF_ris_created_at DEFAULT GETDATE(),
        updated_at            DATETIME2         NOT NULL CONSTRAINT DF_ris_updated_at DEFAULT GETDATE(),
        updated_by            INT               NULL,
        CONSTRAINT PK_requirement_implementation_status PRIMARY KEY CLUSTERED (id)
    );
    PRINT '  Tabella requirement_implementation_status creata';
END
ELSE
    PRINT '  Tabella requirement_implementation_status gia presente - skip';
GO

-- --- 2. CHECK status -----------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ris_status')
BEGIN
    ALTER TABLE dbo.requirement_implementation_status WITH NOCHECK
        ADD CONSTRAINT CK_ris_status CHECK (status IN (
            'discussed', 'in_progress', 'to_validate', 'completed', 'na'
        ));
    PRINT '  CHECK CK_ris_status creato';
END
ELSE
    PRINT '  CHECK CK_ris_status gia presente - skip';
GO

-- --- 3. Unique (organization_id, company_id, norm_requirement_id) --------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_ris_org_company_req' AND object_id = OBJECT_ID('requirement_implementation_status'))
BEGIN
    CREATE UNIQUE INDEX UQ_ris_org_company_req
        ON dbo.requirement_implementation_status(organization_id, company_id, norm_requirement_id);
    PRINT '  Indice UQ_ris_org_company_req creato';
END
ELSE
    PRINT '  Indice UQ_ris_org_company_req gia presente - skip';
GO

-- --- 4. Indici lookup ----------------------------------------------------------
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ris_company' AND object_id = OBJECT_ID('requirement_implementation_status'))
BEGIN
    CREATE INDEX IX_ris_company
        ON dbo.requirement_implementation_status(organization_id, company_id, standard_code);
    PRINT '  Indice IX_ris_company creato';
END
ELSE
    PRINT '  Indice IX_ris_company gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ris_norm_req' AND object_id = OBJECT_ID('requirement_implementation_status'))
BEGIN
    CREATE INDEX IX_ris_norm_req
        ON dbo.requirement_implementation_status(norm_requirement_id);
    PRINT '  Indice IX_ris_norm_req creato';
END
ELSE
    PRINT '  Indice IX_ris_norm_req gia presente - skip';
GO

-- --- 5. FK requirement_implementation_status (senza ON DELETE) -------------------
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ris_organization')
BEGIN
    ALTER TABLE dbo.requirement_implementation_status
        ADD CONSTRAINT FK_ris_organization
            FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);
    PRINT '  FK_ris_organization creato';
END
ELSE
    PRINT '  FK_ris_organization gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ris_company')
BEGIN
    ALTER TABLE dbo.requirement_implementation_status
        ADD CONSTRAINT FK_ris_company
            FOREIGN KEY (company_id) REFERENCES dbo.companies(id);
    PRINT '  FK_ris_company creato';
END
ELSE
    PRINT '  FK_ris_company gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ris_norm_requirement')
BEGIN
    ALTER TABLE dbo.requirement_implementation_status
        ADD CONSTRAINT FK_ris_norm_requirement
            FOREIGN KEY (norm_requirement_id) REFERENCES dbo.norm_requirements(id);
    PRINT '  FK_ris_norm_requirement creato';
END
ELSE
    PRINT '  FK_ris_norm_requirement gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ris_updated_by')
BEGIN
    ALTER TABLE dbo.requirement_implementation_status
        ADD CONSTRAINT FK_ris_updated_by
            FOREIGN KEY (updated_by) REFERENCES dbo.users(user_id);
    PRINT '  FK_ris_updated_by creato';
END
ELSE
    PRINT '  FK_ris_updated_by gia presente - skip';
GO

-- --- 6. Tabella requirement_implementation_history -----------------------------
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'requirement_implementation_history')
BEGIN
    CREATE TABLE dbo.requirement_implementation_history (
        id          INT IDENTITY(1,1) NOT NULL,
        status_id   INT               NOT NULL,
        status      NVARCHAR(20)      NOT NULL,
        notes       NVARCHAR(MAX)     NULL,
        changed_at  DATETIME2         NOT NULL CONSTRAINT DF_rish_changed_at DEFAULT GETDATE(),
        changed_by  INT               NULL,
        CONSTRAINT PK_requirement_implementation_history PRIMARY KEY CLUSTERED (id)
    );
    PRINT '  Tabella requirement_implementation_history creata';
END
ELSE
    PRINT '  Tabella requirement_implementation_history gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_rish_status')
BEGIN
    ALTER TABLE dbo.requirement_implementation_history WITH NOCHECK
        ADD CONSTRAINT CK_rish_status CHECK (status IN (
            'discussed', 'in_progress', 'to_validate', 'completed', 'na'
        ));
    PRINT '  CHECK CK_rish_status creato';
END
ELSE
    PRINT '  CHECK CK_rish_status gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_rish_status_changed' AND object_id = OBJECT_ID('requirement_implementation_history'))
BEGIN
    CREATE INDEX IX_rish_status_changed
        ON dbo.requirement_implementation_history(status_id, changed_at DESC);
    PRINT '  Indice IX_rish_status_changed creato';
END
ELSE
    PRINT '  Indice IX_rish_status_changed gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rish_status')
BEGIN
    ALTER TABLE dbo.requirement_implementation_history
        ADD CONSTRAINT FK_rish_status
            FOREIGN KEY (status_id) REFERENCES dbo.requirement_implementation_status(id);
    PRINT '  FK_rish_status creato';
END
ELSE
    PRINT '  FK_rish_status gia presente - skip';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_rish_changed_by')
BEGIN
    ALTER TABLE dbo.requirement_implementation_history
        ADD CONSTRAINT FK_rish_changed_by
            FOREIGN KEY (changed_by) REFERENCES dbo.users(user_id);
    PRINT '  FK_rish_changed_by creato';
END
ELSE
    PRINT '  FK_rish_changed_by gia presente - skip';
GO

PRINT '';
PRINT 'Migration 117 completata.';
GO
