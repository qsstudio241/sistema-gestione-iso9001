/*
  Split tenant — SOLO passo 2: associare auditor_orgs alle organizations
  ---------------------------------------------------------------------
  Errore 547 (FK_auditor_orgs_organization): quasi sempre significa che
  organization_id di destinazione NON esiste in dbo.organizations (DECLARE sbagliati
  oppure passo 1 non ancora applicato sullo stesso database).

  Questo file risolve gli ID dai codici org (adatta i literal ai vostri organization_code).
  Esempio reale: id 1, 1002, 1003, 1004 per ORG_00001..04 — i DECLARE numerici non sono necessari.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* Allineare ai codici reali dopo: SELECT organization_id, organization_code FROM dbo.organizations; */
DECLARE @CODE_QS     NVARCHAR(64) = N'ORG_00002';
DECLARE @CODE_MASON  NVARCHAR(64) = N'ORG_00003';
DECLARE @CODE_ERAM   NVARCHAR(64) = N'ORG_00004';
DECLARE @CODE_AL     NVARCHAR(64) = N'ORG_00001';

DECLARE @ORG_QS     INT =
    (SELECT organization_id FROM dbo.organizations WHERE organization_code = @CODE_QS);
DECLARE @ORG_MASON  INT =
    (SELECT organization_id FROM dbo.organizations WHERE organization_code = @CODE_MASON);
DECLARE @ORG_ERAM   INT =
    (SELECT organization_id FROM dbo.organizations WHERE organization_code = @CODE_ERAM);
DECLARE @ORG_AL     INT =
    (SELECT organization_id FROM dbo.organizations WHERE organization_code = @CODE_AL);

PRINT N'--- organizations (verifica id risolti dai codici) ---';
SELECT organization_id, organization_code, organization_name
FROM dbo.organizations
ORDER BY organization_id;

IF @ORG_QS IS NULL OR @ORG_MASON IS NULL
BEGIN
    RAISERROR(
        N'FK 547: impossibile aggiornare — manca almeno un tenant (QS o MASON). Controllare organization_code in testa allo script e che il passo 1 sia stato eseguito su QUESTO database.',
        16,
        1
    );
    RETURN;
END;

PRINT N'--- Id risolti dai codici (ERAM/AL solo se servono agli UPDATE sotto) ---';
SELECT @ORG_QS AS org_qs, @ORG_MASON AS org_mason, @ORG_ERAM AS org_eram, @ORG_AL AS org_al;

PRINT N'--- UPDATE auditor_orgs (adattare gli id studio WHERE id = ...) ---';

-- BEGIN TRANSACTION;

-- Esempio: studio 1 e 3 → QS; studio 2 → MASON (come da export tipico)
UPDATE dbo.auditor_orgs SET organization_id = @ORG_QS    WHERE id = 1;
UPDATE dbo.auditor_orgs SET organization_id = @ORG_MASON WHERE id = 2;
UPDATE dbo.auditor_orgs SET organization_id = @ORG_QS    WHERE id = 3;

SELECT ao.id,
       ao.name,
       ao.organization_id,
       o.organization_code,
       o.organization_name
FROM dbo.auditor_orgs AS ao
LEFT JOIN dbo.organizations AS o ON o.organization_id = ao.organization_id
ORDER BY ao.id;

-- COMMIT TRANSACTION;
-- oppure: ROLLBACK TRANSACTION;
