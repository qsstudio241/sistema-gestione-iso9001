-- Migration 074: FK referenti su NC/azioni + log invii escalation
-- Idempotente, mantiene campi testo per retrocompatibilita

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'responsible_contact_id'
)
BEGIN
    ALTER TABLE non_conformities ADD responsible_contact_id INT NULL;
    PRINT 'Colonna non_conformities.responsible_contact_id aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'verification_contact_id'
)
BEGIN
    ALTER TABLE non_conformities ADD verification_contact_id INT NULL;
    PRINT 'Colonna non_conformities.verification_contact_id aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'nc_actions' AND COLUMN_NAME = 'responsible_contact_id'
)
BEGIN
    ALTER TABLE nc_actions ADD responsible_contact_id INT NULL;
    PRINT 'Colonna nc_actions.responsible_contact_id aggiunta.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_responsible_contact')
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_responsible_contact
        FOREIGN KEY (responsible_contact_id) REFERENCES notification_contacts(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_verification_contact')
    ALTER TABLE non_conformities
    ADD CONSTRAINT FK_nc_verification_contact
        FOREIGN KEY (verification_contact_id) REFERENCES notification_contacts(id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_action_responsible_contact')
    ALTER TABLE nc_actions
    ADD CONSTRAINT FK_nc_action_responsible_contact
        FOREIGN KEY (responsible_contact_id) REFERENCES notification_contacts(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'nc_notification_log' AND type = 'U'
)
BEGIN
    CREATE TABLE nc_notification_log (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        entity_type         NVARCHAR(10)   NOT NULL,
        entity_id           INT            NOT NULL,
        recipient_email     NVARCHAR(320)  NOT NULL,
        alert_date          DATE           NOT NULL,
        threshold_days      INT            NOT NULL DEFAULT -1,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_nc_notification_log PRIMARY KEY (id),
        CONSTRAINT CHK_nc_notification_entity_type
            CHECK (entity_type IN ('nc', 'action')),
        CONSTRAINT UQ_nc_notification_log UNIQUE (
            entity_type, entity_id, recipient_email, alert_date, threshold_days
        )
    );
    CREATE INDEX IX_nc_notification_log_org_date
        ON nc_notification_log (organization_id, alert_date);
    PRINT 'Tabella nc_notification_log creata.';
END
ELSE
    PRINT 'Tabella nc_notification_log gia esistente � skip.';
GO

PRINT 'Migration 074 completata.';
GO
