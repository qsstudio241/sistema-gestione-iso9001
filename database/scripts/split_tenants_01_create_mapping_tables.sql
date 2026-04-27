/*
  Split tenant — Fase 1: tabelle di mappatura (staging)
  Eseguire UNA VOLTA su DB di test, poi produzione dopo backup.

  Dopo l'esecuzione:
  1) Compilare i dati (INSERT) in migration_split_* oppure usare split_tenants_02_seed_template.sql
  2) Eseguire split_tenants_03_apply_migration.sql
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.migration_split_meta', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_split_meta (
        id INT NOT NULL PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        legacy_organization_id INT NOT NULL DEFAULT 1,
        rename_legacy_to_code NVARCHAR(64) NULL,   -- es. QS_STUDIO
        rename_legacy_to_name NVARCHAR(255) NULL,  -- es. N'QS Studio'
        notes NVARCHAR(MAX) NULL
    );
    INSERT INTO dbo.migration_split_meta (id, legacy_organization_id, rename_legacy_to_code, rename_legacy_to_name)
    VALUES (1, 1, N'QS_STUDIO', N'QS Studio');
    PRINT 'Creata migration_split_meta (1 riga default).';
END
ELSE
    PRINT 'migration_split_meta gia esistente.';

IF OBJECT_ID(N'dbo.migration_split_new_orgs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_split_new_orgs (
        row_id INT IDENTITY(1,1) PRIMARY KEY,
        organization_code NVARCHAR(64) NOT NULL,
        organization_name NVARCHAR(255) NOT NULL,
        contact_email NVARCHAR(255) NULL,
        audit_report_prefix NVARCHAR(16) NULL,
        licensed_modules_json NVARCHAR(MAX) NULL, -- JSON come in organizations.licensed_modules; NULL = copia da legacy dopo insert
        copy_licenses_from_legacy BIT NOT NULL DEFAULT 1,
        inserted_organization_id INT NULL,       -- valorizzato dallo script apply dopo INSERT
        applied_at DATETIME2 NULL
    );
    PRINT 'Creata migration_split_new_orgs.';
END
ELSE
    PRINT 'migration_split_new_orgs gia esistente.';

IF OBJECT_ID(N'dbo.migration_split_auditor_org', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_split_auditor_org (
        auditor_org_id INT NOT NULL PRIMARY KEY,
        target_organization_id INT NOT NULL, -- FK logico a organizations(organization_id)
        note NVARCHAR(500) NULL
    );
    PRINT 'Creata migration_split_auditor_org.';
END
ELSE
    PRINT 'migration_split_auditor_org gia esistente.';

IF OBJECT_ID(N'dbo.migration_split_user', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_split_user (
        user_id INT NOT NULL PRIMARY KEY,
        target_organization_id INT NOT NULL,
        note NVARCHAR(500) NULL
    );
    PRINT 'Creata migration_split_user.';
END
ELSE
    PRINT 'migration_split_user gia esistente.';

IF OBJECT_ID(N'dbo.migration_split_audit_override', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.migration_split_audit_override (
        audit_id INT NOT NULL PRIMARY KEY,
        target_organization_id INT NOT NULL,
        note NVARCHAR(500) NULL
    );
    PRINT 'Creata migration_split_audit_override (eccezioni manuali).';
END
ELSE
    PRINT 'migration_split_audit_override gia esistente.';

PRINT 'Fase 1 completata. Compilare le tabelle migration_split_* poi eseguire split_tenants_03_apply_migration.sql';
