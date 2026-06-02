-- Migration 081: accesso utente per singola azienda (RBAC Fase 4 — ADR-012)
-- Idempotente

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'user_company_access' AND type = 'U'
)
BEGIN
    CREATE TABLE user_company_access (
        id              INT IDENTITY(1,1) NOT NULL,
        user_id         INT            NOT NULL,
        company_id      INT            NOT NULL,
        permission      NVARCHAR(20)   NOT NULL,
        organization_id INT            NOT NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_user_company_access PRIMARY KEY (id),
        CONSTRAINT UQ_user_company_access_user_company UNIQUE (user_id, company_id),
        CONSTRAINT CK_user_company_access_permission CHECK (permission IN ('read', 'write'))
    );
    CREATE INDEX IX_user_company_access_user
        ON user_company_access (user_id);
    CREATE INDEX IX_user_company_access_company
        ON user_company_access (company_id);
    PRINT 'Tabella user_company_access creata.';
END
ELSE
    PRINT 'Tabella user_company_access già esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_user')
    ALTER TABLE user_company_access
    ADD CONSTRAINT FK_user_company_access_user
        FOREIGN KEY (user_id) REFERENCES users(user_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_company')
    ALTER TABLE user_company_access
    ADD CONSTRAINT FK_user_company_access_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_user_company_access_org')
    ALTER TABLE user_company_access
    ADD CONSTRAINT FK_user_company_access_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

PRINT 'Migration 081 completata.';
GO
