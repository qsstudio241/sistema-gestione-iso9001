-- Migration 147: P×G residuo + nota efficacia (ROO-5 / ROO-7)
-- Idempotente. CHECK 1–3 OR NULL. Non allarga la scala attuale (ROO-13).

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'residual_probability'
)
BEGIN
  ALTER TABLE risks ADD residual_probability TINYINT NULL
    CONSTRAINT CK_risks_residual_probability
    CHECK (residual_probability IS NULL OR residual_probability BETWEEN 1 AND 3);
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'residual_impact'
)
BEGIN
  ALTER TABLE risks ADD residual_impact TINYINT NULL
    CONSTRAINT CK_risks_residual_impact
    CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 3);
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'risks' AND COLUMN_NAME = 'effectiveness_note'
)
BEGIN
  ALTER TABLE risks ADD effectiveness_note NVARCHAR(MAX) NULL;
END
