-- Migrazione 167: Audit trail utilizzo AI senza fonte ufficiale
-- Data: 13/09/2026
-- Scopo: Tracciare utilizzo AI assistant + throttling notifiche admin

-- Tabella principale: log ogni richiesta AI
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_usage_log')
BEGIN
  CREATE TABLE ai_usage_log (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    organization_id  INT NOT NULL,
    user_id          INT NOT NULL,
    feature          NVARCHAR(50) NOT NULL,  -- 'question_assistant', 'ai_chat', ecc.
    standard_code    NVARCHAR(50) NULL,      -- es. 'ISO_9001_2015'
    has_source       BIT NOT NULL,           -- 1 se norm_chunks presente, 0 altrimenti
    logged_at        DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT FK_ai_usage_log_org FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT FK_ai_usage_log_user FOREIGN KEY (user_id) 
      REFERENCES users(id) ON DELETE CASCADE
  );
  
  PRINT 'Tabella ai_usage_log creata con successo.';
END
ELSE
BEGIN
  PRINT 'Tabella ai_usage_log già esistente.';
END
GO

-- Indice per query performance (filtrare per org + data)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_usage_org_date')
BEGIN
  CREATE INDEX IX_ai_usage_org_date 
    ON ai_usage_log(organization_id, logged_at);
  PRINT 'Indice IX_ai_usage_org_date creato.';
END
GO

-- Tabella throttling: registro notifiche inviate (1/giorno per org+standard)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ai_usage_notifications')
BEGIN
  CREATE TABLE ai_usage_notifications (
    id               INT IDENTITY(1,1) PRIMARY KEY,
    organization_id  INT NOT NULL,
    standard_code    NVARCHAR(50) NOT NULL,
    notification_date DATE NOT NULL,          -- Solo la data (no ora)
    created_at       DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT FK_ai_notif_org FOREIGN KEY (organization_id) 
      REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT UQ_ai_notif_org_std_date UNIQUE (organization_id, standard_code, notification_date)
  );
  
  PRINT 'Tabella ai_usage_notifications creata con successo.';
END
ELSE
BEGIN
  PRINT 'Tabella ai_usage_notifications già esistente.';
END
GO

-- Indice per lookup rapido throttling
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_ai_notif_org_std_date')
BEGIN
  CREATE INDEX IX_ai_notif_org_std_date 
    ON ai_usage_notifications(organization_id, standard_code, notification_date);
  PRINT 'Indice IX_ai_notif_org_std_date creato.';
END
GO

PRINT 'Migrazione 167 completata con successo.';
