/**
 * Migrazione albero documentale per-azienda (per tenant / organization_id).
 *
 * 1. Per ogni azienda attiva: provisionTree se manca albero proprio
 * 2. Riassegna documenti/norme con company_id NULL nell'albero condiviso
 *    alla prima azienda (id minimo) — le altre aziende restano vuote
 * 3. Rimappa parent_id da cartelle condivise a cartelle per-azienda (folder_code)
 * 4. Archivia (status obsoleto) l'albero condiviso studio
 *
 * Uso locale o VPS:
 *   DRY_RUN=1 ORG_ID=1004 node scripts/migrate-per-company-document-trees-vps.js
 *   DRY_RUN=0 ORG_ID=1004 node scripts/migrate-per-company-document-trees-vps.js
 *
 * Batch (tutti i tenant che ne hanno bisogno):
 *   node scripts/migrate-shared-trees-batch.js
 *   DRY_RUN=0 node scripts/migrate-shared-trees-batch.js
 *
 * Env: ORG_ID (default 1002), DRY_RUN (default 1)
 */
const path = require('path');
const fs = require('fs');

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

const ORG_ID = parseInt(process.env.ORG_ID || '1002', 10);
const DRY_RUN = process.env.DRY_RUN !== '0';

async function loadActiveCompanies(orgId) {
    const res = await query(
        `
        SELECT c.id, c.name
        FROM companies c
        INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
        WHERE ao.organization_id = @org_id AND c.is_active = 1
        ORDER BY c.id
        `,
        { org_id: orgId }
    );
    return res.recordset || [];
}

async function countActiveRoots(orgId, companyId) {
    const res = await query(
        `
        SELECT COUNT(*) AS n FROM document_registry
        WHERE organization_id = @org_id AND parent_id IS NULL AND doc_type = 'folder'
          AND company_id ${companyId == null ? 'IS NULL' : '= @company_id'}
          AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        `,
        companyId == null ? { org_id: orgId } : { org_id: orgId, company_id: companyId }
    );
    return res.recordset[0].n;
}

async function loadFolderMap(orgId, companyId) {
    const res = await query(
        `
        SELECT id, folder_code, parent_id, company_id
        FROM document_registry
        WHERE organization_id = @org_id AND doc_type = 'folder'
          AND folder_code IS NOT NULL
          AND ISNULL(status, 'rilasciato') <> 'obsoleto'
          AND (company_id IS NULL OR company_id = @company_id)
        `,
        { org_id: orgId, company_id: companyId }
    );

    const sharedByCode = new Map();
    const companyByCode = new Map();

    for (const row of res.recordset) {
        if (row.company_id == null) {
            sharedByCode.set(row.folder_code, row.id);
        } else {
            companyByCode.set(row.folder_code, row.id);
        }
    }

    const map = new Map();
    for (const [code, sharedId] of sharedByCode) {
        const companyFolderId = companyByCode.get(code);
        if (companyFolderId != null) {
            map.set(sharedId, companyFolderId);
        }
    }
    return map;
}

async function remapParents(orgId, companyId, folderMap) {
    let remapped = 0;
    for (const [oldParentId, newParentId] of folderMap) {
        if (DRY_RUN) {
            const preview = await query(
                `
                SELECT COUNT(*) AS n FROM document_registry
                WHERE organization_id = @org_id AND parent_id = @old_parent
                  AND company_id = @company_id
                  AND ISNULL(status, 'rilasciato') <> 'obsoleto'
                `,
                { org_id: orgId, old_parent: oldParentId, company_id: companyId }
            );
            remapped += preview.recordset[0].n;
            continue;
        }

        const upd = await query(
            `
            UPDATE document_registry
            SET parent_id = @new_parent,
                updated_at = GETDATE()
            WHERE organization_id = @org_id AND parent_id = @old_parent
              AND company_id = @company_id
              AND ISNULL(status, 'rilasciato') <> 'obsoleto'
            `,
            {
                org_id: orgId,
                old_parent: oldParentId,
                new_parent: newParentId,
                company_id: companyId,
            }
        );
        remapped += upd.rowsAffected?.[0] ?? upd.rowsAffected ?? 0;
    }
    return remapped;
}

