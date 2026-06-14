-- Migration 093: link import_job_files -> qualifications + log alert qualifiche
-- Idempotente

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('import_job_files') AND name = 'qualification_id'
)
BEGIN
    ALTER TABLE import_job_files ADD qualification_id INT NULL;
    PRINT 'Colonna import_job_files.qualification_id aggiunta.';
END
ELSE
    PRINT 'Colonna import_job_files.qualification_id gia presente - skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ijf_qualification')
    ALTER TABLE import_job_files
    ADD CONSTRAINT FK_ijf_qualification
        FOREIGN KEY (qualification_id) REFERENCES qualifications(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_ijf_qualification' AND object_id = OBJECT_ID('import_job_files')
)
    CREATE INDEX IX_ijf_qualification ON import_job_files(qualification_id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.objects
    WHERE name = 'qual_notification_log' AND type = 'U'
)
BEGIN
    CREATE TABLE qual_notification_log (
        id                  INT IDENTITY(1,1) NOT NULL,
        organization_id     INT            NOT NULL,
        qualification_id    INT            NOT NULL,
        alert_kind          NVARCHAR(20)   NOT NULL,
        recipient_email     NVARCHAR(320)  NOT NULL,
        alert_date          DATE           NOT NULL,
        threshold_days      INT            NOT NULL,
        created_at          DATETIME2      NOT NULL DEFAULT GETDATE(),
        CONSTRAINT PK_qual_notification_log PRIMARY KEY (id),
        CONSTRAINT CHK_qual_notification_kind
            CHECK (alert_kind IN ('expiry', 'confirmation')),
        CONSTRAINT UQ_qual_notification_log UNIQUE (
            qualification_id, alert_kind, recipient_email, alert_date, threshold_days
        )
    );
    CREATE INDEX IX_qual_notification_log_org_date
        ON qual_notification_log (organization_id, alert_date);
    PRINT 'Tabella qual_notification_log creata.';
END
ELSE
    PRINT 'Tabella qual_notification_log gia esistente - skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qual_notification_log_org')
    ALTER TABLE qual_notification_log
    ADD CONSTRAINT FK_qual_notification_log_org
        FOREIGN KEY (organization_id) REFERENCES organizations(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qual_notification_log_qual')
    ALTER TABLE qual_notification_log
    ADD CONSTRAINT FK_qual_notification_log_qual
        FOREIGN KEY (qualification_id) REFERENCES qualifications(id);
GO

PRINT 'Migration 093 completata.';
GO
