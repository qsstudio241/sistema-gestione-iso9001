/**
 * Esegue migrate-per-company-document-trees-vps.js su ogni tenant
 * che ha ancora albero condiviso attivo (scan-shared-document-trees).
 *
 * Uso (da backend/):
 *   node scripts/migrate-shared-trees-batch.js          # DRY_RUN=1 default
 *   DRY_RUN=0 node scripts/migrate-shared-trees-batch.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawnSync } = require('child_process');
const path = require('path');
const { query, getPool, closePool } = require('../src/config/database');

const DRY_RUN = process.env.DRY_RUN !== '0';
const node = process.execPath;
const migrateScript = path.join(__dirname, 'migrate-per-company-document-trees-vps.js');

async function orgsNeedingMigration() {
    const orgs = await query(`
        SELECT o.organization_id, o.organization_code, o.organization_name
        FROM organizations o
        WHERE o.is_active = 1
        ORDER BY o.organization_id
    `);

    const todo = [];
    for (const org of orgs.recordset) {
        const sharedRoots = await query(`
            SELECT COUNT(*) AS n FROM document_registry
            WHERE organization_id = @org_id AND parent_id IS NULL AND doc_type = 'folder'
              AND company_id IS NULL AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        `, { org_id: org.organization_id });

        const companies = await query(`
            SELECT COUNT(*) AS n
            FROM companies c
            INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
            WHERE ao.organization_id = @org_id AND c.is_active = 1
        `, { org_id: org.organization_id });

        if (sharedRoots.recordset[0].n > 0 && companies.recordset[0].n > 0) {
            todo.push(org);
        }
    }
    return todo;
}

async function main() {
    await getPool();
    const todo = await orgsNeedingMigration();
    await closePool();

    console.log(`=== Batch migrazione alberi per-azienda | DRY_RUN=${DRY_RUN} ===`);
    console.log(`Tenant da processare: ${todo.length}`);

    if (todo.length === 0) {
        console.log('Nessun tenant da migrare.');
        process.exit(0);
    }

    let failed = 0;
    for (const org of todo) {
        console.log(`\n######## org ${org.organization_id} (${org.organization_code}) ${org.organization_name} ########`);
        const env = { ...process.env, ORG_ID: String(org.organization_id), DRY_RUN: DRY_RUN ? '1' : '0' };
        const result = spawnSync(node, [migrateScript], { env, stdio: 'inherit', cwd: path.join(__dirname, '..') });
        if (result.status !== 0) {
            console.error(`FAIL org ${org.organization_id} exit=${result.status}`);
            failed += 1;
            if (!DRY_RUN) break;
        }
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error('ERRORE:', e.message);
    process.exit(1);
});
