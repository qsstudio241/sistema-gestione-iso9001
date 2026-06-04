/**
 * Verifica coerenza albero per-azienda org 1002 (Camellini).
 * Uso VPS: scp + node /tmp/verify-per-company-tree-org-1002-vps.js
 */
require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
const { query, getPool } = require('/var/www/sgq-backend/src/config/database');

const ORG_ID = 1002;

async function main() {
    await getPool();
    console.log('=== Verifica albero documentale org', ORG_ID, '===\n');

    const companies = await query(
        `
        SELECT c.id, c.name
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE ao.organization_id = @org_id AND c.is_active = 1
        ORDER BY c.name
        `,
        { org_id: ORG_ID }
    );

    const sharedRoots = await query(
        `
        SELECT COUNT(*) AS n FROM document_registry
        WHERE organization_id = @org_id AND parent_id IS NULL AND doc_type = 'folder'
          AND company_id IS NULL AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        `,
        { org_id: ORG_ID }
    );
    console.log('1. Radici albero CONDIVISO attive (atteso 0):', sharedRoots.recordset[0].n);

    const sharedObsoleto = await query(
        `
        SELECT COUNT(*) AS n FROM document_registry
        WHERE organization_id = @org_id AND company_id IS NULL AND doc_type = 'folder'
          AND status = 'obsoleto'
        `,
        { org_id: ORG_ID }
    );
    console.log('   Cartelle condivise archiviate (obsoleto):', sharedObsoleto.recordset[0].n);

    console.log('\n2. Per ogni azienda attiva:');
    let allOk = true;
    for (const c of companies.recordset) {
        const roots = await query(
            `
            SELECT COUNT(*) AS n FROM document_registry
            WHERE organization_id = @org_id AND company_id = @cid AND parent_id IS NULL
              AND doc_type = 'folder' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
            `,
            { org_id: ORG_ID, cid: c.id }
        );
        const dupes = await query(
            `
            SELECT title, folder_code, COUNT(*) AS cnt
            FROM document_registry
            WHERE organization_id = @org_id AND company_id = @cid AND parent_id IS NULL
              AND doc_type = 'folder' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
            GROUP BY title, folder_code
            HAVING COUNT(*) > 1
            `,
            { org_id: ORG_ID, cid: c.id }
        );
        const docsInShared = await query(
            `
            SELECT COUNT(*) AS n
            FROM document_registry d
            INNER JOIN document_registry p ON p.id = d.parent_id
            WHERE d.organization_id = @org_id AND d.company_id = @cid
              AND d.doc_type <> 'folder' AND ISNULL(d.status, 'rilasciato') <> 'obsoleto'
              AND p.company_id IS NULL AND ISNULL(p.status, 'rilasciato') <> 'obsoleto'
            `,
            { org_id: ORG_ID, cid: c.id }
        );
        const obsoletiCompany = await query(
            `
            SELECT COUNT(*) AS n FROM document_registry
            WHERE organization_id = @org_id AND company_id = @cid AND status = 'obsoleto'
            `,
            { org_id: ORG_ID, cid: c.id }
        );
        const rootN = roots.recordset[0].n;
        const ok = rootN === 15 && dupes.recordset.length === 0 && docsInShared.recordset[0].n === 0;
        if (!ok) allOk = false;
        const flag = ok ? 'OK' : 'WARN';
        console.log(
            `   [${flag}] ${c.name} (id=${c.id}): radici=${rootN}, duplicati=${dupes.recordset.length}, ` +
            `doc sotto parent condiviso=${docsInShared.recordset[0].n}, nodi obsoleti=${obsoletiCompany.recordset[0].n}`
        );
    }

    const orphanNull = await query(
        `
        SELECT COUNT(*) AS n FROM document_registry
        WHERE organization_id = @org_id AND company_id IS NULL
          AND doc_type <> 'folder' AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        `,
        { org_id: ORG_ID }
    );
    console.log('\n3. Documenti attivi senza azienda (company_id NULL):', orphanNull.recordset[0].n);

    const mismatchParent = await query(
        `
        SELECT COUNT(*) AS n
        FROM document_registry d
        INNER JOIN document_registry p ON p.id = d.parent_id
        WHERE d.organization_id = @org_id AND d.company_id IS NOT NULL
          AND d.doc_type <> 'folder' AND ISNULL(d.status, 'rilasciato') <> 'obsoleto'
          AND p.company_id IS NOT NULL AND d.company_id <> p.company_id
        `,
        { org_id: ORG_ID }
    );
    console.log('4. Documenti con parent di altra azienda (atteso 0):', mismatchParent.recordset[0].n);

    console.log('\n=== Esito:', allOk && sharedRoots.recordset[0].n === 0 ? 'COERENTE' : 'ANOMALIE ===');
    process.exit(allOk && sharedRoots.recordset[0].n === 0 ? 0 : 1);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
