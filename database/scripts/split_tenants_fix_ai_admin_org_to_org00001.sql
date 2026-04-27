/*
  Correzione: studio AI.Admin (auditor_orgs.id = 1) deve appartenere al tenant Al.project
  ------------------------------------------------------------------------------
  Sintomo verifica §14: organization_code ORG_00002 ma studio_email admin@sgq.local
  (il tenant QS ha contact marcocamellini@...).

  Aggancia la riga 1 al tenant ORG_00001 (organization_id risolto da codice).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @alproject_org_id INT =
    (SELECT organization_id FROM dbo.organizations WHERE organization_code = N'ORG_00001');

IF @alproject_org_id IS NULL
BEGIN
    RAISERROR(N'Non trovato organization_code ORG_00001.', 16, 1);
    RETURN;
END;

UPDATE dbo.auditor_orgs
SET organization_id = @alproject_org_id,
    updated_at      = SYSUTCDATETIME()
WHERE id = 1
  AND name = N'AI.Admin';

PRINT N'Verifica dopo UPDATE:';
SELECT ao.id,
       ao.name,
       ao.organization_id,
       o.organization_code,
       o.contact_email AS tenant_email,
       ao.email AS studio_email
FROM dbo.auditor_orgs AS ao
INNER JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
WHERE ao.id = 1;
