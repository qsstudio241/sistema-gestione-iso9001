-- Migration 071: responsabile verifica efficacia NC (ISO 10.2)

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'verification_responsible'
)
BEGIN
    ALTER TABLE non_conformities ADD verification_responsible NVARCHAR(200) NULL;
END
