/**
 * Document Tree Provisioner Service
 * Crea l'albero documentale da template JSON (tabella document_tree_templates).
 * Idempotente: folder_code + organization_id + company_id = chiave logica.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Scaffale azienda (folder_code template 059/076) per tipo documento.
 * `altro` e tipi non elencati: nessuna cartella automatica.
 * Le norme restano su resolveNormFolderId (stesso codice 2.3).
 */
const DOC_TYPE_TO_FOLDER_CODE = Object.freeze({
    manuale: '1.1',
    procedura: '1.2',
    istruzione: '1.3',
    modulo: '1.4',
    norma: '2.3',
    certificato_materiale: '2.1',
    cert_taratura: '2.1',
    dichiarazione_ce: '2.1',
    wps: '9.1',
    wpqr: '9.1',
    report_ndt: '9.3',
    rdp: '9.3',
    patentino_saldatore: '4.5',
    qualifica: '4.5',
    qualifica_14732: '4.5',
    qualifica_14731: '4.5',
    pes_pav: '4.5',
    cert_ndt: '4.5',
});

function folderCodeForDocType(docType) {
    const key = String(docType || '').trim();
    return DOC_TYPE_TO_FOLDER_CODE[key] || null;
}

/**
 * Cartella albero per folder_code. Stesso criterio di resolveNormFolderId
 * (doc_type=folder, scope org) + preferenza company_id.
 * @param {number} orgId
 * @param {string} folderCode
 * @param {number|null|undefined} companyId
 * @returns {Promise<{ id: number, company_id: number|null }|null>}
 */
async function resolveFolderByCode(orgId, folderCode, companyId) {
    if (!folderCode) return null;
    const params = { orgId, folderCode: String(folderCode) };
    let sql = `
        SELECT TOP 1 id, company_id FROM document_registry
        WHERE folder_code = @folderCode
          AND organization_id = @orgId
          AND doc_type = 'folder'
    `;
    if (companyId != null && companyId !== '') {
        sql += ' AND company_id = @companyId';
        params.companyId = parseInt(companyId, 10);
    } else {
        sql += ' AND company_id IS NULL';
    }
    sql += ' ORDER BY id ASC';
    const result = await query(sql, params);
    const row = result.recordset[0];
    return row ? { id: row.id, company_id: row.company_id ?? null } : null;
}

/**
 * Cartella esplicita (override parent_folder_id). Deve appartenere all'org.
 * @param {number} orgId
 * @param {number} folderId
 * @returns {Promise<{ id: number, company_id: number|null }|null>}
 */
async function resolveExplicitFolder(orgId, folderId) {
    const id = parseInt(folderId, 10);
    if (!id) return null;
    const explicit = await query(
        `SELECT id, company_id FROM document_registry
         WHERE id = @folderId AND organization_id = @orgId AND doc_type = 'folder'`,
        { folderId: id, orgId }
    );
    const row = explicit.recordset[0];
    return row ? { id: row.id, company_id: row.company_id ?? null } : null;
}

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
async function createNodesRecursive(nodes, parentId, orgId, companyId, standardCodes, baseOrder, contentScope = null) {
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
            // Allinea content_scope se richiesto (es. cartelle Patrimonio Studio create
            // prima dell'introduzione della colonna): garantisce l'esclusione dalle viste azienda.
            if (contentScope) {
                await query(`
                    UPDATE document_registry SET content_scope = @content_scope
                    WHERE id = @id AND organization_id = @org_id
                      AND (content_scope IS NULL OR content_scope <> @content_scope)
                `, { content_scope: contentScope, id: nodeId, org_id: orgId });
            }
        } else {
            const result = await query(`
                INSERT INTO document_registry
                    (organization_id, company_id, doc_type, title, status,
                     is_system_folder, folder_code, parent_id, display_order,
                     content_scope, created_by, created_at, updated_at)
                OUTPUT INSERTED.id
                VALUES
                    (@org_id, @company_id, 'folder', @title, 'rilasciato',
                     1, @folder_code, @parent_id, @display_order,
                     @content_scope, NULL, GETDATE(), GETDATE())
            `, {
                org_id:        orgId,
                company_id:    companyId != null ? parseInt(companyId) : null,
                title:         nodeTitle,
                folder_code:   folderCode,
                parent_id:     parentId != null ? parseInt(parentId) : null,
                display_order: order,
                content_scope: contentScope || (companyId != null ? 'client' : 'reference'),
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
                node.children, nodeId, orgId, companyId, standardCodes, 1, contentScope
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
async function provisionTree(orgId, companyId, templateCode, standardCodes = [], contentScope = null) {
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

    const tree = await createNodesRecursive(templateData, null, orgId, companyId, standardCodes, 1, contentScope);

    logger.info('[TreeProvisioner] Provisioning complete', {
        orgId, companyId, contentScope, nodesCreated: tree.length,
    });

    return tree;
}

/** folder_code della radice del Patrimonio Studio (template studio_patrimonio_v1). */
const STUDIO_ROOT_FOLDER_CODE = 'STD';

/**
 * Provisioning (idempotente) della radice "Patrimonio Studio" per lo studio.
 * - company_id NULL (legato allo studio, non a una singola azienda cliente)
 * - content_scope='studio' su tutti i nodi -> mai visibile nelle viste azienda
 *
 * @param {number} orgId
 * @returns {Promise<{ rootId: number|null, tree: Array }>}
 */
async function provisionStudioPatrimony(orgId) {
    const tree = await provisionTree(orgId, null, 'studio_patrimonio_v1', [], 'studio');

    const rootRes = await query(`
        SELECT TOP 1 id FROM document_registry
        WHERE organization_id = @org_id
          AND company_id IS NULL
          AND folder_code = @code
          AND content_scope = 'studio'
        ORDER BY id ASC
    `, { org_id: orgId, code: STUDIO_ROOT_FOLDER_CODE });

    const rootId = rootRes.recordset[0]?.id ?? null;
    logger.info('[TreeProvisioner] Patrimonio Studio provisionato', { orgId, rootId });
    return { rootId, tree };
}

/**
 * Ritorna la radice del Patrimonio Studio per lo studio, se gia' provisionata.
 * @param {number} orgId
 * @returns {Promise<number|null>}
 */
async function findStudioRoot(orgId) {
    const res = await query(`
        SELECT TOP 1 id FROM document_registry
        WHERE organization_id = @org_id
          AND company_id IS NULL
          AND folder_code = @code
          AND content_scope = 'studio'
        ORDER BY id ASC
    `, { org_id: orgId, code: STUDIO_ROOT_FOLDER_CODE });
    return res.recordset[0]?.id ?? null;
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
    provisionStudioPatrimony,
    findStudioRoot,
    STUDIO_ROOT_FOLDER_CODE,
    calculatePathCache,
    refreshPathCacheRecursive,
    DOC_TYPE_TO_FOLDER_CODE,
    folderCodeForDocType,
    resolveFolderByCode,
    resolveExplicitFolder,
};
