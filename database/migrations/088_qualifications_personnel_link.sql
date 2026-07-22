-- Migration 088: collegamento qualifications <-> company_personnel (ADR-012 slice link)
-- Idempotente

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'qualifications' AND COLUMN_NAME = 'personnel_id'
)
BEGIN
    ALTER TABLE qualifications ADD personnel_id INT NULL;
    PRINT 'Colonna qualifications.personnel_id aggiunta.';
END
ELSE
    PRINT 'Colonna qualifications.personnel_id gia presente - skip.';
GO

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'company_personnel' AND COLUMN_NAME = 'person_code'
)
BEGIN
    ALTER TABLE company_personnel ADD person_code NVARCHAR(50) NULL;
    PRINT 'Colonna company_personnel.person_code aggiunta.';
END
ELSE
    PRINT 'Colonna company_personnel.person_code gia presente - skip.';
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_qualifications_personnel')
    ALTER TABLE qualifications
    ADD CONSTRAINT FK_qualifications_personnel
        FOREIGN KEY (personnel_id) REFERENCES company_personnel(id);
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_qualif_personnel' AND object_id = OBJECT_ID('qualifications')
)
    CREATE INDEX IX_qualif_personnel ON qualifications (personnel_id)
    WHERE personnel_id IS NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_company_personnel_company_code'
      AND object_id = OBJECT_ID('company_personnel')
)
    CREATE INDEX IX_company_personnel_company_code
        ON company_personnel (company_id, person_code)
        WHERE person_code IS NOT NULL AND person_code <> '';
GO

PRINT 'Migration 088 completata.';
GO
