-- Migration 124: §4.1 Fattori di contesto e §4.2 Parti interessate
-- Idempotente: verifica esistenza tabelle prima di crearle

-- §4.1 Fattori di contesto (interni/esterni)
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'context_factors')
BEGIN
  CREATE TABLE context_factors (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,
    type           NVARCHAR(20) NOT NULL DEFAULT 'external'
                   CONSTRAINT CK_cf_type CHECK (type IN ('internal', 'external')),
    category       NVARCHAR(50) NULL,
    description    NVARCHAR(MAX) NOT NULL,
    impact         NVARCHAR(20) NOT NULL DEFAULT 'neutral'
                   CONSTRAINT CK_cf_impact CHECK (impact IN ('positive', 'negative', 'neutral')),
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_context_factors_org ON context_factors(organization_id);
END

-- §4.2 Parti interessate
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'interested_parties')
BEGIN
  CREATE TABLE interested_parties (
    id             INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT NOT NULL,
    company_id     INT NULL,
    name           NVARCHAR(200) NOT NULL,
    relationship   NVARCHAR(100) NULL,
    requirements   NVARCHAR(MAX) NULL,
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME NOT NULL DEFAULT GETDATE(),
    updated_at     DATETIME NOT NULL DEFAULT GETDATE()
  );
  CREATE INDEX IX_interested_parties_org ON interested_parties(organization_id);
END
