/*
  Split tenant — Query di verifica post-apply (read-only)
  Eseguire dopo split_tenants_03_apply_migration.sql su copia DB.
*/

SET NOCOUNT ON;

PRINT N'--- organizations ---';
SELECT organization_id, organization_code, organization_name, is_active
FROM dbo.organizations
ORDER BY organization_id;

PRINT N'--- mapping staging (nuove org inserite) ---';
SELECT * FROM dbo.migration_split_new_orgs ORDER BY row_id;

PRINT N'--- Audits: organization_id non valido ---';
SELECT a.audit_id, a.organization_id
FROM dbo.audits AS a
LEFT JOIN dbo.organizations AS o ON o.organization_id = a.organization_id
WHERE o.organization_id IS NULL;

PRINT N'--- Utenti: organization_id non valido ---';
SELECT u.user_id, u.email, u.organization_id
FROM dbo.users AS u
LEFT JOIN dbo.organizations AS o ON o.organization_id = u.organization_id
WHERE o.organization_id IS NULL;

PRINT N'--- Conteggi audit per tenant (soft-delete se colonna presente) ---';
IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT organization_id, COUNT(*) AS n FROM dbo.audits WHERE is_deleted = 0 GROUP BY organization_id ORDER BY organization_id;
ELSE
    SELECT organization_id, COUNT(*) AS n FROM dbo.audits GROUP BY organization_id ORDER BY organization_id;

PRINT N'--- Conteggi utenti per tenant ---';
SELECT organization_id, COUNT(*) AS n FROM dbo.users GROUP BY organization_id ORDER BY organization_id;

PRINT N'--- Coerenza auditor_orgs ---';
SELECT ao.id, ao.name, ao.organization_id, o.organization_code
FROM dbo.auditor_orgs AS ao
INNER JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
ORDER BY ao.id;

PRINT N'--- Fine ---';
