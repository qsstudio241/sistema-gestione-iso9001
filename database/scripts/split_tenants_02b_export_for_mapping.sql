/*
  Split tenant — Esportazione dati per compilare gli INSERT di mappatura
  ------------------------------------------------------------------------
  Script SOLO IN LETTURA: nessuna modifica al database.

  Uso consigliato (SSMS):
  1) Eseguire sezione per sezione (o tutto il file).
  2) Griglia risultati → tasto destro → "Salva risultati con nome..." (CSV) per Excel.
  3) Sezione "Bozze INSERT": copiare il testo dalla colonna `insert_sql`, incollare in un
     nuovo query editor, rivedere ogni `target_organization_id` (oggi = valore attuale:
     sostituire dove serve MASON / ERAM / QS dopo aver creato le nuove org).

  Prerequisito: aver eseguito split_tenants_01_create_mapping_tables.sql (opzionale per
  le bozze INSERT verso tabelle migration_*; le bozze possono anche essere incollate
  manualmente in split_tenants_02_seed_template.sql).
*/

SET NOCOUNT ON;

-- ============================================================================
-- 1) ORGANIZZAZIONI (stato attuale)
-- ============================================================================
PRINT N'--- 1) organizations ---';

SELECT o.organization_id,
       o.organization_code,
       o.organization_name,
       o.contact_email,
       o.is_active
FROM dbo.organizations AS o
ORDER BY o.organization_id;

-- ============================================================================
-- 2) STUDI (auditor_orgs) — base per migration_split_auditor_org
-- ============================================================================
PRINT N'--- 2) auditor_orgs ---';

SELECT ao.id AS auditor_org_id,
       ao.organization_id AS current_organization_id,
       ao.name,
       ao.email,
       ao.subscription_plan,
       ao.is_active,
       (SELECT COUNT(*) FROM dbo.companies AS c WHERE c.auditor_org_id = ao.id) AS companies_count
FROM dbo.auditor_orgs AS ao
ORDER BY ao.id;

-- ============================================================================
-- 3) UTENTI — base per migration_split_user
-- ============================================================================
PRINT N'--- 3) users ---';

SELECT u.user_id,
       u.email,
       u.full_name,
       u.role,
       u.organization_id AS current_organization_id,
       u.auditor_org_id,
       u.is_active
FROM dbo.users AS u
ORDER BY u.user_id;

-- ============================================================================
-- 4) user_org_roles (se presente)
-- ============================================================================
PRINT N'--- 4) user_org_roles ---';

IF OBJECT_ID(N'dbo.user_org_roles', N'U') IS NOT NULL
    SELECT r.user_id, r.org_id, r.role
    FROM dbo.user_org_roles AS r
    ORDER BY r.user_id, r.org_id;
ELSE
    SELECT CAST(NULL AS INT) AS user_id WHERE 1 = 0;

-- ============================================================================
-- 5) Sintesi audit per organization_id (contesto)
-- ============================================================================
PRINT N'--- 5) audits per organization_id ---';

IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT a.organization_id, COUNT(*) AS audit_count
    FROM dbo.audits AS a
    WHERE a.is_deleted = 0
    GROUP BY a.organization_id
    ORDER BY a.organization_id;
ELSE
    SELECT a.organization_id, COUNT(*) AS audit_count
    FROM dbo.audits AS a
    GROUP BY a.organization_id
    ORDER BY a.organization_id;

-- ============================================================================
-- 6) Audit candidati a override manuale (regole automatiche deboli)
-- ============================================================================
PRINT N'--- 6) audit senza company (solo created_by) ---';

IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT a.audit_id,
           a.organization_id,
           a.company_id,
           a.created_by,
           u.email AS created_by_email,
           u.organization_id AS creator_organization_id
    FROM dbo.audits AS a
    LEFT JOIN dbo.users AS u ON u.user_id = a.created_by
    WHERE a.is_deleted = 0 AND a.company_id IS NULL
    ORDER BY a.audit_id;
