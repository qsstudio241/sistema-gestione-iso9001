/*
  Allinea organization_id su risks / objectives al tenant del creatore (created_by)
  ---------------------------------------------------------------------------------
  Caso: righe con created_by = Marco (1005) ma organization_id ancora 1001 (legacy).

  Eseguire dopo verifica. Solo righe con created_by valorizzato e mismatch.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.organization_id = u.organization_id,
        r.updated_at      = SYSUTCDATETIME()
    FROM dbo.risks AS r
    INNER JOIN dbo.users AS u ON u.user_id = r.created_by
    WHERE r.created_by IS NOT NULL
      AND r.organization_id <> u.organization_id
      AND r.is_deleted = 0;
    PRINT N'risks aggiornati: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
BEGIN
    UPDATE ob
    SET ob.organization_id = u.organization_id,
        ob.updated_at      = SYSUTCDATETIME()
    FROM dbo.objectives AS ob
    INNER JOIN dbo.users AS u ON u.user_id = ob.created_by
    WHERE ob.created_by IS NOT NULL
      AND ob.organization_id <> u.organization_id
      AND ob.is_deleted = 0;
    PRINT N'objectives aggiornati: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

COMMIT TRANSACTION;

PRINT N'Campione risks (Marco / mismatch residuo):';
IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
    SELECT TOP 10 risk_id, organization_id, company_id, created_by
    FROM dbo.risks
    WHERE created_by = 1005
    ORDER BY risk_id DESC;
