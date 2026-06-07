-- ============================================================================
-- Migration 077: doc_type_config — contatore numerazione + scadenza default
-- ============================================================================
-- next_number: contatore atomico per generazione doc_code (PREFISSO-NNN)
-- default_expiry_months: mesi di validità default al rilascio (se expiry_date vuota)
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 077: doc_type_config counters + default_expiry_months';
PRINT '================================================================================';
PRINT '';

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'doc_type_config' AND COLUMN_NAME = 'next_number'
)
BEGIN
    ALTER TABLE dbo.doc_type_config
        ADD next_number INT NOT NULL CONSTRAINT DF_doc_type_config_next_number DEFAULT (1);
    PRINT '  Colonna next_number aggiunta';
END
ELSE
    PRINT '  Colonna next_number già presente';
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'doc_type_config' AND COLUMN_NAME = 'default_expiry_months'
)
BEGIN
    ALTER TABLE dbo.doc_type_config
        ADD default_expiry_months INT NULL;
    PRINT '  Colonna default_expiry_months aggiunta';
END
ELSE
    PRINT '  Colonna default_expiry_months già presente';
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'doc_type_config' AND COLUMN_NAME = 'updated_at'
)
BEGIN
    ALTER TABLE dbo.doc_type_config
        ADD updated_at DATETIME2 NOT NULL CONSTRAINT DF_doc_type_config_updated_at DEFAULT (SYSUTCDATETIME());
    PRINT '  Colonna updated_at aggiunta';
END
ELSE
    PRINT '  Colonna updated_at già presente';
GO

PRINT '';
PRINT 'Migration 077 completata.';
GO
