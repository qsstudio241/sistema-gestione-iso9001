/**
 * Document Tree Controller
 * Navigazione ad albero, spostamento nodi, breadcrumb, provisioning.
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const historyTracker = require('../services/documentHistoryTracker.service');
const provisioner = require('../services/documentTreeProvisioner.service');

/**
 * Ritorna l'albero documentale a partire dalle root.
 * Query params:
 *   depth     (default 2)   livelli di figli da caricare
 *   company_id              filtra per azienda
 */
async function getTree(req, res) {
    try {
        const { organization_id } = req.user;
        const depth      = Math.min(parseInt(req.query.depth) || 2, 10);
        const company_id = req.query.company_id ? parseInt(req.query.company_id) : null;

        const conditions = ['dr.organization_id = @organization_id', 'dr.parent_id IS NULL'];
        const params = { organization_id };

        if (company_id) {
            conditions.push('(dr.company_id = @company_id OR dr.company_id IS NULL)');
            params.company_id = company_id;
        }

        const roots = await query(`
            SELECT dr.id, dr.title, dr.doc_type, dr.folder_code, dr.is_system_folder,
                   dr.display_order, dr.parent_id, dr.path_cache, dr.status,
                   (SELECT COUNT(*) FROM document_registry sub WHERE sub.parent_id = dr.id) AS children_count
            FROM document_registry dr
            WHERE ${conditions.join(' AND ')}
            ORDER BY dr.display_order ASC, dr.title ASC
        `, params);

        const tree = roots.recordset;

        if (depth > 1) {
            for (const node of tree) {
                node.children = await _loadChildren(node.id, organization_id, company_id, depth - 1);
            }
        }

        res.json({ success: true, data: tree });

    } catch (error) {
        logger.error('Error loading document tree', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il caricamento dell\'albero documentale',
            code:  'DOC_TREE_ERROR',
        });
    }
}

/**
 * Carica ricorsivamente i figli fino al livello richiesto.
 */
async function _loadChildren(parentId, orgId, companyId, remainingDepth) {
    const conditions = ['dr.organization_id = @organization_id', 'dr.parent_id = @parent_id'];
    const params = { organization_id: orgId, parent_id: parseInt(parentId) };

    if (companyId) {
        conditions.push('(dr.company_id = @company_id OR dr.company_id IS NULL)');
        params.company_id = companyId;
    }

    const result = await query(`
        SELECT dr.id, dr.title, dr.doc_type, dr.folder_code, dr.is_system_folder,
               dr.display_order, dr.parent_id, dr.path_cache, dr.status,
               (SELECT COUNT(*) FROM document_registry sub WHERE sub.parent_id = dr.id) AS children_count
        FROM document_registry dr
        WHERE ${conditions.join(' AND ')}
        ORDER BY dr.display_order ASC, dr.title ASC
    `, params);

    const children = result.recordset;

    if (remainingDepth > 1) {
        for (const child of children) {
            child.children = await _loadChildren(child.id, orgId, companyId, remainingDepth - 1);
        }
    }

    return children;
}

// GET /api/v1/documents/tree/:parentId/children
async function getChildren(req, res) {
    try {
        const { organization_id } = req.user;
        const parentId = parseInt(req.params.parentId);

        if (isNaN(parentId)) {
            return res.status(400).json({ error: 'parentId non valido', code: 'VALIDATION_ERROR' });
        }

        const result = await query(`
            SELECT dr.id, dr.title, dr.doc_type, dr.folder_code, dr.is_system_folder,
                   dr.display_order, dr.parent_id, dr.path_cache, dr.status,
                   (SELECT COUNT(*) FROM document_registry sub WHERE sub.parent_id = dr.id) AS children_count
            FROM document_registry dr
            WHERE dr.organization_id = @organization_id AND dr.parent_id = @parent_id
              AND ISNULL(dr.status, 'vigente') <> 'obsoleto'
            ORDER BY dr.display_order ASC, dr.title ASC
        `, { organization_id, parent_id: parentId });

        res.json({ success: true, data: result.recordset });

    } catch (error) {
        logger.error('Error loading children', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il caricamento dei figli',
            code:  'DOC_CHILDREN_ERROR',
        });
    }
}

// PUT /api/v1/documents/:docId/move
async function moveDocument(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const docId = parseInt(req.params.docId);
        const { new_parent_id, display_order } = req.body;

        if (isNaN(docId)) {
            return res.status(400).json({ error: 'docId non valido', code: 'VALIDATION_ERROR' });
        }

        const doc = await query(`
            SELECT id, parent_id, is_system_folder FROM document_registry
            WHERE id = @id AND organization_id = @organization_id
        `, { id: docId, organization_id });

        if (!doc.recordset.length) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        if (doc.recordset[0].is_system_folder) {
            return res.status(403).json({
                error: 'Le cartelle di sistema non possono essere spostate',
                code:  'SYSTEM_FOLDER_LOCKED',
            });
        }

        const oldParentId = doc.recordset[0].parent_id;
        const newParentId = new_parent_id != null ? parseInt(new_parent_id) : null;

        if (newParentId != null) {
            if (newParentId === docId) {
                return res.status(400).json({
                    error: 'Un documento non pu essere figlio di se stesso',
                    code:  'CIRCULAR_REF',
                });
            }
            const parent = await query(`
                SELECT id FROM document_registry
                WHERE id = @id AND organization_id = @organization_id
            `, { id: newParentId, organization_id });

            if (!parent.recordset.length) {
                return res.status(404).json({ error: 'Parent non trovato', code: 'PARENT_NOT_FOUND' });
            }
        }

        await query(`
            UPDATE document_registry
            SET parent_id = @new_parent_id,
                display_order = @display_order,
                updated_at = GETDATE()
            WHERE id = @id AND organization_id = @organization_id
        `, {
            new_parent_id: newParentId,
            display_order: display_order != null ? parseInt(display_order) : 0,
            id:            docId,
            organization_id,
        });

        await provisioner.refreshPathCacheRecursive(docId, organization_id);

        historyTracker.trackMove(docId, user_id, oldParentId, newParentId);

        logger.info('Document moved', { docId, oldParentId, newParentId, organization_id });

        res.json({ success: true, message: 'Documento spostato con successo' });

    } catch (error) {
        logger.error('Error moving document', { error: error.message });
        res.status(500).json({
            error: 'Errore durante lo spostamento del documento',
            code:  'DOC_MOVE_ERROR',
        });
    }
}

