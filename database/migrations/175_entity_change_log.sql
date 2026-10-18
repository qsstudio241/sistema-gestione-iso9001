-- NON APPLICARE senza sì del committente. Proposta A3: non lanciare run-migration su TEST né su PROD.
-- La CI apply-on-empty del repo può eseguire questo file su un database vuoto: è il gate già previsto, non un apply VPS.
-- TYPE: additive
-- BACKFILL: none
-- VERIFY: 175_verify.sql
-- ROLLBACK: 175_rollback.sql

-- Log append-only generico (chi, quando, entità, campo, prima/dopo).
-- Non riusa audit_events (FK su audits, CHECK di tipi chiuso) né user_audit_log (solo utenti).
-- Nessuna FK: il log resta anche se il record o l'utente vengono poi trattati altrove,
-- e la tabella si crea anche quando organizations/users non esistono (CI apply-on-empty, storico < 169).
-- Nessun ON DELETE. Nessun backfill.

SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.entity_change_log (
        id              BIGINT IDENTITY(1,1) NOT NULL,
        organization_id INT            NOT NULL,
        entity_table    NVARCHAR(128)  NOT NULL,
        entity_id       NVARCHAR(64)   NOT NULL,
        action_type     NVARCHAR(50)   NOT NULL,
        field_name      NVARCHAR(128)  NULL,
        old_value       NVARCHAR(MAX)  NULL,
        new_value       NVARCHAR(MAX)  NULL,
        actor_user_id   INT            NULL,
        created_at      DATETIME2(7)   NOT NULL CONSTRAINT DF_entity_change_log_created_at DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_entity_change_log PRIMARY KEY CLUSTERED (id)
    );
    PRINT N'175: tabella entity_change_log creata.';
END
ELSE
    PRINT N'175: entity_change_log già presente - skip.';
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_entity_change_log_action' AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    ALTER TABLE dbo.entity_change_log
        ADD CONSTRAINT CK_entity_change_log_action
        CHECK (action_type IN (N'created', N'updated', N'soft_deleted', N'restored'));
    PRINT N'175: CHECK action_type aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_entity_change_log_entity_ref' AND parent_object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    ALTER TABLE dbo.entity_change_log
        ADD CONSTRAINT CK_entity_change_log_entity_ref
        CHECK (LEN(entity_table) > 0 AND LEN(entity_id) > 0);
    PRINT N'175: CHECK entity_table/entity_id aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_entity_change_log_org_created' AND object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    CREATE INDEX IX_entity_change_log_org_created
        ON dbo.entity_change_log (organization_id, created_at DESC);
    PRINT N'175: indice org/created_at creato.';
END
GO

IF OBJECT_ID(N'dbo.entity_change_log', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_entity_change_log_entity' AND object_id = OBJECT_ID(N'dbo.entity_change_log'))
BEGIN
    CREATE INDEX IX_entity_change_log_entity
        ON dbo.entity_change_log (entity_table, entity_id, created_at DESC);
    PRINT N'175: indice entità creato.';
END
GO
