-- NON APPLICARE senza sì del committente. Proposta A3: non lanciare run-migration su TEST né su PROD.
-- La CI apply-on-empty del repo può eseguire questo file su un database vuoto: è il gate già previsto, non un apply VPS.
-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 176_verify.sql
-- ROLLBACK: 176_rollback.sql

-- Colonne nullable deleted_at / deleted_by sulle tabelle che oggi subiscono DELETE fisico
-- di evidenze (qualifiche, WPS/WPQR, passate, commesse, allegati, NC, legami del riesame).
-- Non tocca audits (hanno già is_deleted e deleted_at), document_registry (status obsoleto)
-- né le tabelle che hanno già is_deleted. Nessun backfill: le righe esistenti restano NULL
-- e continuano a comparire nelle liste finché l'applicazione non filtra e non scrive le colonne.
-- Nessuna FK e nessun ON DELETE. Statement separati. Tabella assente (CI apply-on-empty) = skip.
-- L'indice filtrato organization_id WHERE deleted_at IS NULL si crea solo se la tabella ha organization_id.

SET NOCOUNT ON;
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.qualifications ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: qualifications.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.qualifications ADD deleted_by INT NULL;
    PRINT N'176: qualifications.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: welding_procedures.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.welding_procedures ADD deleted_by INT NULL;
    PRINT N'176: welding_procedures.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: wpqr_records.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_records ADD deleted_by INT NULL;
    PRINT N'176: wpqr_records.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: wpqr_test_runs.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.wpqr_test_runs ADD deleted_by INT NULL;
    PRINT N'176: wpqr_test_runs.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.wps_wpqr_links ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: wps_wpqr_links.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.wps_wpqr_links ADD deleted_by INT NULL;
    PRINT N'176: wps_wpqr_links.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.wps_welders ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: wps_welders.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.wps_welders ADD deleted_by INT NULL;
    PRINT N'176: wps_welders.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.projects ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: projects.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.projects ADD deleted_by INT NULL;
    PRINT N'176: projects.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.project_welders ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: project_welders.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.project_welders ADD deleted_by INT NULL;
    PRINT N'176: project_welders.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.non_conformities ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: non_conformities.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.non_conformities ADD deleted_by INT NULL;
    PRINT N'176: non_conformities.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.attachments', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.attachments ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: attachments.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.attachments', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.attachments ADD deleted_by INT NULL;
    PRINT N'176: attachments.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.nc_actions', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.nc_actions', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.nc_actions ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: nc_actions.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.nc_actions', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.nc_actions', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.nc_actions ADD deleted_by INT NULL;
    PRINT N'176: nc_actions.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_documents', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_documents', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.commercial_case_documents ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: commercial_case_documents.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_documents', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_documents', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.commercial_case_documents ADD deleted_by INT NULL;
    PRINT N'176: commercial_case_documents.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_checklist_attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_checklist_attachments', N'deleted_at') IS NULL
BEGIN
    ALTER TABLE dbo.commercial_case_checklist_attachments ADD deleted_at DATETIME2(7) NULL;
    PRINT N'176: commercial_case_checklist_attachments.deleted_at aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.commercial_case_checklist_attachments', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.commercial_case_checklist_attachments', N'deleted_by') IS NULL
BEGIN
    ALTER TABLE dbo.commercial_case_checklist_attachments ADD deleted_by INT NULL;
    PRINT N'176: commercial_case_checklist_attachments.deleted_by aggiunta.';
END
GO
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_qualifications_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.qualifications')
   )
BEGIN
    CREATE INDEX IX_qualifications_org_not_deleted
        ON dbo.qualifications (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_qualifications_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.welding_procedures', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.welding_procedures', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_welding_procedures_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.welding_procedures')
   )
BEGIN
    CREATE INDEX IX_welding_procedures_org_not_deleted
        ON dbo.welding_procedures (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_welding_procedures_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_records', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_records', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_records_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_records')
   )
