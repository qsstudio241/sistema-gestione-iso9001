-- Migration 079: log invii alert documenti (anti-duplicati escalation)
-- Pattern allineato a nc_notification_log (074)

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'doc_notification_log' AND type = 'U'
)
BEGIN
    CREATE TABLE doc_notification_log (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        document_id         INT            NOT NULL,
        recipient_email     NVARCHAR(320)  NOT NULL,
        alert_date          DATE           NOT NULL,
        threshold_days      INT            NOT NULL DEFAULT -1,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_doc_notification_log PRIMARY KEY (id),
        CONSTRAINT UQ_doc_notification_log UNIQUE (
            document_id, recipient_email, alert_date, threshold_days
        )
    );
    CREATE INDEX IX_doc_notification_log_org_date
        ON doc_notification_log (organization_id, alert_date);
    PRINT 'Tabella doc_notification_log creata.';
END
ELSE
    PRINT 'Tabella doc_notification_log gia esistente — skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_notification_log_org')
    ALTER TABLE doc_notification_log
    ADD CONSTRAINT FK_doc_notification_log_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_doc_notification_log_document')
    ALTER TABLE doc_notification_log
    ADD CONSTRAINT FK_doc_notification_log_document
        FOREIGN KEY (document_id) REFERENCES document_registry(id);
GO

PRINT 'Migration 079 completata.';
GO
