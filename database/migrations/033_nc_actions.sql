-- Migration 033: tabella nc_actions per azioni correttive strutturate
-- Sprint 5 — NC & Azioni Correttive
-- Ogni NC può avere N azioni correttive con proprio workflow: open → in_progress → completed → verified

IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_NAME = 'nc_actions'
)
BEGIN
    CREATE TABLE nc_actions (
        action_id         INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_nc_actions PRIMARY KEY,
        nc_id             INT NOT NULL
                          CONSTRAINT FK_nc_actions_nc REFERENCES non_conformities(nc_id) ON DELETE CASCADE,
        action_type       NVARCHAR(20) NOT NULL DEFAULT 'corrective'
                          CONSTRAINT CHK_nc_actions_type
                          CHECK (action_type IN ('immediate','corrective','preventive')),
        description       NVARCHAR(MAX) NOT NULL,
        responsible       NVARCHAR(200) NULL,
        due_date          DATE NULL,
        status            NVARCHAR(20) NOT NULL DEFAULT 'open'
                          CONSTRAINT CHK_nc_actions_status
                          CHECK (status IN ('open','in_progress','completed','verified')),
        completed_at      DATETIME2 NULL,
        verification_note NVARCHAR(MAX) NULL,
        created_by        INT NULL,
        created_at        DATETIME2 NOT NULL DEFAULT GETDATE(),
        updated_at        DATETIME2 NOT NULL DEFAULT GETDATE()
    );

    CREATE INDEX IX_nc_actions_nc_id ON nc_actions(nc_id);

    PRINT 'Tabella nc_actions creata con successo.';
END
ELSE
BEGIN
    PRINT 'Tabella nc_actions gia esistente - skip.';
END
