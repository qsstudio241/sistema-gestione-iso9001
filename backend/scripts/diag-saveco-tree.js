require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query } = require('/var/www/sgq-backend/src/config/database');

async function main() {
  const companies = await query(`
    SELECT c.id, c.name, c.auditor_org_id, ao.organization_id, ao.name AS auditor_name
    FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE c.name LIKE '%SAVECO%' OR ao.name LIKE '%Camellini%' OR ao.organization_id = 1002
    ORDER BY c.name
  `);
  console.log('=== Aziende SAVECO / Camellini (QS) ===');
  console.log(JSON.stringify(companies.recordset, null, 2));

  for (const co of companies.recordset) {
    const orgId = co.organization_id;
    const cid = co.id;

    const rootsForCompany = await query(`
      SELECT dr.id, dr.title, dr.folder_code, dr.company_id
      FROM document_registry dr
      WHERE dr.organization_id = @org_id
        AND dr.parent_id IS NULL
        AND dr.doc_type = 'folder'
        AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        AND (dr.company_id = @company_id OR dr.company_id IS NULL)
      ORDER BY dr.title, dr.company_id, dr.id
    `, { org_id: orgId, company_id: cid });

    const dupes = await query(`
      SELECT dr.title, dr.folder_code, COUNT(*) AS cnt,
             STRING_AGG(CAST(dr.company_id AS NVARCHAR(20)), ', ') AS company_ids,
             STRING_AGG(CAST(dr.id AS NVARCHAR(20)), ', ') AS ids
      FROM document_registry dr
      WHERE dr.organization_id = @org_id
        AND dr.parent_id IS NULL
        AND dr.doc_type = 'folder'
        AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        AND (dr.company_id = @company_id OR dr.company_id IS NULL)
      GROUP BY dr.title, dr.folder_code
      HAVING COUNT(*) > 1
      ORDER BY dr.title
    `, { org_id: orgId, company_id: cid });

    console.log(`\n=== ${co.name} (company_id=${cid}, org=${orgId}) ===`);
    console.log(`Root visibili con filtro azienda (company OR NULL): ${rootsForCompany.recordset.length}`);
    console.log(`Gruppi duplicati: ${dupes.recordset.length}`);
    if (dupes.recordset.length) {
      console.log(JSON.stringify(dupes.recordset, null, 2));
    }

    const byScope = await query(`
      SELECT dr.company_id, COUNT(*) AS root_count
      FROM document_registry dr
      WHERE dr.organization_id = @org_id
        AND dr.parent_id IS NULL
        AND dr.doc_type = 'folder'
        AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        AND (dr.company_id = @company_id OR dr.company_id IS NULL)
      GROUP BY dr.company_id
      ORDER BY dr.company_id
    `, { org_id: orgId, company_id: cid });
    console.log('Root per company_id:');
    console.log(JSON.stringify(byScope.recordset, null, 2));
  }

  const allCos = await query(`
    SELECT c.id, c.name FROM companies c
    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
    WHERE ao.organization_id = 1002 AND c.is_active = 1
    ORDER BY c.name
  `);
  console.log('\n=== Riepilogo duplicati per TUTTE le aziende org 1002 ===');
  for (const co of allCos.recordset) {
    const dupCount = await query(`
      SELECT COUNT(*) AS dup_groups FROM (
        SELECT dr.title
        FROM document_registry dr
        WHERE dr.organization_id = 1002
          AND dr.parent_id IS NULL
          AND dr.doc_type = 'folder'
          AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
          AND (dr.company_id = @cid OR dr.company_id IS NULL)
        GROUP BY dr.title, dr.folder_code
        HAVING COUNT(*) > 1
      ) x
    `, { cid: co.id });
    const visible = await query(`
      SELECT COUNT(*) AS n FROM document_registry dr
      WHERE dr.organization_id = 1002 AND dr.parent_id IS NULL
        AND dr.doc_type = 'folder'
        AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        AND (dr.company_id = @cid OR dr.company_id IS NULL)
    `, { cid: co.id });
    console.log(
      `${co.name} (id=${co.id}): root visibili=${visible.recordset[0].n}, gruppi duplicati=${dupCount.recordset[0].dup_groups}`
    );
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
