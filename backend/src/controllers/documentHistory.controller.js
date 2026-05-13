/**
 * Document History Controller
 * Espone la cronologia delle modifiche per un documento.
 * Tenant-isolated: ogni query filtra per organization_id dal JWT.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ??? GET /api/v1/documents/:docId/history ???????????????????????????????????
/**
 * Lista cronologica delle modifiche del documento.
 * Query params: page (default 1), limit (default 20)
 */
async function getHistory(req, res) {
    try {
        const { organization_id } = req.user;
        const docId = parseInt(req.params.docId);
        const page  = parseInt(req.query.page)  || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        if (isNaN(docId)) {
            return res.status(400).json({ error: 'docId non valido', code: 'VALIDATION_ERROR' });
        }

        const docCheck = await query(`
            SELECT id FROM document_registry
            WHERE id = @id AND organization_id = @organization_id
        `, { id: docId, organization_id });

        if (!docCheck.recordset.length) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        const result = await query(`
            SELECT dh.id, dh.change_type, dh.field_changed,
                   dh.old_value, dh.new_value, dh.changed_at,
                   u.full_name AS changed_by_name, u.email AS changed_by_email
            FROM document_history dh
            LEFT JOIN users u ON dh.changed_by = u.user_id
            WHERE dh.document_id = @document_id
            ORDER BY dh.changed_at DESC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, { document_id: docId, offset, limit });

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM document_history
            WHERE document_id = @document_id
        `, { document_id: docId });

        const total = countResult.recordset[0].total;

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });

    } catch (error) {
        logger.error('Error loading document history', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero della cronologia',
            code:  'DOC_HISTORY_ERROR',
        });
    }
}

module.exports = {
    getHistory,
};
