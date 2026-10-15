-- Rollback di 173_wpqr_test_data.sql (NON eseguito dal runner: file manuale, solo su richiesta esplicita).
-- ATTENZIONE: elimina TUTTE le passate in dbo.wpqr_test_runs e i valori delle colonne di testata aggiunte da 173
-- su dbo.wpqr_records, inclusi quelli scritti dopo l'apply. Fare un backup prima.
-- Ordine: FK, indice, tabella figlia, poi le colonne di testata. Idempotente.
-- Rimuove SOLO gli oggetti creati da 173; non tocca colonne preesistenti.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wpqr_test_runs_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wpqr_test_runs'))
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP CONSTRAINT FK_wpqr_test_runs_wpqr;
    PRINT N'173 rollback: FK_wpqr_test_runs_wpqr rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpqr_test_runs_org_wpqr' AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs'))
BEGIN
    DROP INDEX IX_wpqr_test_runs_org_wpqr ON dbo.wpqr_test_runs;
    PRINT N'173 rollback: indice IX_wpqr_test_runs_org_wpqr rimosso.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.wpqr_test_runs;
    PRINT N'173 rollback: tabella wpqr_test_runs rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'welding_position_test') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN welding_position_test;
    PRINT N'173 rollback: colonna wpqr_records.welding_position_test rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'diameter_test_mm') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN diameter_test_mm;
    PRINT N'173 rollback: colonna wpqr_records.diameter_test_mm rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deposited_thickness_mm') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN deposited_thickness_mm;
    PRINT N'173 rollback: colonna wpqr_records.deposited_thickness_mm rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'thickness_t2_test_mm') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN thickness_t2_test_mm;
    PRINT N'173 rollback: colonna wpqr_records.thickness_t2_test_mm rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'filler_make') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN filler_make;
    PRINT N'173 rollback: colonna wpqr_records.filler_make rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'filler_size') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN filler_size;
    PRINT N'173 rollback: colonna wpqr_records.filler_size rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'backing_gas') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN backing_gas;
    PRINT N'173 rollback: colonna wpqr_records.backing_gas rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_kind') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_kind;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_kind rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_range_min;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_range_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_range_max;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_range_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_unit') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_range_unit;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_range_unit rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_basis') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_range_basis;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_range_basis rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_tol_minus_pct') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_tol_minus_pct;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_tol_minus_pct rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_tol_plus_pct') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_tol_plus_pct;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_tol_plus_pct rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_plus_unlimited') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN heat_input_plus_unlimited;
    PRINT N'173 rollback: colonna wpqr_records.heat_input_plus_unlimited rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'preheat_temp_test') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN preheat_temp_test;
    PRINT N'173 rollback: colonna wpqr_records.preheat_temp_test rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'interpass_temp_test') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN interpass_temp_test;
    PRINT N'173 rollback: colonna wpqr_records.interpass_temp_test rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'post_heating') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN post_heating;
    PRINT N'173 rollback: colonna wpqr_records.post_heating rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'pwht_details') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN pwht_details;
    PRINT N'173 rollback: colonna wpqr_records.pwht_details rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'range_standard_reference') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN range_standard_reference;
    PRINT N'173 rollback: colonna wpqr_records.range_standard_reference rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'shielding_gas_flow_l_min_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN shielding_gas_flow_l_min_min;
    PRINT N'173 rollback: colonna wpqr_records.shielding_gas_flow_l_min_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'shielding_gas_flow_l_min_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN shielding_gas_flow_l_min_max;
    PRINT N'173 rollback: colonna wpqr_records.shielding_gas_flow_l_min_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'nozzle_diameter_mm') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN nozzle_diameter_mm;
    PRINT N'173 rollback: colonna wpqr_records.nozzle_diameter_mm rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'contact_tube_distance_mm_min') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN contact_tube_distance_mm_min;
    PRINT N'173 rollback: colonna wpqr_records.contact_tube_distance_mm_min rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'contact_tube_distance_mm_max') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN contact_tube_distance_mm_max;
    PRINT N'173 rollback: colonna wpqr_records.contact_tube_distance_mm_max rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'tungsten_electrode') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN tungsten_electrode;
    PRINT N'173 rollback: colonna wpqr_records.tungsten_electrode rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'torch_angle_deg') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN torch_angle_deg;
    PRINT N'173 rollback: colonna wpqr_records.torch_angle_deg rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'joint_preparation') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN joint_preparation;
    PRINT N'173 rollback: colonna wpqr_records.joint_preparation rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'cleaning_method') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN cleaning_method;
    PRINT N'173 rollback: colonna wpqr_records.cleaning_method rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'bead_technique') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN bead_technique;
    PRINT N'173 rollback: colonna wpqr_records.bead_technique rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'electrode_count') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN electrode_count;
    PRINT N'173 rollback: colonna wpqr_records.electrode_count rimossa.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'other_test_info') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN other_test_info;
    PRINT N'173 rollback: colonna wpqr_records.other_test_info rimossa.';
END
GO
