/**
 * Diagnostica: tenant con albero documentale condiviso ancora attivo.
 *
 * Per ogni organization_id elenca:
 * - radici condivise attive (company_id NULL)
 * - numero aziende attive
 * - norme/doc con company_id NULL sotto cartelle non obsolete
 * - flag needs_migration (albero condiviso + almeno 1 azienda)
 *
 * Uso (da backend/):
 *   node scripts/scan-shared-document-trees.js
 *   node scripts/scan-shared-document-trees.js --json
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query, getPool, closePool } = require('../src/config/database');

const asJson = process.argv.includes('--json');

async function main() {
    await getPool();

    const orgs = await query(`
        SELECT o.organization_id, o.organization_code, o.organization_name AS org_name
        FROM organizations o
        WHERE o.is_active = 1
        ORDER BY o.organization_id
    `);

    const rows = [];

    for (const org of orgs.recordset) {
        const orgId = org.organization_id;

        const sharedRoots = await query(`
            SELECT COUNT(*) AS n FROM document_registry
            WHERE organization_id = @org_id AND parent_id IS NULL AND doc_type = 'folder'
              AND company_id IS NULL AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        `, { org_id: orgId });

        const companies = await query(`
            SELECT COUNT(*) AS n
            FROM companies c
            INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE ao.organization_id = @org_id AND c.is_active = 1
        `, { org_id: orgId });

        const perCompanyRoots = await query(`
            SELECT COUNT(DISTINCT dr.company_id) AS n
            FROM document_registry dr
            WHERE dr.organization_id = @org_id AND dr.parent_id IS NULL AND dr.doc_type = 'folder'
              AND dr.company_id IS NOT NULL AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        `, { org_id: orgId });

        const sharedNorms = await query(`
            SELECT COUNT(*) AS n FROM document_registry dr
            WHERE dr.organization_id = @org_id AND dr.doc_type = 'norma'
              AND dr.company_id IS NULL AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        `, { org_id: orgId });

        const sharedRootsN = sharedRoots.recordset[0].n;
        const companiesN = companies.recordset[0].n;
        const perCompanyRootsN = perCompanyRoots.recordset[0].n;
        const sharedNormsN = sharedNorms.recordset[0].n;

        const needsMigration = sharedRootsN > 0 && companiesN > 0;

        rows.push({
            organization_id: orgId,
            organization_code: org.organization_code,
            org_name: org.org_name,
            shared_roots: sharedRootsN,
            active_companies: companiesN,
            companies_with_tree: perCompanyRootsN,
            shared_norms: sharedNormsN,
            needs_migration: needsMigration,
        });
    }

    if (asJson) {
        console.log(JSON.stringify(rows, null, 2));
    } else {
        console.log('=== Diagnostica alberi documentali condivisi ===\n');
        console.log(
            'ORG_ID | CODE        | Nome                  | Radici NULL | Aziende | Alberi co. | Norme NULL | Migra?'
        );
        console.log('-'.repeat(105));
        for (const r of rows) {
            const flag = r.needs_migration ? 'SI' : 'no';
            console.log(
                `${String(r.organization_id).padEnd(6)} | ${String(r.organization_code || '').padEnd(11)} | ${String(r.org_name || '').substring(0, 21).padEnd(21)} | ${String(r.shared_roots).padStart(11)} | ${String(r.active_companies).padStart(7)} | ${String(r.companies_with_tree).padStart(10)} | ${String(r.shared_norms).padStart(10)} | ${flag}`
            );
        }
        const todo = rows.filter((r) => r.needs_migration);
        console.log(`\nTenant da migrare: ${todo.length}`);
        for (const r of todo) {
            console.log(`  - org ${r.organization_id} (${r.organization_code}) ${r.org_name}`);
        }
    }

    await closePool();
    process.exit(0);
}

main().catch(async (e) => {
    console.error('ERRORE:', e.message);
    try { await closePool(); } catch (_) {}
    process.exit(1);
});
