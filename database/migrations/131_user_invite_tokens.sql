-- Migration 131: user_action_tokens — invito via email al primo accesso (UAL-3)
-- Tabella generica e riusabile per token ad uso singolo legati a un utente:
-- oggi 'invite' (creazione utente senza password diretta), in futuro anche
-- 'reset' (password dimenticata self-service, slice UAL-4) — stesso schema,
-- stessa logica di verifica/consumo, solo token_type diverso.
-- Il token in chiaro non viene MAI salvato: solo il suo hash SHA-256 (token_hash).
-- Idempotente: IF NOT EXISTS su ogni oggetto, ALTER additivi con controllo preventivo.
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'user_action_tokens' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.user_action_tokens (
        id               BIGINT IDENTITY(1,1) NOT NULL,
        user_id          INT             NOT NULL,
        organization_id  INT             NOT NULL,
        token_hash       NVARCHAR(128)   NOT NULL,
        token_type       NVARCHAR(20)    NOT NULL,
        expires_at       DATETIME2(7)    NOT NULL,
        used_at          DATETIME2(7)    NULL,
        created_by       INT             NULL,
        created_at       DATETIME2(7)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_user_action_tokens PRIMARY KEY CLUSTERED (id),
        CONSTRAINT CK_user_action_tokens_type CHECK (token_type IN ('invite', 'reset')),
        CONSTRAINT FK_user_action_tokens_user FOREIGN KEY (user_id)
            REFERENCES dbo.users(user_id),
        CONSTRAINT FK_user_action_tokens_org FOREIGN KEY (organization_id)
            REFERENCES dbo.organizations(organization_id),
        CONSTRAINT FK_user_action_tokens_created_by FOREIGN KEY (created_by)
            REFERENCES dbo.users(user_id)
    );
    PRINT 'Tabella user_action_tokens creata.';
END
ELSE
    PRINT 'Tabella user_action_tokens già presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_user_action_tokens_hash')
    CREATE UNIQUE INDEX UX_user_action_tokens_hash ON dbo.user_action_tokens (token_hash);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_action_tokens_user_type')
    CREATE INDEX IX_user_action_tokens_user_type ON dbo.user_action_tokens (user_id, token_type, used_at);

-- users.pending_activation: utente creato via invito, in attesa di impostare la propria
-- password. NOT NULL DEFAULT 0 → nessun impatto sugli utenti esistenti (retrocompatibile).
IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'pending_activation'
)
    ALTER TABLE dbo.users ADD pending_activation BIT NOT NULL CONSTRAINT DF_users_pending_activation DEFAULT 0;

-- Estende il CHECK constraint di user_audit_log (migration 130) con i nuovi eventi
-- del flusso di invito. SQL Server non permette ALTER di un CHECK esistente:
-- si droppa (se presente) e si ricrea con l'elenco completo — operazione idempotente,
-- stesso risultato ad ogni riesecuzione.
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_user_audit_log_action')
    ALTER TABLE dbo.user_audit_log DROP CONSTRAINT CK_user_audit_log_action;

ALTER TABLE dbo.user_audit_log ADD CONSTRAINT CK_user_audit_log_action CHECK (action_type IN (
    'user_created', 'role_changed', 'profile_updated', 'auditor_org_changed',
    'password_reset_by_admin', 'activated', 'deactivated', 'standards_updated',
    'company_access_granted', 'company_access_updated', 'company_access_revoked',
    'invite_sent', 'invite_accepted', 'invite_resent'
));

PRINT 'Migration 131 completata.';
