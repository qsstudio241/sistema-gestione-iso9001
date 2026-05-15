-- Migration 060: norm_document_sources
-- Collega documenti del registro (ramo "Norme e Leggi") al contesto AI,
-- salvando testo estratto e metadati per arricchire i prompt.

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'norm_document_sources')
BEGIN
    CREATE TABLE norm_document_sources (
        id                  INT IDENTITY(1,1) PRIMARY KEY,
        document_id         INT NOT NULL,
        organization_id     INT NOT NULL,
        standard_code       NVARCHAR(50),
        norm_title          NVARCHAR(200),
        edition_year        INT,
        issuing_body        NVARCHAR(100),
        extracted_text      NVARCHAR(MAX),
        text_quality        NVARCHAR(20),
        validity_status     NVARCHAR(20) DEFAULT 'vigente',
        last_validity_check DATETIME2,
        validity_check_url  NVARCHAR(500),
        created_at          DATETIME2 DEFAULT GETDATE(),
        updated_at          DATETIME2 DEFAULT GETDATE(),

        CONSTRAINT FK_norm_doc_sources_document
            FOREIGN KEY (document_id) REFERENCES document_registry(id),
        CONSTRAINT FK_norm_doc_sources_organization
            FOREIGN KEY (organization_id) REFERENCES organizations(organization_id)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_norm_doc_sources_org')
    CREATE INDEX IX_norm_doc_sources_org
        ON norm_document_sources(organization_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_norm_doc_sources_standard_code')
    CREATE INDEX IX_norm_doc_sources_standard_code
        ON norm_document_sources(standard_code);
GO
