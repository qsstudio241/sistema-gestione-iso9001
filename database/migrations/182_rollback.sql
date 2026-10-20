-- Rollback di 182_wps_iso15609_wpqr_carry.sql (NON eseguito dal runner).
-- Elimina i campi WPS 15609 carry-over da WPQR. Fare un backup prima. Idempotente.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'joint_preparation') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN joint_preparation;
    PRINT N'182 rollback: joint_preparation rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'cleaning_method') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN cleaning_method;
    PRINT N'182 rollback: cleaning_method rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'mechanization') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN mechanization;
    PRINT N'182 rollback: mechanization rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'shielding_gas_flow_l_min_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN shielding_gas_flow_l_min_min;
    PRINT N'182 rollback: shielding_gas_flow_l_min_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'shielding_gas_flow_l_min_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN shielding_gas_flow_l_min_max;
    PRINT N'182 rollback: shielding_gas_flow_l_min_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'post_heating') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN post_heating;
    PRINT N'182 rollback: post_heating rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'pwht_details') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN pwht_details;
    PRINT N'182 rollback: pwht_details rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'bead_technique') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN bead_technique;
    PRINT N'182 rollback: bead_technique rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'contact_tube_distance_mm_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN contact_tube_distance_mm_min;
    PRINT N'182 rollback: contact_tube_distance_mm_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'contact_tube_distance_mm_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN contact_tube_distance_mm_max;
    PRINT N'182 rollback: contact_tube_distance_mm_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'torch_angle_deg') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN torch_angle_deg;
    PRINT N'182 rollback: torch_angle_deg rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'throat_mm') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN throat_mm;
    PRINT N'182 rollback: throat_mm rimossa.';
END
GO

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'pipe_diameter_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN pipe_diameter_max;
    PRINT N'182 rollback: pipe_diameter_max rimossa.';
END
GO
