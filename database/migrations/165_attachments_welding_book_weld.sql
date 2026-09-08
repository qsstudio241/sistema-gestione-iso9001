-- Migration 165 — Allegati foto cordone su riga Welding Book (ISO-5b)
-- Riuso attachments con parent welding_book_weld_id (pattern ndt_report_item_id / rdp_test_id).
-- Aggiorna CHK_attachments_parent (lezione 069 / mig. 156).
-- Idempotente. Niente USE / GO (runner Node VPS).

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'welding_book_weld_id'
)
BEGIN
    ALTER TABLE dbo.attachments ADD welding_book_weld_id INT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_attachments_welding_book_weld'
      AND object_id = OBJECT_ID('dbo.attachments')
)
BEGIN
    CREATE INDEX IX_attachments_welding_book_weld
        ON dbo.attachments (welding_book_weld_id)
        WHERE welding_book_weld_id IS NOT NULL;
END

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CHK_attachments_parent'
      AND parent_object_id = OBJECT_ID('dbo.attachments')
      AND definition NOT LIKE '%welding_book_weld_id%'
)
BEGIN
    ALTER TABLE dbo.attachments DROP CONSTRAINT CHK_attachments_parent;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CHK_attachments_parent'
      AND parent_object_id = OBJECT_ID('dbo.attachments')
)
BEGIN
    ALTER TABLE dbo.attachments
    ADD CONSTRAINT CHK_attachments_parent CHECK (
        audit_id IS NOT NULL
        OR nc_id IS NOT NULL
        OR document_id IS NOT NULL
        OR custom_item_id IS NOT NULL
        OR commercial_case_id IS NOT NULL
        OR ndt_report_item_id IS NOT NULL
        OR rdp_test_id IS NOT NULL
        OR welding_book_weld_id IS NOT NULL
    );
END
