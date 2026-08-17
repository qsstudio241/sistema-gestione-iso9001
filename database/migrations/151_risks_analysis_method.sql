-- Migration 151 (ex 149 su TEST prima del merge MC-1): metodo di analisi + G con segno (ROO-15)
-- 149 ufficiale dopo merge = 149_material_certificates.sql (MC-1, già su TEST/PROD).
-- method sulla riga (default pxg). SWOT usa swot_quadrant e impact_sign.
-- impact resta 1–5 (assoluto); il segno è colonna a parte.
-- Idempotente: su TEST le colonne ci sono già.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'analysis_method'
)
BEGIN
  ALTER TABLE risks ADD analysis_method NVARCHAR(20) NOT NULL
    CONSTRAINT DF_risks_analysis_method DEFAULT 'pxg'
    CONSTRAINT CK_risks_analysis_method CHECK (analysis_method IN ('pxg', 'swot_signed', 'fmea_gpr'));
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'swot_quadrant'
)
BEGIN
  ALTER TABLE risks ADD swot_quadrant CHAR(1) NULL
    CONSTRAINT CK_risks_swot_quadrant CHECK (swot_quadrant IS NULL OR swot_quadrant IN ('S', 'W', 'O', 'T'));
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'impact_sign'
)
BEGIN
  ALTER TABLE risks ADD impact_sign SMALLINT NOT NULL
    CONSTRAINT DF_risks_impact_sign DEFAULT 1
    CONSTRAINT CK_risks_impact_sign CHECK (impact_sign IN (-1, 1));
END
