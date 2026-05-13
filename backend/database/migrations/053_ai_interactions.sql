-- AI interaction audit trail
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_interactions')
CREATE TABLE ai_interactions (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT           NOT NULL,
  user_id         INT           NOT NULL,
  feature         NVARCHAR(30)  NOT NULL,
  provider        NVARCHAR(20)  NOT NULL,
  model           NVARCHAR(50)  NOT NULL,
  input_tokens    INT,
  output_tokens   INT,
  cost_usd        DECIMAL(10,6),
  latency_ms      INT,
  status          NVARCHAR(20)  NOT NULL,
  context_summary NVARCHAR(500),
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_interactions_org_date')
  CREATE INDEX IX_ai_interactions_org_date ON ai_interactions(organization_id, created_at);
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_interactions_feature')
  CREATE INDEX IX_ai_interactions_feature ON ai_interactions(feature);

-- Norm sources configuration
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'norm_sources')
CREATE TABLE norm_sources (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  source_key      NVARCHAR(30)  NOT NULL UNIQUE,
  source_type     NVARCHAR(20)  NOT NULL,
  display_name    NVARCHAR(100) NOT NULL,
  base_url        NVARCHAR(500),
  credentials_json NVARCHAR(MAX),
  is_active       BIT           NOT NULL DEFAULT 1,
  rate_limit_rpm  INT           DEFAULT 10,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
  updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

-- Norm access log for billing
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'norm_access_log')
CREATE TABLE norm_access_log (
  id              INT IDENTITY(1,1) PRIMARY KEY,
  organization_id INT           NOT NULL,
  standard_code   NVARCHAR(50)  NOT NULL,
  source_used     NVARCHAR(30)  NOT NULL,
  access_type     NVARCHAR(20)  NOT NULL,
  created_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_norm_access_org')
  CREATE INDEX IX_norm_access_org ON norm_access_log(organization_id, created_at);