// POST /api/v1/documents/folder
async function createFolder(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const { title, parent_id, company_id } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({
                error:    'Il titolo  obbligatorio',
                code:     'VALIDATION_ERROR',
                required: ['title'],
            });
        }

        const parentId   = parent_id  != null ? parseInt(parent_id)  : null;
        const companyId  = company_id != null ? parseInt(company_id) : null;

        if (parentId != null) {
            const parent = await query(`
                SELECT id FROM document_registry
                WHERE id = @id AND organization_id = @organization_id
            `, { id: parentId, organization_id });

            if (!parent.recordset.length) {
                return res.status(404).json({ error: 'Parent non trovato', code: 'PARENT_NOT_FOUND' });
            }
        }

        const result = await query(`
            INSERT INTO document_registry
                (organization_id, company_id, doc_type, title, status,
                 parent_id, is_system_folder, display_order,
                 created_by, created_at, updated_at)
            OUTPUT INSERTED.id
            VALUES
                (@organization_id, @company_id, 'folder', @title, 'vigente',
                 @parent_id, 0, 0,
                 @created_by, GETDATE(), GETDATE())
        `, {
            organization_id,
            company_id: companyId,
            title:      title.trim(),
            parent_id:  parentId,
            created_by: user_id,
        });

        const newId = result.recordset[0].id;

        const pathCache = await provisioner.calculatePathCache(newId, organization_id);
        await query(`
            UPDATE document_registry SET path_cache = @path_cache WHERE id = @id
        `, { path_cache: pathCache, id: newId });

        historyTracker.trackCreation(newId, user_id);

        logger.info('Folder created', { id: newId, title, organization_id });

        res.status(201).json({
            success: true,
            data:    { id: newId, title: title.trim(), doc_type: 'folder', path_cache: pathCache },
        });

    } catch (error) {
        logger.error('Error creating folder', { error: error.message });
        res.status(500).json({
            error: 'Errore durante la creazione della cartella',
            code:  'DOC_FOLDER_ERROR',
        });
    }
}

// GET /api/v1/documents/:docId/breadcrumb
async function getBreadcrumb(req, res) {
    try {
        const { organization_id } = req.user;
        const docId = parseInt(req.params.docId);

        if (isNaN(docId)) {
            return res.status(400).json({ error: 'docId non valido', code: 'VALIDATION_ERROR' });
        }

        const breadcrumb = [];
        let currentId = docId;

        for (let depth = 0; depth < 50; depth++) {
            const result = await query(`
                SELECT id, title, folder_code, parent_id
                FROM document_registry
                WHERE id = @id AND organization_id = @organization_id
            `, { id: currentId, organization_id });

            if (!result.recordset.length) break;

            const row = result.recordset[0];
            breadcrumb.unshift({ id: row.id, title: row.title, folder_code: row.folder_code });

            if (row.parent_id == null) break;
            currentId = row.parent_id;
        }

        res.json({ success: true, data: breadcrumb });

    } catch (error) {
        logger.error('Error loading breadcrumb', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il caricamento del breadcrumb',
            code:  'DOC_BREADCRUMB_ERROR',
        });
    }
}

// POST /api/v1/documents/provision-tree
async function provisionTree(req, res) {
    try {
        const { organization_id, role } = req.user;

        if (role !== 'admin' && role !== 'superadmin') {
            return res.status(403).json({
                error: 'Solo admin e superadmin possono eseguire il provisioning',
                code:  'FORBIDDEN',
            });
        }

        const { company_id, template_code, standard_codes } = req.body;
        const companyId     = company_id != null ? parseInt(company_id) : null;
        const standardCodes = Array.isArray(standard_codes) ? standard_codes : [];

        const tree = await provisioner.provisionTree(
            organization_id, companyId, template_code || null, standardCodes
        );

        logger.info('Tree provisioned', { organization_id, company_id: companyId });

        res.status(201).json({ success: true, data: tree });

    } catch (error) {
        logger.error('Error provisioning tree', { error: error.message });
        const status = error.message.includes('non trovato') ? 404 : 500;
        res.status(status).json({
            error: error.message || 'Errore durante il provisioning dell\'albero',
            code:  'DOC_PROVISION_ERROR',
        });
    }
}

// GET /api/v1/document-tree-templates
async function listTemplates(req, res) {
    try {
        const result = await query(`
            SELECT id, template_code, name, description, applicable_standards,
                   is_default, created_at
            FROM document_tree_templates
            ORDER BY is_default DESC, name ASC
        `);

        res.json({ success: true, data: result.recordset });

    } catch (error) {
        logger.error('Error listing templates', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero dei template',
            code:  'DOC_TEMPLATES_ERROR',
        });
    }
}

module.exports = {
    getTree,
    getChildren,
    moveDocument,
    createFolder,
    getBreadcrumb,
    provisionTree,
    listTemplates,
};
