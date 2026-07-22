-- Migration 114: staging revisione ingest batch (IG-3)
-- Tabella bozza revisionabile prima del commit su wpqr_records / qualifications

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ingest_staging')
BEGIN
    CREATE TABLE ingest_staging (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id INT NOT NULL,
        company_id INT NULL,
        doc_type NVARCHAR(50) NOT NULL,
        original_name NVARCHAR(255) NOT NULL,
        storage_path NVARCHAR(500) NOT NULL,
        mime_type NVARCHAR(100) NULL,
        file_size INT NULL,
        staged_fields_json NVARCHAR(MAX) NULL,
        field_confidence_json NVARCHAR(MAX) NULL,
        warnings_json NVARCHAR(MAX) NULL,
        qualification_type NVARCHAR(200) NULL,
        review_status NVARCHAR(20) NOT NULL CONSTRAINT DF_ingest_staging_review_status DEFAULT 'pending',
        committed_wpqr_id INT NULL,
        committed_qualification_id INT NULL,
        created_by INT NULL,
        reviewed_by INT NULL,
        created_at DATETIME2 NOT NULL CONSTRAINT DF_ingest_staging_created_at DEFAULT GETDATE(),
        reviewed_at DATETIME2 NULL,
        error_message NVARCHAR(500) NULL
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints WHERE name = 'CK_ingest_staging_review_status'
)
BEGIN
    ALTER TABLE ingest_staging
        ADD CONSTRAINT CK_ingest_staging_review_status
        CHECK (review_status IN ('pending', 'confirmed', 'rejected'));
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ingest_staging_org_status' AND object_id = OBJECT_ID('ingest_staging')
)
BEGIN
    CREATE INDEX IX_ingest_staging_org_status
        ON ingest_staging (organization_id, review_status, created_at DESC);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes WHERE name = 'IX_ingest_staging_doc_type' AND object_id = OBJECT_ID('ingest_staging')
)
BEGIN
    CREATE INDEX IX_ingest_staging_doc_type
        ON ingest_staging (organization_id, doc_type, created_at DESC);
END;
