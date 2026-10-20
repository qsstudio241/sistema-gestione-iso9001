-- Companion di verifica di 182_wps_iso15609_wpqr_carry.sql
-- Sole SELECT. Tabella welding_procedures assente (CI apply-on-empty) = PASS.

SET NOCOUNT ON;

DECLARE @attese INT = 0;
DECLARE @ok INT = 0;

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
BEGIN
    SET @attese = 13;
    SELECT @ok = COUNT(*)
    FROM sys.columns c
    WHERE c.object_id = OBJECT_ID(N'dbo.welding_procedures')
      AND c.name IN (
          N'joint_preparation', N'cleaning_method', N'mechanization',
          N'shielding_gas_flow_l_min_min', N'shielding_gas_flow_l_min_max',
          N'post_heating', N'pwht_details', N'bead_technique',
          N'contact_tube_distance_mm_min', N'contact_tube_distance_mm_max',
          N'torch_angle_deg', N'throat_mm', N'pipe_diameter_max'
      )
      AND c.is_nullable = 1;
END

SELECT
    CASE WHEN @ok = @attese THEN N'PASS' ELSE N'FAIL' END AS esito,
    @attese AS colonne_attese,
    @ok AS colonne_nullable;