ELSE
    SELECT a.audit_id,
           a.organization_id,
           a.company_id,
           a.created_by,
           u.email AS created_by_email,
           u.organization_id AS creator_organization_id
    FROM dbo.audits AS a
    LEFT JOIN dbo.users AS u ON u.user_id = a.created_by
    WHERE a.company_id IS NULL
    ORDER BY a.audit_id;

PRINT N'--- 7) company con auditor_org_id NULL (fallback created_by sugli audit) ---';

SELECT c.id AS company_id,
       c.name AS company_name,
       c.auditor_org_id
FROM dbo.companies AS c
WHERE c.auditor_org_id IS NULL
ORDER BY c.id;

PRINT N'--- 8) email duplicate (stesso indirizzo su piu user_id) — rischio login ---';

SELECT u.email,
       COUNT(*) AS n_users,
       STUFF((
           SELECT N', ' + CAST(u2.user_id AS NVARCHAR(11))
           FROM dbo.users AS u2
           WHERE u2.email = u.email
           ORDER BY u2.user_id
           FOR XML PATH(N''), TYPE
       ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 2, N'') AS user_ids
FROM dbo.users AS u
WHERE NULLIF(LTRIM(RTRIM(u.email)), N'') IS NOT NULL
GROUP BY u.email
HAVING COUNT(*) > 1;

-- ============================================================================
-- 9) BOZZE INSERT — migration_split_auditor_org (target = org attuale)
--     Modificare i secondi numeri dopo export (es. passare a id MASON / ERAM).
-- ============================================================================
PRINT N'--- 9) Bozze INSERT auditor_org ---';

SELECT N'INSERT INTO dbo.migration_split_auditor_org (auditor_org_id, target_organization_id, note) VALUES ('
    + CAST(ao.id AS NVARCHAR(20)) + N', '
    + CAST(ao.organization_id AS NVARCHAR(20)) + N', N'''
    + REPLACE(ISNULL(ao.name, N''), N'''', N'''''') + N''');' AS insert_sql
FROM dbo.auditor_orgs AS ao
ORDER BY ao.id;

-- ============================================================================
-- 10) BOZZE INSERT — migration_split_user (target = org attuale utente)
-- ============================================================================
PRINT N'--- 10) Bozze INSERT user ---';

SELECT N'INSERT INTO dbo.migration_split_user (user_id, target_organization_id, note) VALUES ('
    + CAST(u.user_id AS NVARCHAR(20)) + N', '
    + CAST(u.organization_id AS NVARCHAR(20)) + N', N'''
    + REPLACE(ISNULL(ISNULL(u.full_name, u.email), N''), N'''', N'''''') + N''');' AS insert_sql
FROM dbo.users AS u
ORDER BY u.user_id;

-- ============================================================================
-- 11) BOZZE INSERT — migration_split_new_orgs (solo intestazione + esempio)
--     Compilare email/prefissi reali; NON rigenerare automaticamente da DB.
-- ============================================================================
PRINT N'--- 11) Esempio statico new_orgs (copiare e adattare) ---';

SELECT N'-- Esempio (adattare email e prefissi):' AS insert_sql
UNION ALL
SELECT N'INSERT INTO dbo.migration_split_new_orgs (organization_code, organization_name, contact_email, audit_report_prefix, licensed_modules_json, copy_licenses_from_legacy) VALUES (N''MASON_SRL'', N''MASON Srl'', N''email@dominio.it'', N''MSN'', NULL, 1);'
UNION ALL
SELECT N'INSERT INTO dbo.migration_split_new_orgs (organization_code, organization_name, contact_email, audit_report_prefix, licensed_modules_json, copy_licenses_from_legacy) VALUES (N''ERAM'', N''ERAM'', N''email@dominio.it'', N''MSN'', NULL, 1);';

PRINT N'--- Fine export ---';
