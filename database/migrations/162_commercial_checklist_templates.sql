-- Migration 162: template checklist Riesame requisiti (studio / per cliente)
-- Additive. Idempotente. Nessun GO. Nessun DROP.
-- Snapshot sul caso resta in commercial_case_checklist (nessuna ALTER su quella tabella).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_checklist_templates' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE commercial_checklist_templates (
        id                INT IDENTITY(1,1) PRIMARY KEY,
        organization_id   INT           NOT NULL,
        company_id        INT           NULL,
        name              NVARCHAR(200) NOT NULL,
        is_active         BIT           NOT NULL CONSTRAINT DF_cct_is_active DEFAULT (1),
        created_by        INT           NULL,
        created_at        DATETIME2     NOT NULL CONSTRAINT DF_cct_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at        DATETIME2     NULL,
        CONSTRAINT FK_cct_org FOREIGN KEY (organization_id) REFERENCES organizations(organization_id),
        CONSTRAINT FK_cct_company FOREIGN KEY (company_id) REFERENCES companies(id)
    );
    PRINT 'Tabella commercial_checklist_templates creata.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_cct_org_company_active' AND object_id = OBJECT_ID('dbo.commercial_checklist_templates'))
    CREATE INDEX IX_cct_org_company_active
    ON commercial_checklist_templates(organization_id, company_id, is_active);

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'commercial_checklist_template_items' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE commercial_checklist_template_items (
        id            INT IDENTITY(1,1) PRIMARY KEY,
        template_id   INT           NOT NULL,
        phase         NVARCHAR(20)  NOT NULL
            CONSTRAINT CK_ccti_phase CHECK (phase IN ('preliminary', 'final')),
        item_ref      NVARCHAR(30)  NOT NULL,
        item_text     NVARCHAR(500) NOT NULL,
        sort_order    INT           NOT NULL CONSTRAINT DF_ccti_sort DEFAULT (0),
        is_core       BIT           NOT NULL CONSTRAINT DF_ccti_is_core DEFAULT (0),
        CONSTRAINT FK_ccti_template FOREIGN KEY (template_id)
            REFERENCES commercial_checklist_templates(id),
        CONSTRAINT UQ_ccti_template_phase_ref UNIQUE (template_id, phase, item_ref)
    );
    PRINT 'Tabella commercial_checklist_template_items creata.';
END

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ccti_template_phase' AND object_id = OBJECT_ID('dbo.commercial_checklist_template_items'))
    CREATE INDEX IX_ccti_template_phase
    ON commercial_checklist_template_items(template_id, phase, sort_order);
