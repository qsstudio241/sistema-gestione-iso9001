/**
 * provision-trees-existing-orgs.js
 * Provisioning albero documentale per tutte le organizzazioni che non ne hanno uno.
 *
 * Idempotente: se un'org ha gi\u00E0 nodi root in document_registry, viene saltata.
 *
 * Uso locale:  node backend/scripts/provision-trees-existing-orgs.js
 * Uso VPS:     scp to VPS, then: node /tmp/provision-trees-existing-orgs.js
 *
 * Richiede database.json oppure variabili d'ambiente DB_*.
 */

const path = require('path');
const fs = require('fs');

// Rileva se siamo su VPS (directory /var/www/sgq-backend) o in locale
const isVps = fs.existsSync('/var/www/sgq-backend/src/config/database.js');
const basePath = isVps ? '/var/www/sgq-backend' : path.join(__dirname, '..');

if (isVps) {
    process.chdir('/var/www/sgq-backend');
    require('/var/www/sgq-backend/node_modules/dotenv').config({ path: '/var/www/sgq-backend/.env' });
} else {
    require('dotenv').config({ path: path.join(basePath, '.env') });
}

const { getPool, query } = require(path.join(basePath, 'src', 'config', 'database'));
const provisioner = require(path.join(basePath, 'src', 'services', 'documentTreeProvisioner.service'));

async function main() {
    await getPool();
    console.log('Connessione DB OK');

    // Standard attivi globali
    const stdRes = await query('SELECT standard_code FROM standards WHERE is_active = 1');
    const standardCodes = (stdRes.recordset || []).map(r => r.standard_code);
    console.log('Standard attivi:', standardCodes.join(', ') || '(nessuno)');

    // Tutte le organizzazioni attive
    const orgsRes = await query(`
        SELECT o.organization_id, o.organization_name
        FROM organizations o
        WHERE o.is_active = 1
        ORDER BY o.organization_id
    `);
    const orgs = orgsRes.recordset || [];
    console.log(`Organizzazioni attive: ${orgs.length}`);

    let provisioned = 0;
    let skipped = 0;
    let failed = 0;

    for (const org of orgs) {
        const rootCheck = await query(
            `SELECT TOP 1 id FROM document_registry
             WHERE organization_id = @org_id AND parent_id IS NULL`,
            { org_id: org.organization_id }
        );

        if (rootCheck.recordset.length > 0) {
            console.log(`  [SKIP] Org ${org.organization_id} "${org.organization_name}" - albero gi\u00E0 presente`);
            skipped++;
            continue;
        }

        try {
            const tree = await provisioner.provisionTree(
                org.organization_id, null, null, standardCodes
            );
            console.log(`  [OK]   Org ${org.organization_id} "${org.organization_name}" - ${tree.length} cartelle root create`);
            provisioned++;
        } catch (err) {
            console.error(`  [FAIL] Org ${org.organization_id} "${org.organization_name}" - ${err.message}`);
            failed++;
        }
    }

    console.log('\n--- Riepilogo ---');
    console.log(`Provisioned: ${provisioned}`);
    console.log(`Skipped:     ${skipped}`);
    console.log(`Failed:      ${failed}`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('ERRORE FATALE:', err.message);
    process.exit(1);
});
