-- Migration 148: scala P/G per azienda (ROO-13)
-- risk_pg_max 3|4|5 (default 3). CHECK su risks allargato a 1–5;
-- il massimo effettivo lo applica l'API in base all'azienda.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'companies' AND COLUMN_NAME = 'risk_pg_max'
)
BEGIN
  ALTER TABLE companies ADD risk_pg_max TINYINT NOT NULL
    CONSTRAINT DF_companies_risk_pg_max DEFAULT 3;
  ALTER TABLE companies ADD CONSTRAINT CK_companies_risk_pg_max
    CHECK (risk_pg_max IN (3, 4, 5));
END

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_risks_prob')
  ALTER TABLE risks DROP CONSTRAINT CHK_risks_prob;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_risks_prob')
  ALTER TABLE risks ADD CONSTRAINT CHK_risks_prob CHECK (probability BETWEEN 1 AND 5);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_risks_impact')
  ALTER TABLE risks DROP CONSTRAINT CHK_risks_impact;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CHK_risks_impact')
  ALTER TABLE risks ADD CONSTRAINT CHK_risks_impact CHECK (impact BETWEEN 1 AND 5);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_risks_residual_probability')
  ALTER TABLE risks DROP CONSTRAINT CK_risks_residual_probability;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_risks_residual_probability')
  ALTER TABLE risks ADD CONSTRAINT CK_risks_residual_probability
    CHECK (residual_probability IS NULL OR residual_probability BETWEEN 1 AND 5);

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_risks_residual_impact')
  ALTER TABLE risks DROP CONSTRAINT CK_risks_residual_impact;
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_risks_residual_impact')
  ALTER TABLE risks ADD CONSTRAINT CK_risks_residual_impact
    CHECK (residual_impact IS NULL OR residual_impact BETWEEN 1 AND 5);
