/**
 * Diagnostica norme in document_registry (produzione o env locale).
 * Uso: da backend/ con DB_* in env oppure .env
 *   node scripts/check-norms-db.js
 *   node scripts/check-norms-db.js --doc-id=1769
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query, getPool, closePool } = require('../src/config/database');

const DOC_ID = (() => {
  const arg = process.argv.find((a) => a.startsWith('--doc-id='));
  return arg ? parseInt(arg.split('=')[1], 10) : 1769;
})();

async function main() {
  await getPool();
  console.log('=== Diagnostica norme document_registry ===\n');

  const totals = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_company,
      SUM(CASE WHEN company_id IS NOT NULL THEN 1 ELSE 0 END) AS with_company,
      SUM(CASE WHEN ISNULL(status, 'rilasciato') = 'obsoleto' THEN 1 ELSE 0 END) AS obsoleto
    FROM document_registry
    WHERE doc_type = 'norma'
  `);
  const t = totals.recordset[0];
  console.log('1. Totale norme (doc_type=norma):', t.total);
  console.log('   company_id NULL:', t.null_company);
  console.log('   company_id valorizzato:', t.with_company);
  console.log('   status obsoleto:', t.obsoleto);

  const byOrg = await query(`
    SELECT organization_id,
      COUNT(*) AS n,
      SUM(CASE WHEN company_id IS NULL THEN 1 ELSE 0 END) AS null_co
    FROM document_registry
    WHERE doc_type = 'norma'
    GROUP BY organization_id
    ORDER BY n DESC
  `);
  console.log('\n2. Norme per organization_id:');
  for (const r of byOrg.recordset) {
    console.log(`   org ${r.organization_id}: ${r.n} (NULL company=${r.null_co})`);
  }

  const recent = await query(`
    SELECT TOP 20
      dr.id, dr.organization_id, dr.company_id, dr.parent_id, dr.title,
      dr.status, dr.doc_code, dr.created_at, dr.attachment_id,
      p.title AS parent_title, p.folder_code AS parent_folder_code, p.company_id AS parent_company_id
    FROM document_registry dr
    LEFT JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
    ORDER BY dr.id DESC
  `);
  console.log('\n3. Ultime 20 norme:');
  for (const r of recent.recordset) {
    console.log(
      `   #${r.id} org=${r.organization_id} co=${r.company_id ?? 'NULL'} parent=${r.parent_id} ` +
        `(${r.parent_folder_code || '?'}) "${r.title}" status=${r.status} att=${r.attachment_id ?? 'NULL'}`
    );
  }

  const folder23 = await query(`
    SELECT id, organization_id, company_id, parent_id, title, folder_code, status, is_system_folder
    FROM document_registry
    WHERE folder_code = '2.3' OR title LIKE '%NORME E LEGGI%'
    ORDER BY organization_id, company_id, id
  `);
  console.log('\n4. Cartelle 2.3 / NORME E LEGGI:');
  for (const r of folder23.recordset) {
    console.log(
      `   #${r.id} org=${r.organization_id} co=${r.company_id ?? 'NULL'} code=${r.folder_code} ` +
        `"${r.title}" status=${r.status} system=${r.is_system_folder}`
    );
  }

  if (DOC_ID) {
    const doc = await query(
      `
      SELECT dr.*, p.title AS parent_title, p.folder_code AS parent_folder_code, p.company_id AS parent_company_id
      FROM document_registry dr
      LEFT JOIN document_registry p ON p.id = dr.parent_id
      WHERE dr.id = @id
      `,
      { id: DOC_ID }
    );
    console.log(`\n5. Dettaglio documento #${DOC_ID}:`);
    if (!doc.recordset.length) {
      console.log('   NON TROVATO');
    } else {
      const d = doc.recordset[0];
      console.log(JSON.stringify(
        {
          id: d.id,
          organization_id: d.organization_id,
          company_id: d.company_id,
          parent_id: d.parent_id,
          parent_title: d.parent_title,
          parent_folder_code: d.parent_folder_code,
          parent_company_id: d.parent_company_id,
          doc_type: d.doc_type,
          title: d.title,
          status: d.status,
          doc_code: d.doc_code,
          attachment_id: d.attachment_id,
          type_specific_data: d.type_specific_data,
          created_at: d.created_at,
        },
        null,
        2
      ));
    }

    const nds = await query(
      `SELECT * FROM norm_document_sources WHERE document_id = @id OR id = @id ORDER BY id`,
      { id: DOC_ID }
    );
    console.log(`\n6. norm_document_sources collegati a #${DOC_ID}: ${nds.recordset.length}`);
    for (const r of nds.recordset) {
      console.log(
        `   nds#${r.id} doc=${r.document_id} org=${r.organization_id} code=${r.standard_code} title="${r.norm_title}"`
      );
    }

    const atts = await query(
      `
      SELECT a.attachment_id, a.document_id, a.file_name, a.mime_type, a.file_size, a.storage_path, a.created_at
      FROM attachments a
      WHERE a.document_id = @id
         OR EXISTS (SELECT 1 FROM document_registry dr WHERE dr.id = @id AND dr.attachment_id = a.attachment_id)
      ORDER BY a.attachment_id
      `,
      { id: DOC_ID }
    );
    console.log(`\n7. attachments per #${DOC_ID}: ${atts.recordset.length}`);
    for (const r of atts.recordset) {
      console.log(`   att#${r.attachment_id} doc=${r.document_id} file="${r.file_name}" path=${r.storage_path}`);
    }
  }

  const orphanNorms = await query(`
    SELECT COUNT(*) AS n FROM document_registry dr
    WHERE dr.doc_type = 'norma'
      AND dr.parent_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM document_registry p WHERE p.id = dr.parent_id)
  `);
  console.log('\n8. Norme con parent_id inesistente:', orphanNorms.recordset[0].n);

  const hiddenByCompanyFilter = await query(`
    SELECT COUNT(*) AS n
    FROM document_registry dr
    INNER JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
      AND dr.company_id IS NULL
      AND p.company_id IS NOT NULL
  `);
  console.log('9. Norme company_id NULL sotto cartella con company_id (nascoste da filtro UI):', hiddenByCompanyFilter.recordset[0].n);

  const underObsoletoParent = await query(`
    SELECT dr.id, dr.organization_id, dr.parent_id, p.status AS parent_status, p.company_id AS parent_co, dr.title
    FROM document_registry dr
    INNER JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
      AND (p.status = 'obsoleto' OR ISNULL(p.status, 'rilasciato') = 'obsoleto')
    ORDER BY dr.id
  `);
  console.log('\n10. Norme attive sotto cartella padre obsoleta (invisibili in albero):', underObsoletoParent.recordset.length);
  for (const r of underObsoletoParent.recordset) {
    console.log(`   #${r.id} org=${r.organization_id} parent=${r.parent_id} parent_co=${r.parent_co ?? 'NULL'} "${r.title}"`);
  }

  const backfillPreview = await query(`
    SELECT dr.id, dr.company_id AS current_co, p.company_id AS would_be_co, p.id AS parent_id
    FROM document_registry dr
    INNER JOIN document_registry p ON p.id = dr.parent_id
    WHERE dr.doc_type = 'norma'
      AND dr.company_id IS NULL
      AND p.company_id IS NOT NULL
    ORDER BY dr.id
  `);
  console.log('\n11. Backfill candidati (company_id da cartella padre):', backfillPreview.recordset.length);
  for (const r of backfillPreview.recordset) {
    console.log(`   #${r.id}: NULL -> ${r.would_be_co} (parent ${r.parent_id})`);
  }

  await closePool();
}

main().catch(async (e) => {
  console.error('ERRORE:', e.message);
  try { await closePool(); } catch (_) {}
  process.exit(1);
});
