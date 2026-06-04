/**
 * Rimuove l'albero documentale duplicato SAVECO (company_id=45, org QS 1002).
 * Mantiene l'albero studio condiviso (company_id NULL) come le altre aziende Camellini.
 *
 * Uso VPS: scp + node /tmp/fix-saveco-duplicate-tree.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

const ORG_ID = 1002;
const COMPANY_ID = 45;

async function main() {
  const before = await query(
    `
    WITH roots AS (
      SELECT id FROM document_registry
      WHERE organization_id = @org_id AND parent_id IS NULL AND company_id = @company_id
        AND doc_type = 'folder' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
    ),
    subtree AS (
      SELECT id FROM roots
      UNION ALL
      SELECT dr.id FROM document_registry dr
      INNER JOIN subtree s ON dr.parent_id = s.id
      WHERE dr.organization_id = @org_id
    )
    SELECT COUNT(*) AS active_nodes FROM subtree
  `,
    { org_id: ORG_ID, company_id: COMPANY_ID }
  );
  console.log('Nodi attivi sotto albero SAVECO dedicato:', before.recordset[0].active_nodes);

  const docsCheck = await query(
    `
    SELECT COUNT(*) AS n FROM document_registry
    WHERE organization_id = @org_id AND company_id = @company_id
      AND doc_type <> 'folder' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `,
    { org_id: ORG_ID, company_id: COMPANY_ID }
  );
  if (docsCheck.recordset[0].n > 0) {
    throw new Error(
      `Abort: ${docsCheck.recordset[0].n} documenti non-cartella ancora su company_id=${COMPANY_ID}`
    );
  }

  const result = await query(
    `
    WITH roots AS (
      SELECT id FROM document_registry
      WHERE organization_id = @org_id AND parent_id IS NULL AND company_id = @company_id
        AND doc_type = 'folder'
    ),
    subtree AS (
      SELECT id FROM roots
      UNION ALL
      SELECT dr.id FROM document_registry dr
      INNER JOIN subtree s ON dr.parent_id = s.id
      WHERE dr.organization_id = @org_id
    )
    UPDATE document_registry
    SET status = 'obsoleto', updated_at = GETDATE()
    WHERE id IN (SELECT id FROM subtree)
      AND ISNULL(status, 'rilasciato') <> 'obsoleto'
  `,
    { org_id: ORG_ID, company_id: COMPANY_ID }
  );
  console.log('Righe archiviate (obsoleto):', result.rowsAffected?.[0] ?? result.rowsAffected);

  const dupes = await query(
    `
    SELECT dr.title, COUNT(*) AS cnt
    FROM document_registry dr
    WHERE dr.organization_id = @org_id AND dr.parent_id IS NULL AND dr.doc_type = 'folder'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
      AND (dr.company_id = @company_id OR dr.company_id IS NULL)
    GROUP BY dr.title, dr.folder_code
    HAVING COUNT(*) > 1
  `,
    { org_id: ORG_ID, company_id: COMPANY_ID }
  );
  console.log('Gruppi duplicati residui (atteso 0):', dupes.recordset.length);

  const visible = await query(
    `
    SELECT COUNT(*) AS n FROM document_registry dr
    WHERE dr.organization_id = @org_id AND dr.parent_id IS NULL AND dr.doc_type = 'folder'
      AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
      AND (dr.company_id = @company_id OR dr.company_id IS NULL)
  `,
    { org_id: ORG_ID, company_id: COMPANY_ID }
  );
  console.log('Root visibili con filtro SAVECO (atteso 15):', visible.recordset[0].n);

  process.exit(dupes.recordset.length === 0 && visible.recordset[0].n === 15 ? 0 : 1);
}

main().catch((err) => {
  console.error('ERRORE:', err.message);
  process.exit(1);
});
