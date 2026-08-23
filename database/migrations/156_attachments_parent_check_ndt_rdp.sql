-- Migration 156 — CHK_attachments_parent accetta verbale CND e prova RDP
-- Lezione 069: dopo un nuovo parent sugli allegati va aggiornato il CHECK,
-- altrimenti INSERT con solo ndt_report_item_id / rdp_test_id fallisce (500).
-- Le colonne possono già esserci (108 / 127); qui si aggiungono se mancano
-- così il CHECK non fallisce su ambienti incompleti.
-- Idempotente. Niente USE / GO (runner Node VPS).

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'ndt_report_item_id'
)
BEGIN
    ALTER TABLE dbo.attachments ADD ndt_report_item_id INT NULL;
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.attachments') AND name = 'rdp_test_id'
)
BEGIN
    ALTER TABLE dbo.attachments ADD rdp_test_id INT NULL;
END

IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = 'CHK_attachments_parent'
      AND parent_object_id = OBJECT_ID('dbo.attachments')
      AND (
        definition NOT LIKE '%ndt_report_item_id%'
        OR definition NOT LIKE '%rdp_test_id%'
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
