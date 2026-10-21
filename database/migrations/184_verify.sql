-- Companion di verifica di 184_wpqr_run_ranges.sql
-- Sole SELECT. Tabella assente (DB vuoto prima della 173) = PASS.

SET NOCOUNT ON;

DECLARE @tabella INT = CASE WHEN OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @colonne INT = 0;

IF @tabella = 1
BEGIN
    SELECT @colonne = COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
      AND name IN (
          N'current_a_min', N'current_a_max',
          N'voltage_v_min', N'voltage_v_max',
          N'travel_speed_min', N'travel_speed_max',
          N'heat_input_value_min', N'heat_input_value_max'
      )
      AND is_nullable = 1;
END

SELECT
    CASE
        WHEN @tabella = 0 THEN N'PASS'
        WHEN @colonne = 8 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @tabella AS tabella_presente,
    @colonne AS colonne_range;
