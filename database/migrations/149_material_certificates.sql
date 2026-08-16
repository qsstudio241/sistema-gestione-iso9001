-- =============================================================================
-- Migration 149 — Material Compliance (MC-1)
-- Tabelle additive: material_certificates + material_certificate_checks.
-- Spec: docs/specs/MATERIAL_COMPLIANCE_DATA_MODEL.md (ADR-020…024).
-- Idempotente: IF NOT EXISTS su tabella, CHECK, FK, indici.
-- Niente GO (lo script VPS esegue gli stessi statement a step).
-- CASCADE solo figlio→padre (checks → certificato).
-- FK verso import_jobs / document_registry / projects: ON DELETE SET NULL.
-- import_job_file_id: NO ACTION (evita multiple cascade path via import_jobs).
-- =============================================================================

SET NOCOUNT ON;

-- =====================================================================
-- 1) TABELLA PADRE: material_certificates
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'material_certificates' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.material_certificates (
        id                          INT            IDENTITY(1,1) NOT NULL,
        organization_id             INT            NOT NULL,
        company_id                  INT            NOT NULL,
        import_job_id               INT            NULL,
        import_job_file_id          INT            NULL,
        document_registry_id        INT            NULL,
        project_id                  INT            NULL,
        storage_path                NVARCHAR(2000) NULL,
        ddt_no                      NVARCHAR(80)   NULL,
        ddt_date                    DATE           NULL,
        certificate_no              NVARCHAR(120)  NULL,
        material_role               NVARCHAR(16)   NOT NULL
            CONSTRAINT DF_mc_cert_material_role DEFAULT (N'base'),
        designation                 NVARCHAR(200)  NULL,
        heat_or_lot_no              NVARCHAR(80)   NULL,
        product_form                NVARCHAR(40)   NULL,
        dimensions                  NVARCHAR(120)  NULL,
        material_standard           NVARCHAR(80)   NULL,
        manufacturer_works          NVARCHAR(200)  NULL,
        inspection_document_type    NVARCHAR(8)    NULL,
        workflow_status             NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_mc_cert_workflow_status DEFAULT (N'received'),
        extracted_text              NVARCHAR(MAX)  NULL,
        text_extract_reason         NVARCHAR(40)   NULL,
        extracted_json              NVARCHAR(MAX)  NULL,
        corrected_json              NVARCHAR(MAX)  NULL,
        evaluate_result_json        NVARCHAR(MAX)  NULL,
        kb_snapshot_hash            NVARCHAR(64)   NULL,
        kb_snapshot_json            NVARCHAR(MAX)  NULL,
        ai_model                    NVARCHAR(80)   NULL,
        created_by                  INT            NULL,
        reviewed_by                 INT            NULL,
        reviewed_at                 DATETIME2      NULL,
        review_notes                NVARCHAR(MAX)  NULL,
        created_at                  DATETIME2      NOT NULL
            CONSTRAINT DF_mc_cert_created_at DEFAULT SYSUTCDATETIME(),
        updated_at                  DATETIME2      NOT NULL
            CONSTRAINT DF_mc_cert_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_material_certificates PRIMARY KEY CLUSTERED (id)
    );
    PRINT 'Tabella material_certificates creata.';
