-- Migration 031: Document Registry File Attachments
-- Estende la tabella 'attachments' per supportare file allegati ai documenti del registro.
-- Puramente additiva — aggiunge colonne nullable. Sicura da rieseguire (idempotente).

-- 1. Colonna document_id (FK verso document_registry)
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'document_id'
)
BEGIN
    ALTER TABLE attachments ADD document_id INT NULL;
END

-- 2. Versione file del documento (es. "Rev.2", "2.0")
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'doc_file_version'
)
BEGIN
    ALTER TABLE attachments ADD doc_file_version NVARCHAR(20) NULL;
END

-- 3. Flag: indica se è la revisione corrente (ultima) per quel documento
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments') AND name = 'is_current_doc_version'
)
BEGIN
    ALTER TABLE attachments ADD is_current_doc_version BIT NULL DEFAULT 1;
END

-- 4. FK verso document_registry
IF NOT EXISTS (
    SELECT 1 FROM sys.foreign_keys
    WHERE name = 'FK_attachments_document_registry'
)
BEGIN
    ALTER TABLE attachments
        ADD CONSTRAINT FK_attachments_document_registry
        FOREIGN KEY (document_id) REFERENCES document_registry(id);
END

-- 5. Indice per lookup veloce per document_id
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_attachments_document_id' AND object_id = OBJECT_ID('attachments')
)
BEGIN
    CREATE INDEX IX_attachments_document_id ON attachments(document_id);
END
