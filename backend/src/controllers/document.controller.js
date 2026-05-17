/**
 * Document Registry Controller
 * Gestisce il registro universale documenti SGQ (ISO 9001/14001/45001/3834)
 *
 * Tenant-isolated: ogni query filtra per organization_id del JWT.
 * Soft delete: i documenti non vengono mai cancellati fisicamente,
 * vengono portati a status='obsoleto'.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

// ─── GET /api/v1/documents ────────────────────────────────────────────────────
/**
 * Lista documenti con filtri opzionali.
 * Query params:
 *   company_id, standard_id, doc_type, status, expiring_days,
 *   search (testo libero su title/doc_code),
 *   page (default 1), limit (default 50)
 */
async function listDocuments(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id,
            standard_id,
            doc_type,
            status,
            expiring_days,
            search,
            page  = 1,
            limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const conditions = ['dr.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset };

        if (company_id) {
            conditions.push('dr.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }
        if (standard_id) {
            conditions.push('dr.standard_id = @standard_id');
            params.standard_id = parseInt(standard_id);
        }
        if (doc_type) {
            conditions.push('dr.doc_type = @doc_type');
            params.doc_type = doc_type;
        }
        if (status) {
            conditions.push('dr.status = @status');
            params.status = status;
        } else {
            // Senza filtro status esplicito: nascondi i documenti obsoleti
            // (soft-deleted). Mostra rilasciato + bozza + in_revisione + in_approvazione.
            conditions.push("dr.status <> 'obsoleto'");
        }
        if (expiring_days) {
            conditions.push(`dr.expiry_date IS NOT NULL
                AND dr.expiry_date <= DATEADD(DAY, @expiring_days, CAST(GETDATE() AS DATE))
                AND dr.expiry_date >= CAST(GETDATE() AS DATE)
                AND dr.status = 'rilasciato'`);
            params.expiring_days = parseInt(expiring_days);
        }
        if (search) {
            conditions.push('(dr.title LIKE @search OR dr.doc_code LIKE @search)');
            params.search = `%${search}%`;
        }

        const where = conditions.join(' AND ');

        const result = await query(`
            SELECT
                dr.id,
                dr.doc_type,
                dr.doc_code,
                dr.title,
                dr.revision,
                dr.status,
                dr.import_status,
                dr.issue_date,
                dr.expiry_date,
                dr.responsible,
                dr.retention_years,
                dr.clause_ref,
                dr.notes,
                dr.revision_number,
                dr.released_at,
                dr.created_at,
                dr.updated_at,
                c.name        AS company_name,
                s.standard_code,
                s.standard_name,
                u.email       AS created_by_email,
                CASE
                    WHEN dr.expiry_date IS NOT NULL
                         AND dr.expiry_date < CAST(GETDATE() AS DATE)
                         AND dr.status = 'rilasciato'
                    THEN 1 ELSE 0
                END AS is_expired,
                CASE
                    WHEN dr.expiry_date IS NOT NULL
                         AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                             AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
                         AND dr.status = 'rilasciato'
                    THEN 1 ELSE 0
                END AS expiring_soon
            FROM document_registry dr
            LEFT JOIN companies     c ON dr.company_id   = c.id
            LEFT JOIN standards     s ON dr.standard_id  = s.standard_id
            LEFT JOIN users         u ON dr.created_by   = u.user_id
            WHERE ${where}
            ORDER BY
                CASE dr.status
                    WHEN 'rilasciato'      THEN 1
                    WHEN 'bozza'          THEN 2
                    WHEN 'in_approvazione' THEN 3
                    WHEN 'in_revisione'   THEN 4
                    ELSE 5
                END,
                dr.expiry_date ASC,
                dr.title ASC
            OFFSET @offset ROWS
            FETCH NEXT @limit ROWS ONLY
        `, params);

        const countResult = await query(`
            SELECT COUNT(*) AS total
            FROM document_registry dr
            WHERE ${where}
        `, params);

        const total = countResult.recordset[0].total;

        logger.info('Documents list retrieved', {
            organization_id,
            count: result.recordset.length,
            filters: { company_id, standard_id, doc_type, status },
        });

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page:       parseInt(page),
                limit:      parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });

    } catch (error) {
        logger.error('Error listing documents', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero dei documenti',
            code:  'DOC_LIST_ERROR',
        });
    }
}

