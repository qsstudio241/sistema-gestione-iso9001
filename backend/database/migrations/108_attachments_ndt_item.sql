-- Migration 108: aggiunge ndt_report_item_id alla tabella attachments
-- Permette di allegare foto a singoli componenti ispezionati (righe Elenco Marche)
-- Pattern identico a question_id (ISO checklist) e custom_item_id (custom checklist)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('attachments')
      AND name = 'ndt_report_item_id'
)
BEGIN
    ALTER TABLE attachments
        ADD ndt_report_item_id INT NULL;

    CREATE INDEX IX_attachments_ndt_item
        ON attachments (ndt_report_item_id)
        WHERE ndt_report_item_id IS NOT NULL;

    PRINT 'Colonna ndt_report_item_id aggiunta ad attachments.';
END
ELSE
    PRINT 'Colonna ndt_report_item_id gia'' esistente — skip.';
