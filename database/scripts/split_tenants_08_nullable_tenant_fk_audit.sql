/*
  Audit colonne nullable legate a tenant / societa / utente (read-only)
  ----------------------------------------------------------------------
  Obiettivo: elencare dove restano NULL su campi che *spesso* possono essere
  derivati da legami gia presenti (organization_id, company_id, auditor_org_id,
  created_by, org_id). Non tutti i NULL vanno riempiti: alcuni sono voluti
  (es. admin senza studio, template di sistema).

  Eseguire in SSMS su SGQ_ISO9001. Interpretazione:
  - Sezione 1: inventario schema (cosa e nullable).
  - Sezione 2: quanti NULL per tabella nota nel progetto.
  - Sezione 3: *candidati* (righe dove un legame esplicito suggerisce un valore).

  Nota: non modifica dati. Fix mirati vanno in script dedicati dopo revisione.
*/

SET NOCOUNT ON;

PRINT N'========== 1) Colonne nullable (tenant / societa / creatore) su tabelle dbo ==========';
SELECT c.TABLE_NAME,
       c.COLUMN_NAME,
       c.DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS AS c
INNER JOIN INFORMATION_SCHEMA.TABLES AS t
    ON t.TABLE_SCHEMA = c.TABLE_SCHEMA AND t.TABLE_NAME = c.TABLE_NAME
WHERE c.TABLE_SCHEMA = N'dbo'
  AND t.TABLE_TYPE = N'BASE TABLE'
  AND c.IS_NULLABLE = N'YES'
  AND (
        c.COLUMN_NAME IN (N'organization_id', N'company_id', N'auditor_org_id', N'created_by', N'org_id')
        OR c.COLUMN_NAME LIKE N'%_organization_id'
      )
ORDER BY c.TABLE_NAME, c.COLUMN_NAME;

PRINT N'========== 2) Conteggi NULL (tabelle operative note nel repo SGQ) ==========';

IF OBJECT_ID(N'dbo.audits', N'U') IS NOT NULL
    SELECT N'audits' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.audits;

IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
    SELECT N'users' AS tabella,
           SUM(CASE WHEN auditor_org_id IS NULL THEN 1 ELSE 0 END) AS null_auditor_org_id,
           SUM(CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END) AS null_organization_id
    FROM dbo.users;

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
    SELECT N'document_registry' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN auditor_org_id IS NULL THEN 1 ELSE 0 END) AS null_auditor_org_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.document_registry;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
    SELECT N'import_jobs' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.import_jobs;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
    SELECT N'qualifications' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.qualifications;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
    SELECT N'risks' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.risks;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
    SELECT N'objectives' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.objectives;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
    SELECT N'complaints' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.complaints;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
    SELECT N'suppliers' AS tabella,
           SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company_id,
           SUM(CASE WHEN created_by IS NULL THEN 1 ELSE 0 END) AS null_created_by
    FROM dbo.suppliers;

IF OBJECT_ID(N'dbo.custom_checklists', N'U') IS NOT NULL
   AND COL_LENGTH(N'custom_checklists', N'auditor_org_id') IS NOT NULL
    EXEC sys.sp_executesql
        N'SELECT N''custom_checklists'' AS tabella, SUM(CASE WHEN auditor_org_id IS NULL THEN 1 ELSE 0 END) AS null_auditor_org_id FROM dbo.custom_checklists;';

IF OBJECT_ID(N'dbo.report_templates', N'U') IS NOT NULL
    SELECT N'report_templates' AS tabella,
           SUM(CASE WHEN organization_id IS NULL THEN 1 ELSE 0 END) AS null_organization_id
    FROM dbo.report_templates;

PRINT N'========== 3) Audits con company_id NULL (spesso voluto per verbale senza societa; campione) ==========';
IF OBJECT_ID(N'dbo.audits', N'U') IS NOT NULL
BEGIN
    SELECT COUNT(*) AS audits_con_company_null
    FROM dbo.audits
    WHERE company_id IS NULL;

    SELECT TOP 30 a.audit_id, a.organization_id, a.company_id, a.created_by
    FROM dbo.audits AS a
    WHERE a.company_id IS NULL
    ORDER BY a.audit_id DESC;
END;

PRINT N'========== 4) Candidati: import_jobs company_id NULL, created_by valorizzato ==========';
IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
    SELECT j.id, j.organization_id, j.created_by, j.company_id
    FROM dbo.import_jobs AS j
    WHERE j.company_id IS NULL AND j.created_by IS NOT NULL;

PRINT N'========== 5) Candidati: qualifications/risks/objectives company_id NULL (solo campione) ==========';
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
    SELECT TOP 20 N'qualifications' AS src, id, organization_id, company_id, created_by
    FROM dbo.qualifications
    WHERE company_id IS NULL;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
    SELECT TOP 20 N'risks' AS src, risk_id, organization_id, company_id, created_by
    FROM dbo.risks
    WHERE company_id IS NULL AND is_deleted = 0;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
    SELECT TOP 20 N'objectives' AS src, objective_id, organization_id, company_id, created_by
    FROM dbo.objectives
    WHERE company_id IS NULL AND is_deleted = 0;

PRINT N'========== Fine ==========';
PRINT N'I NULL non sono sempre errori: valutare policy (es. users.auditor_org_id NULL per admin).';
PRINT N'Per document_registry usare gia split_tenants_fix_document_registry_organization / reassign Camellini.';
