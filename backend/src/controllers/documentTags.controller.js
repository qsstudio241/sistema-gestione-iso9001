/**
 * Document Tags Controller
 * Gestisce tag, categorie tag e assegnazioni tag ? documenti.
 *
 * Tabelle: tag_categories, document_tags, document_tag_assignments
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ??? helpers ????????????????????????????????????????????????????????????????????

function slugify(text) {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/[\s]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

// ??? TAG CRUD ???????????????????????????????????????????????????????????????????

async function listTags(req, res) {
    try {
        const { organization_id } = req.user;
        const { category_id } = req.query;

        const conditions = ['(dt.organization_id = @organization_id OR dt.organization_id IS NULL)'];
        const params = { organization_id };

        if (category_id) {
            conditions.push('dt.category_id = @category_id');
            params.category_id = parseInt(category_id);
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                dt.id,
                dt.organization_id,
                dt.category_id,
                dt.name,
                dt.slug,
                dt.color,
                dt.is_system,
                dt.auto_rule,
                dt.created_at,
                tc.name AS category_name,
                tc.color AS category_color,
                (SELECT COUNT(*) FROM document_tag_assignments dta WHERE dta.tag_id = dt.id) AS usage_count
            FROM document_tags dt
            LEFT JOIN tag_categories tc ON tc.id = dt.category_id
            WHERE ${where}
            ORDER BY tc.display_order, tc.name, dt.name
        `, params);

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('listTags error', { error: error.message });
        res.status(500).json({ error: 'Errore nel recupero dei tag', code: 'TAG_LIST_ERROR' });
    }
}

async function createTag(req, res) {
    try {
        const { organization_id } = req.user;
        const { name, category_id, color } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Il nome del tag ù obbligatorio', code: 'TAG_NAME_REQUIRED' });
        }

        const slug = slugify(name);

        const existing = await query(`
            SELECT id FROM document_tags
            WHERE organization_id = @organization_id AND slug = @slug
        `, { organization_id, slug });

        if (existing.recordset.length > 0) {
            return res.status(409).json({ error: 'Un tag con questo nome esiste giù', code: 'TAG_DUPLICATE' });
        }

        const params = {
            organization_id,
            name: name.trim(),
            slug,
            color: color || null,
            category_id: category_id ? parseInt(category_id) : null,
        };

        const result = await query(`
            INSERT INTO document_tags (organization_id, category_id, name, slug, color, is_system)
            OUTPUT INSERTED.*
            VALUES (@organization_id, @category_id, @name, @slug, @color, 0)
        `, params);

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('createTag error', { error: error.message });
        res.status(500).json({ error: 'Errore nella creazione del tag', code: 'TAG_CREATE_ERROR' });
    }
}

async function updateTag(req, res) {
    try {
        const { organization_id } = req.user;
        const tagId = parseInt(req.params.id);
        const { name, category_id, color } = req.body;

        const tag = await query(`
            SELECT id, is_system FROM document_tags
            WHERE id = @tagId AND organization_id = @organization_id
        `, { tagId, organization_id });

        if (tag.recordset.length === 0) {
            return res.status(404).json({ error: 'Tag non trovato', code: 'TAG_NOT_FOUND' });
        }
        if (tag.recordset[0].is_system) {
            return res.status(403).json({ error: 'Non ù possibile modificare un tag di sistema', code: 'TAG_SYSTEM_READONLY' });
        }

        const sets = [];
        const params = { tagId, organization_id };

        if (name !== undefined) {
            const slug = slugify(name);
            const dup = await query(`
                SELECT id FROM document_tags
                WHERE organization_id = @organization_id AND slug = @slug AND id != @tagId
            `, { organization_id, slug, tagId });
            if (dup.recordset.length > 0) {
                return res.status(409).json({ error: 'Un tag con questo nome esiste giù', code: 'TAG_DUPLICATE' });
            }
            sets.push('name = @name', 'slug = @slug');
            params.name = name.trim();
            params.slug = slug;
        }
        if (category_id !== undefined) {
            sets.push('category_id = @category_id');
            params.category_id = category_id ? parseInt(category_id) : null;
        }
        if (color !== undefined) {
            sets.push('color = @color');
            params.color = color || null;
        }

        if (sets.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'TAG_NO_CHANGES' });
        }

        const result = await query(`
            UPDATE document_tags SET ${sets.join(', ')}
            OUTPUT INSERTED.*
            WHERE id = @tagId AND organization_id = @organization_id
        `, params);

        res.json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('updateTag error', { error: error.message });
        res.status(500).json({ error: 'Errore nell\'aggiornamento del tag', code: 'TAG_UPDATE_ERROR' });
    }
}

async function deleteTag(req, res) {
    try {
        const { organization_id } = req.user;
        const tagId = parseInt(req.params.id);

        const tag = await query(`
            SELECT id, is_system FROM document_tags
            WHERE id = @tagId AND organization_id = @organization_id
        `, { tagId, organization_id });

        if (tag.recordset.length === 0) {
            return res.status(404).json({ error: 'Tag non trovato', code: 'TAG_NOT_FOUND' });
        }
        if (tag.recordset[0].is_system) {
            return res.status(403).json({ error: 'Non ù possibile eliminare un tag di sistema', code: 'TAG_SYSTEM_READONLY' });
        }

        await query(`DELETE FROM document_tag_assignments WHERE tag_id = @tagId`, { tagId });
        await query(`DELETE FROM document_tags WHERE id = @tagId AND organization_id = @organization_id`, { tagId, organization_id });

        res.json({ success: true, message: 'Tag eliminato' });
    } catch (error) {
        logger.error('deleteTag error', { error: error.message });
        res.status(500).json({ error: 'Errore nell\'eliminazione del tag', code: 'TAG_DELETE_ERROR' });
    }
}

// ??? CATEGORIES ?????????????????????????????????????????????????????????????????

async function listCategories(req, res) {
    try {
        const { organization_id } = req.user;

        const result = await query(`
            SELECT
                tc.id,
                tc.organization_id,
                tc.name,
                tc.color,
                tc.display_order,
                tc.is_system,
                tc.created_at,
                (SELECT COUNT(*) FROM document_tags dt WHERE dt.category_id = tc.id) AS tag_count
            FROM tag_categories tc
            WHERE tc.organization_id = @organization_id OR tc.organization_id IS NULL
            ORDER BY tc.display_order, tc.name
        `, { organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('listCategories error', { error: error.message });
        res.status(500).json({ error: 'Errore nel recupero delle categorie', code: 'CATEGORY_LIST_ERROR' });
    }
}

async function createCategory(req, res) {
    try {
        const { organization_id } = req.user;
        const { name, color, display_order } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Il nome della categoria ù obbligatorio', code: 'CATEGORY_NAME_REQUIRED' });
        }

        const result = await query(`
            INSERT INTO tag_categories (organization_id, name, color, display_order, is_system)
            OUTPUT INSERTED.*
            VALUES (@organization_id, @name, @color, @display_order, 0)
        `, {
            organization_id,
            name: name.trim(),
            color: color || null,
            display_order: display_order != null ? parseInt(display_order) : 0,
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('createCategory error', { error: error.message });
        res.status(500).json({ error: 'Errore nella creazione della categoria', code: 'CATEGORY_CREATE_ERROR' });
    }
}

// ??? TAG ASSIGNMENTS ????????????????????????????????????????????????????????????

async function assignTags(req, res) {
    try {
        const { organization_id } = req.user;
        const userId = req.user.user_id || req.user.id;
        const docId = parseInt(req.params.docId);
        const { tag_ids } = req.body;

        if (!Array.isArray(tag_ids) || tag_ids.length === 0) {
            return res.status(400).json({ error: 'tag_ids deve essere un array non vuoto', code: 'TAG_IDS_REQUIRED' });
        }

        const doc = await query(`
            SELECT id FROM document_registry
            WHERE id = @docId AND organization_id = @organization_id
        `, { docId, organization_id });

        if (doc.recordset.length === 0) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        const inserted = [];
        for (const rawId of tag_ids) {
            const tagId = parseInt(rawId);
            const tagExists = await query(`
                SELECT id FROM document_tags
                WHERE id = @tagId AND (organization_id = @organization_id OR organization_id IS NULL)
            `, { tagId, organization_id });

            if (tagExists.recordset.length === 0) continue;

            try {
                await query(`
                    IF NOT EXISTS (
                        SELECT 1 FROM document_tag_assignments
                        WHERE document_id = @docId AND tag_id = @tagId
                    )
                    INSERT INTO document_tag_assignments (document_id, tag_id, source, assigned_by)
                    VALUES (@docId, @tagId, 'manual', @userId)
                `, { docId, tagId, userId });
                inserted.push(tagId);
            } catch (dupErr) {
                logger.warn('Tag assignment duplicate skipped', { docId, tagId });
            }
        }

        res.json({ success: true, data: { document_id: docId, assigned_tag_ids: inserted } });
    } catch (error) {
        logger.error('assignTags error', { error: error.message });
        res.status(500).json({ error: 'Errore nell\'assegnazione dei tag', code: 'TAG_ASSIGN_ERROR' });
    }
}

async function removeTag(req, res) {
    try {
        const { organization_id } = req.user;
        const docId = parseInt(req.params.docId);
        const tagId = parseInt(req.params.tagId);

        const doc = await query(`
            SELECT id FROM document_registry
            WHERE id = @docId AND organization_id = @organization_id
        `, { docId, organization_id });

        if (doc.recordset.length === 0) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        await query(`
            DELETE FROM document_tag_assignments
            WHERE document_id = @docId AND tag_id = @tagId
        `, { docId, tagId });

        res.json({ success: true, message: 'Tag rimosso dal documento' });
    } catch (error) {
        logger.error('removeTag error', { error: error.message });
        res.status(500).json({ error: 'Errore nella rimozione del tag', code: 'TAG_REMOVE_ERROR' });
    }
}

// ??? DOCUMENTS BY TAG ???????????????????????????????????????????????????????????

async function getDocumentsByTag(req, res) {
    try {
        const { organization_id } = req.user;
        const tagId = parseInt(req.params.tagId);

        const result = await query(`
            SELECT
                dr.id,
                dr.doc_type,
                dr.doc_code,
                dr.title,
                dr.revision,
                dr.status,
                dr.issue_date,
                dr.expiry_date,
                dta.source      AS tag_source,
                dta.assigned_at AS tag_assigned_at
            FROM document_registry dr
            INNER JOIN document_tag_assignments dta ON dta.document_id = dr.id
            WHERE dta.tag_id = @tagId
              AND dr.organization_id = @organization_id
            ORDER BY dr.title
        `, { tagId, organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('getDocumentsByTag error', { error: error.message });
        res.status(500).json({ error: 'Errore nel recupero documenti per tag', code: 'DOCS_BY_TAG_ERROR' });
    }
}

module.exports = {
    listTags,
    createTag,
    updateTag,
    deleteTag,
    listCategories,
    createCategory,
    assignTags,
    removeTag,
    getDocumentsByTag,
};