/** Documenti/norme nell'albero condiviso senza company_id → prima azienda dello studio. */
async function rehomeSharedOrphans(orgId, companies) {
    if (!companies.length) return { reassigned: 0, targetCompanyId: null, targetName: null };

    const sorted = [...companies].sort((a, b) => a.id - b.id);
    const target = sorted[0];

    const preview = await query(
        `
        WITH roots AS (
            SELECT id FROM document_registry
            WHERE organization_id = @org_id AND parent_id IS NULL
              AND company_id IS NULL AND doc_type = 'folder'
              AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        ),
        subtree AS (
            SELECT id FROM roots
            UNION ALL
            SELECT dr.id FROM document_registry dr
            INNER JOIN subtree s ON dr.parent_id = s.id
            WHERE dr.organization_id = @org_id
        )
        SELECT COUNT(*) AS n FROM document_registry dr
        WHERE dr.id IN (SELECT id FROM subtree)
          AND dr.doc_type <> 'folder'
          AND dr.company_id IS NULL
          AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        `,
        { org_id: orgId }
    );
    const count = preview.recordset[0].n;

    console.log(
        `  Orfani condivisi (company_id NULL): ${count} → azienda ${target.name} (id=${target.id})`
    );

    if (DRY_RUN || count === 0) {
        return { reassigned: count, targetCompanyId: target.id, targetName: target.name };
    }

    const result = await query(
        `
        WITH roots AS (
            SELECT id FROM document_registry
            WHERE organization_id = @org_id AND parent_id IS NULL
              AND company_id IS NULL AND doc_type = 'folder'
              AND ISNULL(status, 'rilasciato') <> 'obsoleto'
        ),
        subtree AS (
            SELECT id FROM roots
            UNION ALL
            SELECT dr.id FROM document_registry dr
            INNER JOIN subtree s ON dr.parent_id = s.id
            WHERE dr.organization_id = @org_id
        )
        UPDATE document_registry
        SET company_id = @company_id, updated_at = GETDATE()
        WHERE id IN (
            SELECT dr.id FROM document_registry dr
            WHERE dr.id IN (SELECT id FROM subtree)
              AND dr.doc_type <> 'folder'
              AND dr.company_id IS NULL
              AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        )
        `,
        { org_id: orgId, company_id: target.id }
    );

    return {
        reassigned: result.rowsAffected?.[0] ?? result.rowsAffected ?? 0,
        targetCompanyId: target.id,
        targetName: target.name,
    };
}

