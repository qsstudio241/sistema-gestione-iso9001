-- Migration 075: handoff commessa stub (Epic H slice H1 — opzione H-A)
-- Riferimento esterno passaggio commercial_cases → esecuzione

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_ref'
)
BEGIN
    ALTER TABLE commercial_cases ADD handoff_ref NVARCHAR(100) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_at'
)
BEGIN
    ALTER TABLE commercial_cases ADD handoff_at DATETIME2 NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_by'
)
BEGIN
    ALTER TABLE commercial_cases ADD handoff_by INT NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'handoff_notes'
)
BEGIN
    ALTER TABLE commercial_cases ADD handoff_notes NVARCHAR(500) NULL;
END
GO
