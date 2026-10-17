-- NON APPLICARE senza sì del committente.
-- Rollback manuale di 176_soft_delete_columns.sql. Non è eseguito dal runner.
-- Rimuove indici filtrati e colonne deleted_at / deleted_by aggiunte da 176.
-- Se l'applicazione ha già scritto deleted_at, il DROP perde quel segno: backup prima.

SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_qualifications_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.qualifications'))
BEGIN
    DROP INDEX IX_qualifications_org_not_deleted ON dbo.qualifications;
    PRINT N'176 rollback: IX_qualifications_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_welding_procedures_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.welding_procedures'))
BEGIN
    DROP INDEX IX_welding_procedures_org_not_deleted ON dbo.welding_procedures;
    PRINT N'176 rollback: IX_welding_procedures_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpqr_records_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_records'))
BEGIN
    DROP INDEX IX_wpqr_records_org_not_deleted ON dbo.wpqr_records;
    PRINT N'176 rollback: IX_wpqr_records_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wpqr_test_runs_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs'))
BEGIN
    DROP INDEX IX_wpqr_test_runs_org_not_deleted ON dbo.wpqr_test_runs;
    PRINT N'176 rollback: IX_wpqr_test_runs_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wps_wpqr_links_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links'))
BEGIN
    DROP INDEX IX_wps_wpqr_links_org_not_deleted ON dbo.wps_wpqr_links;
    PRINT N'176 rollback: IX_wps_wpqr_links_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_wps_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_welders'))
BEGIN
    DROP INDEX IX_wps_welders_org_not_deleted ON dbo.wps_welders;
    PRINT N'176 rollback: IX_wps_welders_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_projects_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.projects'))
BEGIN
    DROP INDEX IX_projects_org_not_deleted ON dbo.projects;
    PRINT N'176 rollback: IX_projects_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_project_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.project_welders'))
BEGIN
    DROP INDEX IX_project_welders_org_not_deleted ON dbo.project_welders;
    PRINT N'176 rollback: IX_project_welders_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_non_conformities_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.non_conformities'))
BEGIN
    DROP INDEX IX_non_conformities_org_not_deleted ON dbo.non_conformities;
    PRINT N'176 rollback: IX_non_conformities_org_not_deleted rimosso.';
END
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.qualifications DROP COLUMN deleted_by;
    PRINT N'176 rollback: qualifications.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.qualifications DROP COLUMN deleted_at;
    PRINT N'176 rollback: qualifications.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN deleted_by;
    PRINT N'176 rollback: welding_procedures.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.welding_procedures DROP COLUMN deleted_at;
    PRINT N'176 rollback: welding_procedures.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN deleted_by;
    PRINT N'176 rollback: wpqr_records.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_records DROP COLUMN deleted_at;
    PRINT N'176 rollback: wpqr_records.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN deleted_by;
    PRINT N'176 rollback: wpqr_test_runs.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs DROP COLUMN deleted_at;
    PRINT N'176 rollback: wpqr_test_runs.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP COLUMN deleted_by;
    PRINT N'176 rollback: wps_wpqr_links.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP COLUMN deleted_at;
    PRINT N'176 rollback: wps_wpqr_links.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wps_welders DROP COLUMN deleted_by;
    PRINT N'176 rollback: wps_welders.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.wps_welders DROP COLUMN deleted_at;
    PRINT N'176 rollback: wps_welders.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.projects DROP COLUMN deleted_by;
    PRINT N'176 rollback: projects.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.projects DROP COLUMN deleted_at;
    PRINT N'176 rollback: projects.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.project_welders DROP COLUMN deleted_by;
    PRINT N'176 rollback: project_welders.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.project_welders DROP COLUMN deleted_at;
    PRINT N'176 rollback: project_welders.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.non_conformities DROP COLUMN deleted_by;
    PRINT N'176 rollback: non_conformities.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.non_conformities DROP COLUMN deleted_at;
    PRINT N'176 rollback: non_conformities.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.attachments', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.attachments DROP COLUMN deleted_by;
    PRINT N'176 rollback: attachments.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.attachments', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.attachments DROP COLUMN deleted_at;
    PRINT N'176 rollback: attachments.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.nc_actions', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.nc_actions', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.nc_actions DROP COLUMN deleted_by;
    PRINT N'176 rollback: nc_actions.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.nc_actions', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.nc_actions', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.nc_actions DROP COLUMN deleted_at;
    PRINT N'176 rollback: nc_actions.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_documents', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_documents', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.commercial_case_documents DROP COLUMN deleted_by;
    PRINT N'176 rollback: commercial_case_documents.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_documents', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_documents', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.commercial_case_documents DROP COLUMN deleted_at;
    PRINT N'176 rollback: commercial_case_documents.deleted_at rimossa.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_checklist_attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_checklist_attachments', N'deleted_by') IS NOT NULL
BEGIN
    ALTER TABLE dbo.commercial_case_checklist_attachments DROP COLUMN deleted_by;
    PRINT N'176 rollback: commercial_case_checklist_attachments.deleted_by rimossa.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_checklist_attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_checklist_attachments', N'deleted_at') IS NOT NULL
BEGIN
    ALTER TABLE dbo.commercial_case_checklist_attachments DROP COLUMN deleted_at;
    PRINT N'176 rollback: commercial_case_checklist_attachments.deleted_at rimossa.';
END
GO