// ─── GET /api/v1/documents/stats ─────────────────────────────────────────────
/**
 * Statistiche riassuntive del registro per l'organizzazione.
 * Utile per la dashboard / alert badge.
 */
async function getDocumentStats(req, res) {
    try {
        const { organization_id } = req.user;

        const result = await query(`
            SELECT
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN status = 'rilasciato'         THEN 1 ELSE 0 END)     AS vigenti,
                SUM(CASE WHEN status = 'in_revisione'    THEN 1 ELSE 0 END)     AS in_revisione,
                SUM(CASE WHEN status = 'in_approvazione' THEN 1 ELSE 0 END)     AS in_approvazione,
                SUM(CASE WHEN status = 'obsoleto'        THEN 1 ELSE 0 END)     AS obsoleti,
                SUM(CASE
                    WHEN expiry_date IS NOT NULL
                         AND expiry_date < CAST(GETDATE() AS DATE)
                         AND status = 'rilasciato'
                    THEN 1 ELSE 0 END)                                           AS scaduti,
                SUM(CASE
                    WHEN expiry_date IS NOT NULL
                         AND expiry_date BETWEEN CAST(GETDATE() AS DATE)
                             AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
                         AND status = 'rilasciato'
                    THEN 1 ELSE 0 END)                                           AS in_scadenza_30gg
            FROM document_registry
            WHERE organization_id = @organization_id
        `, { organization_id });

        res.json({ success: true, data: result.recordset[0] });

    } catch (error) {
        logger.error('Error getting document stats', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero delle statistiche',
            code:  'DOC_STATS_ERROR',
        });
    }
}

// ─── GET /api/v1/documents/:id ────────────────────────────────────────────────
async function getDocumentById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
            SELECT
                dr.*,
                c.name        AS company_name,
                s.standard_code,
                s.standard_name,
                u.email       AS created_by_email
            FROM document_registry dr
            LEFT JOIN companies c ON dr.company_id  = c.id
            LEFT JOIN standards s ON dr.standard_id = s.standard_id
            LEFT JOIN users     u ON dr.created_by  = u.user_id
            WHERE dr.id = @id AND dr.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Documento non trovato',
                code:  'DOC_NOT_FOUND',
            });
        }

        res.json({ success: true, data: result.recordset[0] });

    } catch (error) {
        logger.error('Error getting document', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero del documento',
            code:  'DOC_GET_ERROR',
        });
    }
}

// ─── POST /api/v1/documents ───────────────────────────────────────────────────
/**
 * Crea un nuovo documento nel registro.
 * Body richiesto: { doc_type, title, status }
 * Tutto il resto è opzionale.
 */
