-- Companion di verifica di 185_discrepancy_notices.sql
-- Sole SELECT.

SET NOCOUNT ON;

DECLARE @tabella INT = CASE WHEN OBJECT_ID(N'dbo.discrepancy_notices', N'U') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @stato INT = CASE
    WHEN COL_LENGTH(N'dbo.discrepancy_notices', N'status') IS NOT NULL THEN 1 ELSE 0 END;
DECLARE @indice INT = CASE
    WHEN EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'UX_discrepancy_notices_entity_rule'
          AND object_id = OBJECT_ID(N'dbo.discrepancy_notices')
    ) THEN 1 ELSE 0 END;

SELECT
    CASE
        WHEN @tabella = 1 AND @stato = 1 AND @indice = 1 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @tabella AS tabella_presente,
    @stato AS colonna_status,
    @indice AS indice_univoco;
