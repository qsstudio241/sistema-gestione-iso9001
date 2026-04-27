/*
  Split tenant — Verifica contenuti: checklist, template report, documenti, import, ecc.
  -------------------------------------------------------------------------------------
  Read-only. Utile dopo migrazione tenant per vedere distribuzione e incroci incoerenti.

  1) Conteggi per organization_id (panorama per tenant)
  2) Checklist custom: organization_id vs studio (se auditor_org_id presente)
  3) Assegnazioni template vs checklist (organization_id deve coincidere con la checklist)
  4) Template report per-tenant: orfani / conteggi
  5) Registro documenti: conteggi; mismatch con tenant da società (se catena completa)
  6) Import jobs per tenant
*/

SET NOCOUNT ON;

PRINT N'========== 1) Conteggi per tenant (organization_id) ==========';

IF OBJECT_ID(N'dbo.custom_checklists', N'U') IS NOT NULL
BEGIN
    PRINT N'--- custom_checklists ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.custom_checklists
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
BEGIN
    PRINT N'--- report_template_assignments ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.report_template_assignments
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.report_templates', N'U') IS NOT NULL
BEGIN
    PRINT N'--- report_templates (solo organization_id valorizzato) ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.report_templates
    WHERE organization_id IS NOT NULL
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
BEGIN
    PRINT N'--- document_registry ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.document_registry
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
BEGIN
    PRINT N'--- import_jobs ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.import_jobs
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    PRINT N'--- qualifications ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.qualifications
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
BEGIN
    PRINT N'--- risks ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.risks
    WHERE is_deleted = 0
    GROUP BY organization_id
    ORDER BY organization_id;
END;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
BEGIN
    PRINT N'--- objectives ---';
    SELECT organization_id, COUNT(*) AS n
    FROM dbo.objectives
    WHERE is_deleted = 0
    GROUP BY organization_id
    ORDER BY organization_id;
END;

PRINT N'========== 2) custom_checklists: organization_id diverso dallo studio (auditor_org_id) ==========';
IF COL_LENGTH(N'custom_checklists', N'auditor_org_id') IS NOT NULL
    EXEC sys.sp_executesql
        N'SELECT cc.id, cc.name, cc.organization_id AS checklist_org_id, ao.organization_id AS studio_tenant_id,
                 N''Mismatch: tenant checklist vs tenant studio'' AS problema
          FROM dbo.custom_checklists AS cc
          INNER JOIN dbo.auditor_orgs AS ao ON ao.id = cc.auditor_org_id
          WHERE cc.auditor_org_id IS NOT NULL AND cc.organization_id <> ao.organization_id;';

PRINT N'========== 3) report_template_assignments vs custom_checklist (organization_id) ==========';
IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
    SELECT rta.id,
           rta.organization_id AS rta_org_id,
           cc.organization_id AS checklist_org_id,
           N'RTA organization_id diverso dalla checklist' AS problema
    FROM dbo.report_template_assignments AS rta
    INNER JOIN dbo.custom_checklists AS cc ON cc.id = rta.custom_checklist_id
    WHERE rta.custom_checklist_id IS NOT NULL
      AND rta.organization_id <> cc.organization_id;

PRINT N'========== 4) report_templates: organization_id orfano (tenant inesistente) ==========';
IF OBJECT_ID(N'dbo.report_templates', N'U') IS NOT NULL
    SELECT rt.id, rt.name, rt.organization_id, N'organization_id orfano' AS problema
    FROM dbo.report_templates AS rt
    LEFT JOIN dbo.organizations AS o ON o.organization_id = rt.organization_id
    WHERE rt.organization_id IS NOT NULL
      AND o.organization_id IS NULL;

PRINT N'========== 5) document_registry: mismatch vs tenant da societa (company → studio) ==========';
IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
    SELECT dr.id,
           dr.organization_id AS doc_org_id,
           ao.organization_id AS atteso_da_company,
           N'document_registry.organization_id vs tenant societa' AS problema
    FROM dbo.document_registry AS dr
    INNER JOIN dbo.companies AS c ON c.id = dr.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE dr.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND dr.organization_id <> ao.organization_id;

PRINT N'========== 6) document_registry: organization_id vs studio diretto (auditor_org_id su doc) ==========';
IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
   AND COL_LENGTH(N'document_registry', N'auditor_org_id') IS NOT NULL
    EXEC sys.sp_executesql
        N'SELECT dr.id, dr.organization_id AS doc_org_id, ao.organization_id AS studio_tenant_id,
                 N''document_registry vs studio (auditor_org_id)'' AS problema
          FROM dbo.document_registry AS dr
          INNER JOIN dbo.auditor_orgs AS ao ON ao.id = dr.auditor_org_id
          WHERE dr.auditor_org_id IS NOT NULL AND dr.organization_id <> ao.organization_id;';

PRINT N'========== Fine ==========';
PRINT N'Sezioni 2–6: griglia vuota = nessuna incoerenza rilevata da queste regole. Sezione 1: solo riepilogo conteggi.';
