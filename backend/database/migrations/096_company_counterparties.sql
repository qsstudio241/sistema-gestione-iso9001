-- Migration 096: controparti per azienda + FK commercial_cases.commercial_customer_id
-- Idempotente — PR1 anagrafica controparti (customer / end_customer / supplier)

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'company_counterparties' AND type = 'U'
)
BEGIN
    CREATE TABLE company_counterparties (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT               NOT NULL,
        company_id          INT               NOT NULL,
        counterparty_uuid   UNIQUEIDENTIFIER  NOT NULL DEFAULT NEWID(),
        name                NVARCHAR(255)     NOT NULL,
        vat_number          NVARCHAR(50)      NULL,
        external_ref        NVARCHAR(100)     NULL,
        role                NVARCHAR(30)      NOT NULL,
        contact_person      NVARCHAR(200)     NULL,
        email               NVARCHAR(320)     NULL,
        phone               NVARCHAR(50)      NULL,
        address             NVARCHAR(500)     NULL,
        notes               NVARCHAR(MAX)     NULL,
        linked_supplier_id  INT               NULL,
        is_active           BIT               NOT NULL DEFAULT 1,
        created_by          INT               NULL,
        created_at          DATETIME2         NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2         NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_company_counterparties PRIMARY KEY (id),
        CONSTRAINT CK_company_counterparties_role CHECK (
            role IN ('customer', 'end_customer', 'supplier')
        )
    );
    CREATE INDEX IX_company_counterparties_org_company
        ON company_counterparties (organization_id, company_id);
    CREATE INDEX IX_company_counterparties_company_role_active
        ON company_counterparties (company_id, role, is_active);
    PRINT 'Tabella company_counterparties creata.';
END
ELSE
    PRINT 'Tabella company_counterparties già esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_counterparties_org')
    ALTER TABLE company_counterparties
    ADD CONSTRAINT FK_company_counterparties_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_counterparties_company')
    ALTER TABLE company_counterparties
    ADD CONSTRAINT FK_company_counterparties_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_counterparties_supplier')
    ALTER TABLE company_counterparties
    ADD CONSTRAINT FK_company_counterparties_supplier
        FOREIGN KEY (linked_supplier_id) REFERENCES suppliers(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'commercial_customer_id'
)
BEGIN
    ALTER TABLE commercial_cases ADD commercial_customer_id INT NULL;
    PRINT 'Colonna commercial_cases.commercial_customer_id aggiunta.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_commercial_cases_counterparty_customer')
    ALTER TABLE commercial_cases
    ADD CONSTRAINT FK_commercial_cases_counterparty_customer
        FOREIGN KEY (commercial_customer_id) REFERENCES company_counterparties(id);
GO

PRINT 'Migration 096 completata.';
GO
