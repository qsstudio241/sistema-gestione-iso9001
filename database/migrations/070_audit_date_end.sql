-- Migration 070: audit_date_end per audit multi-giorno
-- audit_date = data inizio (invariato); audit_date_end NULL = mono-giorno
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.audits') AND name = 'audit_date_end'
)
BEGIN
    ALTER TABLE dbo.audits
        ADD audit_date_end DATE NULL;
    PRINT 'Colonna audit_date_end aggiunta a dbo.audits';
END
ELSE
    PRINT 'Colonna audit_date_end già presente — skip';
