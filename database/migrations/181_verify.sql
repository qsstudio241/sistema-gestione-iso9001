-- Companion di verifica di 181_wps_iso15609_content.sql
-- Sole SELECT. Tabella welding_procedures assente (CI apply-on-empty) = PASS.

SET NOCOUNT ON;

DECLARE @attese INT = 0;
DECLARE @ok INT = 0;

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
BEGIN
    SET @attese = 7;
    SELECT @ok = COUNT(*)
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.welding_procedures')
      AND c.name IN (
          N'wpqr_ref', N'parent_material_a', N'parent_material_b',
          N'heat_input', N'current_range', N'voltage_range', N'metal_transfer'
      )
      AND c.is_nullable = 1
      AND t.name = N'nvarchar';
END

SELECT
    CASE WHEN @ok = @attese THEN N'PASS' ELSE N'FAIL' END AS esito,
    @attese AS colonne_attese,
    @ok AS colonne_nvarchar_nullable;
