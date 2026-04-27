/*
  Allinea organization_id dopo split (verifica §5 e §9 di split_tenants_05)
  -------------------------------------------------------------------------
  Caso tipico:
  - Utenti auditor con users.organization_id = 1001 (Al.project) ma auditor_org
    su tenant QS (1002) o MASON (1003) → portare users.organization_id = studio.organization_id.
  - Audit con organization_id = 1001 ma company → auditor_org su 1002/1003 → aggiornare
    audits.organization_id alla catena società → studio.

  Eseguire su copia DB; poi rieseguire split_tenants_05_verify_all_linkages.sql
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

PRINT N'--- 1) users: allinea tenant allo studio (solo se auditor_org_id valorizzato) ---';

UPDATE u
SET u.organization_id = ao.organization_id
FROM dbo.users AS u
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = u.auditor_org_id
WHERE u.auditor_org_id IS NOT NULL
  AND u.organization_id <> ao.organization_id;

PRINT N'Righe users aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

PRINT N'--- 2) audits: organization_id da company → auditor_orgs ---';

IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
BEGIN
    UPDATE a
    SET a.organization_id = ao.organization_id
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id
      AND a.is_deleted = 0;
END
ELSE
BEGIN
    UPDATE a
    SET a.organization_id = ao.organization_id
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id;
END;

PRINT N'Righe audits aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

COMMIT TRANSACTION;

PRINT N'--- Controllo rapido (dovrebbe essere vuoto come la verifica §5 su mismatch) ---';
SELECT u.user_id, u.email, u.organization_id AS user_org_id, ao.organization_id AS studio_org_id
FROM dbo.users AS u
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = u.auditor_org_id
WHERE u.auditor_org_id IS NOT NULL
  AND u.organization_id <> ao.organization_id;

PRINT N'--- Controllo §9 (mismatch audit vs company chain) ---';
IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT a.audit_id, a.organization_id AS audit_org_id, ao.organization_id AS atteso_da_company
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.is_deleted = 0
      AND a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id;
ELSE
    SELECT a.audit_id, a.organization_id AS audit_org_id, ao.organization_id AS atteso_da_company
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id;
