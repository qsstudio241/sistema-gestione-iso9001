-- Migration 163: ponte checklist ↔ allegati (PONTE-1 layout A)
-- Additive. Idempotente. Nessun GO. Nessun DROP.
-- Flag required su template item + snapshot sul caso; tabella link item↔attachment.

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.commercial_checklist_template_items')
      AND name = 'attachment_required'
)
BEGIN
    ALTER TABLE commercial_checklist_template_items
        ADD attachment_required BIT NOT NULL
            CONSTRAINT DF_ccti_attachment_required DEFAULT (0);
    PRINT 'Colonna commercial_checklist_template_items.attachment_required aggiunta.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.commercial_case_checklist')
      AND name = 'attachment_required'
)
BEGIN
    ALTER TABLE commercial_case_checklist
        ADD attachment_required BIT NOT NULL
            CONSTRAINT DF_ccl_attachment_required DEFAULT (0);
    PRINT 'Colonna commercial_case_checklist.attachment_required aggiunta.';
END

IF NOT EXISTS (
    SELECT * FROM sys.tables
    WHERE name = 'commercial_case_checklist_attachments' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
    CREATE TABLE commercial_case_checklist_attachments (
        id                 INT IDENTITY(1,1) PRIMARY KEY,
        checklist_item_id  INT           NOT NULL,
        attachment_id      INT           NOT NULL,
        created_by         INT           NULL,
        created_at         DATETIME2     NOT NULL CONSTRAINT DF_ccca_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_ccca_checklist_item FOREIGN KEY (checklist_item_id)
            REFERENCES commercial_case_checklist(id),
        CONSTRAINT FK_ccca_attachment FOREIGN KEY (attachment_id)
            REFERENCES attachments(attachment_id),
        CONSTRAINT UQ_ccca_item_attachment UNIQUE (checklist_item_id, attachment_id)
    );
    PRINT 'Tabella commercial_case_checklist_attachments creata.';
END

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ccca_checklist_item' AND object_id = OBJECT_ID('dbo.commercial_case_checklist_attachments')
)
    CREATE INDEX IX_ccca_checklist_item
    ON commercial_case_checklist_attachments(checklist_item_id);

IF NOT EXISTS (
    SELECT * FROM sys.indexes
    WHERE name = 'IX_ccca_attachment' AND object_id = OBJECT_ID('dbo.commercial_case_checklist_attachments')
)
    CREATE INDEX IX_ccca_attachment
    ON commercial_case_checklist_attachments(attachment_id);
