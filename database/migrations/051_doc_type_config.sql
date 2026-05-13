-- ============================================================================
-- Migration 051: doc_type_config � configurazione prefissi per tipo documento
-- ============================================================================
-- Permette a ogni organizzazione di configurare prefisso e autonumerazione
-- per ciascun tipo di documento (es. 'Procedura' -> 'PG', 'Modulo' -> 'MOD').
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 051: Tabella doc_type_config';
PRINT '================================================================================';
PRINT '';

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'doc_type_config' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.doc_type_config (
        id              INT IDENTITY(1,1) PRIMARY KEY,
        organization_id INT NOT NULL,
        doc_type        NVARCHAR(50) NOT NULL,
        prefix          NVARCHAR(20) NULL,
        auto_number     BIT NOT NULL CONSTRAINT DF_doc_type_config_auto_number DEFAULT (1),
        CONSTRAINT UQ_doc_type_org UNIQUE (organization_id, doc_type),
        CONSTRAINT FK_dtc_org FOREIGN KEY (organization_id)
            REFERENCES dbo.organizations(organization_id)
    );
    PRINT '  ? Tabella doc_type_config creata';
END
ELSE
    PRINT '  ??  Tabella doc_type_config gi� presente';

PRINT '';
PRINT 'Migration 051 completata.';
GO
