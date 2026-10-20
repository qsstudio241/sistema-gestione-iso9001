-- Rollback di 181_wps_iso15609_content.sql (NON eseguito dal runner).
-- Elimina i sette campi WPS 15609. Fare un backup prima. Idempotente.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'wpqr_ref') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN wpqr_ref;
    PRINT N'181 rollback: wpqr_ref rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'parent_material_a') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN parent_material_a;
    PRINT N'181 rollback: parent_material_a rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'parent_material_b') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN parent_material_b;
    PRINT N'181 rollback: parent_material_b rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'heat_input') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN heat_input;
    PRINT N'181 rollback: heat_input rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'current_range') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN current_range;
    PRINT N'181 rollback: current_range rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'voltage_range') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN voltage_range;
    PRINT N'181 rollback: voltage_range rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'metal_transfer') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN metal_transfer;
    PRINT N'181 rollback: metal_transfer rimossa.';
END
GO
