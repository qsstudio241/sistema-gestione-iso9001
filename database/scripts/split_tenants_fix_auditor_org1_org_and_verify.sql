/*
  Correzione riga 1 auditor_orgs + verifica coerenza email + rimozione utente typo ERAM
  -------------------------------------------------------------------------------
  1) Riga id=1 (AI.Admin / admin@sgq.local) deve stare sotto tenant Al.project = 1001.
  2) Verifiche incrociate auditor_orgs.email vs organizations.contact_email.
  3) Eliminazione account duplicato email typo: mauro.franciosi@eram-technogies.com
     (se DELETE fallisce per FK, usare il blocco alternativo COMMENTATO in fondo).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- ========= A) Correzione immediata riga 1 =========
UPDATE dbo.auditor_orgs
SET organization_id = 1001,
    updated_at      = SYSUTCDATETIME()
WHERE id = 1;

-- ========= B) Verifica coerenza (email studio vs email tenant) =========
PRINT N'--- Incroci: ogni auditor_org con org e contact_email tenant ---';
SELECT ao.id,
       ao.organization_id,
       o.organization_code,
       o.organization_name,
       o.contact_email AS org_contact_email,
       ao.name         AS auditor_org_name,
       ao.email        AS auditor_org_email,
       CASE
           WHEN NULLIF(LTRIM(RTRIM(ao.email)), N'') IS NULL THEN N'OK studio senza email'
           WHEN LOWER(LTRIM(RTRIM(ao.email))) = LOWER(LTRIM(RTRIM(o.contact_email))) THEN N'OK allineato'
           ELSE N'Verificare (email studio diversa da contact tenant)'
       END AS email_check
FROM dbo.auditor_orgs AS ao
INNER JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
ORDER BY ao.id;

PRINT N'--- Utenti: stessa email su piu user_id (possibili duplicati) ---';
SELECT u.email,
       COUNT(*) AS n,
       STUFF((
           SELECT N', ' + CAST(u2.user_id AS NVARCHAR(20))
           FROM dbo.users AS u2
           WHERE LOWER(LTRIM(RTRIM(u2.email))) = LOWER(LTRIM(RTRIM(u.email)))
           ORDER BY u2.user_id
           FOR XML PATH(N''), TYPE
       ).value(N'.[1]', N'NVARCHAR(MAX)'), 1, 2, N'') AS user_ids
FROM dbo.users AS u
WHERE NULLIF(LTRIM(RTRIM(u.email)), N'') IS NOT NULL
GROUP BY u.email
HAVING COUNT(*) > 1;

PRINT N'--- Utenti ERAM / Franciosi ---';
SELECT user_id, email, full_name, organization_id, auditor_org_id, is_active
FROM dbo.users
WHERE email LIKE N'%franciosi%' OR email LIKE N'%eram%'
ORDER BY user_id;

-- ========= C) Elimina utente typo eram-technogies.com =========
DECLARE @typoEmail NVARCHAR(255) = N'mauro.franciosi@eram-technogies.com';
DECLARE @typoUserId INT =
    (SELECT user_id FROM dbo.users WHERE LOWER(LTRIM(RTRIM(email))) = LOWER(@typoEmail));

IF @typoUserId IS NULL
    PRINT N'Nessun utente con email typo — nulla da eliminare.';
ELSE
BEGIN
    BEGIN TRY
        DELETE FROM dbo.users WHERE user_id = @typoUserId;
        PRINT N'Eliminato user_id = ' + CAST(@typoUserId AS NVARCHAR(20)) + N' (email typo).';
    END TRY
    BEGIN CATCH
        PRINT N'DELETE fallito (probabilmente FK). Eseguire blocco alternativo sotto.';
        THROW;
    END CATCH
END;

/*
-- Alternativa se DELETE fallisce: disattiva e libera l'email (senza cancellare la riga)
UPDATE dbo.users
SET is_active  = 0,
    email      = N'_archived_' + CAST(user_id AS NVARCHAR(20)) + N'_eram_typo@invalid.local',
    updated_at = SYSUTCDATETIME()
WHERE LOWER(LTRIM(RTRIM(email))) = N'mauro.franciosi@eram-technogies.com';
*/

PRINT N'--- auditor_orgs dopo fix ---';
SELECT ao.id, ao.organization_id, o.organization_code, ao.name, ao.email, ao.is_active
FROM dbo.auditor_orgs AS ao
LEFT JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
ORDER BY ao.id;
