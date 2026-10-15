-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 173_verify.sql
-- ROLLBACK: 173_rollback.sql
--
-- Migration 173 (WV-3): dati di prova strutturati della WPQR.
--   * tabella figlia dbo.wpqr_test_runs (una riga per passata; stud: 1-2 righe) con organization_id
--     e company_id coerenti con wpqr_records;
--   * colonne di testata NULLABLE su dbo.wpqr_records: condizioni di prova (gruppo A) e parametri
--     processo-specifici (gruppo B).
-- Fonti: ISO 15614-1 Annex B pag. 1-2, ISO 15614-2 Annex A, ISO 14555 Annex C, ISO 15609-1 par. 4.4/4.5
-- (schema: docs/agent-tasks/PLAN_VERIFICA_WPQR_SLICES.md par. 2.2). Le colonne marcate "da campione" nel piano
-- non hanno una clausola: sono dati archiviati, non soglie.
--
-- Additiva e idempotente: ogni oggetto ha il proprio guard (OBJECT_ID / COL_LENGTH / sys.*).
-- Nessuna colonna esistente viene alterata, nessun dato riscritto, nessun DROP/UPDATE/DELETE.
-- FK in statement separato dal CREATE TABLE, SENZA ON DELETE: la cancellazione di una WPQR elimina
-- esplicitamente le passate nello stesso handler (welding.controller).
-- dbo.wpqr_records assente (CI apply-on-empty) -> no-op.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NULL
BEGIN
    PRINT N'173: dbo.wpqr_records assente - skip (apply-on-empty / gap pre-169).';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wpqr_test_runs (
        id                   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id      INT NOT NULL,
        company_id           INT NULL,
        wpqr_id              INT NOT NULL,
        run_no               INT NULL,
        run_label            NVARCHAR(20) NULL,
        welding_process      NVARCHAR(50) NULL,
        filler_diameter_mm   DECIMAL(5,2) NULL,
        filler_designation   NVARCHAR(100) NULL,
        filler_make          NVARCHAR(100) NULL,
        current_a            DECIMAL(8,2) NULL,
        voltage_v            DECIMAL(8,2) NULL,
        current_polarity     NVARCHAR(40) NULL,
        wire_feed_speed      DECIMAL(8,2) NULL,
        wire_feed_unit       NVARCHAR(10) NULL,
        travel_speed         DECIMAL(8,2) NULL,
        travel_speed_unit    NVARCHAR(10) NULL,
        heat_input_value     DECIMAL(10,3) NULL,
        heat_input_unit      NVARCHAR(10) NULL,
        metal_transfer       NVARCHAR(40) NULL,
        weld_time_ms         DECIMAL(10,2) NULL,
        protrusion_mm        DECIMAL(8,2) NULL,
        lift_mm              DECIMAL(8,2) NULL,
        capacitance_mf       DECIMAL(10,2) NULL,
        charging_voltage_v   DECIMAL(8,2) NULL,
        gap_lift_mm          DECIMAL(8,2) NULL,
        spring_force_n       DECIMAL(10,2) NULL,
        remarks              NVARCHAR(200) NULL,
        source               NVARCHAR(10) NULL,
        created_at           DATETIME2 NOT NULL CONSTRAINT DF_wpqr_test_runs_created_at DEFAULT GETDATE(),
        updated_at           DATETIME2 NULL
    );
    PRINT N'173: tabella wpqr_test_runs creata.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_test_runs_org_wpqr'
          AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
   )
BEGIN
    CREATE INDEX IX_wpqr_test_runs_org_wpqr ON dbo.wpqr_test_runs (organization_id, wpqr_id);
    PRINT N'173: indice IX_wpqr_test_runs_org_wpqr creato.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_wpqr_test_runs_wpqr'
          AND parent_object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
   )
