-- ============================================================================
-- Migration 041: organizations — partita IVA e logo tenant
-- ============================================================================
-- Aggiunge anagrafica per report Word e branding UI (banner / sidebar).
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT '================================================================================';
PRINT 'Migration 041: organizations.vat_number, organizations.logo_url';
PRINT '================================================================================';
PRINT '';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'vat_number'
)
BEGIN
    ALTER TABLE dbo.organizations ADD vat_number NVARCHAR(32) NULL;
    PRINT '  ✅ Aggiunta colonna organizations.vat_number';
END
ELSE
    PRINT '  ⏭️  organizations.vat_number già presente';

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.organizations') AND name = N'logo_url'
)
BEGIN
    ALTER TABLE dbo.organizations ADD logo_url NVARCHAR(500) NULL;
    PRINT '  ✅ Aggiunta colonna organizations.logo_url';
END
ELSE
    PRINT '  ⏭️  organizations.logo_url già presente';

PRINT '';
PRINT 'Migration 041 completata.';
GO
