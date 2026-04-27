/*
  Registro documenti: tutte le righe assegnate a Marco Camellini (tenant QS)
  ------------------------------------------------------------------------------
  Aggiorna organization_id, auditor_org_id, created_by (e opzionalmente company_id)
  al posto dei NULL, coerente con "tutti i documenti sono di Camellini".

  PRIMA DI ESEGUIRE (SSMS):
    SELECT id, name, organization_id, email FROM dbo.auditor_orgs WHERE organization_id = 1002;
    SELECT user_id, email, organization_id, auditor_org_id FROM dbo.users WHERE email LIKE N'%camellini%';
    SELECT TOP 5 id, name, auditor_org_id FROM dbo.companies WHERE auditor_org_id = @AUDITOR_ORG_ID;

  Adattare i DECLARE sotto ai valori reali (id studio Marco, user_id Marco, prima societa se serve).
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ORG_QS           INT = 1002;   -- QS_Studio (Marco)
DECLARE @AUDITOR_ORG_ID   INT = 3;      -- id auditor_orgs dello studio Marco (verificare!)
DECLARE @USER_MARCO       INT = 1005;   -- user_id Marco Camellini (verificare!)
DECLARE @COMPANY_ID       INT = NULL;  -- opzionale: forzare una societa precisa; se NULL si prova auto-sotto

IF @COMPANY_ID IS NULL
    SET @COMPANY_ID = (
        SELECT TOP 1 c.id
        FROM dbo.companies AS c
        WHERE c.auditor_org_id = @AUDITOR_ORG_ID
          AND c.is_active = 1
        ORDER BY c.id
    );

IF @COMPANY_ID IS NULL
    PRINT N'Attenzione: nessuna companies attiva per questo auditor_org_id — company_id restera NULL.';
ELSE
    PRINT N'company_id usato per tutte le righe: ' + CAST(@COMPANY_ID AS NVARCHAR(20));

BEGIN TRANSACTION;

UPDATE dbo.document_registry
SET organization_id = @ORG_QS,
    auditor_org_id   = @AUDITOR_ORG_ID,
    created_by       = @USER_MARCO,
    company_id       = @COMPANY_ID,
    updated_at       = SYSUTCDATETIME();

PRINT N'Righe aggiornate: ' + CAST(@@ROWCOUNT AS NVARCHAR(20));

COMMIT TRANSACTION;

SELECT id,
       organization_id,
       company_id,
       auditor_org_id,
       created_by,
       title
FROM dbo.document_registry
ORDER BY id;
