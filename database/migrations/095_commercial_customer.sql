-- Migration 095: committente commerciale su commercial_cases (scenario LM&CO / PT.MAIDO)
-- company_id = azienda SGQ che riesamina le capacità; commercial_customer_* = cliente del lavoro

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'commercial_customer_name'
)
BEGIN
    ALTER TABLE commercial_cases ADD commercial_customer_name NVARCHAR(255) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'commercial_cases' AND COLUMN_NAME = 'commercial_customer_ref'
)
BEGIN
    ALTER TABLE commercial_cases ADD commercial_customer_ref NVARCHAR(100) NULL;
END
GO
