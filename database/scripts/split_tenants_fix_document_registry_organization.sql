/*
  Riassegna document_registry.organization_id usando i legami ricostruiti
  --------------------------------------------------------------------------
  Precedenza (primo valorizzato vince):
  1) document_registry.auditor_org_id → tenant dello studio
  2) document_registry.company_id → companies.auditor_org_id → tenant dello studio
  3) document_registry.created_by → users.organization_id (creatore / titolare logico)

  Se tutti e tre sono NULL, la riga resta invariata.

  Opzionale: limitare al tenant legacy ancora sbagliato — decommentare AND in fondo al FROM.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

UPDATE dr
SET dr.organization_id = COALESCE(
        ao_doc.organization_id,
        ao_co.organization_id,
        u.organization_id,
        dr.organization_id
    ),
    dr.updated_at      = SYSUTCDATETIME()
FROM dbo.document_registry AS dr
LEFT JOIN dbo.auditor_orgs AS ao_doc ON ao_doc.id = dr.auditor_org_id
LEFT JOIN dbo.companies AS c ON c.id = dr.company_id
LEFT JOIN dbo.auditor_orgs AS ao_co ON ao_co.id = c.auditor_org_id
LEFT JOIN dbo.users AS u ON u.user_id = dr.created_by
WHERE 1 = 1
-- AND dr.organization_id = 1001   -- decommentare per limitare il blast radius
;

PRINT N'Righe document_registry aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

COMMIT TRANSACTION;

PRINT N'--- Conteggi per organization_id ---';
SELECT organization_id, COUNT(*) AS n
FROM dbo.document_registry
GROUP BY organization_id
ORDER BY organization_id;

PRINT N'--- Righe (campione) ---';
SELECT id,
       organization_id,
       company_id,
       auditor_org_id,
       created_by,
       title
FROM dbo.document_registry
ORDER BY id;

PRINT N'--- Verifica sezione 5/6 di split_tenants_06 (dovrebbe essere vuota) ---';
SELECT dr.id,
       dr.organization_id AS doc_org_id,
       ao.organization_id AS atteso_da_company,
       N'document_registry vs tenant societa' AS problema
FROM dbo.document_registry AS dr
INNER JOIN dbo.companies AS c ON c.id = dr.company_id
INNER JOIN dbo.auditor_orgs AS ao ON ao.id = c.auditor_org_id
WHERE dr.company_id IS NOT NULL
  AND c.auditor_org_id IS NOT NULL
  AND dr.organization_id <> ao.organization_id;