async function createDocument(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            company_id,
            auditor_org_id,
            standard_id,
            clause_ref,
            doc_type,
            doc_code,
            title,
            revision,
            status       = 'rilasciato',
            issue_date,
            expiry_date,
            responsible,
            retention_years,
            attachment_id,
            import_status = 'active',
            notes,
        } = req.body;

        // Validazione campi obbligatori
        if (!doc_type || !title) {
            return res.status(400).json({
                error:    'Campi obbligatori mancanti',
                code:     'VALIDATION_ERROR',
                required: ['doc_type', 'title'],
            });
        }

        const validStatuses = ['rilasciato', 'bozza', 'in_revisione', 'obsoleto', 'in_approvazione'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error:   'Status non valido',
                code:    'VALIDATION_ERROR',
                allowed: validStatuses,
            });
        }

        const parent_id = req.body.parent_id ? parseInt(req.body.parent_id) : null;

        let path_cache = null;
        if (parent_id) {
            const parentRow = await query(
                `SELECT path_cache FROM document_registry WHERE id = @pid AND organization_id = @organization_id`,
                { pid: parent_id, organization_id }
            );
            const parentPath = parentRow.recordset[0]?.path_cache || `/${parent_id}/`;
            path_cache = parentPath; // will be completed after INSERT with new id
        }

        const result = await query(`
            INSERT INTO document_registry (
                organization_id, company_id, auditor_org_id,
                standard_id, clause_ref,
                doc_type, doc_code, title, revision, status,
                issue_date, expiry_date, responsible, retention_years,
                attachment_id, import_status, notes,
                parent_id, path_cache,
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @auditor_org_id,
                @standard_id, @clause_ref,
                @doc_type, @doc_code, @title, @revision, @status,
                @issue_date, @expiry_date, @responsible, @retention_years,
                @attachment_id, @import_status, @notes,
                @parent_id, @path_cache,
                @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            company_id:      company_id      ? parseInt(company_id)      : null,
            auditor_org_id:  auditor_org_id  ? parseInt(auditor_org_id)  : null,
            standard_id:     standard_id     ? parseInt(standard_id)     : null,
            clause_ref:      clause_ref      || null,
            doc_type,
            doc_code:        doc_code        || null,
            title,
            revision:        revision        || null,
            status,
            parent_id,
            path_cache,
            issue_date:      issue_date      || null,
            expiry_date:     expiry_date     || null,
            responsible:     responsible     || null,
            retention_years: retention_years ? parseInt(retention_years) : null,
            attachment_id:   attachment_id   ? parseInt(attachment_id)   : null,
            import_status,
            notes:           notes           || null,
            created_by:      user_id,
        });

        const newId = result.recordset[0].id;

        // Completa path_cache con il nuovo id
        const finalPath = parent_id
            ? `${path_cache}${newId}/`
            : `/${newId}/`;
        await query(
            `UPDATE document_registry SET path_cache = @pc WHERE id = @id`,
            { pc: finalPath, id: newId }
        );

        // History tracking (fire-and-forget)
        try {
            const historyTracker = require('../services/documentHistoryTracker.service');
            await historyTracker.trackCreation(newId, user_id);
        } catch (_) { /* non bloccante */ }

        logger.info('Document created', { id: newId, organization_id, doc_type, title });

        res.status(201).json({
            success: true,
            data:    { id: newId, doc_type, title, status, parent_id },
        });

    } catch (error) {
        logger.error('Error creating document', { error: error.message });
        res.status(500).json({
            error: 'Errore durante la creazione del documento',
            code:  'DOC_CREATE_ERROR',
        });
    }
}

// ─── PUT /api/v1/documents/:id ────────────────────────────────────────────────
async function updateDocument(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Verifica esistenza e ownership
        const existing = await query(`
            SELECT id, is_system_folder FROM document_registry
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                error: 'Documento non trovato',
                code:  'DOC_NOT_FOUND',
            });
        }

        // Protezione cartelle di sistema
        const doc = existing.recordset[0];
        if (doc.is_system_folder && (req.body.title !== undefined || req.body.folder_code !== undefined)) {
            return res.status(403).json({
                error: 'Le cartelle di sistema non possono essere rinominate',
                code:  'SYSTEM_FOLDER_PROTECTED',
            });
        }

        const allowed = [
            'company_id', 'auditor_org_id', 'standard_id', 'clause_ref',
            'doc_type', 'doc_code', 'title', 'revision', 'status',
            'issue_date', 'expiry_date', 'responsible', 'retention_years',
            'attachment_id', 'import_status', 'notes', 'parent_id',
        ];

        const updates = [];
        const params  = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                // Campi interi
                if (['company_id', 'auditor_org_id', 'standard_id', 'retention_years', 'attachment_id', 'parent_id'].includes(field)) {
                    params[field] = req.body[field] !== null ? parseInt(req.body[field]) : null;
                } else {
                    params[field] = req.body[field] || null;
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Nessun campo da aggiornare',
                code:  'VALIDATION_ERROR',
            });
        }

        // Validazione status se presente
        if (params.status) {
            const validStatuses = ['rilasciato', 'bozza', 'in_revisione', 'obsoleto', 'in_approvazione'];
            if (!validStatuses.includes(params.status)) {
                return res.status(400).json({
                    error:   'Status non valido',
                    code:    'VALIDATION_ERROR',
                    allowed: validStatuses,
                });
            }
        }

        updates.push('updated_at = GETDATE()');

        await query(`
            UPDATE document_registry
            SET ${updates.join(', ')}
            WHERE id = @id
        `, params);

        logger.info('Document updated', { id, organization_id });

        res.json({ success: true, message: 'Documento aggiornato con successo' });

    } catch (error) {
        logger.error('Error updating document', { error: error.message });
        res.status(500).json({
            error: 'Errore durante l\'aggiornamento del documento',
            code:  'DOC_UPDATE_ERROR',
        });
    }
}

