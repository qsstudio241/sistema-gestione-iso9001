-- Migration 078: anagrafica personale per azienda + bridge notification_contacts
-- Idempotente — ADR-012 slice S2

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'company_personnel' AND type = 'U'
)
BEGIN
    CREATE TABLE company_personnel (
        id                      INT IDENTITY(1,1) NOT NULL,
        organization_id         INT            NOT NULL,
        company_id              INT            NOT NULL,
        name                    NVARCHAR(200)  NOT NULL,
        job_title               NVARCHAR(200)  NULL,
        email                   NVARCHAR(320)  NULL,
        active                  BIT            NOT NULL DEFAULT 1,
        can_actuation           BIT            NOT NULL DEFAULT 0,
        can_verify              BIT            NOT NULL DEFAULT 0,
        notification_contact_id INT            NULL,
        created_at              DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at              DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_company_personnel PRIMARY KEY (id)
    );
    CREATE INDEX IX_company_personnel_org_company
        ON company_personnel (organization_id, company_id);
    CREATE INDEX IX_company_personnel_company_active
        ON company_personnel (company_id, active);
    PRINT 'Tabella company_personnel creata.';
END
ELSE
    PRINT 'Tabella company_personnel già esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_org')
    ALTER TABLE company_personnel
    ADD CONSTRAINT FK_company_personnel_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_company')
    ALTER TABLE company_personnel
    ADD CONSTRAINT FK_company_personnel_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_company_personnel_notification_contact')
    ALTER TABLE company_personnel
    ADD CONSTRAINT FK_company_personnel_notification_contact
        FOREIGN KEY (notification_contact_id) REFERENCES notification_contacts(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notification_contacts' AND COLUMN_NAME = 'company_id'
)
BEGIN
    ALTER TABLE notification_contacts ADD company_id INT NULL;
    PRINT 'Colonna notification_contacts.company_id aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notification_contacts' AND COLUMN_NAME = 'personnel_id'
)
BEGIN
    ALTER TABLE notification_contacts ADD personnel_id INT NULL;
    PRINT 'Colonna notification_contacts.personnel_id aggiunta.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notification_contacts_company')
    ALTER TABLE notification_contacts
    ADD CONSTRAINT FK_notification_contacts_company
        FOREIGN KEY (company_id) REFERENCES companies(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notification_contacts_personnel')
    ALTER TABLE notification_contacts
    ADD CONSTRAINT FK_notification_contacts_personnel
        FOREIGN KEY (personnel_id) REFERENCES company_personnel(id);
GO

PRINT 'Migration 078 completata.';
GO
