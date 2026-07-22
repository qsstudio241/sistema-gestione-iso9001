-- ============================================================================
-- Migration 118: SAL Fase 3 — estende source_category NC con sal_gap
-- Idempotente: DROP + ricrea CK_nc_source_category
-- ============================================================================

USE SGQ_ISO9001;
GO

SET NOCOUNT ON;
PRINT '';
PRINT 'Migration 118: NC source_category sal_gap';
PRINT '';

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_nc_source_category')
BEGIN
    ALTER TABLE dbo.non_conformities DROP CONSTRAINT CK_nc_source_category;
    PRINT '  CK_nc_source_category rimosso';
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_nc_source_category')
BEGIN
    ALTER TABLE dbo.non_conformities WITH NOCHECK
        ADD CONSTRAINT CK_nc_source_category CHECK (source_category IN (
            'audit', 'complaint', 'risk_action', 'management_review',
            'improvement', 'operational', 'external_audit', 'sal_gap'
        ));
    PRINT '  CK_nc_source_category ricreato con sal_gap';
END
GO

PRINT 'Migration 118 completata.';
GO
