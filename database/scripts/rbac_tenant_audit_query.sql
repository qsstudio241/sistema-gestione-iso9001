/*
  Script di verifica isolamento multi-tenant
  ==========================================
  Eseguire periodicamente su DB produzione per intercettare anomalie di assegnazione tenant.
  Sicuro: solo SELECT, nessuna modifica.

  Sezione 1 — Audit con organization_id diverso dalla company owner
  Sezione 2 — NC orfane (audit_id punta ad audit di org diversa)
  Sezione 3 — Allegati con audit_id di org diversa dal token
  Sezione 4 — Utenti senza organization_id valida
  Sezione 5 — Companies con auditor_org di org diversa dall'audit collegato
  Sezione 6 — Riepilogo conteggi per org
*/

SET NOCOUNT ON;

PRINT '=== [1] Audit con org non coerente con company owner ===';
SELECT
    a.audit_id,
    a.audit_number,
    a.organization_id        AS audit_org,
    a.company_id,
    c.auditor_org_id,
    ao.organization_id       AS company_org
FROM dbo.audits a
INNER JOIN dbo.companies c ON c.id = a.company_id
INNER JOIN dbo.auditor_orgs ao ON ao.id = c.auditor_org_id
WHERE ao.organization_id <> a.organization_id
  AND ISNULL(a.is_deleted, 0) = 0
ORDER BY a.organization_id, a.audit_id;

PRINT '=== [2] NC su audit inesistente (orfane) ===';
SELECT
    nc.nc_id,
    nc.audit_id
FROM dbo.non_conformities nc
WHERE NOT EXISTS (SELECT 1 FROM dbo.audits a WHERE a.audit_id = nc.audit_id AND ISNULL(a.is_deleted,0)=0)
ORDER BY nc.nc_id;

PRINT '=== [3] Allegati su audit di org diversa ===';
SELECT
    att.attachment_id,
    att.audit_id,
    a.organization_id        AS audit_org
FROM dbo.attachments att
INNER JOIN dbo.audits a ON a.audit_id = att.audit_id
WHERE a.is_deleted = 0
ORDER BY att.attachment_id
OFFSET 0 ROWS FETCH NEXT 50 ROWS ONLY;

PRINT '=== [4] Utenti con organization_id NULL o non esistente ===';
SELECT
    u.user_id,
    u.email,
    u.organization_id,
    u.role,
    u.is_active
FROM dbo.users u
WHERE u.organization_id IS NULL
   OR NOT EXISTS (SELECT 1 FROM dbo.organizations o WHERE o.organization_id = u.organization_id)
ORDER BY u.user_id;

PRINT '=== [5] Rischi con organization_id non in organizations ===';
SELECT r.risk_id, r.organization_id
FROM dbo.risks r
WHERE ISNULL(r.is_deleted, 0) = 0
  AND NOT EXISTS (SELECT 1 FROM dbo.organizations o WHERE o.organization_id = r.organization_id);

PRINT '=== [6] Conteggi per organizzazione ===';
SELECT
    o.organization_id,
    (SELECT COUNT(*) FROM dbo.audits a WHERE a.organization_id = o.organization_id AND ISNULL(a.is_deleted,0)=0) AS audits_count,
    (SELECT COUNT(*) FROM dbo.non_conformities nc INNER JOIN dbo.audits aa ON aa.audit_id = nc.audit_id WHERE aa.organization_id = o.organization_id) AS nc_count,
    (SELECT COUNT(*) FROM dbo.risks r WHERE r.organization_id = o.organization_id AND ISNULL(r.is_deleted,0)=0) AS risks_count,
    (SELECT COUNT(*) FROM dbo.document_registry dr WHERE dr.organization_id = o.organization_id) AS docs_count,
    (SELECT COUNT(*) FROM dbo.users u WHERE u.organization_id = o.organization_id AND u.is_active=1) AS active_users
FROM dbo.organizations o
ORDER BY o.organization_id;
