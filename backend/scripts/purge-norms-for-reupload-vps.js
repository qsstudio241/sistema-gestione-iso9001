#!/usr/bin/env node
/**
 * Hard-delete norme attive per re-upload (esclude org/esclusioni esplicite).
 * Default: anteprima. --execute per applicare.
 *
 * VPS: NODE_ENV=production DB_SERVER=127.0.0.1 node scripts/purge-norms-for-reupload-vps.js --execute
 */
'use strict';

const path = require('path');
const backendRoot = path.join(__dirname, '..');
const { query, getPool, closePool } = require(path.join(backendRoot, 'src/config/database'));

const EXECUTE = process.argv.includes('--execute');

/** Mason org 1003 — norme già OK, non toccare */
const EXCLUDE_IDS = new Set([1990, 1991]);

/** Tutti gli altri studi: cancella norme attive */
const EXCLUDE_ORG_IDS = new Set([1003]);

async function tryDelete(label, sql, params = {}) {
  try {
    const res = await query(sql, params);
    const n = res.rowsAffected?.[0] ?? 0;
    if (n > 0) console.log(`  ${label}: ${n}`);
    return n;
  } catch (err) {
    if (/Invalid object name/i.test(err.message)) return 0;
    throw err;
  }
}

async function purgeDocument(docId) {
  const p = { docId };
  await tryDelete('document_history', 'DELETE FROM document_history WHERE document_id = @docId', p);
  await tryDelete('document_relations', `
    DELETE FROM document_relations
    WHERE source_document_id = @docId OR target_document_id = @docId
  `, p);
  await tryDelete('document_tag_links', 'DELETE FROM document_tag_links WHERE document_id = @docId', p);
  await tryDelete('doc_notification_log', 'DELETE FROM doc_notification_log WHERE document_id = @docId', p);
  await tryDelete('deadline_items', 'DELETE FROM deadline_items WHERE source_document_id = @docId', p);
  await tryDelete('norm_document_sources', 'DELETE FROM norm_document_sources WHERE document_id = @docId', p);
  await tryDelete('document_file_attachments', 'DELETE FROM document_file_attachments WHERE document_id = @docId', p);
  await tryDelete('attachment_id null', 'UPDATE document_registry SET attachment_id = NULL WHERE id = @docId', p);
  await tryDelete('attachments', 'DELETE FROM attachments WHERE document_id = @docId', p);
  await tryDelete('document_registry', 'DELETE FROM document_registry WHERE id = @docId', p);
}

async function main() {
  await getPool();

  const rows = await query(`
    SELECT dr.id, dr.organization_id, dr.title,
      JSON_VALUE(dr.type_specific_data, '$.standard_code') AS standard_code,
      ao.name AS studio,
      c.name AS azienda
    FROM document_registry dr
    LEFT JOIN auditor_orgs ao ON ao.organization_id = dr.organization_id
    LEFT JOIN companies c ON c.id = dr.company_id
    WHERE dr.doc_type = 'norma'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
    ORDER BY dr.organization_id, dr.id
  `);

  const targets = rows.recordset.filter((r) => {
    if (EXCLUDE_IDS.has(r.id)) return false;
    if (EXCLUDE_ORG_IDS.has(r.organization_id)) return false;
    return true;
  });

  console.log(`=== Purge norme per re-upload (${EXECUTE ? 'ESECUZIONE' : 'ANTEPRIMA'}) ===`);
  console.log(`Esclusi: org ${[...EXCLUDE_ORG_IDS].join(', ')} + id ${[...EXCLUDE_IDS].join(', ')}`);
  console.log(`Da eliminare: ${targets.length}\n`);

  for (const r of targets) {
    console.log(`  #${r.id} ${r.studio || 'org '+r.organization_id} / ${r.azienda || 'org-wide'} | ${r.standard_code || '(no code)'}`);
  }

  const kept = rows.recordset.filter((r) => !targets.find((t) => t.id === r.id));
  console.log(`\nConservati: ${kept.length}`);
  for (const r of kept) {
    console.log(`  #${r.id} ${r.studio} | ${r.title?.slice(0, 60)}`);
  }

  if (!targets.length) {
    await closePool();
    return;
  }

  if (!EXECUTE) {
    console.log('\nNessuna modifica (usa --execute).');
    await closePool();
    return;
  }

  console.log('\nEliminazione...');
  for (const r of targets) {
    console.log(`\n#${r.id}:`);
    await purgeDocument(r.id);
  }

  const left = await query(`
    SELECT COUNT(*) AS n FROM document_registry
    WHERE doc_type = 'norma' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `);
  console.log(`\nNorme attive residue: ${left.recordset[0].n}`);
  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
