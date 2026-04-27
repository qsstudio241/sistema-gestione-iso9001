/*
  Rimozione utente duplicato user_id = 1007 (email typo eram-technogies.com)
  --------------------------------------------------------------------------
  Prima di DELETE su users si azzerano / rimuovono riferimenti noti (FK).

  Perché il secondo account e 2007 e non 1008: user_id e IDENTITY sulla tabella
  users — ogni nuovo INSERT prende il *prossimo* valore globale. Se nel frattempo
  sono stati creati altri utenti (anche rimossi dopo), il contatore avanza:
  1007 poi ... 2007 e normale, non indica un errore.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @u INT = 1007;

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE user_id = @u)
BEGIN
    PRINT N'user_id 1007 non presente — nulla da fare.';
    RETURN;
END;

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.audit_locks', N'U') IS NOT NULL
    DELETE FROM dbo.audit_locks WHERE user_id = @u;

IF OBJECT_ID(N'dbo.document_registry', N'U') IS NOT NULL
   AND COL_LENGTH(N'document_registry', N'created_by') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.document_registry SET created_by = NULL WHERE created_by = @uid;',
        N'@uid int',
        @uid = @u;

IF OBJECT_ID(N'dbo.audits', N'U') IS NOT NULL
   AND COL_LENGTH(N'audits', N'created_by') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.audits SET created_by = NULL WHERE created_by = @uid;',
        N'@uid int',
        @uid = @u;

IF OBJECT_ID(N'dbo.import_jobs', N'U') IS NOT NULL
   AND COL_LENGTH(N'import_jobs', N'created_by') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.import_jobs SET created_by = NULL WHERE created_by = @uid;',
        N'@uid int',
        @uid = @u;

IF OBJECT_ID(N'dbo.complaints', N'U') IS NOT NULL
   AND COL_LENGTH(N'complaints', N'created_by') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.complaints SET created_by = NULL WHERE created_by = @uid;',
        N'@uid int',
        @uid = @u;

IF OBJECT_ID(N'dbo.suppliers', N'U') IS NOT NULL
   AND COL_LENGTH(N'suppliers', N'created_by') IS NOT NULL
    EXEC sys.sp_executesql
        N'UPDATE dbo.suppliers SET created_by = NULL WHERE created_by = @uid;',
        N'@uid int',
        @uid = @u;

DELETE FROM dbo.users WHERE user_id = @u;

COMMIT TRANSACTION;

PRINT N'Utente 1007 eliminato. Verifica:';
SELECT user_id, email, full_name, organization_id, auditor_org_id, is_active
FROM dbo.users
WHERE email LIKE N'%franciosi%' OR email LIKE N'%eram%'
ORDER BY user_id;