BEGIN
    CREATE INDEX IX_wpqr_records_org_not_deleted
        ON dbo.wpqr_records (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_wpqr_records_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.wpqr_test_runs', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.wpqr_test_runs', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wpqr_test_runs_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wpqr_test_runs')
   )
BEGIN
    CREATE INDEX IX_wpqr_test_runs_org_not_deleted
        ON dbo.wpqr_test_runs (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_wpqr_test_runs_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wps_wpqr_links_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    CREATE INDEX IX_wps_wpqr_links_org_not_deleted
        ON dbo.wps_wpqr_links (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_wps_wpqr_links_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.wps_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_welders', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_wps_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.wps_welders')
   )
BEGIN
    CREATE INDEX IX_wps_welders_org_not_deleted
        ON dbo.wps_welders (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_wps_welders_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.projects', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.projects', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_projects_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.projects')
   )
BEGIN
    CREATE INDEX IX_projects_org_not_deleted
        ON dbo.projects (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_projects_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.project_welders', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.project_welders', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_project_welders_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.project_welders')
   )
BEGIN
    CREATE INDEX IX_project_welders_org_not_deleted
        ON dbo.project_welders (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_project_welders_org_not_deleted creato.';
END
GO
IF OBJECT_ID(N'dbo.non_conformities', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'deleted_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.non_conformities', N'organization_id') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_non_conformities_org_not_deleted' AND object_id = OBJECT_ID(N'dbo.non_conformities')
   )
BEGIN
    CREATE INDEX IX_non_conformities_org_not_deleted
        ON dbo.non_conformities (organization_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice IX_non_conformities_org_not_deleted creato.';
END
GO

-- Una riga nel cestino non deve occupare lo slot del certificato attivo.
-- L'indice 087 esclude solo status <> 'revocata': si ricrea con deleted_at IS NULL.
IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_at') IS NOT NULL
   AND EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'UX_qualif_org_company_cert_person_active'
          AND object_id = OBJECT_ID(N'dbo.qualifications')
   )
BEGIN
    DROP INDEX UX_qualif_org_company_cert_person_active ON dbo.qualifications;
    PRINT N'176: indice unico qualifiche rimosso per riallinearlo al cestino.';
END
GO

IF OBJECT_ID(N'dbo.qualifications', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.qualifications', N'deleted_at') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'UX_qualif_org_company_cert_person_active'
          AND object_id = OBJECT_ID(N'dbo.qualifications')
   )
BEGIN
    CREATE UNIQUE INDEX UX_qualif_org_company_cert_person_active
        ON dbo.qualifications (organization_id, company_id, certificate_number, person_name)
        WHERE status <> 'revocata'
          AND deleted_at IS NULL
          AND certificate_number IS NOT NULL
          AND certificate_number <> '';
    PRINT N'176: indice unico qualifiche ricreato (escluse revocate e cestinate).';
END
GO

-- Lo UNIQUE 174 (wps_id, wpqr_id) tiene anche i legami cestinati. Diventa indice filtrato.
IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_at') IS NOT NULL
   AND EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE name = N'UQ_wps_wpqr_links_wps_wpqr'
          AND parent_object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    ALTER TABLE dbo.wps_wpqr_links DROP CONSTRAINT UQ_wps_wpqr_links_wps_wpqr;
    PRINT N'176: UNIQUE legami WPS-WPQR rimosso.';
END
GO

IF OBJECT_ID(N'dbo.wps_wpqr_links', N'U') IS NOT NULL
   AND COL_LENGTH(N'dbo.wps_wpqr_links', N'deleted_at') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'UX_wps_wpqr_links_pair_active'
          AND object_id = OBJECT_ID(N'dbo.wps_wpqr_links')
   )
BEGIN
    CREATE UNIQUE INDEX UX_wps_wpqr_links_pair_active
        ON dbo.wps_wpqr_links (wps_id, wpqr_id)
        WHERE deleted_at IS NULL;
    PRINT N'176: indice unico legami WPS-WPQR attivi creato.';
END
GO
