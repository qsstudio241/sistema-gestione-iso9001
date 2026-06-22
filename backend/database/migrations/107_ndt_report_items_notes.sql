-- Migration 107: aggiunge colonna notes a ndt_report_items
-- Necessaria per descrivere il difetto per singolo componente ispezionato
-- (posizione, dimensioni, foto di riferimento, annotazioni ispettore)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ndt_report_items')
      AND name = 'notes'
)
BEGIN
    ALTER TABLE ndt_report_items
        ADD notes NVARCHAR(MAX) NULL;
    PRINT 'Colonna ndt_report_items.notes aggiunta.';
END
ELSE
    PRINT 'Colonna ndt_report_items.notes gia'' esistente — skip.';
