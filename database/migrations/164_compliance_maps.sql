-- =============================================================================
-- Migration 164 — Compliance Map (§8.2) CM-1
-- Grafo multi-tenant requisito ↔ norma/legge ↔ evidenza ↔ gap (HITL).
-- Idempotente: IF NOT EXISTS. Niente GO. Nessun ON DELETE CASCADE.
-- =============================================================================

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'compliance_maps' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.compliance_maps (
        id                   INT            IDENTITY(1,1) NOT NULL,
        uuid                 UNIQUEIDENTIFIER NOT NULL
            CONSTRAINT DF_cm_uuid DEFAULT NEWID(),
        organization_id      INT            NOT NULL,
        company_id           INT            NOT NULL,
        commercial_case_id   INT            NULL,
        title                NVARCHAR(300)  NOT NULL,
        source_label         NVARCHAR(300)  NULL,
        map_version          INT            NOT NULL
            CONSTRAINT DF_cm_map_version DEFAULT 1,
        status               NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_cm_status DEFAULT N'draft',
        created_by           INT            NULL,
        updated_by           INT            NULL,
        created_at           DATETIME2      NOT NULL
            CONSTRAINT DF_cm_created_at DEFAULT SYSUTCDATETIME(),
        updated_at           DATETIME2      NOT NULL
            CONSTRAINT DF_cm_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_compliance_maps PRIMARY KEY CLUSTERED (id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cm_status'
)
BEGIN
    ALTER TABLE dbo.compliance_maps
    ADD CONSTRAINT CK_cm_status
        CHECK (status IN (N'draft', N'in_review', N'approved', N'archived'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cm_org_company'
      AND object_id = OBJECT_ID('dbo.compliance_maps')
)
BEGIN
    CREATE INDEX IX_cm_org_company
        ON dbo.compliance_maps (organization_id, company_id);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_cm_uuid'
      AND object_id = OBJECT_ID('dbo.compliance_maps')
)
BEGIN
    CREATE UNIQUE INDEX UQ_cm_uuid ON dbo.compliance_maps (uuid);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'compliance_map_items' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.compliance_map_items (
        id                      INT            IDENTITY(1,1) NOT NULL,
        map_id                  INT            NOT NULL,
        organization_id         INT            NOT NULL,
        company_id              INT            NOT NULL,
        req_key                 NVARCHAR(120)  NOT NULL,
        req_text                NVARCHAR(MAX)  NOT NULL,
        req_source              NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_cmi_req_source DEFAULT N'manual',
        norm_requirement_id     INT            NULL,
        standard_code           NVARCHAR(100)  NULL,
        clause_ref              NVARCHAR(100)  NULL,
        legislation_ref         NVARCHAR(300)  NULL,
        evidence_document_ids   NVARCHAR(MAX)  NULL,
        coverage                NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_cmi_coverage DEFAULT N'unknown',
        gap_note                NVARCHAR(MAX)  NULL,
        hitl_status             NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_cmi_hitl_status DEFAULT N'proposed',
        proposed_by             NVARCHAR(32)   NOT NULL
            CONSTRAINT DF_cmi_proposed_by DEFAULT N'user',
        reviewed_by             INT            NULL,
        reviewed_at             DATETIME2      NULL,
        created_at              DATETIME2      NOT NULL
            CONSTRAINT DF_cmi_created_at DEFAULT SYSUTCDATETIME(),
        updated_at              DATETIME2      NOT NULL
            CONSTRAINT DF_cmi_updated_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_compliance_map_items PRIMARY KEY CLUSTERED (id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cmi_req_source'
)
BEGIN
    ALTER TABLE dbo.compliance_map_items
    ADD CONSTRAINT CK_cmi_req_source
        CHECK (req_source IN (N'ingest', N'manual', N'ai'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cmi_coverage'
)
BEGIN
    ALTER TABLE dbo.compliance_map_items
    ADD CONSTRAINT CK_cmi_coverage
        CHECK (coverage IN (N'unknown', N'covered', N'partial', N'missing', N'na'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cmi_hitl_status'
)
BEGIN
    ALTER TABLE dbo.compliance_map_items
    ADD CONSTRAINT CK_cmi_hitl_status
        CHECK (hitl_status IN (N'proposed', N'accepted', N'edited', N'rejected'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_cmi_proposed_by'
)
BEGIN
    ALTER TABLE dbo.compliance_map_items
    ADD CONSTRAINT CK_cmi_proposed_by
        CHECK (proposed_by IN (N'gemini', N'user', N'compiler'));
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cmi_org_company'
      AND object_id = OBJECT_ID('dbo.compliance_map_items')
)
BEGIN
    CREATE INDEX IX_cmi_org_company
        ON dbo.compliance_map_items (organization_id, company_id);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cmi_map_req_key'
      AND object_id = OBJECT_ID('dbo.compliance_map_items')
)
BEGIN
    CREATE INDEX IX_cmi_map_req_key
        ON dbo.compliance_map_items (map_id, req_key);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'compliance_map_events' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.compliance_map_events (
        id               INT            IDENTITY(1,1) NOT NULL,
        map_id           INT            NOT NULL,
        item_id          INT            NULL,
        organization_id  INT            NOT NULL,
        actor_user_id    INT            NULL,
        event_type       NVARCHAR(64)   NOT NULL,
        payload_json     NVARCHAR(MAX)  NULL,
        created_at       DATETIME2      NOT NULL
            CONSTRAINT DF_cme_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_compliance_map_events PRIMARY KEY CLUSTERED (id)
    );
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cme_map_created'
      AND object_id = OBJECT_ID('dbo.compliance_map_events')
)
BEGIN
    CREATE INDEX IX_cme_map_created
        ON dbo.compliance_map_events (map_id, created_at);
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_cme_org'
      AND object_id = OBJECT_ID('dbo.compliance_map_events')
)
BEGIN
    CREATE INDEX IX_cme_org
        ON dbo.compliance_map_events (organization_id);
END
