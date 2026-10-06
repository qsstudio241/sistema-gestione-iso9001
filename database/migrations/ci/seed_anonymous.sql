-- Seed CI anonimo per apply-on-empty.
-- VIETATO: dati di produzione, email reali, ragioni sociali cliente, dump VPS.
--
-- Compile-safe su SQL Server: i riferimenti a tabelle (FROM / INSERT) stanno
-- SOLO dentro EXEC. OBJECT_ID / COL_LENGTH nel batch esterno. Altrimenti, su
-- DB vuoto (storico < 169 saltato, issue #699) il parser fallisce con
-- «Invalid object name 'dbo.organizations'» anche se l'IF sarebbe falso.

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.organizations', N'U') IS NULL
BEGIN
  PRINT N'Seed CI: dbo.organizations assente — skip (apply-on-empty / gap pre-169).';
END
ELSE IF COL_LENGTH(N'dbo.organizations', N'organization_name') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.organizations', N'organization_code') IS NOT NULL
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_name = N''CI Demo Srl'')
        INSERT INTO dbo.organizations (organization_name, organization_code, is_active)
        VALUES (N''CI Demo Srl'', N''CI-DEMO'', 1);
    ');
  ELSE
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_name = N''CI Demo Srl'')
        INSERT INTO dbo.organizations (organization_name, is_active)
        VALUES (N''CI Demo Srl'', 1);
    ');
END
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.organizations', N'U') IS NULL
BEGIN
  PRINT N'Seed CI: users/organizations assenti — skip utenti.';
END
ELSE IF COL_LENGTH(N'dbo.users', N'email') IS NOT NULL
    AND COL_LENGTH(N'dbo.users', N'organization_id') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.organizations', N'organization_id') IS NOT NULL
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = N''ci.demo@example.test'')
        INSERT INTO dbo.users (organization_id, email, password_hash, full_name, role, is_active)
        SELECT TOP 1 organization_id, N''ci.demo@example.test'', N''CI_HASH_NOT_A_PASSWORD'',
               N''Utente CI Demo'', N''admin'', 1
        FROM dbo.organizations
        WHERE organization_name = N''CI Demo Srl'';
    ');
  ELSE IF COL_LENGTH(N'dbo.organizations', N'id') IS NOT NULL
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = N''ci.demo@example.test'')
        INSERT INTO dbo.users (organization_id, email, password_hash, full_name, role, is_active)
        SELECT TOP 1 id, N''ci.demo@example.test'', N''CI_HASH_NOT_A_PASSWORD'',
               N''Utente CI Demo'', N''admin'', 1
        FROM dbo.organizations
        WHERE organization_name = N''CI Demo Srl'';
    ');
END
GO

IF OBJECT_ID(N'dbo.companies', N'U') IS NULL
   OR OBJECT_ID(N'dbo.organizations', N'U') IS NULL
BEGIN
  PRINT N'Seed CI: companies/organizations assenti — skip aziende.';
END
ELSE IF COL_LENGTH(N'dbo.companies', N'name') IS NOT NULL
    AND COL_LENGTH(N'dbo.companies', N'organization_id') IS NOT NULL
BEGIN
  IF COL_LENGTH(N'dbo.organizations', N'organization_id') IS NOT NULL
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE name = N''Officina CI Demo'')
        INSERT INTO dbo.companies (organization_id, name)
        SELECT TOP 1 organization_id, N''Officina CI Demo''
        FROM dbo.organizations
        WHERE organization_name = N''CI Demo Srl'';
    ');
  ELSE IF COL_LENGTH(N'dbo.organizations', N'id') IS NOT NULL
    EXEC(N'
      IF NOT EXISTS (SELECT 1 FROM dbo.companies WHERE name = N''Officina CI Demo'')
        INSERT INTO dbo.companies (organization_id, name)
        SELECT TOP 1 id, N''Officina CI Demo''
        FROM dbo.organizations
        WHERE organization_name = N''CI Demo Srl'';
    ');
END
GO

PRINT N'Seed CI anonimo applicato (o già presente / tabelle assenti).';
