/*
  Split tenant — Verifica legami (read-only)
  -------------------------------------------
  Eseguire in SSMS dopo migrazione org / auditor / users. Ogni sezione elenca SOLO
  anomalie: risultato vuoto = OK per quella verifica.

  Suggerimento: Results to Grid; se una query restituisce righe, intervenire.
*/

SET NOCOUNT ON;

PRINT N'========== 1) organizations (catalogo) ==========';
SELECT organization_id, organization_code, organization_name, contact_email, is_active
FROM dbo.organizations
ORDER BY organization_id;

PRINT N'========== 2) auditor_orgs → organizations (FK logica) ==========';
SELECT ao.id, ao.name, ao.organization_id, N'organization_id assente in organizations' AS problema
FROM dbo.auditor_orgs AS ao
LEFT JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
WHERE o.organization_id IS NULL;

PRINT N'========== 3) users → organizations ==========';
SELECT u.user_id, u.email, u.organization_id, N'organization_id orfano' AS problema
FROM dbo.users AS u
LEFT JOIN dbo.organizations AS o ON o.organization_id = u.organization_id
WHERE o.organization_id IS NULL;

PRINT N'========== 4) users → auditor_orgs (id deve esistere se valorizzato) ==========';
SELECT u.user_id, u.email, u.auditor_org_id, N'auditor_org_id orfano' AS problema
FROM dbo.users AS u
LEFT JOIN dbo.auditor_orgs AS ao ON ao.id = u.auditor_org_id
WHERE u.auditor_org_id IS NOT NULL AND ao.id IS NULL;

PRINT N'========== 5) Coerenza user.organization_id vs studio collegato (se auditor_org valorizzato) ==========';
SELECT u.user_id,
       u.email,
       u.organization_id AS user_org_id,
       ao.id AS auditor_org_id,
       ao.organization_id AS studio_org_id,
       N'Utente su tenant diverso dallo studio (verificare policy)' AS nota
FROM dbo.users AS u
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = u.auditor_org_id
WHERE u.auditor_org_id IS NOT NULL
  AND u.organization_id <> ao.organization_id;

PRINT N'========== 6) companies → auditor_orgs ==========';
SELECT c.id, c.name, c.auditor_org_id, N'auditor_org_id orfano' AS problema
FROM dbo.companies AS c
LEFT JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
WHERE c.auditor_org_id IS NOT NULL AND ao.id IS NULL;

PRINT N'========== 7) subscriptions → auditor_orgs ==========';
IF OBJECT_ID(N'dbo.subscriptions', N'U') IS NOT NULL
    SELECT s.id, s.auditor_org_id, N'auditor_org_id orfano' AS problema
    FROM dbo.subscriptions AS s
    LEFT JOIN dbo.auditor_orgs AS ao ON ao.id = s.auditor_org_id
    WHERE ao.id IS NULL;

PRINT N'========== 8) audits → organizations ==========';
IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT a.audit_id, a.organization_id, N'organization_id orfano' AS problema
    FROM dbo.audits AS a
    LEFT JOIN dbo.organizations AS o ON o.organization_id = a.organization_id
    WHERE o.organization_id IS NULL AND a.is_deleted = 0;
ELSE
    SELECT a.audit_id, a.organization_id, N'organization_id orfano' AS problema
    FROM dbo.audits AS a
    LEFT JOIN dbo.organizations AS o ON o.organization_id = a.organization_id
    WHERE o.organization_id IS NULL;

PRINT N'========== 9) audits con company: organization_id vs catena company→auditor_org ==========';
IF COL_LENGTH(N'dbo.audits', N'is_deleted') IS NOT NULL
    SELECT a.audit_id,
           a.organization_id AS audit_org_id,
           ao.organization_id AS atteso_da_company,
           N'Mismatch audit.organization_id vs studio della societa' AS problema
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.is_deleted = 0
      AND a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id;
ELSE
    SELECT a.audit_id,
           a.organization_id AS audit_org_id,
           ao.organization_id AS atteso_da_company,
           N'Mismatch audit.organization_id vs studio della societa' AS problema
    FROM dbo.audits AS a
    INNER JOIN dbo.companies AS c ON c.id = a.company_id
    INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
    WHERE a.company_id IS NOT NULL
      AND c.auditor_org_id IS NOT NULL
      AND a.organization_id <> ao.organization_id;

