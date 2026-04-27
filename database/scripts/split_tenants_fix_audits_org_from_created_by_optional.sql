/*
  Opzionale: allinea audits.organization_id al tenant di created_by
  -----------------------------------------------------------------
  I campioni che hai incollato (audit_id ~5197–5204) hanno organization_id = 1001
  e created_by = 1 (PS_Admin): spesso sono **test su Al.project** e vanno lasciati.

  Usare questo script SOLO se decidete che quegli audit devono seguire il tenant
  dell utente creatore (es. spostare test su QS). Altrimenti non eseguire.

  Non tocca company_id (resta NULL se gia NULL).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Decommentare SOLO una delle due strategie.

-- A) Tutti gli audit dove il creatore ha tenant diverso da audit.organization_id
/*
BEGIN TRANSACTION;
UPDATE a
SET a.organization_id = u.organization_id,
    a.updated_at = SYSUTCDATETIME()
FROM dbo.audits AS a
INNER JOIN dbo.users AS u ON u.user_id = a.created_by
WHERE a.created_by IS NOT NULL
  AND a.organization_id <> u.organization_id;
PRINT N'Audit aggiornati: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
COMMIT TRANSACTION;
*/

-- B) Solo audit ancora su 1001 con creatore diverso da user 1 (escludi test admin su Al.project)
/*
BEGIN TRANSACTION;
UPDATE a
SET a.organization_id = u.organization_id,
    a.updated_at = SYSUTCDATETIME()
FROM dbo.audits AS a
INNER JOIN dbo.users AS u ON u.user_id = a.created_by
WHERE a.created_by IS NOT NULL
  AND a.created_by <> 1
  AND a.organization_id = 1001
  AND a.organization_id <> u.organization_id;
PRINT N'Audit aggiornati: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));
COMMIT TRANSACTION;
*/

PRINT N'Script vuoto: decommentare blocco A o B in base alla policy. Nessuna modifica eseguita.';
