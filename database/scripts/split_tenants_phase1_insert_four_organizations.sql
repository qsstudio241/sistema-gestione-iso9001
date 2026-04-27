/*
  Split tenant — Passo 1: da UNA sola organizations a QUATTRO tenant
  -------------------------------------------------------------------
  Situazione tipica: una sola riga (organization_id = 1, DEFAULT_ORG).
  Senza INSERT (e senza aggiornare la riga 1), non esistono altre righe tenant
  e gli UPDATE su auditor_orgs verso codici ORG_00002..04 falliscono con errore 547 (FK).
  Gli organization_id numerici possono essere qualsiasi valore IDENTITY (es. 1002, 1003, 1004):
  la fase 2 usa i organization_code, non i numeri fissi 2/3/4.

  Questo script (idempotente sui codici ORG_00002..04):
  1) Aggiorna la riga 1 in Al.project / ORG_00001 (allineato al modello concordato).
  2) Inserisce QS_Studio, MASON_Srl, ERAM se mancano (codici ORG_00002..04).

  Dopo: SELECT organization_id, organization_code FROM organizations;
  Poi eseguire split_tenants_phase2_map_auditor_orgs_template.sql

  Backup + prova su copia DB prima della produzione.
*/

SET NOCOUNT ON;
SET XACT_ABORT ON;

PRINT N'--- Prima: stato organizations ---';
SELECT organization_id, organization_code, organization_name, contact_email, is_active
FROM dbo.organizations
ORDER BY organization_id;

BEGIN TRANSACTION;

UPDATE dbo.organizations
SET organization_code = N'ORG_00001',
    organization_name = N'Al.project',
    contact_email       = N'admin@sgq.local',
    is_active           = 1
WHERE organization_id = 1;

IF COL_LENGTH(N'dbo.organizations', N'created_at') IS NOT NULL
   AND COL_LENGTH(N'dbo.organizations', N'updated_at') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00002')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active, created_at, updated_at)
        VALUES (N'ORG_00002', N'QS_Studio', N'marcocamellini@gmail.com', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00003')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active, created_at, updated_at)
        VALUES (N'ORG_00003', N'MASON_Srl', N'andrea.mason@mason-cs.com', 1, SYSUTCDATETIME(), SYSUTCDATETIME());

    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00004')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active, created_at, updated_at)
        VALUES (N'ORG_00004', N'ERAM', N'mauro.franciosi@eram-technologies.com', 1, SYSUTCDATETIME(), SYSUTCDATETIME());
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00002')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active)
        VALUES (N'ORG_00002', N'QS_Studio', N'marcocamellini@gmail.com', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00003')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active)
        VALUES (N'ORG_00003', N'MASON_Srl', N'andrea.mason@mason-cs.com', 1);

    IF NOT EXISTS (SELECT 1 FROM dbo.organizations WHERE organization_code = N'ORG_00004')
        INSERT INTO dbo.organizations (organization_code, organization_name, contact_email, is_active)
        VALUES (N'ORG_00004', N'ERAM', N'mauro.franciosi@eram-technologies.com', 1);
END;

IF COL_LENGTH(N'dbo.organizations', N'licensed_modules') IS NOT NULL
BEGIN
    DECLARE @lm NVARCHAR(MAX) =
        (SELECT licensed_modules FROM dbo.organizations WHERE organization_id = 1);

    IF @lm IS NOT NULL
    BEGIN
        UPDATE dbo.organizations
        SET licensed_modules = @lm
        WHERE organization_code IN (N'ORG_00002', N'ORG_00003', N'ORG_00004')
          AND (licensed_modules IS NULL OR licensed_modules = N'');
    END;
END;

COMMIT TRANSACTION;

PRINT N'--- Dopo: verificare quattro righe; id numerici possono essere 1002+ (normale per IDENTITY) ---';
SELECT organization_id, organization_code, organization_name, contact_email, is_active
FROM dbo.organizations
ORDER BY organization_id;
