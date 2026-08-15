/**
 * Diagnostica SOLO LETTURA: alberi documentali per studio (tenant).
 * Parte da Camellini (org 1002) e elenca anche gli altri tenant attivi.
 *
 * Non cancella, non aggiorna, non provisiona.
 *
 * Uso VPS:
 *   node /tmp/audit-studio-document-trees-vps.js
 *   ORG_ID=1002 node /tmp/audit-studio-document-trees-vps.js
 */
const path = require('path');
const fs = require('fs');

const vpsDb = '/var/www/sgq-backend/src/config/database.js';
const vpsDotenv = '/var/www/sgq-backend/node_modules/dotenv';
let query;
let getPool;
let closePool;
if (fs.existsSync(vpsDb)) {
  require(vpsDotenv).config({ path: '/var/www/sgq-backend/.env' });
  ({ query, getPool, closePool } = require('/var/www/sgq-backend/src/config/database'));
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  ({ query, getPool, closePool } = require('../src/config/database'));
}

const FOCUS_ORG = process.env.ORG_ID ? parseInt(process.env.ORG_ID, 10) : 1002;

function n(row, key) {
  const v = row?.[key] ?? row?.[key?.toLowerCase?.()] ?? 0;
  return Number(v) || 0;
}

async function countSafe(sql, params) {
  try {
    const res = await query(sql, params);
    return n(res.recordset[0], 'n');
  } catch (err) {
    return `ERR:${err.message}`;
  }
}

async function auditOrg(org) {
  const orgId = org.organization_id;
  const p = { org_id: orgId };

  const companies = await query(`
    SELECT c.id, c.name, c.is_active
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE ao.organization_id = @org_id
    ORDER BY c.name
  `, p);

  const roots = await query(`
    SELECT dr.id, dr.title, dr.folder_code, dr.content_scope, dr.company_id,
           dr.status, dr.doc_type,
           (SELECT COUNT(*) FROM document_registry ch
             WHERE ch.parent_id = dr.id AND ISNULL(ch.status, 'rilasciato') <> 'obsoleto') AS children_n
    FROM document_registry dr
    WHERE dr.organization_id = @org_id
      AND dr.parent_id IS NULL
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
    ORDER BY dr.content_scope, dr.company_id, dr.display_order, dr.title
  `, p);

  const byType = await query(`
    SELECT
      CASE WHEN dr.doc_type = 'folder' THEN 'folder' ELSE 'document' END AS kind,
      ISNULL(dr.content_scope, '(null)') AS content_scope,
      CASE WHEN dr.company_id IS NULL THEN 'NULL' ELSE 'azienda' END AS company_kind,
      ISNULL(dr.status, 'rilasciato') AS status,
      COUNT(*) AS n
    FROM document_registry dr
    WHERE dr.organization_id = @org_id
    GROUP BY
      CASE WHEN dr.doc_type = 'folder' THEN 'folder' ELSE 'document' END,
      ISNULL(dr.content_scope, '(null)'),
      CASE WHEN dr.company_id IS NULL THEN 'NULL' ELSE 'azienda' END,
      ISNULL(dr.status, 'rilasciato')
    ORDER BY kind, content_scope, company_kind, status
  `, p);

  const studioFolders = await query(`
    SELECT id, title, folder_code, parent_id, status
    FROM document_registry
    WHERE organization_id = @org_id
      AND (
        content_scope = 'studio'
        OR folder_code LIKE 'STD%'
        OR title LIKE N'%PATRIMONIO STUDIO%'
      )
    ORDER BY folder_code, id
  `, p);

  const liveDocs = await countSafe(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND doc_type <> 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, p);

  const liveFolders = await countSafe(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND doc_type = 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, p);

  const studioLiveDocs = await countSafe(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND doc_type <> 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, p);

  const studioLiveFolders = await countSafe(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND doc_type = 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, p);

  const attachments = await countSafe(`
    SELECT COUNT(*) AS n FROM attachments a
    INNER JOIN document_registry dr ON dr.id = a.document_id
    WHERE dr.organization_id = @org_id
  `, p);

  const fileAtt = await countSafe(`
    SELECT COUNT(*) AS n FROM document_file_attachments a
    INNER JOIN document_registry dr ON dr.id = a.document_id
    WHERE dr.organization_id = @org_id
  `, p);

  const relations = await countSafe(`
    SELECT COUNT(*) AS n FROM document_relations rel
    WHERE rel.organization_id = @org_id
  `, p);

  const history = await countSafe(`
    SELECT COUNT(*) AS n FROM document_history h
    INNER JOIN document_registry dr ON dr.id = h.document_id
    WHERE dr.organization_id = @org_id
  `, p);

  const chunks = await countSafe(`
    SELECT COUNT(*) AS n FROM knowledge_chunks kc
    INNER JOIN document_registry dr ON dr.id = kc.entity_id
    WHERE dr.organization_id = @org_id
      AND kc.entity_type IN ('document', 'document_registry')
  `, p);

  const sampleDocs = await query(`
    SELECT TOP 15 dr.id, dr.title, dr.doc_type, dr.content_scope, dr.company_id, dr.status, dr.folder_code
    FROM document_registry dr
    WHERE dr.organization_id = @org_id
      AND dr.doc_type <> 'folder'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
    ORDER BY dr.id DESC
  `, p);

  return {
    org,
    companies: companies.recordset,
    roots: roots.recordset,
    byType: byType.recordset,
    studioFolders: studioFolders.recordset,
    liveDocs,
    liveFolders,
    studioLiveDocs,
    studioLiveFolders,
    attachments,
    fileAtt,
    relations,
    history,
    chunks,
    sampleDocs: sampleDocs.recordset,
  };
}

