-- Migration 161: snapshot report gap capacità (VC-1) su commercial_cases
-- Colonne nullable/additive. Idempotente. Nessun GO. Nessun DROP.

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'capability_gap_report_json'
)
BEGIN
    ALTER TABLE commercial_cases ADD capability_gap_report_json NVARCHAR(MAX) NULL;
    PRINT 'Colonna commercial_cases.capability_gap_report_json aggiunta.';
END

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'capability_gap_report_at'
)
BEGIN
    ALTER TABLE commercial_cases ADD capability_gap_report_at DATETIME2 NULL;
    PRINT 'Colonna commercial_cases.capability_gap_report_at aggiunta.';
END
