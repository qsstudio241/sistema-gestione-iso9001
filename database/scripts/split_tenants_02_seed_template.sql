/*
  Split tenant — Template di INSERT per la mappatura
  ------------------------------------------------------------------
  0) Esportazione guidata (griglie + bozze INSERT): eseguire prima
     split_tenants_02b_export_for_mapping.sql in SSMS e copiare/adattare i risultati.
  1) Sostituire gli ID di esempio con quelli reali da SSMS:
     SELECT id, name, organization_id FROM auditor_orgs;
     SELECT user_id, email, full_name, organization_id FROM users;
  2) Per migration_split_new_orgs: inserire UNA RIGA per ogni NUOVA organizzazione
     (es. MASON_SRL, ERAM). QS_Studio di solito = rename di organization_id = 1 (vedi meta).
  3) Non eseguire questo file cosi com'è: duplicati generano errori.
*/

SET NOCOUNT ON;

-- ---------------------------------------------------------------------------
-- Meta: rinomina tenant legacy (organization_id = 1) in QS Studio
-- ---------------------------------------------------------------------------
UPDATE dbo.migration_split_meta
SET rename_legacy_to_code = N'QS_STUDIO',
    rename_legacy_to_name = N'QS Studio',
    notes = N'Aggiornare se i nomi definitivi differiscono.'
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Nuove organizzazioni da creare (esempi: modificare / duplicare righe)
-- ---------------------------------------------------------------------------
/*
INSERT INTO dbo.migration_split_new_orgs
    (organization_code, organization_name, contact_email, audit_report_prefix, licensed_modules_json, copy_licenses_from_legacy)
VALUES
    (N'MASON_SRL', N'MASON Srl', N'admin@mason.example', N'MSN', NULL, 1),
    (N'ERAM',      N'ERAM',      N'admin@eram.example',  N'MSN', NULL, 1);
*/

-- ---------------------------------------------------------------------------
-- Ogni auditor_org esistente -> organization_id finale (dopo INSERT nuove org)
-- IMPORTANTE: target_organization_id deve esistere in organizations.
-- Usare ID noti: 1 = QS (rinominato), 2 e 3 = dopo insert nuove org (verificare!)
-- ---------------------------------------------------------------------------
/*
INSERT INTO dbo.migration_split_auditor_org (auditor_org_id, target_organization_id, note)
VALUES
    (1, 1, N'Esempio: studio legato a QS'),
    (2, 2, N'Esempio: studio Mason -> org MASON_SRL');
*/

-- ---------------------------------------------------------------------------
-- Ogni utente -> organization_id finale
-- ---------------------------------------------------------------------------
/*
INSERT INTO dbo.migration_split_user (user_id, target_organization_id, note)
VALUES
    (1, 1, N'Esempio: Camellini -> QS_Studio'),
    (2, 3, N'Esempio: Francioni -> ERAM');
*/

-- ---------------------------------------------------------------------------
-- Solo audit che NON si risolvono con le regole automatiche (join company/utente)
-- ---------------------------------------------------------------------------
/*
INSERT INTO dbo.migration_split_audit_override (audit_id, target_organization_id, note)
VALUES
    (123, 2, N'Esempio: audit orfano da forzare');
*/

PRINT 'Template: decommentare e adattare gli INSERT prima di apply.';
