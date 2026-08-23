-- Migration 156 — CHK_attachments_parent include ndt_report_item_id e rdp_test_id
-- Le colonne esistono da 108 (CND) e 127 (RDP); il CHECK di 069 non le ha mai
-- accettate. Upload foto verbale VT CND (solo ndt_report_item_id) falliva con 547.
-- Idempotente. Niente USE / GO.

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CHK_attachments_parent'
      AND parent_object_id = OBJECT_ID('dbo.attachments')
      AND (
          CHARINDEX('ndt_report_item_id', definition) = 0
          OR CHARINDEX('rdp_test_id', definition) = 0
      )
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
    );
END
