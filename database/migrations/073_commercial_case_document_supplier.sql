-- Migration 073: supplier_id su collegamenti documento registro → caso Riesame
-- Epic S slice S2 — anagrafica fornitore opzionale quando counterparty=supplier

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_case_documents' AND COLUMN_NAME = 'supplier_id'
)
BEGIN
    ALTER TABLE commercial_case_documents ADD supplier_id INT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_ccd_supplier')
BEGIN
    ALTER TABLE commercial_case_documents
    ADD CONSTRAINT FK_ccd_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ccd_supplier_id')
BEGIN
    CREATE INDEX IX_ccd_supplier_id
    ON commercial_case_documents (supplier_id)
    WHERE supplier_id IS NOT NULL;
END
GO
