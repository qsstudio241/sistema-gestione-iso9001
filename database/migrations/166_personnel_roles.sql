-- Migrazione 166: tabella personnel_roles (additiva, idempotente)
-- Scopo: assegnare ruoli funzionali al personale aziendale (es. destinatario alert qualifiche).

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'personnel_roles')
BEGIN
  CREATE TABLE personnel_roles (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    organization_id INT           NOT NULL,
    company_id      INT           NOT NULL,
    personnel_id    INT           NOT NULL,
    role_code       NVARCHAR(50)  NOT NULL,
    active          BIT           NOT NULL DEFAULT 1,
    notes           NVARCHAR(500) NULL,
    created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
  );

  CREATE INDEX IX_personnel_roles_lookup
    ON personnel_roles (organization_id, company_id, role_code, active);

  CREATE INDEX IX_personnel_roles_personnel
    ON personnel_roles (personnel_id, role_code);
END