BEGIN
    ALTER TABLE dbo.wpqr_test_runs
        ADD CONSTRAINT FK_wpqr_test_runs_wpqr FOREIGN KEY (wpqr_id) REFERENCES dbo.wpqr_records (id);
    PRINT N'173: FK_wpqr_test_runs_wpqr creata (nessuna azione referenziale).';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'welding_position_test') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD welding_position_test NVARCHAR(40) NULL;
    PRINT N'173: colonna wpqr_records.welding_position_test aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'diameter_test_mm') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD diameter_test_mm DECIMAL(8,2) NULL;
    PRINT N'173: colonna wpqr_records.diameter_test_mm aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deposited_thickness_mm') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD deposited_thickness_mm DECIMAL(8,2) NULL;
    PRINT N'173: colonna wpqr_records.deposited_thickness_mm aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'thickness_t2_test_mm') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD thickness_t2_test_mm DECIMAL(8,2) NULL;
    PRINT N'173: colonna wpqr_records.thickness_t2_test_mm aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'filler_make') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD filler_make NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.filler_make aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'filler_size') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD filler_size NVARCHAR(50) NULL;
    PRINT N'173: colonna wpqr_records.filler_size aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'backing_gas') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD backing_gas NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.backing_gas aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_kind') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_kind NVARCHAR(20) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_kind aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_range_min DECIMAL(8,3) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_range_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_range_max DECIMAL(8,3) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_range_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_unit') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_range_unit NVARCHAR(10) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_range_unit aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_range_basis') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_range_basis NVARCHAR(10) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_range_basis aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_tol_minus_pct') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_tol_minus_pct DECIMAL(5,1) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_tol_minus_pct aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_tol_plus_pct') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_tol_plus_pct DECIMAL(5,1) NULL;
    PRINT N'173: colonna wpqr_records.heat_input_tol_plus_pct aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'heat_input_plus_unlimited') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD heat_input_plus_unlimited BIT NULL;
    PRINT N'173: colonna wpqr_records.heat_input_plus_unlimited aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'preheat_temp_test') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD preheat_temp_test DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.preheat_temp_test aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'interpass_temp_test') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD interpass_temp_test DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.interpass_temp_test aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'post_heating') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD post_heating NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.post_heating aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'pwht_details') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD pwht_details NVARCHAR(300) NULL;
    PRINT N'173: colonna wpqr_records.pwht_details aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'range_standard_reference') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD range_standard_reference NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.range_standard_reference aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'shielding_gas_flow_l_min_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD shielding_gas_flow_l_min_min DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.shielding_gas_flow_l_min_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'shielding_gas_flow_l_min_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD shielding_gas_flow_l_min_max DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.shielding_gas_flow_l_min_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'nozzle_diameter_mm') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD nozzle_diameter_mm DECIMAL(5,1) NULL;
    PRINT N'173: colonna wpqr_records.nozzle_diameter_mm aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'contact_tube_distance_mm_min') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD contact_tube_distance_mm_min DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.contact_tube_distance_mm_min aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'contact_tube_distance_mm_max') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD contact_tube_distance_mm_max DECIMAL(6,1) NULL;
    PRINT N'173: colonna wpqr_records.contact_tube_distance_mm_max aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'tungsten_electrode') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD tungsten_electrode NVARCHAR(50) NULL;
    PRINT N'173: colonna wpqr_records.tungsten_electrode aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'torch_angle_deg') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD torch_angle_deg DECIMAL(5,1) NULL;
    PRINT N'173: colonna wpqr_records.torch_angle_deg aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'joint_preparation') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD joint_preparation NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.joint_preparation aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'cleaning_method') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD cleaning_method NVARCHAR(100) NULL;
    PRINT N'173: colonna wpqr_records.cleaning_method aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'bead_technique') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD bead_technique NVARCHAR(20) NULL;
    PRINT N'173: colonna wpqr_records.bead_technique aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'electrode_count') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD electrode_count NVARCHAR(10) NULL;
    PRINT N'173: colonna wpqr_records.electrode_count aggiunta.';
END
GO

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'other_test_info') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD other_test_info NVARCHAR(500) NULL;
    PRINT N'173: colonna wpqr_records.other_test_info aggiunta.';
END
GO
