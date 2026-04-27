/*
  Split tenant — Seed mappatura da export reale (2026-04)
  ------------------------------------------------------------
  Basato su export:
  - organizations: solo id=1 DEFAULT_ORG
  - auditor_orgs: (1) QS Studio Interno, (2) Mason, (3) QS Studio (Marco) — tutti su org 1
  - users: PS_Admin; Camellini 1005 (auditor_org 3); Mason 1006 (auditor_org 2);
           Franciosi 2007 attivo eram-technologies.com; 1007 duplicato inattivo typo eram-technogies

  Se si usa passo-passo (phase1 + phase2 per codice ORG_0000x), gli organization_id possono essere
  es. 1002, 1003, 1004 — non usare questo seed con target fissi 2/3 senza SELECT di verifica.

  OBBLIGATORIO prima di apply monolite:
    SELECT organization_id, organization_code FROM dbo.organizations ORDER BY organization_id;
  Allineare target_organization_id in migration_split_* agli id REALI (non si assume 2/3/4).

  Ordine operativo: split_tenants_01 → questo file → split_tenants_03 (su copia DB + backup).
*/

SET NOCOUNT ON;

IF OBJECT_ID(N'dbo.migration_split_meta', N'U') IS NULL
BEGIN
    RAISERROR(N'Eseguire prima split_tenants_01_create_mapping_tables.sql', 16, 1);
    RETURN;
END;

BEGIN TRANSACTION;

DELETE FROM dbo.migration_split_audit_override;
DELETE FROM dbo.migration_split_user;
DELETE FROM dbo.migration_split_auditor_org;
DELETE FROM dbo.migration_split_new_orgs;

UPDATE dbo.migration_split_meta
SET legacy_organization_id     = 1,
    rename_legacy_to_code      = N'QS_STUDIO',
    rename_legacy_to_name      = N'QS Studio',
    notes                      = N'Seed 02c: export 2026-04 — DEFAULT_ORG → QS_STUDIO'
WHERE id = 1;

INSERT INTO dbo.migration_split_new_orgs
    (organization_code, organization_name, contact_email, audit_report_prefix, licensed_modules_json, copy_licenses_from_legacy)
VALUES
    (N'MASON_SRL', N'MASON Srl', N'andrea.mason@mason-cs.com', N'MSN', NULL, 1),
    (N'ERAM',      N'ERAM',      N'mauro.franciosi@eram-technologies.com', NULL, NULL, 1);

INSERT INTO dbo.migration_split_auditor_org (auditor_org_id, target_organization_id, note)
VALUES
    (1, 1, N'QS Studio (Interno) — resta su tenant QS_STUDIO (id 1)'),
    (2, 2, N'Studio Mason — tenant MASON_SRL (id atteso 2 dopo INSERT)'),
    (3, 1, N'QS Studio (Marco Camellini) — resta su tenant QS_STUDIO (id 1)');

INSERT INTO dbo.migration_split_user (user_id, target_organization_id, note)
VALUES
    (1,    1, N'PS_Admin — QS Studio'),
    (1005, 1, N'Marco Camellini — QS Studio'),
    (1006, 2, N'Andrea Mason — MASON Srl'),
    (2007, 3, N'Mauro Franciosi — ERAM (account attivo eram-technologies.com)');

COMMIT TRANSACTION;

PRINT N'Seed 02c caricato.';
PRINT N'NOTA utente 1007 (mauro.franciosi@eram-technogies.com, inattivo): fuori da migration_split_user.';
PRINT N'  Valutare in SQL: disattivazione definitiva o DELETE dopo verifica (duplicato omonimo).';
