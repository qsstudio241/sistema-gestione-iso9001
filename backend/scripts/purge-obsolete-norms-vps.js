#!/usr/bin/env node
/**
 * Hard-delete norme in status obsoleto (test / upload ripetuti).
 * Default: anteprima. Con --execute applica la cancellazione.
 *
 * VPS: NODE_ENV=production DB_SERVER=127.0.0.1 node scripts/purge-obsolete-norms-vps.js
 * VPS: ... --execute
 * Opzionale: --org=1003 --ids=1986,1988
 */
const path = require('path');
const backendRoot = path.join(__dirname, '..');
const { query, getPool, closePool } = require(path.join(backendRoot, 'src/config/database'));

const EXECUTE = process.argv.includes('--execute');
const orgArg = process.argv.find((a) => a.startsWith('--org='));
const idsArg = process.argv.find((a) => a.startsWith('--ids='));
const ORG_FILTER = orgArg ? parseInt(orgArg.split('=')[1], 10) : null;
const ID_FILTER = idsArg
  ? idsArg.split('=')[1].split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean)
  : null;

async function tryDelete(label, sql, params = {}) {
  try {
    const res = await query(sql, params);
    const n = res.rowsAffected?.[0] ?? res.recordset?.length ?? 0;
    if (n > 0) console.log(`  ${label}: ${n} righe`);
    return n;
  } catch (err) {
    if (/Invalid object name/i.test(err.message)) return 0;
    throw err;
  }
}

async function purgeDocument(docId) {
  const inClause = '@docId';
  await tryDelete('document_history', `DELETE FROM document_history WHERE document_id = ${inClause}`, { docId });
  await tryDelete('document_relations', `
    DELETE FROM document_relations
    WHERE source_document_id = ${inClause} OR target_document_id = ${inClause}
  `, { docId });
  await tryDelete('document_tag_links', `DELETE FROM document_tag_links WHERE document_id = ${inClause}`, { docId });
  await tryDelete('doc_notification_log', `DELETE FROM doc_notification_log WHERE document_id = ${inClause}`, { docId });
  await tryDelete('deadline_items', `DELETE FROM deadline_items WHERE source_document_id = ${inClause}`, { docId });
  await tryDelete('norm_document_sources', `DELETE FROM norm_document_sources WHERE document_id = ${inClause}`, { docId });
  await tryDelete('document_file_attachments', `DELETE FROM document_file_attachments WHERE document_id = ${inClause}`, { docId });
  await tryDelete('document_registry.attachment_id', `
    UPDATE document_registry SET attachment_id = NULL WHERE id = ${inClause}
  `, { docId });
  await tryDelete('attachments', `DELETE FROM attachments WHERE document_id = ${inClause}`, { docId });
  await tryDelete('document_registry', `DELETE FROM document_registry WHERE id = ${inClause}`, { docId });
}

async function main() {
  await getPool();

  let where = `doc_type = 'norma' AND status = 'obsoleto'`;
  const params = {};
  if (ORG_FILTER) {
    where += ' AND organization_id = @orgId';
    params.orgId = ORG_FILTER;
  }
  if (ID_FILTER?.length) {
    where += ` AND id IN (${ID_FILTER.join(',')})`;
  }

  const rows = await query(`
    SELECT id, organization_id, title,
      JSON_VALUE(type_specific_data, '$.standard_code') AS standard_code,
      attachment_id, created_at
    FROM document_registry
    WHERE ${where}
    ORDER BY id
  `, params);

  console.log(`=== Norme obsolete da eliminare (${EXECUTE ? 'ESECUZIONE' : 'ANTEPRIMA'}) ===`);
  console.log(`Trovate: ${rows.recordset.length}`);
  for (const r of rows.recordset) {
    console.log(`  #${r.id} org=${r.organization_id} code=${r.standard_code} att=${r.attachment_id ?? 'NULL'}`);
  }

  if (!rows.recordset.length) {
    await closePool();
    return;
  }

  if (!EXECUTE) {
    console.log('\nNessuna modifica (usa --execute per applicare).');
    await closePool();
    return;
  }

  console.log('\nCancellazione in corso...');
  for (const r of rows.recordset) {
    console.log(`\n#${r.id}:`);
    await purgeDocument(r.id);
  }

  const left = await query(`
    SELECT COUNT(*) AS n FROM document_registry WHERE doc_type = 'norma' AND status = 'obsoleto'
  `);
  console.log(`\nNorme obsolete residue: ${left.recordset[0].n}`);
  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
