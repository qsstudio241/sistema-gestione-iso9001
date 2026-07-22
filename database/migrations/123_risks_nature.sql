-- Migration 123: campo nature su tabella risks (rischio vs opportunità §6.1)
-- Idempotente: verifica esistenza colonna prima di aggiungerla
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'nature'
)
BEGIN
  ALTER TABLE risks
    ADD nature NVARCHAR(20) NOT NULL DEFAULT 'risk'
    CONSTRAINT CK_risks_nature CHECK (nature IN ('risk', 'opportunity'));
END
