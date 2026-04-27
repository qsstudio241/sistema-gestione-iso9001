/*
  Split tenant — Applicazione mappatura (dopo backup su copia DB)

  Prerequisiti:
  - Eseguito split_tenants_01_create_mapping_tables.sql
  - Compilati INSERT in migration_split_* (vedi split_tenants_02_seed_template.sql)

  Ordine logico interno:
  1) INSERT nuove righe organizations (da migration_split_new_orgs)
  2) Rinomina tenant legacy (QS Studio) + licenze/prefissi opzionali
  3) UPDATE auditor_orgs, users (da tabelle di mappatura)
  4) UPDATE audits (override → company/auditor → created_by)
  5) Tabelle satellite con organization_id

  Eseguire in SSMS come singolo batch (no GO interni) per mantenere la transazione.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.migration_split_meta', N'U') IS NULL
BEGIN
    RAISERROR('Manca migration_split_meta: eseguire prima split_tenants_01_create_mapping_tables.sql', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

DECLARE @legacy_org INT =
    (SELECT legacy_organization_id FROM dbo.migration_split_meta WITH (NOLOCK) WHERE id = 1);

PRINT N'--- 1) Nuove organizations ---';

IF COL_LENGTH(N'dbo.organizations', N'created_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.organizations', N'updated_at') IS NOT NULL
BEGIN
    INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active, created_at, updated_at)
    SELECT m.organization_code,
           m.organization_name,
           ISNULL(NULLIF(LTRIM(RTRIM(m.contact_email)), N''), N'noreply@local.invalid'),
           1,
           SYSUTCDATETIME(),
           SYSUTCDATETIME()
    FROM dbo.migration_split_new_orgs AS m
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.organizations AS o WHERE o.organization_code = m.organization_code
    );
END
ELSE
BEGIN
    INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active)
    SELECT m.organization_code,
           m.organization_name,
           ISNULL(NULLIF(LTRIM(RTRIM(m.contact_email)), N''), N'noreply@local.invalid'),
           1
    FROM dbo.migration_split_new_orgs AS m
    WHERE NOT EXISTS (
        SELECT 1 FROM dbo.organizations AS o WHERE o.organization_code = m.organization_code
    );
END

UPDATE m
SET inserted_organization_id = o.organization_id,
    applied_at             = SYSUTCDATETIME()
FROM dbo.migration_split_new_orgs AS m
INNER JOIN dbo.organizations AS o ON o.organization_code = m.organization_code
WHERE m.inserted_organization_id IS NULL;

IF COL_LENGTH(N'dbo.organizations', N'licensed_modules') IS NOT NULL
BEGIN
    UPDATE o
    SET o.licensed_modules =
        CASE
            WHEN m.licensed_modules_json IS NOT NULL THEN m.licensed_modules_json
            WHEN m.copy_licenses_from_legacy = 1 THEN leg.licensed_modules
            ELSE o.licensed_modules
        END
    FROM dbo.organizations AS o
    INNER JOIN dbo.migration_split_new_orgs AS m ON m.organization_code = o.organization_code
    CROSS JOIN dbo.organizations AS leg
    WHERE leg.organization_id = @legacy_org
      AND (m.licensed_modules_json IS NOT NULL OR m.copy_licenses_from_legacy = 1);
END;

IF COL_LENGTH(N'dbo.organizations', N'audit_report_prefix') IS NOT NULL
BEGIN
    UPDATE o
    SET o.audit_report_prefix = m.audit_report_prefix
    FROM dbo.organizations AS o
    INNER JOIN dbo.migration_split_new_orgs AS m ON m.organization_code = o.organization_code
    WHERE m.audit_report_prefix IS NOT NULL;
END;

PRINT N'--- 2) Rinomina org legacy (QS Studio) ---';

UPDATE o
SET o.organization_code = meta.rename_legacy_to_code,
    o.organization_name = meta.rename_legacy_to_name
FROM dbo.organizations AS o
CROSS JOIN dbo.migration_split_meta AS meta
WHERE meta.id = 1
  AND o.organization_id = meta.legacy_organization_id
  AND meta.rename_legacy_to_code IS NOT NULL;

PRINT N'--- 3a) auditor_orgs ---';

UPDATE ao
SET ao.organization_id = map.target_organization_id
FROM dbo.auditor_orgs AS ao
INNER JOIN dbo.migration_split_auditor_org AS map ON map.auditor_org_id = ao.id;

PRINT N'--- 3b) users ---';

UPDATE u
SET u.organization_id = map.target_organization_id
FROM dbo.users AS u
INNER JOIN dbo.migration_split_user AS map ON map.user_id = u.user_id;

PRINT N'--- 3c) user_org_roles (solo righe ancora legate al tenant legacy) ---';

IF OBJECT_ID(N'dbo.user_org_roles', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.org_id = u.organization_id
    FROM dbo.user_org_roles AS r
    INNER JOIN dbo.users AS u ON u.user_id = r.user_id
    WHERE r.org_id = @legacy_org;
END;

PRINT N'--- 4) audits ---';

UPDATE a
SET a.organization_id = ovr.target_organization_id
FROM dbo.audits AS a
INNER JOIN dbo.migration_split_audit_override AS ovr ON ovr.audit_id = a.audit_id;

UPDATE a
SET a.organization_id = ao.organization_id
FROM dbo.audits AS a
INNER JOIN dbo.companies AS c ON c.id = a.company_id
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
WHERE c.auditor_org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.migration_split_audit_override AS x WHERE x.audit_id = a.audit_id
);

UPDATE a
SET a.organization_id = u.organization_id
FROM dbo.audits AS a
INNER JOIN dbo.users AS u ON u.user_id = a.created_by
WHERE a.company_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM dbo.migration_split_audit_override AS x WHERE x.audit_id = a.audit_id
);

UPDATE a
SET a.organization_id = u.organization_id
FROM dbo.audits AS a
INNER JOIN dbo.users AS u ON u.user_id = a.created_by
WHERE a.company_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM dbo.companies AS c WHERE c.id = a.company_id AND c.auditor_org_id IS NULL)
  AND NOT EXISTS (
    SELECT 1 FROM dbo.migration_split_audit_override AS x WHERE x.audit_id = a.audit_id
);

PRINT N'--- 5) Satellite: custom_checklists (scope auditor_org) ---';

IF COL_LENGTH(N'dbo.custom_checklists', N'auditor_org_id') IS NOT NULL
BEGIN
    UPDATE cc
    SET cc.organization_id = ao.organization_id
    FROM dbo.custom_checklists AS cc
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = cc.auditor_org_id
    WHERE cc.auditor_org_id IS NOT NULL;
END;

PRINT N'--- 5) import_jobs (da created_by) ---';

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
BEGIN
    UPDATE j
    SET j.organization_id = u.organization_id
    FROM dbo.import_jobs AS j
    INNER JOIN dbo.users AS u ON u.user_id = j.created_by
    WHERE j.created_by IS NOT NULL;
END;

PRINT N'--- 5) document_registry ---';

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
BEGIN
    UPDATE dr
    SET dr.organization_id = ao.organization_id
    FROM dbo.document_registry AS dr
    INNER JOIN dbo.companies AS c ON c.id = dr.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE dr.company_id IS NOT NULL AND c.auditor_org_id IS NOT NULL;

    IF COL_LENGTH(N'dbo.document_registry', N'auditor_org_id') IS NOT NULL
    BEGIN
        UPDATE dr
        SET dr.organization_id = ao.organization_id
        FROM dbo.document_registry AS dr
        INNER JOIN dbo.auditor_orgs AS ao ON ao.id = dr.auditor_org_id
        WHERE dr.auditor_org_id IS NOT NULL;
    END
END;

PRINT N'--- 5) qualifications / risks / objectives ---';

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    UPDATE q
    SET q.organization_id = ao.organization_id
    FROM dbo.qualifications AS q
    INNER JOIN dbo.companies AS c ON c.id = q.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE q.company_id IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
BEGIN
    UPDATE r
    SET r.organization_id = ao.organization_id
    FROM dbo.risks AS r
    INNER JOIN dbo.companies AS c ON c.id = r.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE r.company_id IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
BEGIN
    UPDATE ob
    SET ob.organization_id = ao.organization_id
    FROM dbo.objectives AS ob
    INNER JOIN dbo.companies AS c ON c.id = ob.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE ob.company_id IS NOT NULL;
END;

PRINT N'--- 5) complaints / suppliers ---';

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
BEGIN
    UPDATE cp
    SET cp.organization_id = ao.organization_id
    FROM dbo.complaints AS cp
    INNER JOIN dbo.companies AS c ON c.id = cp.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE cp.company_id IS NOT NULL;
END;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
BEGIN
    UPDATE s
    SET s.organization_id = ao.organization_id
    FROM dbo.suppliers AS s
    INNER JOIN dbo.companies AS c ON c.id = s.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE s.company_id IS NOT NULL;
END;

PRINT N'--- 5) report_template_assignments ---';

IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
BEGIN
    UPDATE rta
    SET rta.organization_id = cc.organization_id
    FROM dbo.report_template_assignments AS rta
    INNER JOIN dbo.custom_checklists AS cc ON cc.id = rta.custom_checklist_id
    WHERE rta.custom_checklist_id IS NOT NULL;
END;

PRINT N'--- Verifica FK organizations ---';

DECLARE @bad_audits INT;
SELECT @bad_audits = COUNT(*)
FROM dbo.audits AS a
LEFT JOIN dbo.organizations AS o ON o.organization_id = a.organization_id
WHERE o.organization_id IS NULL;

IF @bad_audits > 0
BEGIN
    RAISERROR(N'Rollback: audits con organization_id non valido: %d', 16, 1, @bad_audits);
    ROLLBACK TRANSACTION;
    RETURN;
END;

DECLARE @bad_users INT;
SELECT @bad_users = COUNT(*)
FROM dbo.users AS u
LEFT JOIN dbo.organizations AS o ON o.organization_id = u.organization_id
WHERE o.organization_id IS NULL;

IF @bad_users > 0
BEGIN
    RAISERROR(N'Rollback: users con organization_id non valido: %d', 16, 1, @bad_users);
    ROLLBACK TRANSACTION;
    RETURN;
END;

COMMIT TRANSACTION;
PRINT N'Apply completato con COMMIT. Eseguire split_tenants_04_verify_queries.sql';