// ─── DELETE /api/v1/documents/:id ────────────────────────────────────────────
/**
 * Soft delete: porta il documento a status='obsoleto'.
 * I dati rimangono nel DB per la tracciabilità (requisito ISO).
 */
async function deleteDocument(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const existing = await query(`
            SELECT id, status, is_system_folder FROM document_registry
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                error: 'Documento non trovato',
                code:  'DOC_NOT_FOUND',
            });
        }

        if (existing.recordset[0].is_system_folder) {
            return res.status(403).json({
                error: 'Le cartelle di sistema non possono essere archiviate',
                code:  'SYSTEM_FOLDER_PROTECTED',
            });
        }

        await query(`
            UPDATE document_registry
            SET status = 'obsoleto', updated_at = GETDATE()
            WHERE id = @id
        `, { id: parseInt(id) });

        logger.info('Document soft-deleted (→ obsoleto)', { id, organization_id });

        res.json({
            success: true,
            message: 'Documento archiviato come obsoleto',
        });

    } catch (error) {
        logger.error('Error deleting document', { error: error.message });
        res.status(500).json({
            error: 'Errore durante l\'archiviazione del documento',
            code:  'DOC_DELETE_ERROR',
        });
    }
}

// ─── POST /api/v1/documents/:id/release-revision ─────────────────────────────
/**
 * Avanza il documento da 'bozza' a 'rilasciato':
 * - incrementa revision_number
 * - aggiorna revision (testo display) se fornito, altrimenti auto-genera "Rev. N"
 * - imposta released_at = now
 * - opzionalmente aggiorna expiry_date se fornita
 */
async function releaseRevision(req, res) {
    try {
        const { id } = req.params;
        const { organization_id, user_id } = req.user;
        const { revision_label, expiry_date } = req.body;

        const existing = await query(`
            SELECT id, status, revision_number, revision
            FROM document_registry
            WHERE id = @id AND organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (!existing.recordset.length) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        const doc = existing.recordset[0];
        if (doc.status !== 'bozza') {
            return res.status(409).json({
                error: 'Solo i documenti in stato bozza possono essere rilasciati.',
                code:  'INVALID_STATUS_TRANSITION',
                current_status: doc.status,
            });
        }

        const newRevNum = (doc.revision_number || 0) + 1;
        const newRevLabel = revision_label || `Rev. ${String(newRevNum).padStart(2, '0')}`;

        const params = {
            id: parseInt(id),
            revision_number: newRevNum,
            revision:        newRevLabel,
            expiry_date:     expiry_date || null,
        };

        await query(`
            UPDATE document_registry
            SET status          = 'rilasciato',
                revision_number = @revision_number,
                revision        = @revision,
                released_at     = GETDATE(),
                expiry_date     = ISNULL(@expiry_date, expiry_date),
                updated_at      = GETDATE()
            WHERE id = @id
        `, params);

        logger.info('Document released', { id, organization_id, user_id, revision: newRevLabel });

        res.json({
            success:         true,
            revision_number: newRevNum,
            revision:        newRevLabel,
            status:          'rilasciato',
            released_at:     new Date().toISOString(),
        });

    } catch (error) {
        logger.error('Error releasing document revision', { error: error.message });
        res.status(500).json({ error: 'Errore durante il rilascio della revisione', code: 'RELEASE_ERROR' });
    }
}

module.exports = {
    listDocuments,
    getDocumentStats,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument,
    releaseRevision,
};
