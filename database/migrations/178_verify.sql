-- Companion di verifica di 178_qualifications_vision_clocks.sql
-- Sole SELECT. Tabella qualifications assente (CI apply-on-empty) = PASS.
-- FAIL se la tabella c'è e manca una colonna, se non è nullable, o se il tipo non è date.

SET NOCOUNT ON;

DECLARE @attese INT = 0;
DECLARE @ok INT = 0;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    SET @attese = 2;
    SELECT @ok = COUNT(*)
    FROM sys.columns c
    INNER JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.qualifications')
      AND c.name IN (N'near_vision_expiry_date', N'colour_vision_expiry_date')
      AND c.is_nullable = 1
      AND t.name = N'date';
END

SELECT
    CASE WHEN @ok = @attese THEN N'PASS' ELSE N'FAIL' END AS esito,
    @attese AS colonne_attese,
    @ok AS colonne_date_nullable;
