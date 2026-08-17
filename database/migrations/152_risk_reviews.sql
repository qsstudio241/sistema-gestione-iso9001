-- Migration 152 (ex 150 su TEST prima del merge MC-1): snapshot aggiornamenti riga analisi (ROO-16)
-- risks resta lo stato corrente. risk_reviews è append-only.
-- Idempotente: su TEST la tabella c'è già.

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'risk_reviews' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.risk_reviews (
    id INT IDENTITY(1,1) NOT NULL
      CONSTRAINT PK_risk_reviews PRIMARY KEY CLUSTERED,
    risk_id INT NOT NULL,
    organization_id INT NOT NULL,
    company_id INT NULL,
    title NVARCHAR(200) NULL,
    evaluated_element NVARCHAR(300) NULL,
    nature NVARCHAR(20) NULL,
    probability TINYINT NULL,
    impact TINYINT NULL,
    impact_sign SMALLINT NOT NULL
      CONSTRAINT DF_risk_reviews_impact_sign DEFAULT 1
      CONSTRAINT CK_risk_reviews_impact_sign CHECK (impact_sign IN (-1, 1)),
    analysis_method NVARCHAR(20) NULL,
    swot_quadrant CHAR(1) NULL,
    residual_probability TINYINT NULL,
    residual_impact TINYINT NULL,
    effectiveness_note NVARCHAR(MAX) NULL,
    current_actions NVARCHAR(MAX) NULL,
    further_actions NVARCHAR(MAX) NULL,
    recorded_at DATETIME2 NOT NULL
      CONSTRAINT DF_risk_reviews_recorded_at DEFAULT SYSUTCDATETIME(),
    recorded_by INT NULL
  );
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_risk_reviews_risk_at' AND object_id = OBJECT_ID('dbo.risk_reviews'))
BEGIN
  CREATE INDEX IX_risk_reviews_risk_at
    ON dbo.risk_reviews (risk_id, recorded_at DESC);
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_risk_reviews_org_co_at' AND object_id = OBJECT_ID('dbo.risk_reviews'))
BEGIN
  CREATE INDEX IX_risk_reviews_org_co_at
    ON dbo.risk_reviews (organization_id, company_id, recorded_at DESC);
END
