/**
 * Ricrea le 6 cartelle Patrimonio Studio (template studio_patrimonio_v1)
 * SOLO se l'albero studio del tenant è vuoto (zero documenti).
 *
 * Non tocca cartelle ISO per-azienda né documenti clienti.
 *
 * Uso VPS:
 *   DRY_RUN=1 node /tmp/recreate-studio-patrimony-folders-vps.js
 *   ORG_IDS=1002 DRY_RUN=0 node /tmp/recreate-studio-patrimony-folders-vps.js
 *
 * Default: ORG_IDS=1002 (Camellini), DRY_RUN=1.
 * Org 1001 (Al.project) ha 1 documento patrimonio: lo script la salta.
 */
const path = require('path');
const fs = require('fs');

const vpsDb = '/var/www/sgq-backend/src/config/database.js';
const vpsDotenv = '/var/www/sgq-backend/node_modules/dotenv';
const vpsProvisioner = '/var/www/sgq-backend/src/services/documentTreeProvisioner.service.js';

let query;
let getPool;
let closePool;
let provisionStudioPatrimony;
if (fs.existsSync(vpsDb)) {
  require(vpsDotenv).config({ path: '/var/www/sgq-backend/.env' });
  ({ query, getPool, closePool } = require('/var/www/sgq-backend/src/config/database'));
  ({ provisionStudioPatrimony } = require(vpsProvisioner));
} else {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
  ({ query, getPool, closePool } = require('../src/config/database'));
  ({ provisionStudioPatrimony } = require('../src/services/documentTreeProvisioner.service'));
}

const DRY_RUN = String(process.env.DRY_RUN || '1') !== '0';
const ORG_IDS = String(process.env.ORG_IDS || '1002')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);

function n(row, key) {
  return Number(row?.[key] ?? row?.[key?.toLowerCase?.()] ?? 0) || 0;
}

async function countSafe(sql, params) {
  try {
    const res = await query(sql, params);
    return n(res.recordset[0], 'n');
  } catch (err) {
    console.log(`  (conteggio opzionale saltato: ${err.message})`);
    return 0;
  }
}

async function inspectOrg(orgId) {
  const p = { org_id: orgId };
  const org = await query(`
    SELECT organization_id, organization_code, organization_name
    FROM organizations WHERE organization_id = @org_id
  `, p);
  const folders = await query(`
    SELECT id, title, folder_code, parent_id, status, content_scope, company_id
    FROM document_registry
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND company_id IS NULL
      AND folder_code LIKE 'STD%'
      AND doc_type = 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
    ORDER BY folder_code, id
  `, p);
  const docs = await query(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND doc_type <> 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, p);
  const attachments = await countSafe(`
    SELECT COUNT(*) AS n
    FROM attachments a
    INNER JOIN document_registry dr ON dr.id = a.document_id
    WHERE dr.organization_id = @org_id
      AND dr.content_scope = 'studio'
      AND dr.company_id IS NULL
  `, p);
  const fileAtt = await countSafe(`
    SELECT COUNT(*) AS n
    FROM document_file_attachments a
    INNER JOIN document_registry dr ON dr.id = a.document_id
    WHERE dr.organization_id = @org_id
      AND dr.content_scope = 'studio'
      AND dr.company_id IS NULL
  `, p);
  const clientDocs = await query(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id
      AND doc_type <> 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
      AND ISNULL(content_scope, 'client') <> 'studio'
  `, p);
  return {
    org: org.recordset[0] || { organization_id: orgId },
    folders: folders.recordset,
    studioDocs: n(docs.recordset[0], 'n'),
    attachments,
    fileAtt,
    clientDocs: n(clientDocs.recordset[0], 'n'),
  };
}

async function archiveEmptyStudioFolders(orgId) {
  const res = await query(`
    UPDATE document_registry
    SET status = 'obsoleto',
        folder_code = LEFT(N'A' + CAST(id AS NVARCHAR(20)), 10),
        updated_at = GETDATE()
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND company_id IS NULL
      AND folder_code LIKE 'STD%'
      AND doc_type = 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `, { org_id: orgId });
  return res.rowsAffected?.[0] ?? 0;
}

async function listLiveStudioFolders(orgId) {
  const res = await query(`
    SELECT id, title, folder_code, parent_id, status
    FROM document_registry
    WHERE organization_id = @org_id
      AND content_scope = 'studio'
      AND company_id IS NULL
      AND folder_code LIKE 'STD%'
      AND doc_type = 'folder'
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
    ORDER BY folder_code, id
  `, { org_id: orgId });
  return res.recordset;
}

async function recreateOrg(orgId) {
  const snap = await inspectOrg(orgId);
  const name = snap.org.organization_name || snap.org.organization_code || '';
  console.log(`\n---- org ${orgId} ${name} ----`);
  console.log(`Cartelle STD vive: ${snap.folders.length}`);
  for (const f of snap.folders) {
    console.log(`  #${f.id}  [${f.folder_code}]  ${f.title}  parent=${f.parent_id ?? 'NULL'}`);
  }
  console.log(`Documenti patrimonio: ${snap.studioDocs}  allegati: ${snap.attachments}+${snap.fileAtt}`);
  console.log(`Documenti clienti (non toccare): ${snap.clientDocs}`);

  if (snap.studioDocs > 0 || snap.attachments > 0 || snap.fileAtt > 0) {
    console.log('SKIP: patrimonio non vuoto. Nessuna modifica.');
    return { orgId, action: 'skip_not_empty', ...snap };
  }

  if (DRY_RUN) {
    console.log('DRY_RUN: archivierei le cartelle STD e richiamerei provisionStudioPatrimony.');
    return { orgId, action: 'dry_run', ...snap };
  }

  const archived = await archiveEmptyStudioFolders(orgId);
  console.log(`Archiviate (obsoleto + folder_code A<id>): ${archived}`);
  const provisioned = await provisionStudioPatrimony(orgId);
  const after = await listLiveStudioFolders(orgId);
  console.log(`Provision rootId=${provisioned.rootId}  cartelle vive ora: ${after.length}`);
  for (const f of after) {
    console.log(`  #${f.id}  [${f.folder_code}]  ${f.title}  parent=${f.parent_id ?? 'NULL'}`);
  }
  return { orgId, action: 'recreated', archived, rootId: provisioned.rootId, live: after.length };
}

async function main() {
  if (!ORG_IDS.length) {
    throw new Error('ORG_IDS vuoto');
  }
  console.log(`recreate-studio-patrimony  DRY_RUN=${DRY_RUN ? 1 : 0}  ORG_IDS=${ORG_IDS.join(',')}`);
  await getPool();
  const results = [];
  for (const orgId of ORG_IDS) {
    results.push(await recreateOrg(orgId));
  }
  console.log('\nRIEPILOGO');
  for (const r of results) {
    console.log(`  org ${r.orgId}: ${r.action}`);
  }
}

main()
  .catch((err) => {
    console.error('RECREATE_FAIL', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { await closePool(); } catch { /* ignore */ }
  });
