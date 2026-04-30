-- Migration 046: Event store audit_events (T2 — ADR-008)
-- Idempotente: IF NOT EXISTS su ogni oggetto.
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.tables WHERE name = 'audit_events' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE dbo.audit_events (
        event_id         BIGINT IDENTITY(1,1) NOT NULL,
        event_uuid       UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID(),
        audit_id         INT NOT NULL,
        audit_uuid       UNIQUEIDENTIFIER NOT NULL,
        event_type       NVARCHAR(50) NOT NULL,
        field_path       NVARCHAR(200) NULL,
        old_value        NVARCHAR(MAX) NULL,
        new_value        NVARCHAR(MAX) NULL,
        user_id          INT NOT NULL,
        device_type      NVARCHAR(20) NULL,
        client_ts        DATETIME2(7) NOT NULL,
        client_ts_offset_ms INT NOT NULL DEFAULT 0,
        server_ts        DATETIME2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
        idempotency_key  UNIQUEIDENTIFIER NOT NULL,
        sync_batch_id    UNIQUEIDENTIFIER NULL,
        organization_id  INT NOT NULL,
        CONSTRAINT PK_audit_events PRIMARY KEY CLUSTERED (event_id),
        CONSTRAINT UQ_audit_events_idempotency UNIQUE (idempotency_key),
        CONSTRAINT CK_audit_events_type CHECK (event_type IN (
            'audit_created', 'audit_status_changed',
            'response_set', 'response_cleared',
            'field_updated',
            'attachment_added', 'attachment_removed',
            'custom_response_set'
        )),
        CONSTRAINT FK_audit_events_audit FOREIGN KEY (audit_id)
            REFERENCES dbo.audits(audit_id),
        CONSTRAINT FK_audit_events_user FOREIGN KEY (user_id)
            REFERENCES dbo.users(user_id)
    );
    PRINT 'Tabella audit_events creata.';
END
ELSE
    PRINT 'Tabella audit_events già presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_audit_ts')
    CREATE INDEX IX_audit_events_audit_ts   ON dbo.audit_events (audit_id, client_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_audit_uuid')
    CREATE INDEX IX_audit_events_audit_uuid ON dbo.audit_events (audit_uuid, client_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_user_ts')
    CREATE INDEX IX_audit_events_user_ts    ON dbo.audit_events (user_id, server_ts);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_audit_events_org')
    CREATE INDEX IX_audit_events_org        ON dbo.audit_events (organization_id, server_ts);

PRINT 'Migration 046 completata.';
