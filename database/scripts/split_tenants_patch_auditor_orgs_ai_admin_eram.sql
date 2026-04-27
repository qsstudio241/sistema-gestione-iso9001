/*
  Patch auditor_orgs dopo split tenant
  --------------------------------------
  1) Rinomina lo studio interno da "QS Studio (Interno)" (varianti) a **AI.Admin**.
  2) Inserisce uno studio **ERAM** sotto organization_id = 1004 (tenant ORG_00004),
     referenza Mauro Franciosi.

  Eseguire su copia DB / produzione dopo backup. Idempotente sul punto (2) se esiste
  già una riga auditor_orgs con organization_id = 1004.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_id = 1004)
BEGIN
    RAISERROR(N'Manca organizations.organization_id = 1004 (ERAM). Creare prima il tenant.', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

-- 1) Nome display studio interno → AI.Admin
UPDATE dbo.auditor_orgs
SET name       = N'AI.Admin',
    updated_at = SYSUTCDATETIME()
WHERE name IN (
    N'QS Studio (Interno)',
    N'QS_Studio (Interno)',
    N'QS Studio (interno)',
    N'QS_Studio (interno)'
);

IF @@ROWCOUNT = 0
    PRINT N'Attenzione: nessuna riga aggiornata al punto 1 — verificare il name attuale in SELECT id, name FROM auditor_orgs.';

-- 2) Studio per tenant ERAM (organization_id 1004)
IF NOT EXISTS (SELECT 1 FROM dbo.auditor_orgs WHERE organization_id = 1004)
BEGIN
    INSERT INTO dbo.auditor_orgs (organization_id, name, email, subscription_plan, is_active)
    VALUES (
        1004,
        N'ERAM',
        N'mauro.franciosi@eram-technologies.com',
        N'full',
        1
    );
    PRINT N'Inserito auditor_org per ERAM (organization_id = 1004).';
END
ELSE
    PRINT N'Esiste gia almeno un auditor_org per organization_id = 1004 — INSERT saltato.';

COMMIT TRANSACTION;

PRINT N'--- Stato auditor_orgs ---';
SELECT ao.id,
       ao.organization_id,
       o.organization_code,
       ao.name,
       ao.email,
       ao.is_active
FROM dbo.auditor_orgs AS ao
LEFT JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
ORDER BY ao.id;

/*
  Opzionale: collegare l''utente ERAM allo studio appena creato (adattare user_id):
  DECLARE @eram_auditor_org_id INT =
      (SELECT TOP 1 id FROM dbo.auditor_orgs WHERE organization_id = 1004 ORDER BY id DESC);
  UPDATE dbo.users
  SET auditor_org_id = @eram_auditor_org_id, updated_at = SYSUTCDATETIME()
  WHERE user_id = 2007 AND organization_id = 1004;
*/
