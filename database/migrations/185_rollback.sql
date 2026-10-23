-- Rollback di 185_discrepancy_notices.sql (NON eseguito dal runner).
-- Toglie la tabella degli avvisi e le due colonne nullable sulla WPQR.
-- Fare un backup prima. Non tocca le altre colonne di wpqr_records.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.discrepancy_notices', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.discrepancy_notices;
    PRINT N'185 rollback: discrepancy_notices rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'fillet_throat_range') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN fillet_throat_range;
    PRINT N'185 rollback: fillet_throat_range rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'material_group_range') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN material_group_range;
    PRINT N'185 rollback: material_group_range rimossa.';
END
GO
