-- Migration 073: rubrica referenti notifiche NC per organizzazione
-- Idempotente

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'notification_contacts' AND type = 'U'
)
BEGIN
    CREATE TABLE notification_contacts (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        name                NVARCHAR(200)  NOT NULL,
        email               NVARCHAR(320)  NOT NULL,
        role_type           NVARCHAR(20)   NOT NULL DEFAULT 'generico',
        active              BIT            NOT NULL DEFAULT 1,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_notification_contacts PRIMARY KEY (id),
        CONSTRAINT CHK_notification_contacts_role
            CHECK (role_type IN ('attuazione', 'verifica', 'generico'))
    );
    CREATE INDEX IX_notification_contacts_org ON notification_contacts (organization_id);
    PRINT 'Tabella notification_contacts creata.';
END
ELSE
    PRINT 'Tabella notification_contacts gia esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notification_contacts_org')
    ALTER TABLE notification_contacts
    ADD CONSTRAINT FK_notification_contacts_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

PRINT 'Migration 073 completata.';
GO