function printOrg(a) {
  const o = a.org;
  console.log('\n============================================================');
  console.log(`ORG ${o.organization_id}  ${o.organization_code || ''}  ${o.org_name || o.organization_name || ''}`);
  console.log('============================================================');
  console.log(`Aziende: ${a.companies.length}`);
  for (const c of a.companies) {
    console.log(`  - id=${c.id}  ${c.name}  active=${c.is_active}`);
  }
  console.log(`Cartelle vive: ${a.liveFolders}   Documenti vivi (non cartelle): ${a.liveDocs}`);
  console.log(`Patrimonio (content_scope=studio)  cartelle=${a.studioLiveFolders}  documenti=${a.studioLiveDocs}`);
  console.log(`Allegati: ${a.attachments}   file_attachments: ${a.fileAtt}`);
  console.log(`Relazioni: ${a.relations}   storico: ${a.history}   chunk AI: ${a.chunks}`);

  console.log('\nRadici vive (parent_id NULL):');
  if (!a.roots.length) console.log('  (nessuna)');
  for (const r of a.roots) {
    console.log(
      `  #${r.id}  [${r.folder_code || '-'}]  ${r.title}  scope=${r.content_scope || 'null'}  company=${r.company_id ?? 'NULL'}  figli=${r.children_n}`
    );
  }

  console.log('\nNodi patrimonio / STD / titolo PATRIMONIO:');
  if (!a.studioFolders.length) console.log('  (nessuno)');
  for (const r of a.studioFolders) {
    console.log(
      `  #${r.id}  [${r.folder_code || '-'}]  ${r.title}  parent=${r.parent_id ?? 'NULL'}  status=${r.status}`
    );
  }

  console.log('\nConteggi per tipo/scope/azienda/stato:');
  for (const row of a.byType) {
    console.log(
      `  ${row.kind}  scope=${row.content_scope}  company=${row.company_kind}  status=${row.status}  n=${row.n}`
    );
  }

  console.log('\nUltimi documenti vivi:');
  if (!a.sampleDocs.length) console.log('  (nessuno)');
  for (const d of a.sampleDocs) {
    console.log(
      `  #${d.id}  ${d.doc_type}  scope=${d.content_scope || 'null'}  company=${d.company_id ?? 'NULL'}  ${d.title}`
    );
  }

  const studioEmpty = a.studioLiveDocs === 0;
  const studioMissing = a.studioLiveFolders === 0;
  const hasClientDocs = a.liveDocs > 0 && a.studioLiveDocs !== a.liveDocs;
  console.log('\nVERDETTO:');
  if (studioMissing) {
    console.log('  Patrimonio Studio: ASSENTE (si puo\' provisionare, non serve cancellare).');
  } else if (studioEmpty) {
    console.log('  Patrimonio Studio: cartelle presenti, ZERO documenti. Cancellare/ricreare le sole cartelle STD e\' a basso rischio.');
  } else {
    console.log(`  Patrimonio Studio: NON vuoto (${a.studioLiveDocs} documenti). NON cancellare.`);
  }
  if (hasClientDocs) {
    console.log(`  Albero aziende/ISO: ha ${a.liveDocs - (typeof a.studioLiveDocs === 'number' ? a.studioLiveDocs : 0)} documenti non-studio. NON toccare.`);
  }
  if (a.liveDocs === 0 && a.liveFolders > 0) {
    console.log('  Tutto il tenant: solo cartelle vuote. Wipe albero possibile ma da confermare per-cartella.');
  }
}

async function main() {
  await getPool();
  const orgs = await query(`
    SELECT o.organization_id, o.organization_code, o.organization_name AS org_name
    FROM organizations o
    WHERE o.is_active = 1
    ORDER BY o.organization_id
  `);

  console.log('Tenant attivi:', orgs.recordset.map((o) => `${o.organization_id}:${o.org_name}`).join(' | '));
  console.log('Focus richiesto: org', FOCUS_ORG, '(Camellini se 1002)');

  const ordered = [
    ...orgs.recordset.filter((o) => o.organization_id === FOCUS_ORG),
    ...orgs.recordset.filter((o) => o.organization_id !== FOCUS_ORG),
  ];

  for (const org of ordered) {
    const a = await auditOrg(org);
    printOrg(a);
  }
}

main()
  .catch((err) => {
    console.error('AUDIT_FAIL', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await closePool(); } catch { /* ignore */ }
  });
