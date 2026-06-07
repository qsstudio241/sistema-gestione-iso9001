/**
 * Backfill company_id sulle norme in document_registry.
 *
 * A) Eredita company_id dalla cartella padre (parent_id)
 * B) Sposta norme org 1002 da cartella obsoleta #1055 alla cartella attiva 2.3 #1290 (company 10)
 *
 * Uso (da backend/ con DB_* in env o .ssh-deploy.local.ps1):
 *   node scripts/backfill-norm-company-id.js --dry-run
 *   node scripts/backfill-norm-company-id.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query, getPool, closePool } = require('../src/config/database');
const { calculatePathCache } = require('../src/services/documentTreeProvisioner.service');

const dryRun = process.argv.includes('--dry-run');

const OBSOLETE_FOLDER_ID = 1055;
const TARGET_FOLDER_ID = 1290;
const MOVE_NORM_IDS = [1699, 1700, 1701, 1702, 1703];

async function countNorms() {
  const r = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company,
      SUM(CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END) AS with_company
    FROM document_registry
    WHERE doc_type = 'norma'
  `);
  return r.recordset[0];
}

async function backfillFromParent() {
  const preview = await query(`
    SELECT dr.id, dr.company_id AS current_co, p.company_id AS would_be_co, p.id AS parent_id
    FROM document_registry dr
    INNER JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
      AND dr.company_id IS NULL
      AND p.company_id IS NOT NULL
    ORDER BY dr.id
  `);

  console.log(`\n[A] Backfill company_id da cartella padre: ${preview.recordset.length} candidati`);
  for (const r of preview.recordset) {
    console.log(`   #${r.id}: NULL -> ${r.would_be_co} (parent ${r.parent_id})`);
  }

  if (dryRun || preview.recordset.length === 0) {
    return { updated: 0, candidates: preview.recordset.length };
  }

  const result = await query(`
    UPDATE dr
    SET dr.company_id = p.company_id, dr.updated_at = GETDATE()
    FROM document_registry dr
    INNER JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
      AND dr.company_id IS NULL
      AND p.company_id IS NOT NULL
  `);
  return { updated: result.rowsAffected[0], candidates: preview.recordset.length };
}

async function moveNormsFromObsoleteFolder() {
  const target = await query(
    `SELECT id, organization_id, company_id, title, folder_code, status
     FROM document_registry WHERE id = @id`,
    { id: TARGET_FOLDER_ID }
  );
  if (!target.recordset.length) {
    throw new Error(`Cartella destinazione #${TARGET_FOLDER_ID} non trovata`);
  }
  const folder = target.recordset[0];
  if (folder.status === 'obsoleto') {
    throw new Error(`Cartella #${TARGET_FOLDER_ID} � obsoleta`);
  }
  if (!folder.company_id) {
    throw new Error(`Cartella #${TARGET_FOLDER_ID} senza company_id`);
  }

  const norms = await query(`
    SELECT id, organization_id, parent_id, company_id, title
    FROM document_registry
    WHERE id IN (${MOVE_NORM_IDS.join(',')})
      AND doc_type = 'norma'
    ORDER BY id
  `);

  console.log(`\n[B] Sposta norme da #${OBSOLETE_FOLDER_ID} a #${TARGET_FOLDER_ID} (co=${folder.company_id}):`);
  for (const n of norms.recordset) {
    console.log(
      `   #${n.id} parent=${n.parent_id} co=${n.company_id ?? 'NULL'} "${n.title}"`
    );
  }

  if (norms.recordset.length !== MOVE_NORM_IDS.length) {
    throw new Error(`Attese ${MOVE_NORM_IDS.length} norme, trovate ${norms.recordset.length}`);
  }

  if (dryRun) {
    return { moved: 0, targetCompanyId: folder.company_id };
  }

  const result = await query(`
    UPDATE document_registry
    SET parent_id = @parentId,
        company_id = @companyId,
        updated_at = GETDATE()
    WHERE id IN (${MOVE_NORM_IDS.join(',')})
      AND doc_type = 'norma'
      AND parent_id = @obsoleteFolderId
  `, {
    parentId: TARGET_FOLDER_ID,
    companyId: folder.company_id,
    obsoleteFolderId: OBSOLETE_FOLDER_ID,
  });

  const moved = result.rowsAffected[0];
  for (const n of norms.recordset) {
    const pathCache = await calculatePathCache(n.id, n.organization_id);
    await query(
      `UPDATE document_registry SET path_cache = @path_cache, updated_at = GETDATE() WHERE id = @id`,
      { path_cache: pathCache, id: n.id }
    );
  }

  return { moved, targetCompanyId: folder.company_id };
}

async function main() {
  await getPool();
  console.log(`=== Backfill norme company_id${dryRun ? ' (DRY-RUN)' : ''} ===`);

  const before = await countNorms();
  console.log('\nPrima:', before);

  const backfill = await backfillFromParent();
  const move = await moveNormsFromObsoleteFolder();

  const after = dryRun ? before : await countNorms();
  if (!dryRun) {
    console.log('\nDopo:', after);
  }

  console.log('\n--- Riepilogo ---');
  console.log(`Backfill (A): ${dryRun ? `${backfill.candidates} candidati (dry-run)` : `${backfill.updated} aggiornate`}`);
  console.log(
    `Spostamento (B): ${dryRun ? `${MOVE_NORM_IDS.length} da spostare (dry-run)` : `${move.moved} spostate -> company ${move.targetCompanyId}`}`
  );

  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
