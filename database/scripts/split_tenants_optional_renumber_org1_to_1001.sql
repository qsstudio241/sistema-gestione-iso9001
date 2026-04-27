/*
  Split tenant — Opzionale: rinumerare Al.project da organization_id = 1 a 1001
  ------------------------------------------------------------------------------
  Perché: il valore 1 è stato a lungo il “tenant unico” legacy; portare Al.project
  (ORG_00001, amministratore piattaforma) su 1001 allinea numericamente a 1002/1003/1004
  (QS, MASON, ERAM) senza cambiare organization_code.

  Prerequisiti:
  - Non deve esistere già una riga organizations.organization_id = 1001.
  - La riga id = 1 deve essere Al.project (ORG_00001) o equivalente da conservare.
  - Backup + esecuzione su copia DB.

  Ordine interno:
  1) organization_code su id 1 → valore temporaneo (evita UNIQUE con nuova riga).
  2) IDENTITY_INSERT: INSERT organizations con id = 1001 (copia attributi da riga 1).
  3) UPDATE su tutte le tabelle note che referenziano organizations(organization_id).
  4) DELETE organizations dove id = 1.
  5) DBCC CHECKIDENT per allineare prossimo IDENTITY.

  Dopo l'esecuzione: aggiornare eventuali script/config che ancora hardcodano organization_id = 1
  per Al.project (sostituire con 1001).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @OLD INT = 1;
DECLARE @NEW INT = 1001;

IF EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_id = @NEW)
BEGIN
    RAISERROR(N'Esiste gia organizations.organization_id = %d: annullare o cambiare @NEW.', 16, 1, @NEW);
    RETURN;
END;

IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_id = @OLD)
BEGIN
    RAISERROR(N'Manca organizations.organization_id = %d.', 16, 1, @OLD);
    RETURN;
END;

BEGIN TRANSACTION;

UPDATE dbo.organizations
SET organization_code = N'_TEMP_RENUMBER_' + CAST(@OLD AS NVARCHAR(10))
WHERE organization_id = @OLD;

SET IDENTITY_INSERT dbo.organizations ON;

IF COL_LENGTH(N'dbo.organizations', N'created_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.organizations', N'updated_at') IS NOT NULL
BEGIN
    INSERT INTO dbo.organizations (
        organization_id,
        organization_code,
        organization_name,
        contact_email,
        is_active,
        created_at,
        updated_at
    )
    SELECT @NEW,
           N'ORG_00001',
           organization_name,
           contact_email,
           is_active,
           SYSUTCDATETIME(),
           SYSUTCDATETIME()
    FROM dbo.organizations
    WHERE organization_id = @OLD;
END
ELSE
BEGIN
    INSERT INTO dbo.organizations (organization_id, organization_code, organization_name, contact_email, is_active)
    SELECT @NEW, N'ORG_00001', organization_name, contact_email, is_active
    FROM dbo.organizations
    WHERE organization_id = @OLD;
END;

IF COL_LENGTH(N'dbo.organizations', N'licensed_modules') IS NOT NULL
BEGIN
    UPDATE n
    SET n.licensed_modules = o.licensed_modules
    FROM dbo.organizations AS n
    CROSS JOIN dbo.organizations AS o
    WHERE n.organization_id = @NEW AND o.organization_id = @OLD;
END;

IF COL_LENGTH(N'dbo.organizations', N'audit_report_prefix') IS NOT NULL
BEGIN
    UPDATE n
    SET n.audit_report_prefix = o.audit_report_prefix
    FROM dbo.organizations AS n
    CROSS JOIN dbo.organizations AS o
    WHERE n.organization_id = @NEW AND o.organization_id = @OLD;
END;

SET IDENTITY_INSERT dbo.organizations OFF;

UPDATE dbo.users SET organization_id = @NEW WHERE organization_id = @OLD;
UPDATE dbo.auditor_orgs SET organization_id = @NEW WHERE organization_id = @OLD;
UPDATE dbo.audits SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.user_org_roles', N'U') IS NOT NULL
    UPDATE dbo.user_org_roles SET org_id = @NEW WHERE org_id = @OLD;

IF OBJECT_ID(N'dbo.report_templates', N'U') IS NOT NULL
    UPDATE dbo.report_templates SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.report_template_assignments', N'U') IS NOT NULL
    UPDATE dbo.report_template_assignments SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.custom_checklists', N'U') IS NOT NULL
    UPDATE dbo.custom_checklists SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.notifications_config', N'U') IS NOT NULL
    UPDATE dbo.notifications_config SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
    UPDATE dbo.document_registry SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
    UPDATE dbo.qualifications SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.risks', N'U') IS NOT NULL
    UPDATE dbo.risks SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.objectives', N'U') IS NOT NULL
    UPDATE dbo.objectives SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
    UPDATE dbo.complaints SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
    UPDATE dbo.suppliers SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
    UPDATE dbo.import_jobs SET organization_id = @NEW WHERE organization_id = @OLD;

IF OBJECT_ID(N'dbo.audit_daily_sequences', N'U') IS NOT NULL
    UPDATE dbo.audit_daily_sequences SET organization_id = @NEW WHERE organization_id = @OLD;

/* pending_issues: SQL dinamico — altrimenti, se la tabella esiste senza organization_id,
   SQL Server fallisce in compilazione (Msg 207) anche dentro IF COL_LENGTH. */
IF OBJECT_ID(N'dbo.pending_issues', N'U') IS NOT NULL
   AND COL_LENGTH(N'pending_issues', N'organization_id') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.pending_issues SET organization_id = @n WHERE organization_id = @o;',
        N'@n int, @o int',
        @n = @NEW,
        @o = @OLD;

/* non_conformities: nello schema SGQ le NC sono legate all'audit, non a organization_id diretto.
   Non aggiornare qui (evita Msg 207 se la tabella esiste senza quella colonna). */

IF OBJECT_ID(N'dbo.migration_split_meta', N'U') IS NOT NULL
    UPDATE dbo.migration_split_meta SET legacy_organization_id = @NEW WHERE legacy_organization_id = @OLD;

IF OBJECT_ID(N'dbo.migration_split_user', N'U') IS NOT NULL
    UPDATE dbo.migration_split_user SET target_organization_id = @NEW WHERE target_organization_id = @OLD;

IF OBJECT_ID(N'dbo.migration_split_auditor_org', N'U') IS NOT NULL
    UPDATE dbo.migration_split_auditor_org SET target_organization_id = @NEW WHERE target_organization_id = @OLD;

IF OBJECT_ID(N'dbo.migration_split_audit_override', N'U') IS NOT NULL
    UPDATE dbo.migration_split_audit_override SET target_organization_id = @NEW WHERE target_organization_id = @OLD;

DELETE FROM dbo.organizations WHERE organization_id = @OLD;

DECLARE @maxId INT = (SELECT MAX(organization_id) FROM dbo.organizations);
DBCC CHECKIDENT (N'dbo.organizations', RESEED, @maxId);

COMMIT TRANSACTION;

PRINT N'Completato: Al.project ora organization_id = 1001 (ORG_00001). Verificare:';
SELECT organization_id, organization_code, organization_name FROM dbo.organizations ORDER BY organization_id;