async function obsoleteSharedTree(orgId) {
    if (DRY_RUN) {
        const preview = await query(
            `
            WITH roots AS (
                SELECT id FROM document_registry
                WHERE organization_id = @org_id AND parent_id IS NULL
                  AND company_id IS NULL AND doc_type = 'folder'
                  AND ISNULL(status, 'rilasciato') <> 'obsoleto'
            ),
            subtree AS (
                SELECT id FROM roots
                UNION ALL
                SELECT dr.id FROM document_registry dr
                INNER JOIN subtree s ON dr.parent_id = s.id
                WHERE dr.organization_id = @org_id
            )
            SELECT COUNT(*) AS n FROM subtree
            `,
            { org_id: orgId }
        );
        return preview.recordset[0].n;
    }

    const result = await query(
        `
        WITH roots AS (
            SELECT id FROM document_registry
            WHERE organization_id = @org_id AND parent_id IS NULL
              AND company_id IS NULL AND doc_type = 'folder'
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
        { org_id: orgId }
    );
    return result.rowsAffected?.[0] ?? result.rowsAffected ?? 0;
}

async function verifyCompany(orgId, companyId, companyName) {
    const roots = await countActiveRoots(orgId, companyId);
    const dupes = await query(
        `
        SELECT dr.title, COUNT(*) AS cnt
        FROM document_registry dr
        WHERE dr.organization_id = @org_id AND dr.parent_id IS NULL AND dr.doc_type = 'folder'
          AND dr.company_id = @company_id
          AND ISNULL(dr.status, 'rilasciato') <> 'obsoleto'
        GROUP BY dr.title, dr.folder_code
        HAVING COUNT(*) > 1
        `,
        { org_id: orgId, company_id: companyId }
    );
    const ok = roots === 15 && dupes.recordset.length === 0;
    console.log(
        `  [${ok ? 'OK' : 'WARN'}] ${companyName} (id=${companyId}): ${roots} radici, duplicati=${dupes.recordset.length}`
    );
    return ok;
}

async function main() {
    await getPool();
    console.log(`Org ${ORG_ID} | DRY_RUN=${DRY_RUN}`);

    const stdRes = await query('SELECT standard_code FROM standards WHERE is_active = 1');
    const standardCodes = (stdRes.recordset || []).map((r) => r.standard_code);

    const companies = await loadActiveCompanies(ORG_ID);
    console.log(`Aziende attive: ${companies.length}`);

    const sharedRootsBefore = await countActiveRoots(ORG_ID, null);
    console.log(`Radici albero condiviso (company_id NULL): ${sharedRootsBefore}`);

    for (const company of companies) {
        console.log(`\n--- Provision ${company.name} (id=${company.id}) ---`);
        const roots = await countActiveRoots(ORG_ID, company.id);

        if (roots === 0) {
            console.log('  Provision albero per-azienda...');
            if (!DRY_RUN) {
                await provisioner.provisionTree(ORG_ID, company.id, null, standardCodes);
                const rootsAfter = await countActiveRoots(ORG_ID, company.id);
                if (rootsAfter === 0) {
                    const purged = await query(
                        `
                        DELETE FROM document_registry
                        WHERE organization_id = @org_id AND company_id = @company_id
                          AND status = 'obsoleto' AND doc_type = 'folder'
                        `,
                        { org_id: ORG_ID, company_id: company.id }
                    );
                    const n = purged.rowsAffected?.[0] ?? purged.rowsAffected ?? 0;
                    if (n > 0) {
                        console.log(`  Rimossi ${n} folder obsoleti che bloccavano provision; riprovo...`);
                        await provisioner.provisionTree(ORG_ID, company.id, null, standardCodes);
                    }
                }
            }
        } else {
            console.log(`  Albero già presente (${roots} radici)`);
        }
    }

    console.log('\n--- Riassegna documenti condivisi senza company_id ---');
    await rehomeSharedOrphans(ORG_ID, companies);

    for (const company of companies) {
        console.log(`\n--- Rimappa ${company.name} (id=${company.id}) ---`);
        const folderMap = await loadFolderMap(ORG_ID, company.id);
        console.log(`  Mappa cartelle condiviso→azienda: ${folderMap.size} codici`);

        const remapped = await remapParents(ORG_ID, company.id, folderMap);
        console.log(`  Righe rimappate parent_id: ${remapped}${DRY_RUN ? ' (preview)' : ''}`);
    }

    console.log('\n--- Archivia albero condiviso studio ---');
    const archived = await obsoleteSharedTree(ORG_ID);
    console.log(`  Nodi archiviati: ${archived}${DRY_RUN ? ' (preview)' : ''}`);

    if (!DRY_RUN) {
        console.log('\n--- Verifica post-migrazione ---');
        let allOk = true;
        for (const company of companies) {
            const ok = await verifyCompany(ORG_ID, company.id, company.name);
            if (!ok) allOk = false;
        }
        const sharedAfter = await countActiveRoots(ORG_ID, null);
        console.log(`Radici condivise residue (atteso 0): ${sharedAfter}`);
        process.exit(allOk && sharedAfter === 0 ? 0 : 1);
    }

    console.log('\nDRY_RUN completato. Per applicare: DRY_RUN=0 node ...');
    process.exit(0);
}

main().catch((err) => {
    console.error('ERRORE:', err.message);
    process.exit(1);
});
