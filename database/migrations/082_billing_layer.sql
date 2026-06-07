-- Migration 082: layer fatturazione B2B2B (company_billing, billing_events, billing_snapshots)
-- Idempotente

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'company_billing' AND type = 'U'
)
BEGIN
    CREATE TABLE company_billing (
        id              INT IDENTITY(1,1) NOT NULL,
        company_id      INT            NOT NULL,
        organization_id INT            NOT NULL,
        auditor_org_id  INT            NOT NULL,
        status          NVARCHAR(20)   NOT NULL DEFAULT 'active',
        billing_plan    NVARCHAR(50)   NOT NULL DEFAULT 'base',
        activated_at    DATETIME2      NULL,
        deactivated_at  DATETIME2      NULL,
        monthly_fee_cents INT          NULL,
        notes           NVARCHAR(500)  NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_company_billing PRIMARY KEY (id),
        CONSTRAINT UQ_company_billing_company UNIQUE (company_id),
        CONSTRAINT CK_company_billing_status CHECK (status IN ('trial', 'active', 'suspended', 'cancelled'))
    );
    CREATE INDEX IX_company_billing_organization ON company_billing (organization_id);
    CREATE INDEX IX_company_billing_company ON company_billing (company_id);
    CREATE INDEX IX_company_billing_auditor_org ON company_billing (auditor_org_id);
    CREATE INDEX IX_company_billing_status ON company_billing (status);
    PRINT 'Tabella company_billing creata.';
END
ELSE
    PRINT 'Tabella company_billing gi� esistente � skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_billing_company')
    ALTER TABLE company_billing
    ADD CONSTRAINT FK_company_billing_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_billing_organization')
    ALTER TABLE company_billing
    ADD CONSTRAINT FK_company_billing_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_billing_auditor_org')
    ALTER TABLE company_billing
    ADD CONSTRAINT FK_company_billing_auditor_org
        FOREIGN KEY (auditor_org_id) REFERENCES auditor_orgs(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'billing_events' AND type = 'U'
)
BEGIN
    CREATE TABLE billing_events (
        id              INT IDENTITY(1,1) NOT NULL,
        organization_id INT            NOT NULL,
        company_id      INT            NULL,
        auditor_org_id  INT            NULL,
        event_type      NVARCHAR(50)   NOT NULL,
        payload_json    NVARCHAR(MAX)  NULL,
        created_by      INT            NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_billing_events PRIMARY KEY (id)
    );
    CREATE INDEX IX_billing_events_organization ON billing_events (organization_id);
    CREATE INDEX IX_billing_events_company ON billing_events (company_id);
    CREATE INDEX IX_billing_events_created_at ON billing_events (created_at DESC);
    PRINT 'Tabella billing_events creata.';
END
ELSE
    PRINT 'Tabella billing_events gi� esistente � skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_events_organization')
    ALTER TABLE billing_events
    ADD CONSTRAINT FK_billing_events_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_events_company')
    ALTER TABLE billing_events
    ADD CONSTRAINT FK_billing_events_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_events_auditor_org')
    ALTER TABLE billing_events
    ADD CONSTRAINT FK_billing_events_auditor_org
        FOREIGN KEY (auditor_org_id) REFERENCES auditor_orgs(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_events_created_by')
    ALTER TABLE billing_events
    ADD CONSTRAINT FK_billing_events_created_by
        FOREIGN KEY (created_by) REFERENCES users(user_id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'billing_snapshots' AND type = 'U'
)
BEGIN
    CREATE TABLE billing_snapshots (
        id              INT IDENTITY(1,1) NOT NULL,
        period_yyyy_mm  CHAR(7)        NOT NULL,
        organization_id INT            NOT NULL,
        company_id      INT            NOT NULL,
        auditor_org_id  INT            NOT NULL,
        is_billable     BIT            NOT NULL DEFAULT 0,
        modules_enabled NVARCHAR(MAX)  NULL,
        metrics_json    NVARCHAR(MAX)  NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_billing_snapshots PRIMARY KEY (id),
        CONSTRAINT UQ_billing_snapshots_period_company UNIQUE (period_yyyy_mm, company_id)
    );
    CREATE INDEX IX_billing_snapshots_period ON billing_snapshots (period_yyyy_mm);
    CREATE INDEX IX_billing_snapshots_organization ON billing_snapshots (organization_id, period_yyyy_mm);
    CREATE INDEX IX_billing_snapshots_company ON billing_snapshots (company_id, period_yyyy_mm);
    PRINT 'Tabella billing_snapshots creata.';
END
ELSE
    PRINT 'Tabella billing_snapshots gi� esistente � skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_snapshots_organization')
    ALTER TABLE billing_snapshots
    ADD CONSTRAINT FK_billing_snapshots_organization
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_snapshots_company')
    ALTER TABLE billing_snapshots
    ADD CONSTRAINT FK_billing_snapshots_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_billing_snapshots_auditor_org')
    ALTER TABLE billing_snapshots
    ADD CONSTRAINT FK_billing_snapshots_auditor_org
        FOREIGN KEY (auditor_org_id) REFERENCES auditor_orgs(id);
GO

PRINT 'Migration 082 completata.';
GO
