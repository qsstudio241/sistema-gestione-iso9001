-- Rollback di 184_wpqr_run_ranges.sql (NON eseguito dal runner).
-- Rimuove solo le colonne di range. I valori puntuali restano. Fare un backup prima.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'heat_input_value_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN heat_input_value_max;
    PRINT N'184 rollback: heat_input_value_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'heat_input_value_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN heat_input_value_min;
    PRINT N'184 rollback: heat_input_value_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'travel_speed_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN travel_speed_max;
    PRINT N'184 rollback: travel_speed_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'travel_speed_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN travel_speed_min;
    PRINT N'184 rollback: travel_speed_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'voltage_v_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN voltage_v_max;
    PRINT N'184 rollback: voltage_v_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'voltage_v_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN voltage_v_min;
    PRINT N'184 rollback: voltage_v_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'current_a_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN current_a_max;
    PRINT N'184 rollback: current_a_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'current_a_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN current_a_min;
    PRINT N'184 rollback: current_a_min rimossa.';
END
GO
