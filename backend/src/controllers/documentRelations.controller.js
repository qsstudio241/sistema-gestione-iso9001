/**
 * Document Relations Controller
 * Gestisce le relazioni tipizzate tra documenti del registro SGQ.
 *
 * Tabella: document_relations
 * Tipi: references, supersedes, implements, requires, attachment_of
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

const VALID_RELATION_TYPES = ['references', 'supersedes', 'implements', 'requires', 'attachment_of'];

// ??? CREATE ?????????????????????????????????????????????????????????????????????

async function createRelation(req, res) {
    try {
        const { organization_id } = req.user;
        const userId = req.user.user_id || req.user.id;
        const sourceDocId = parseInt(req.params.docId);
        const { target_document_id, relation_type, notes } = req.body;

        if (!target_document_id) {
            return res.status(400).json({ error: 'target_document_id è obbligatorio', code: 'REL_TARGET_REQUIRED' });
        }
        const targetDocId = parseInt(target_document_id);

        if (!relation_type || !VALID_RELATION_TYPES.includes(relation_type)) {
            return res.status(400).json({
                error: `relation_type deve essere uno di: ${VALID_RELATION_TYPES.join(', ')}`,
                code: 'REL_TYPE_INVALID',
            });
        }

        if (sourceDocId === targetDocId) {
            return res.status(400).json({ error: 'Un documento non può essere collegato a se stesso', code: 'REL_SELF_REFERENCE' });
        }

        const docs = await query(`
            SELECT id, organization_id FROM document_registry
            WHERE id IN (@sourceDocId, @targetDocId)
              AND organization_id = @organization_id
        `, { sourceDocId, targetDocId, organization_id });

        const foundIds = docs.recordset.map(d => d.id);
        if (!foundIds.includes(sourceDocId)) {
            return res.status(404).json({ error: 'Documento sorgente non trovato', code: 'REL_SOURCE_NOT_FOUND' });
        }
        if (!foundIds.includes(targetDocId)) {
            return res.status(404).json({ error: 'Documento destinazione non trovato', code: 'REL_TARGET_NOT_FOUND' });
        }

        const existing = await query(`
            SELECT id FROM document_relations
            WHERE organization_id = @organization_id
              AND source_document_id = @sourceDocId
              AND target_document_id = @targetDocId
              AND relation_type = @relation_type
        `, { organization_id, sourceDocId, targetDocId, relation_type });

        if (existing.recordset.length > 0) {
            return res.status(409).json({ error: 'Questa relazione esiste già', code: 'REL_DUPLICATE' });
        }

        const result = await query(`
            INSERT INTO document_relations
                (organization_id, source_document_id, target_document_id, relation_type, notes, created_by)
            OUTPUT INSERTED.*
            VALUES (@organization_id, @sourceDocId, @targetDocId, @relation_type, @notes, @userId)
        `, {
            organization_id,
            sourceDocId,
            targetDocId,
            relation_type,
            notes: notes || null,
            userId,
        });

        res.status(201).json({ success: true, data: result.recordset[0] });
    } catch (error) {
        logger.error('createRelation error', { error: error.message });
        res.status(500).json({ error: 'Errore nella creazione della relazione', code: 'REL_CREATE_ERROR' });
    }
}

// ??? LIST (both directions) ?????????????????????????????????????????????????????

async function getRelations(req, res) {
    try {
        const { organization_id } = req.user;
        const docId = parseInt(req.params.docId);

        const result = await query(`
            SELECT
                rel.id,
                rel.source_document_id,
                rel.target_document_id,
                rel.relation_type,
                rel.notes,
                rel.created_by,
                rel.created_at,
                CASE
                    WHEN rel.source_document_id = @docId THEN 'outgoing'
                    ELSE 'incoming'
                END AS direction,
                linked.id        AS linked_doc_id,
                linked.title     AS linked_doc_title,
                linked.doc_code  AS linked_doc_code,
                linked.doc_type  AS linked_doc_type,
                linked.status    AS linked_doc_status
            FROM document_relations rel
            INNER JOIN document_registry linked
                ON linked.id = CASE
                    WHEN rel.source_document_id = @docId THEN rel.target_document_id
                    ELSE rel.source_document_id
                END
            WHERE rel.organization_id = @organization_id
              AND (rel.source_document_id = @docId OR rel.target_document_id = @docId)
            ORDER BY rel.created_at DESC
        `, { docId, organization_id });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('getRelations error', { error: error.message });
        res.status(500).json({ error: 'Errore nel recupero delle relazioni', code: 'REL_LIST_ERROR' });
    }
}

// ??? DELETE ?????????????????????????????????????????????????????????????????????

async function deleteRelation(req, res) {
    try {
        const { organization_id } = req.user;
        const relId = parseInt(req.params.id);

        const rel = await query(`
            SELECT id FROM document_relations
            WHERE id = @relId AND organization_id = @organization_id
        `, { relId, organization_id });

        if (rel.recordset.length === 0) {
            return res.status(404).json({ error: 'Relazione non trovata', code: 'REL_NOT_FOUND' });
        }

        await query(`
            DELETE FROM document_relations
            WHERE id = @relId AND organization_id = @organization_id
        `, { relId, organization_id });

        res.json({ success: true, message: 'Relazione eliminata' });
    } catch (error) {
        logger.error('deleteRelation error', { error: error.message });
        res.status(500).json({ error: 'Errore nell\'eliminazione della relazione', code: 'REL_DELETE_ERROR' });
    }
}

module.exports = {
    createRelation,
    getRelations,
    deleteRelation,
};
