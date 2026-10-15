-- Companion di verifica per 173_wpqr_test_data.sql
-- Una riga di risultato con esito = PASS|FAIL (sole SELECT, nessuna scrittura).
-- CI apply-on-empty: dbo.wpqr_records assente -> PASS.

SET NOCOUNT ON;

DECLARE @wpqr_presente INT = CASE WHEN OBJECT_ID(N'dbo.wpqr_records', N'U') IS NULL THEN 0 ELSE 1 END;
DECLARE @runs_presente INT = CASE WHEN OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NULL THEN 0 ELSE 1 END;
DECLARE @righe_wpqr INT = 0;
DECLARE @colonne_run_attese INT = 31;
DECLARE @colonne_run_presenti INT = 0;
DECLARE @colonne_testata_attese INT = 32;
DECLARE @colonne_testata_presenti INT = 0;
DECLARE @indice_presente INT = 0;
DECLARE @fk_presente INT = 0;
DECLARE @fk_con_delete INT = 0;
DECLARE @runs_org_incoerenti INT = 0;

IF @wpqr_presente = 1
BEGIN
    SELECT @righe_wpqr = COUNT(*) FROM dbo.wpqr_records;
    SELECT @colonne_testata_presenti = COUNT(*) FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wpqr_records')
      AND name IN (N'welding_position_test', N'diameter_test_mm', N'deposited_thickness_mm', N'thickness_t2_test_mm', N'filler_make', N'filler_size', N'backing_gas', N'heat_input_kind', N'heat_input_range_min', N'heat_input_range_max', N'heat_input_range_unit', N'heat_input_range_basis', N'heat_input_tol_minus_pct', N'heat_input_tol_plus_pct', N'heat_input_plus_unlimited', N'preheat_temp_test', N'interpass_temp_test', N'post_heating', N'pwht_details', N'range_standard_reference', N'shielding_gas_flow_l_min_min', N'shielding_gas_flow_l_min_max', N'nozzle_diameter_mm', N'contact_tube_distance_mm_min', N'contact_tube_distance_mm_max', N'tungsten_electrode', N'torch_angle_deg', N'joint_preparation', N'cleaning_method', N'bead_technique', N'electrode_count', N'other_test_info');
END

IF @runs_presente = 1
BEGIN
    SELECT @colonne_run_presenti = COUNT(*) FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
      AND name IN (N'id', N'organization_id', N'company_id', N'wpqr_id', N'run_no', N'run_label', N'welding_process', N'filler_diameter_mm', N'filler_designation', N'filler_make', N'current_a', N'voltage_v', N'current_polarity', N'wire_feed_speed', N'wire_feed_unit', N'travel_speed', N'travel_speed_unit', N'heat_input_value', N'heat_input_unit', N'metal_transfer', N'weld_time_ms', N'protrusion_mm', N'lift_mm', N'capacitance_mf', N'charging_voltage_v', N'gap_lift_mm', N'spring_force_n', N'remarks', N'source', N'created_at', N'updated_at');

    IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpqr_test_runs_org_wpqr' AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs'))
        SET @indice_presente = 1;

    IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_wpqr_test_runs_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wpqr_test_runs'))
        SET @fk_presente = 1;

    SELECT @fk_con_delete = COUNT(*) FROM sys.foreign_keys
    WHERE name = N'FK_wpqr_test_runs_wpqr' AND parent_object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
      AND (delete_referential_action <> 0 OR update_referential_action <> 0);

    IF @wpqr_presente = 1
        SELECT @runs_org_incoerenti = COUNT(*)
        FROM dbo.wpqr_test_runs r
        INNER JOIN dbo.wpqr_records w ON w.id = r.wpqr_id
        WHERE r.organization_id <> w.organization_id;
END

SELECT
    CASE
        WHEN @wpqr_presente = 0 THEN N'PASS'
        WHEN @runs_presente = 1
             AND @colonne_run_presenti = @colonne_run_attese
             AND @colonne_testata_presenti = @colonne_testata_attese
             AND @indice_presente = 1
             AND @fk_presente = 1
             AND @fk_con_delete = 0
             AND @runs_org_incoerenti = 0 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @righe_wpqr AS righe_wpqr_records,
    @runs_presente AS tabella_wpqr_test_runs_presente,
    @colonne_run_presenti AS colonne_run_presenti,
    @colonne_run_attese AS colonne_run_attese,
    @colonne_testata_presenti AS colonne_testata_presenti,
    @colonne_testata_attese AS colonne_testata_attese,
    @indice_presente AS indice_presente,
    @fk_presente AS fk_presente,
    @fk_con_delete AS fk_con_delete,
    @runs_org_incoerenti AS runs_org_incoerenti,
    CASE
        WHEN @wpqr_presente = 0 THEN N'dbo.wpqr_records assente (CI apply-on-empty / gap pre-169)'
        ELSE N'oggetti di schema 173 presenti; FK senza azioni referenziali; passate coerenti per organization_id'
    END AS nota;
