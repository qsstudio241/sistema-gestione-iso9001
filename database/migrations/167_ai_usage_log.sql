-- Migrazione 167: Audit trail utilizzo AI senza fonte ufficiale
-- Data: 13/09/2026
-- Scopo: Tracciare utilizzo AI assistant + throttling notifiche admin
-- Pattern: CREATE TABLE → ADD CONSTRAINT separati (SQL Server)

-- Tabella principale: log ogni richiesta AI assistant (question assistant)
-- NOTA: Rinominata in ai_assistant_usage per evitare conflitto con ai_usage_log esistente (AI chat)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_assistant_usage')
BEGIN
  CREATE TABLE ai_assistant_usage (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    organization_id  INT NOT NULL,
    user_id          INT NOT NULL,
    feature          NVARCHAR(50) NOT NULL,
    standard_code    NVARCHAR(50) NULL,
    has_source       BIT NOT NULL,
    logged_at        DATETIME2 DEFAULT GETDATE()
  );
  PRINT 'Tabella ai_assistant_usage creata.';
END
GO

-- FK per ai_assistant_usage (dopo CREATE TABLE)
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ai_assistant_usage_org')
BEGIN
  ALTER TABLE ai_assistant_usage
    ADD CONSTRAINT FK_ai_assistant_usage_org FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) ON DELETE CASCADE;
  PRINT 'FK FK_ai_assistant_usage_org aggiunta.';
END
GO

IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ai_assistant_usage_user')
BEGIN
  ALTER TABLE ai_assistant_usage
    ADD CONSTRAINT FK_ai_assistant_usage_user FOREIGN KEY (user_id) 
      REFERENCES users(id) ON DELETE CASCADE;
  PRINT 'FK FK_ai_assistant_usage_user aggiunta.';
END
GO

-- Indice per query performance
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_assistant_usage_org_date')
BEGIN
  CREATE INDEX IX_ai_assistant_usage_org_date 
    ON ai_assistant_usage(organization_id, logged_at);
  PRINT 'Indice IX_ai_assistant_usage_org_date creato.';
END
GO

-- Tabella throttling notifiche
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_assistant_notifications')
BEGIN
  CREATE TABLE ai_assistant_notifications (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    organization_id  INT NOT NULL,
    standard_code    NVARCHAR(50) NOT NULL,
    notification_date DATE NOT NULL,
    created_at       DATETIME2 DEFAULT GETDATE()
  );
  PRINT 'Tabella ai_assistant_notifications creata.';
END
GO

-- FK per ai_assistant_notifications
IF NOT EXISTS (SELECT * FROM sys.foreign_keys WHERE name = 'FK_ai_assistant_notif_org')
BEGIN
  ALTER TABLE ai_assistant_notifications
    ADD CONSTRAINT FK_ai_assistant_notif_org FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) ON DELETE CASCADE;
  PRINT 'FK FK_ai_assistant_notif_org aggiunta.';
END
GO

-- Unique constraint
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_ai_assistant_notif_org_std_date')
BEGIN
  ALTER TABLE ai_assistant_notifications
    ADD CONSTRAINT UQ_ai_assistant_notif_org_std_date 
      UNIQUE (organization_id, standard_code, notification_date);
  PRINT 'Constraint UQ_ai_assistant_notif_org_std_date aggiunto.';
END
GO

-- Indice per lookup throttling
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_assistant_notif_org_std_date')
BEGIN
  CREATE INDEX IX_ai_assistant_notif_org_std_date 
    ON ai_assistant_notifications(organization_id, standard_code, notification_date);
  PRINT 'Indice IX_ai_assistant_notif_org_std_date creato.';
END
GO

PRINT 'Migrazione 167 completata con successo.';
