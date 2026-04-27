/*
  Diagnostica: perché un utente "admin" vede checklist di un altro tenant?
  -------------------------------------------------------------------------
  Il backend (customChecklist.service) per admin/superadmin SENZA auditor_org_id
  filtra SOLO: custom_checklists.organization_id = users.organization_id.

  Se vedi ancora checklist Marco mentre sei admin Al.project, verificare:
  A) Riga checklist: organization_id e nome
  B) Utente admin: organization_id, auditor_org_id, role
*/

SET NOCOUNT ON;

PRINT N'--- A) Checklist con nome simile a Tuscania / Sopralluogo ---';
SELECT id,
       name,
       organization_id,
       auditor_org_id,
       is_active
FROM dbo.custom_checklists
WHERE name LIKE N'%Tuscania%'
   OR name LIKE N'%Sopralluogo%'
ORDER BY id;

PRINT N'--- B) Utenti admin / PS_Admin (adattare email se serve) ---';
SELECT user_id,
       email,
       full_name,
       role,
       organization_id,
       auditor_org_id,
       is_active
FROM dbo.users
WHERE role IN (N'admin', N'superadmin')
ORDER BY user_id;

PRINT N'--- C) Studi collegati alle checklist sopra ---';
SELECT cc.id AS checklist_id,
       cc.name,
       cc.organization_id AS cc_org,
       ao.id AS auditor_org_id,
       ao.organization_id AS studio_org,
       o.organization_code
FROM dbo.custom_checklists AS cc
LEFT JOIN dbo.auditor_orgs AS ao ON ao.id = cc.auditor_org_id
LEFT JOIN dbo.organizations AS o ON o.organization_id = cc.organization_id
WHERE cc.name LIKE N'%Tuscania%'
   OR cc.name LIKE N'%Sopralluogo%'
ORDER BY cc.id;
