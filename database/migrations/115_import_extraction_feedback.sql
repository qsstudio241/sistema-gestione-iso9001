-- Migration 115: feedback estrazione ingest (IG-4) + ai_model su staging

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'import_extraction_feedback')
BEGIN
    CREATE TABLE import_extraction_feedback (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id INT NOT NULL,
        company_id INT NULL,
        doc_type NVARCHAR(50) NOT NULL,
        source NVARCHAR(30) NOT NULL CONSTRAINT DF_ief_source DEFAULT 'batch',
        action NVARCHAR(20) NOT NULL,
        ai_payload_json NVARCHAR(MAX) NULL,
        human_payload_json NVARCHAR(MAX) NULL,
        field_diffs_json NVARCHAR(MAX) NULL,
        field_confidence_json NVARCHAR(MAX) NULL,
        file_name NVARCHAR(255) NULL,
        model_used NVARCHAR(100) NULL,
        staging_id INT NULL,
        reject_reason NVARCHAR(500) NULL,
        created_by INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ief_created_at DEFAULT GETDATE()
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ief_action'
)
BEGIN
    ALTER TABLE import_extraction_feedback
        ADD CONSTRAINT CK_ief_action
        CHECK (action IN ('accepted', 'corrected', 'rejected'));
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ief_org_doctype_created' AND object_id = OBJECT_ID('import_extraction_feedback')
)
BEGIN
    CREATE INDEX IX_ief_org_doctype_created
        ON import_extraction_feedback (organization_id, doc_type, created_at DESC);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ingest_staging') AND name = 'ai_model'
)
BEGIN
    ALTER TABLE ingest_staging ADD ai_model NVARCHAR(100) NULL;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ingest_staging') AND name = 'committed_wps_id'
)
BEGIN
    ALTER TABLE ingest_staging ADD committed_wps_id INT NULL;
END;