PRINT N'========== 10) user_org_roles → organizations / users ==========';
IF OBJECT_ID(N'dbo.user_org_roles', N'U') IS NOT NULL
BEGIN
    SELECT r.user_id, r.org_id, N'org_id orfano' AS problema
    FROM dbo.user_org_roles AS r
    LEFT JOIN dbo.organizations AS o ON o.organization_id = r.org_id
    WHERE o.organization_id IS NULL;

    SELECT r.user_id, r.org_id, N'user_id orfano' AS problema
    FROM dbo.user_org_roles AS r
    LEFT JOIN dbo.users AS u ON u.user_id = r.user_id
    WHERE u.user_id IS NULL;

    SELECT r.user_id, r.org_id, u.organization_id AS user_primary_org, N'org_id diverso da users.organization_id' AS nota
    FROM dbo.user_org_roles AS r
    INNER JOIN dbo.users AS u ON u.user_id = r.user_id
    WHERE r.org_id <> u.organization_id;
END;

PRINT N'========== 11) Tabelle satellite: organization_id orfano ==========';
IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
    SELECT N'import_jobs' AS tabella, j.id, j.organization_id
    FROM dbo.import_jobs AS j
    LEFT JOIN dbo.organizations AS o ON o.organization_id = j.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
    SELECT N'document_registry' AS tabella, d.id, d.organization_id
    FROM dbo.document_registry AS d
    LEFT JOIN dbo.organizations AS o ON o.organization_id = d.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.custom_checklists', N'U') IS NOT NULL
    SELECT N'custom_checklists' AS tabella, cc.id, cc.organization_id
    FROM dbo.custom_checklists AS cc
    LEFT JOIN dbo.organizations AS o ON o.organization_id = cc.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.notifications_config', N'U') IS NOT NULL
    SELECT N'notifications_config' AS tabella, n.id, n.organization_id
    FROM dbo.notifications_config AS n
    LEFT JOIN dbo.organizations AS o ON o.organization_id = n.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.audit_daily_sequences', N'U') IS NOT NULL
    SELECT N'audit_daily_sequences' AS tabella, s.id, s.organization_id
    FROM dbo.audit_daily_sequences AS s
    LEFT JOIN dbo.organizations AS o ON o.organization_id = s.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
    SELECT N'qualifications' AS tabella, q.id, q.organization_id
    FROM dbo.qualifications AS q
    LEFT JOIN dbo.organizations AS o ON o.organization_id = q.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
    SELECT N'risks' AS tabella, r.risk_id, r.organization_id
    FROM dbo.risks AS r
    LEFT JOIN dbo.organizations AS o ON o.organization_id = r.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
    SELECT N'objectives' AS tabella, ob.objective_id, ob.organization_id
    FROM dbo.objectives AS ob
    LEFT JOIN dbo.organizations AS o ON o.organization_id = ob.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
    SELECT N'complaints' AS tabella, c.id, c.organization_id
    FROM dbo.complaints AS c
    LEFT JOIN dbo.organizations AS o ON o.organization_id = c.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
    SELECT N'suppliers' AS tabella, s.id, s.organization_id
    FROM dbo.suppliers AS s
    LEFT JOIN dbo.organizations AS o ON o.organization_id = s.organization_id
    WHERE o.organization_id IS NULL;

IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
    SELECT N'report_template_assignments' AS tabella, rta.id, rta.organization_id
    FROM dbo.report_template_assignments AS rta
    LEFT JOIN dbo.organizations AS o ON o.organization_id = rta.organization_id
    WHERE o.organization_id IS NULL;

PRINT N'========== 12) report_templates: organization_id valorizzato ma orfano ==========';
IF OBJECT_ID(N'dbo.report_templates', N'U') IS NOT NULL
    SELECT rt.id, rt.organization_id, N'organization_id orfano' AS problema
    FROM dbo.report_templates AS rt
    LEFT JOIN dbo.organizations AS o ON o.organization_id = rt.organization_id
    WHERE rt.organization_id IS NOT NULL AND o.organization_id IS NULL;

PRINT N'========== 13) Email duplicate (login / ambiguita) ==========';
SELECT u.email,
       COUNT(*) AS n
FROM dbo.users AS u
WHERE NULLIF(LTRIM(RTRIM(u.email)), N'') IS NOT NULL
GROUP BY u.email
HAVING COUNT(*) > 1;

PRINT N'========== 14) Incrocio email studio vs contact_email tenant (solo avviso) ==========';
SELECT ao.id,
       ao.name,
       o.organization_code,
       o.contact_email AS tenant_email,
       ao.email AS studio_email,
       N'Email studio diversa da contact tenant' AS nota
FROM dbo.auditor_orgs AS ao
INNER JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
WHERE NULLIF(LTRIM(RTRIM(ao.email)), N'') IS NOT NULL
  AND LOWER(LTRIM(RTRIM(ao.email))) <> LOWER(LTRIM(RTRIM(o.contact_email)));

PRINT N'========== Fine verifiche ==========';
PRINT N'Se le sezioni 2–14 (escluso catalogo 1 e nota 14) sono vuote, i legami principali sono coerenti.';
