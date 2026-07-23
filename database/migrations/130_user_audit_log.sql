-- Migration 130: user_audit_log — audit trail gestione utenti (UAL-2)
-- Traccia chi ha fatto cosa e quando su un utente: creazione, modifica ruolo/dati,
-- attivazione/disattivazione, standard consentiti, accessi azienda cliente (UAL-1).
-- Tabella dedicata: audit_events (migration 046, ADR-008) è specifica per il dominio
-- audit ISO (FK su audits.audit_id) e non riusabile per eventi generici sugli utenti.
-- Idempotente: IF NOT EXISTS su ogni oggetto.
SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.objects WHERE name = 'user_audit_log' AND type = 'U'
)
BEGIN
    CREATE TABLE dbo.user_audit_log (
        id               BIGINT IDENTITY(1,1) NOT NULL,
        organization_id  INT             NOT NULL,
        target_user_id   INT             NOT NULL,
        actor_user_id    INT             NULL,
        action_type      NVARCHAR(50)    NOT NULL,
        field_changed    NVARCHAR(100)   NULL,
        old_value        NVARCHAR(MAX)   NULL,
        new_value        NVARCHAR(MAX)   NULL,
        created_at       DATETIME2(7)    NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_user_audit_log PRIMARY KEY CLUSTERED (id),
        CONSTRAINT CK_user_audit_log_action CHECK (action_type IN (
            'user_created', 'role_changed', 'profile_updated', 'auditor_org_changed',
            'password_reset_by_admin', 'activated', 'deactivated', 'standards_updated',
            'company_access_granted', 'company_access_updated', 'company_access_revoked'
        )),
        CONSTRAINT FK_user_audit_log_target FOREIGN KEY (target_user_id)
            REFERENCES dbo.users(user_id),
        CONSTRAINT FK_user_audit_log_actor FOREIGN KEY (actor_user_id)
            REFERENCES dbo.users(user_id),
        CONSTRAINT FK_user_audit_log_org FOREIGN KEY (organization_id)
            REFERENCES dbo.organizations(organization_id)
    );
    PRINT 'Tabella user_audit_log creata.';
END
ELSE
    PRINT 'Tabella user_audit_log già presente — skip.';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_audit_log_target_created')
    CREATE INDEX IX_user_audit_log_target_created ON dbo.user_audit_log (target_user_id, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_user_audit_log_org_created')
    CREATE INDEX IX_user_audit_log_org_created ON dbo.user_audit_log (organization_id, created_at DESC);

PRINT 'Migration 130 completata.';
