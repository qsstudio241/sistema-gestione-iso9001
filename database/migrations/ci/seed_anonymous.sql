-- Seed CI anonimo per apply-on-empty.
-- VIETATO: dati di produzione, email reali, ragioni sociali cliente, dump VPS.
-- INSERT solo se tabelle/colonne esistono (EXEC evita errori di compile su colonne assenti).

SET NOCOUNT ON;

IF OBJECT_ID('dbo.organizations', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.organizations', 'organization_name') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM dbo.organizations WHERE organization_name = N'CI Demo Srl'
   )
BEGIN
  IF COL_LENGTH('dbo.organizations', 'organization_code') IS NOT NULL
    EXEC(N'INSERT INTO dbo.organizations (organization_name, organization_code, is_active)
           VALUES (N''CI Demo Srl'', N''CI-DEMO'', 1)');
  ELSE
    EXEC(N'INSERT INTO dbo.organizations (organization_name, is_active)
           VALUES (N''CI Demo Srl'', 1)');
END
GO

IF OBJECT_ID('dbo.users', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.users', 'email') IS NOT NULL
   AND COL_LENGTH('dbo.users', 'organization_id') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM dbo.users WHERE email = N'ci.demo@example.test'
   )
BEGIN
  IF COL_LENGTH('dbo.organizations', 'organization_id') IS NOT NULL
    EXEC(N'
      INSERT INTO dbo.users (organization_id, email, password_hash, full_name, role, is_active)
      SELECT TOP 1 organization_id, N''ci.demo@example.test'', N''CI_HASH_NOT_A_PASSWORD'',
             N''Utente CI Demo'', N''admin'', 1
      FROM dbo.organizations
      WHERE organization_name = N''CI Demo Srl''
    ');
  ELSE IF COL_LENGTH('dbo.organizations', 'id') IS NOT NULL
    EXEC(N'
      INSERT INTO dbo.users (organization_id, email, password_hash, full_name, role, is_active)
      SELECT TOP 1 id, N''ci.demo@example.test'', N''CI_HASH_NOT_A_PASSWORD'',
             N''Utente CI Demo'', N''admin'', 1
      FROM dbo.organizations
      WHERE organization_name = N''CI Demo Srl''
    ');
END
GO

IF OBJECT_ID('dbo.companies', 'U') IS NOT NULL
   AND COL_LENGTH('dbo.companies', 'name') IS NOT NULL
   AND COL_LENGTH('dbo.companies', 'organization_id') IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM dbo.companies WHERE name = N'Officina CI Demo'
   )
BEGIN
  IF COL_LENGTH('dbo.organizations', 'organization_id') IS NOT NULL
    EXEC(N'
      INSERT INTO dbo.companies (organization_id, name)
      SELECT TOP 1 organization_id, N''Officina CI Demo''
      FROM dbo.organizations
      WHERE organization_name = N''CI Demo Srl''
    ');
  ELSE IF COL_LENGTH('dbo.organizations', 'id') IS NOT NULL
    EXEC(N'
      INSERT INTO dbo.companies (organization_id, name)
      SELECT TOP 1 id, N''Officina CI Demo''
      FROM dbo.organizations
      WHERE organization_name = N''CI Demo Srl''
    ');
END
GO

PRINT 'Seed CI anonimo applicato (o già presente / tabelle assenti).';
