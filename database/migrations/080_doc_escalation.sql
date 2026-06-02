-- Migration 080: profili escalation documenti + flag notifications_config
-- alert_days_1 resta la finestra operativa condivisa (Priorità, email, dashboard)

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'doc_escalation_profile' AND type = 'U'
)
BEGIN
    CREATE TABLE doc_escalation_profile (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        doc_type            NVARCHAR(50)   NULL,
        name                NVARCHAR(120)  NOT NULL,
        rules_json          NVARCHAR(MAX)  NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        updated_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_doc_escalation_profile PRIMARY KEY (id)
    );
    CREATE INDEX IX_doc_escalation_profile_org
        ON doc_escalation_profile (organization_id, doc_type);
    PRINT 'Tabella doc_escalation_profile creata.';
END
ELSE
    PRINT 'Tabella doc_escalation_profile gia esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_escalation_profile_org')
    ALTER TABLE doc_escalation_profile
    ADD CONSTRAINT FK_doc_escalation_profile_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notifications_config' AND COLUMN_NAME = 'doc_escalation_enabled'
)
BEGIN
    ALTER TABLE notifications_config ADD doc_escalation_enabled BIT NOT NULL DEFAULT 1;
    PRINT 'Colonna notifications_config.doc_escalation_enabled aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notifications_config' AND COLUMN_NAME = 'doc_use_legacy_digest'
)
BEGIN
    ALTER TABLE notifications_config ADD doc_use_legacy_digest BIT NOT NULL DEFAULT 0;
    PRINT 'Colonna notifications_config.doc_use_legacy_digest aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notifications_config' AND COLUMN_NAME = 'doc_notify_responsible'
)
BEGIN
    ALTER TABLE notifications_config ADD doc_notify_responsible BIT NOT NULL DEFAULT 0;
    PRINT 'Colonna notifications_config.doc_notify_responsible aggiunta.';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'notifications_config' AND COLUMN_NAME = 'doc_escalation_profile_id'
)
BEGIN
    ALTER TABLE notifications_config ADD doc_escalation_profile_id INT NULL;
    PRINT 'Colonna notifications_config.doc_escalation_profile_id aggiunta.';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_notifications_config_doc_profile')
    ALTER TABLE notifications_config
    ADD CONSTRAINT FK_notifications_config_doc_profile
        FOREIGN KEY (doc_escalation_profile_id) REFERENCES doc_escalation_profile(id);
GO

PRINT 'Migration 080 completata.';
GO
