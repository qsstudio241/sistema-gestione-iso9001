-- Migration 109: aggiunge supplier_name a ndt_reports
-- Identifica il fornitore/stabilimento fisicamente ispezionato
-- (distinto dal cliente che commissiona l'ispezione)
-- Scenario: Mason -> Manitou (cliente) -> Fornitore1 (ispezione fisica)

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('ndt_reports') AND name = 'supplier_name'
)
BEGIN
    ALTER TABLE ndt_reports ADD supplier_name NVARCHAR(200) NULL;
    PRINT 'Colonna supplier_name aggiunta a ndt_reports.';
END
ELSE
    PRINT 'supplier_name gia'' esistente — skip.';