END
ELSE
    PRINT 'Tabella material_certificates gia presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_mc_cert_material_role')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT CK_mc_cert_material_role
        CHECK (material_role IN (N'base', N'filler'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_mc_cert_inspection_doc_type')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT CK_mc_cert_inspection_doc_type
        CHECK (
            inspection_document_type IS NULL
            OR inspection_document_type IN (N'2.1', N'2.2', N'3.1', N'3.2')
        );

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_mc_cert_workflow_status')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT CK_mc_cert_workflow_status
        CHECK (workflow_status IN (
            N'received',
            N'text_ready',
            N'extracted',
            N'pending_review',
            N'compliant',
            N'non_compliant',
            N'archived',
            N'ocr_running'
        ));

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_org')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_company')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_company
        FOREIGN KEY (company_id) REFERENCES dbo.companies(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_import_job')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_import_job
        FOREIGN KEY (import_job_id) REFERENCES dbo.import_jobs(id)
        ON DELETE SET NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_import_job_file')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_import_job_file
        FOREIGN KEY (import_job_file_id) REFERENCES dbo.import_job_files(id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_document_registry')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_document_registry
        FOREIGN KEY (document_registry_id) REFERENCES dbo.document_registry(id)
        ON DELETE SET NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_project')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_project
        FOREIGN KEY (project_id) REFERENCES dbo.projects(id)
        ON DELETE SET NULL;

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_created_by')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_created_by
        FOREIGN KEY (created_by) REFERENCES dbo.users(user_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_cert_reviewed_by')
    ALTER TABLE dbo.material_certificates
    ADD CONSTRAINT FK_mc_cert_reviewed_by
        FOREIGN KEY (reviewed_by) REFERENCES dbo.users(user_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_cert_org_company'
      AND object_id = OBJECT_ID('dbo.material_certificates')
)
    CREATE NONCLUSTERED INDEX IX_mc_cert_org_company
        ON dbo.material_certificates (organization_id, company_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_cert_org_status'
      AND object_id = OBJECT_ID('dbo.material_certificates')
)
    CREATE NONCLUSTERED INDEX IX_mc_cert_org_status
        ON dbo.material_certificates (organization_id, workflow_status);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_cert_org_role'
      AND object_id = OBJECT_ID('dbo.material_certificates')
)
    CREATE NONCLUSTERED INDEX IX_mc_cert_org_role
        ON dbo.material_certificates (organization_id, material_role);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_cert_org_ddt'
      AND object_id = OBJECT_ID('dbo.material_certificates')
)
    CREATE NONCLUSTERED INDEX IX_mc_cert_org_ddt
        ON dbo.material_certificates (organization_id, ddt_no);

-- =====================================================================
-- 2) TABELLA FIGLIA: material_certificate_checks
-- =====================================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'material_certificate_checks' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.material_certificate_checks (
        id                          INT            IDENTITY(1,1) NOT NULL,
        organization_id             INT            NOT NULL,
        certificate_id              INT            NOT NULL,
        requirement_key             NVARCHAR(80)   NOT NULL,
        source_level                NVARCHAR(32)   NOT NULL,
        source_ref                  NVARCHAR(300)  NULL,
        required_value              NVARCHAR(200)  NULL,
        actual_value                NVARCHAR(200)  NULL,
        result                      NVARCHAR(16)   NOT NULL,
        explanation                 NVARCHAR(500)  NULL,
        created_at                  DATETIME2      NOT NULL
            CONSTRAINT DF_mc_checks_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_material_certificate_checks PRIMARY KEY CLUSTERED (id)
    );
    PRINT 'Tabella material_certificate_checks creata.';
END
ELSE
    PRINT 'Tabella material_certificate_checks gia presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_mc_checks_result')
    ALTER TABLE dbo.material_certificate_checks
    ADD CONSTRAINT CK_mc_checks_result
        CHECK (result IN (N'pass', N'fail', N'skip'));

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_mc_checks_source_level')
    ALTER TABLE dbo.material_certificate_checks
    ADD CONSTRAINT CK_mc_checks_source_level
        CHECK (source_level IN (
            N'en10204',
            N'material_std',
            N'po',
            N'customer',
            N'company'
        ));

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_checks_org')
    ALTER TABLE dbo.material_certificate_checks
    ADD CONSTRAINT FK_mc_checks_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations(organization_id);

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_mc_checks_certificate')
    ALTER TABLE dbo.material_certificate_checks
    ADD CONSTRAINT FK_mc_checks_certificate
        FOREIGN KEY (certificate_id) REFERENCES dbo.material_certificates(id)
        ON DELETE CASCADE;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_checks_certificate'
      AND object_id = OBJECT_ID('dbo.material_certificate_checks')
)
    CREATE NONCLUSTERED INDEX IX_mc_checks_certificate
        ON dbo.material_certificate_checks (certificate_id);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_mc_checks_org_result'
      AND object_id = OBJECT_ID('dbo.material_certificate_checks')
)
    CREATE NONCLUSTERED INDEX IX_mc_checks_org_result
        ON dbo.material_certificate_checks (organization_id, result);

PRINT 'Migration 149 completata.';
