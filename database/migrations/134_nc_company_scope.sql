-- =============================================================================
-- Migration 134 — Ambito azienda per NC non legate ad audit
-- Il Piano Azioni multi-fonte (migration 098) supporta categorie non legate ad
-- audit (rischi, riesame, miglioramento, ecc.) ma queste NC non avevano modo di
-- essere imputate a una specifica azienda cliente (solo organization_id).
-- Aggiunge company_id diretto, allineato al pattern gia' usato per audit_id.
-- Idempotente.
-- =============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT 'Migration 134: NC company_id per categorie non legate ad audit';
PRINT '';

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'company_id'
)
BEGIN
    ALTER TABLE dbo.non_conformities ADD company_id INT NULL;
    PRINT '  Colonna company_id aggiunta a non_conformities';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_nc_company')
BEGIN
    ALTER TABLE dbo.non_conformities
    ADD CONSTRAINT FK_nc_company
        FOREIGN KEY (company_id) REFERENCES dbo.companies(id);
    PRINT '  FK_nc_company aggiunto';
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_nc_company_id' AND object_id = OBJECT_ID('non_conformities')
)
BEGIN
    CREATE INDEX IX_nc_company_id ON dbo.non_conformities(company_id);
    PRINT '  IX_nc_company_id creato';
END
GO

PRINT 'Migration 134 completata.';
GO
