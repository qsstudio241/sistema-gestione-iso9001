-- Migration 123: source_risk_id su non_conformities per collegamento Rischio → Piano Azioni
-- Idempotente
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'non_conformities' AND COLUMN_NAME = 'source_risk_id'
)
BEGIN
  ALTER TABLE non_conformities ADD source_risk_id INT NULL;
END
