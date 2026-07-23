-- Migration 132: estende CK_user_audit_log_action con gli eventi del reset
-- password self-service (UAL-4, Fase 2 del piano ciclo di vita account utente).
-- Nessuna nuova tabella: riusa user_action_tokens (token_type = 'reset', già
-- supportato dal CHECK di migration 131) e user_audit_log (migration 130).
-- SQL Server non permette ALTER di un CHECK esistente: si droppa (se presente)
-- e si ricrea con l'elenco completo — operazione idempotente, stesso risultato
-- ad ogni riesecuzione.
SET NOCOUNT ON;

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_user_audit_log_action')
    ALTER TABLE dbo.user_audit_log DROP CONSTRAINT CK_user_audit_log_action;

ALTER TABLE dbo.user_audit_log ADD CONSTRAINT CK_user_audit_log_action CHECK (action_type IN (
    'user_created', 'role_changed', 'profile_updated', 'auditor_org_changed',
    'password_reset_by_admin', 'activated', 'deactivated', 'standards_updated',
    'company_access_granted', 'company_access_updated', 'company_access_revoked',
    'invite_sent', 'invite_accepted', 'invite_resent',
    'password_reset_requested', 'password_reset_completed'
));

PRINT 'Migration 132 completata.';
