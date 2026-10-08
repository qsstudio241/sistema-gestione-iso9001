-- TYPE: additive
-- BACKFILL: none
-- VERIFY: n/a (solo schema, tabelle nuove vuote)
-- ROLLBACK: n/a (drop solo in migrazione di cleanup successiva)
--
-- Migration 172: ai_assistant_usage e ai_assistant_notifications con la struttura REALE di PROD.
-- Allinea TEST a PROD senza toccare la 167 (gia' applicata altrove, non va riscritta).
--
-- Differenze della 167 del repo rispetto a PROD (verificate in SELECT sola lettura, 2026-10-08):
--   * 167 crea FK_ai_assistant_usage_org -> organizations(id) e FK_ai_assistant_usage_user -> users(id):
--     colonne inesistenti (le PK sono organization_id / user_id), quindi in PROD queste FK NON esistono.
--     Questa migrazione NON le crea: ai_assistant_usage resta senza FK (audit trail conservato).
--   * 167 crea FK_ai_assistant_notif_org -> organizations(id): su PROD esiste -> organizations(organization_id)
--     con ON DELETE CASCADE (ON UPDATE NO_ACTION). Replicato identico: decisione esplicita del committente
--     (2026-10-08) per l'allineamento TEST=PROD, in deroga alla regola generale "niente CASCADE".
--     Il throttling notifiche e' dato derivato e rigenerabile: la cancellazione a cascata non perde audit.
--
-- Idempotente: ogni oggetto ha il proprio guard; FK/constraint/indici in statement separati.
-- Senza dbo.organizations (CI apply-on-empty) -> no-op.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.organizations', N'U') IS NULL
BEGIN
    PRINT N'172: dbo.organizations assente - skip (apply-on-empty).';
END
GO

IF OBJECT_ID(N'dbo.organizations', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.ai_assistant_usage', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_assistant_usage (
        id              INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id INT NOT NULL,
        user_id         INT NOT NULL,
        feature         NVARCHAR(50) NOT NULL,
        standard_code   NVARCHAR(50) NULL,
        has_source      BIT NOT NULL,
        logged_at       DATETIME2 NULL DEFAULT GETDATE()
    );
    PRINT N'172: tabella ai_assistant_usage creata.';
END
GO

IF OBJECT_ID(N'dbo.ai_assistant_usage', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_ai_assistant_usage_org_date'
          AND object_id = OBJECT_ID(N'dbo.ai_assistant_usage')
   )
BEGIN
    CREATE INDEX IX_ai_assistant_usage_org_date
        ON dbo.ai_assistant_usage (organization_id, logged_at);
    PRINT N'172: indice IX_ai_assistant_usage_org_date creato.';
END
GO

IF OBJECT_ID(N'dbo.organizations', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.ai_assistant_notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ai_assistant_notifications (
        id                INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        organization_id   INT NOT NULL,
        standard_code     NVARCHAR(50) NOT NULL,
        notification_date DATE NOT NULL,
        created_at        DATETIME2 NULL DEFAULT GETDATE()
    );
    PRINT N'172: tabella ai_assistant_notifications creata.';
END
GO

IF OBJECT_ID(N'dbo.ai_assistant_notifications', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.key_constraints
        WHERE name = N'UQ_ai_assistant_notif_org_std_date'
          AND parent_object_id = OBJECT_ID(N'dbo.ai_assistant_notifications')
   )
BEGIN
    ALTER TABLE dbo.ai_assistant_notifications
        ADD CONSTRAINT UQ_ai_assistant_notif_org_std_date
        UNIQUE (organization_id, standard_code, notification_date);
    PRINT N'172: vincolo UQ_ai_assistant_notif_org_std_date aggiunto.';
END
GO

IF OBJECT_ID(N'dbo.ai_assistant_notifications', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.indexes
        WHERE name = N'IX_ai_assistant_notif_org_std_date'
          AND object_id = OBJECT_ID(N'dbo.ai_assistant_notifications')
   )
BEGIN
    CREATE INDEX IX_ai_assistant_notif_org_std_date
        ON dbo.ai_assistant_notifications (organization_id, standard_code, notification_date);
    PRINT N'172: indice IX_ai_assistant_notif_org_std_date creato.';
END
GO

IF OBJECT_ID(N'dbo.ai_assistant_notifications', N'U') IS NOT NULL
   AND OBJECT_ID(N'dbo.organizations', N'U') IS NOT NULL
   AND NOT EXISTS (
        SELECT 1 FROM sys.foreign_keys
        WHERE name = N'FK_ai_assistant_notif_org'
          AND parent_object_id = OBJECT_ID(N'dbo.ai_assistant_notifications')
   )
BEGIN
    ALTER TABLE dbo.ai_assistant_notifications
        ADD CONSTRAINT FK_ai_assistant_notif_org
        FOREIGN KEY (organization_id) REFERENCES dbo.organizations (organization_id)
        ON DELETE CASCADE;
    PRINT N'172: FK_ai_assistant_notif_org aggiunta (CASCADE come PROD).';
END
GO
