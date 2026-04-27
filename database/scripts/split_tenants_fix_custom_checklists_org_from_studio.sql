/*
  Allinea custom_checklists.organization_id al tenant dello studio (auditor_org_id)
  ---------------------------------------------------------------------------------
  Caso: checklist con organization_id = 1001 (Al.project) ma auditor_org su QS (1002).
  Aggiorna dalla catena checklist → auditor_orgs.

  Poi allinea report_template_assignments.organization_id alla checklist collegata
  (stessa logica di split_tenants_06 sezione 3).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

PRINT N'--- 1) custom_checklists ---';

IF COL_LENGTH(N'custom_checklists', N'auditor_org_id') IS NULL
BEGIN
    RAISERROR(N'Colonna custom_checklists.auditor_org_id assente: script non applicabile.', 16, 1);
    ROLLBACK TRANSACTION;
    RETURN;
END;

UPDATE cc
SET cc.organization_id = ao.organization_id,
    cc.updated_at      = SYSUTCDATETIME()
FROM dbo.custom_checklists AS cc
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = cc.auditor_org_id
WHERE cc.auditor_org_id IS NOT NULL
  AND cc.organization_id <> ao.organization_id;

PRINT N'Checklist aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

PRINT N'--- 2) report_template_assignments (legati a custom_checklist_id) ---';

IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
BEGIN
    UPDATE rta
    SET rta.organization_id = cc.organization_id
    FROM dbo.report_template_assignments AS rta
    INNER JOIN dbo.custom_checklists AS cc ON cc.id = rta.custom_checklist_id
    WHERE rta.custom_checklist_id IS NOT NULL
      AND rta.organization_id <> cc.organization_id;

    PRINT N'RTA aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
END;

COMMIT TRANSACTION;

PRINT N'--- Verifica (sezione 2 di split_tenants_06): deve essere vuota ---';
EXEC sys.sp_executesql
    N'SELECT cc.id, cc.name, cc.organization_id AS checklist_org_id, ao.organization_id AS studio_tenant_id
      FROM dbo.custom_checklists AS cc
      INNER JOIN dbo.auditor_orgs AS ao ON ao.id = cc.auditor_org_id
      WHERE cc.auditor_org_id IS NOT NULL AND cc.organization_id <> ao.organization_id;';
