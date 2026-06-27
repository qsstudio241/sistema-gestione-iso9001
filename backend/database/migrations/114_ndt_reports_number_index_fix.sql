-- Migration 114: indice univoco report_number per organizzazione (non globale)
-- La numerazione VT-YYYY-NNN e' progressiva per organization_id (come RD-YYYY-NNN).
-- L'indice globale su report_number impediva il salvataggio a tutte le org dopo la prima.

IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_ndt_reports_number'
      AND object_id = OBJECT_ID('ndt_reports')
)
BEGIN
    DROP INDEX UX_ndt_reports_number ON ndt_reports;
    PRINT 'Indice UX_ndt_reports_number rimosso.';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UX_ndt_reports_org_number'
      AND object_id = OBJECT_ID('ndt_reports')
)
BEGIN
    CREATE UNIQUE INDEX UX_ndt_reports_org_number
        ON ndt_reports (organization_id, report_number)
        WHERE report_number IS NOT NULL;
    PRINT 'Indice UX_ndt_reports_org_number creato.';
END
ELSE
    PRINT 'Indice UX_ndt_reports_org_number gia'' esistente — skip.';
