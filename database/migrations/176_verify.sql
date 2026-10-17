-- NON APPLICARE senza sì. Companion di verifica di 176_soft_delete_columns.sql
-- Sole SELECT su metadati. Tabella assente = skip (CI apply-on-empty). FAIL se la tabella c'è
-- e manca una colonna, se la colonna non è nullable, se manca l'indice filtrato atteso,
-- o se deleted_at/deleted_by hanno una FK con azione referenziale diversa da NO ACTION.

SET NOCOUNT ON;

DECLARE @attese INT = 0;
DECLARE @ok INT = 0;
DECLARE @indici_attesi INT = 0;
DECLARE @indici_ok INT = 0;
DECLARE @cascade INT = 0;

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.qualifications')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.welding_procedures')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wpqr_records')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.wps_welders')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.projects')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.project_welders')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.non_conformities')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.attachments', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.attachments')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.nc_actions', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.nc_actions')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.commercial_case_documents', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.commercial_case_documents')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.commercial_case_checklist_attachments', N'U') IS NOT NULL
BEGIN
    SET @attese = @attese + 2;
    SELECT @ok = @ok + COUNT(*)
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.commercial_case_checklist_attachments')
      AND name IN (N'deleted_at', N'deleted_by')
      AND is_nullable = 1;
END

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_qualifications_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.qualifications')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_welding_procedures_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.welding_procedures')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_records_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_records')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_test_runs_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wps_wpqr_links_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wps_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_welders')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_projects_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.projects')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_project_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.project_welders')
    ) SET @indici_ok = @indici_ok + 1;
END

IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'organization_id') IS NOT NULL
BEGIN
    SET @indici_attesi = @indici_attesi + 1;
    IF EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_non_conformities_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.non_conformities')
    ) SET @indici_ok = @indici_ok + 1;
END

SELECT @cascade = COUNT(*)
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
WHERE fk.delete_referential_action <> 0
  AND COL_NAME(fkc.parent_object_id, fkc.parent_column_id) IN (N'deleted_at', N'deleted_by')
  AND OBJECT_NAME(fk.parent_object_id) IN (N'qualifications', N'welding_procedures', N'wpqr_records', N'wpqr_test_runs', N'wps_wpqr_links', N'wps_welders', N'projects', N'project_welders', N'non_conformities', N'attachments', N'nc_actions', N'commercial_case_documents', N'commercial_case_checklist_attachments');

SELECT
    CASE
        WHEN @ok = @attese AND @indici_ok = @indici_attesi AND @cascade = 0 THEN N'PASS'
        ELSE N'FAIL'
    END AS esito,
    @attese AS colonne_attese,
    @ok AS colonne_nullable_presenti,
    @indici_attesi AS indici_attesi,
    @indici_ok AS indici_presenti,
    @cascade AS fk_con_delete;
