-- migration: 044_add_superadmin_role.sql
-- Estende il CHECK constraint sulla colonna users.role per includere 'superadmin'.
-- Necessario per il ruolo "platform admin" con visibilità cross-org.

-- Rimuove il vincolo esistente (nome generato automaticamente da SQL Server)
ALTER TABLE dbo.users DROP CONSTRAINT CK__users__role__4E88ABD4;

-- Ricrea con superadmin incluso
ALTER TABLE dbo.users
  ADD CONSTRAINT CK_users_role
  CHECK (role IN ('viewer', 'auditor', 'admin', 'superadmin'));
