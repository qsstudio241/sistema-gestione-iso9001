-- TYPE: additive
-- BACKFILL: Rielaborazioni
-- VERIFY: 184_verify.sql
-- ROLLBACK: 184_rollback.sql
--
-- Range min/max delle passate presenti solo nella tabella di validità
-- della WPQR. I valori puntuali (current_a, voltage_v, travel_speed,
-- heat_input_value) non si toccano. Nessuna riga esistente viene riscritta.
-- Nessuna FK e nessuna cancellazione a cascata.
--
-- Voce Rielaborazioni: wpqr_validity_runs (dopo questa migrazione).
-- Apply: solo dopo backup COPY_ONLY + CHECKSUM + VERIFYONLY.
-- Runner: backend/scripts/run-migration-184-vps.js (SGQ_MIGRATION_TARGET=test).
-- PROD: non applicare da questo script.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'current_a_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD current_a_min DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.current_a_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'current_a_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD current_a_max DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.current_a_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'voltage_v_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD voltage_v_min DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.voltage_v_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'voltage_v_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD voltage_v_max DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.voltage_v_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'travel_speed_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD travel_speed_min DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.travel_speed_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'travel_speed_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD travel_speed_max DECIMAL(8,2) NULL;
    PRINT N'184: wpqr_test_runs.travel_speed_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'heat_input_value_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD heat_input_value_min DECIMAL(10,3) NULL;
    PRINT N'184: wpqr_test_runs.heat_input_value_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'heat_input_value_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD heat_input_value_max DECIMAL(10,3) NULL;
    PRINT N'184: wpqr_test_runs.heat_input_value_max aggiunta.';
END
GO
