-- ============================================================================
-- Migration 040: Prefisso numerazione report audit + sequenze giornaliere
-- ============================================================================
-- Obiettivo:
--   Supporto numerazione tipo Mason PREFISSO-YYMMDD-NN (es. MSN-260417-01)
--   con contatore atomico per (organization_id, prefix, giorno calendario Europe/Rome).
--
-- Eseguire su DB di test prima di produzione.
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;

-- Prefisso report (es. MSN). NULL = default applicativo 'MSN'.
IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'organizations' AND COLUMN_NAME = 'audit_report_prefix'
)
BEGIN
    ALTER TABLE dbo.organizations ADD audit_report_prefix NVARCHAR(16) NULL;
    PRINT 'Colonna organizations.audit_report_prefix aggiunta';
END
ELSE
    PRINT 'Colonna organizations.audit_report_prefix gia presente';
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'audit_daily_sequences' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.audit_daily_sequences (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id INT NOT NULL,
        prefix NVARCHAR(16) NOT NULL,
        sequence_date DATE NOT NULL,
        last_seq INT NOT NULL CONSTRAINT DF_audit_daily_sequences_last DEFAULT (0),
        updated_at DATETIME2(7) NOT NULL DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT UQ_audit_daily_sequences_org_prefix_day
            UNIQUE (organization_id, prefix, sequence_date),
        CONSTRAINT FK_audit_daily_sequences_org
            FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id)
    );
    CREATE INDEX IX_audit_daily_sequences_lookup
        ON dbo.audit_daily_sequences (organization_id, prefix, sequence_date);
    PRINT 'Tabella audit_daily_sequences creata';
END
ELSE
    PRINT 'Tabella audit_daily_sequences gia presente';
GO

PRINT 'Migration 040 completata.';
GO
