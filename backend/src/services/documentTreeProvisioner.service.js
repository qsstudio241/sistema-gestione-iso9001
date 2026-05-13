/**
 * Document Tree Provisioner Service
 * Crea l'albero documentale da template JSON (tabella document_tree_templates).
 * Idempotente: folder_code + organization_id + company_id = chiave logica.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Risale l'albero parent_id per costruire path_cache = /ancestor1/ancestor2/.../nodeId/
 */
async function calculatePathCache(nodeId, orgId) {
    const parts = [];
    let currentId = parseInt(nodeId);

    for (let depth = 0; depth < 50; depth++) {
        parts.unshift(currentId);
        const result = await query(`
            SELECT parent_id FROM document_registry
            WHERE id = @id AND organization_id = @org_id
        `, { id: currentId, org_id: orgId });

        if (!result.recordset.length || result.recordset[0].parent_id == null) break;
        currentId = result.recordset[0].parent_id;
    }

    return '/' + parts.join('/') + '/';
}

/**
 * Aggiorna path_cache di un nodo e di tutti i suoi discendenti (ricorsivo).
 */
async function refreshPathCacheRecursive(nodeId, orgId) {
    const newPath = await calculatePathCache(nodeId, orgId);
    await query(`
        UPDATE document_registry SET path_cache = @path_cache, updated_at = GETDATE()
        WHERE id = @id AND organization_id = @org_id
    `, { path_cache: newPath, id: parseInt(nodeId), org_id: orgId });

    const children = await query(`
        SELECT id FROM document_registry
        WHERE parent_id = @parent_id AND organization_id = @org_id
    `, { parent_id: parseInt(nodeId), org_id: orgId });

    for (const child of children.recordset) {
        await refreshPathCacheRecursive(child.id, orgId);
    }
}

/**
 * Crea ricorsivamente i nodi dall'array template.
 * @param {Array} nodes       - array di nodi { folder_code, title, requires_standards?, children? }
 * @param {number|null} parentId
 * @param {number} orgId
 * @param {number|null} companyId
 * @param {string[]} standardCodes - standard attivi per filtrare nodi condizionati
 * @param {number} baseOrder       - display_order di partenza
 * @returns {Array} nodi creati
 */
async function createNodesRecursive(nodes, parentId, orgId, companyId, standardCodes, baseOrder) {
    const created = [];
    let order = baseOrder;

    for (const node of nodes) {
        // Il template JSON usa "code", il DB usa "folder_code"
        const folderCode = node.folder_code || node.code || null;
        const nodeTitle  = node.title || node.name || '';

        if (node.requires_standards && node.requires_standards.length > 0) {
            const hasMatch = node.requires_standards.some(s => standardCodes.includes(s));
            if (!hasMatch) continue;
        }

        const existing = await query(`
            SELECT id FROM document_registry
            WHERE folder_code = @folder_code
              AND organization_id = @org_id
              AND (company_id = @company_id OR (@company_id IS NULL AND company_id IS NULL))
        `, {
            folder_code: folderCode,
            org_id:      orgId,
            company_id:  companyId != null ? parseInt(companyId) : null,
        });

        let nodeId;
        if (existing.recordset.length > 0) {
            nodeId = existing.recordset[0].id;
        } else {
            const result = await query(`
                INSERT INTO document_registry
                    (organization_id, company_id, doc_type, title, status,
                     is_system_folder, folder_code, parent_id, display_order,
                     created_by, created_at, updated_at)
                OUTPUT INSERTED.id
                VALUES
                    (@org_id, @company_id, 'folder', @title, 'vigente',
                     1, @folder_code, @parent_id, @display_order,
                     NULL, GETDATE(), GETDATE())
            `, {
                org_id:        orgId,
                company_id:    companyId != null ? parseInt(companyId) : null,
                title:         nodeTitle,
                folder_code:   folderCode,
                parent_id:     parentId != null ? parseInt(parentId) : null,
                display_order: order,
            });
            nodeId = result.recordset[0].id;

            const pathCache = await calculatePathCache(nodeId, orgId);
            await query(`
                UPDATE document_registry SET path_cache = @path_cache WHERE id = @id
            `, { path_cache: pathCache, id: nodeId });
        }

        const item = { id: nodeId, folder_code: folderCode, title: nodeTitle, children: [] };

        if (node.children && node.children.length > 0) {
            item.children = await createNodesRecursive(
                node.children, nodeId, orgId, companyId, standardCodes, 1
            );
        }

        created.push(item);
        order++;
    }

    return created;
}

/**
 * Provisioning completo dell'albero documentale da template.
 * @param {number} orgId
 * @param {number|null} companyId
 * @param {string|null} templateCode - codice template, null per default
 * @param {string[]} standardCodes   - es. ['ISO9001', 'ISO14001']
 * @returns {Promise<Array>} albero creato
 */
async function provisionTree(orgId, companyId, templateCode, standardCodes = []) {
    let templateData;

    if (templateCode) {
        const tmpl = await query(`
            SELECT structure FROM document_tree_templates
            WHERE template_code = @code
        `, { code: templateCode });

        if (!tmpl.recordset.length) {
            throw new Error(`Template "${templateCode}" non trovato`);
        }
        templateData = typeof tmpl.recordset[0].structure === 'string'
            ? JSON.parse(tmpl.recordset[0].structure)
            : tmpl.recordset[0].structure;
    } else {
        const tmpl = await query(`
            SELECT TOP 1 structure FROM document_tree_templates
            WHERE is_default = 1
        `);

        if (!tmpl.recordset.length) {
            throw new Error('Nessun template default trovato');
        }
        templateData = typeof tmpl.recordset[0].structure === 'string'
            ? JSON.parse(tmpl.recordset[0].structure)
            : tmpl.recordset[0].structure;
    }

    logger.info('[TreeProvisioner] Starting provisioning', {
        orgId, companyId, templateCode, standardCodes,
    });

    const tree = await createNodesRecursive(templateData, null, orgId, companyId, standardCodes, 1);

    logger.info('[TreeProvisioner] Provisioning complete', {
        orgId, companyId, nodesCreated: tree.length,
    });

    return tree;
}

/**
 * Sync incrementale: aggiunge solo le cartelle condizionate mancanti
 * quando un nuovo standard viene attivato.
 */
async function syncTree(orgId, companyId, standardCodes = []) {
    return provisionTree(orgId, companyId, null, standardCodes);
}

module.exports = {
    provisionTree,
    syncTree,
    calculatePathCache,
    refreshPathCacheRecursive,
};
