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
const { documentRegistryScopeClause, appendScopeSql } = require('../services/auditListRbac.service');
const {
    assertMutatingAllowed,
    sendAccessDenied,
} = require('../services/companyAccess.service');
const multer = require('multer');
const {
    RELEASED_STATUS_SQL_IN,
    isReleasedDocStatus,
    parseRegistryDocStatus,
} = require('../constants/documentStatus');
const {
    buildHasAnyFileSql,
    buildCurrentFileApplySql,
    parseTruthyQueryFlag,
} = require('../utils/documentRegistryFile');
const { allocateDocCode, resolveExpiryDate } = require('../services/docCodeGenerator.service');

/** Giorni finestra alert documenti (allineato a notifications_config.alert_days_1). */
const DEFAULT_DOC_ALERT_WINDOW_DAYS = 30;

// ─── GET /api/v1/documents ────────────────────────────────────────────────────
/**
 * Lista documenti con filtri opzionali.
 * Query params:
 *   company_id, standard_id, doc_type, status, expiring_days,
 *   expired_only (1/true: solo documenti già scaduti),
 *   include_expired (1/true: con expiring_days include anche scaduti),
 *   search (testo libero su title/doc_code),
 *   without_file (1/true: solo documenti senza allegato),
 *   page (default 1), limit (default 50)
 */
async function listDocuments(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            company_id,
            standard_id,
            clause_ref_prefix,
            doc_type,
            status,
            expiring_days,
            expired_only,
            include_expired,
            search,
            without_file,
            page  = 1,
            limit = 50,
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const conditions = ['dr.organization_id = @organization_id'];
        const params = { organization_id, limit: parseInt(limit), offset, ...docScope.params };
        if (docScope.clause) {
            conditions.push(docScope.clause);
        }

        if (company_id) {
            conditions.push('dr.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }
        if (standard_id) {
            conditions.push('dr.standard_id = @standard_id');
            params.standard_id = parseInt(standard_id);
        }
        if (clause_ref_prefix) {
            conditions.push('dr.clause_ref LIKE @clause_ref_prefix');
            params.clause_ref_prefix = `${clause_ref_prefix}%`;
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
        if (parseTruthyQueryFlag(expired_only)) {
            conditions.push(`dr.expiry_date IS NOT NULL
                AND dr.expiry_date < CAST(GETDATE() AS DATE)
                AND dr.status IN ${RELEASED_STATUS_SQL_IN}`);
        } else if (expiring_days) {
            const windowDays = parseInt(expiring_days, 10) || DEFAULT_DOC_ALERT_WINDOW_DAYS;
            conditions.push(`dr.expiry_date IS NOT NULL
                AND dr.expiry_date <= DATEADD(DAY, @expiring_days, CAST(GETDATE() AS DATE))
                AND dr.status IN ${RELEASED_STATUS_SQL_IN}`);
            params.expiring_days = windowDays;
            if (!parseTruthyQueryFlag(include_expired)) {
                conditions.push('dr.expiry_date >= CAST(GETDATE() AS DATE)');
            }
        }
        if (search) {
            conditions.push('(dr.title LIKE @search OR dr.doc_code LIKE @search)');
            params.search = `%${search}%`;
        }
        if (parseTruthyQueryFlag(without_file)) {
            conditions.push(`NOT ${buildHasAnyFileSql('dr')}`);
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
                JSON_VALUE(dr.type_specific_data, '$.validity_status')     AS norm_validity_status,
                JSON_VALUE(dr.type_specific_data, '$.last_validity_check') AS norm_last_check,
                CASE
                    WHEN dr.expiry_date IS NOT NULL
                         AND dr.expiry_date < CAST(GETDATE() AS DATE)
                         AND dr.status IN ${RELEASED_STATUS_SQL_IN}
                    THEN 1 ELSE 0
                END AS is_expired,
                CASE
                    WHEN dr.expiry_date IS NOT NULL
                         AND dr.expiry_date BETWEEN CAST(GETDATE() AS DATE)
                             AND DATEADD(DAY, ISNULL(nc_cfg.alert_days_1, ${DEFAULT_DOC_ALERT_WINDOW_DAYS}), CAST(GETDATE() AS DATE))
                         AND dr.status IN ${RELEASED_STATUS_SQL_IN}
                    THEN 1 ELSE 0
                END AS expiring_soon,
                CASE WHEN cur_file.file_name IS NOT NULL THEN 1 ELSE 0 END AS has_file,
                cur_file.file_name AS current_file_name,
                cur_file.file_uploaded_at AS current_file_uploaded_at
            FROM document_registry dr
            LEFT JOIN companies     c ON dr.company_id   = c.id
            LEFT JOIN standards     s ON dr.standard_id  = s.standard_id
            LEFT JOIN users         u ON dr.created_by   = u.user_id
            LEFT JOIN notifications_config nc_cfg ON nc_cfg.organization_id = dr.organization_id
            ${buildCurrentFileApplySql('dr')}
            WHERE ${where}
            ORDER BY
                CASE dr.status
                    WHEN 'rilasciato'      THEN 1
                    WHEN 'vigente'         THEN 1
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
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const scopeSql = appendScopeSql(docScope);
        const noFileExists = buildHasAnyFileSql('dr');

        const result = await query(`
            SELECT
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN status IN ${RELEASED_STATUS_SQL_IN} THEN 1 ELSE 0 END) AS vigenti,
                SUM(CASE WHEN status = 'in_revisione'    THEN 1 ELSE 0 END)     AS in_revisione,
                SUM(CASE WHEN status = 'in_approvazione' THEN 1 ELSE 0 END)     AS in_approvazione,
                SUM(CASE WHEN status = 'obsoleto'        THEN 1 ELSE 0 END)     AS obsoleti,
                SUM(CASE
                    WHEN expiry_date IS NOT NULL
                         AND expiry_date < CAST(GETDATE() AS DATE)
                         AND status IN ${RELEASED_STATUS_SQL_IN}
                    THEN 1 ELSE 0 END)                                           AS scaduti,
                SUM(CASE
                    WHEN expiry_date IS NOT NULL
                         AND expiry_date BETWEEN CAST(GETDATE() AS DATE)
                             AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
                         AND status IN ${RELEASED_STATUS_SQL_IN}
                    THEN 1 ELSE 0 END)                                           AS in_scadenza_30gg,
                (
                    SELECT COUNT(*)
                    FROM document_registry dr
                    WHERE dr.organization_id = @organization_id
                      AND dr.doc_type <> 'folder'
                      AND dr.status <> 'obsoleto'
                      AND NOT ${noFileExists}
                      ${scopeSql}
                )                                                                AS senza_file,
                (
                    SELECT COUNT(*)
                    FROM document_registry dr
                    WHERE dr.organization_id = @organization_id
                      AND dr.doc_type <> 'folder'
                      AND dr.status IN ${RELEASED_STATUS_SQL_IN}
                      AND NOT ${noFileExists}
                      ${scopeSql}
                )                                                                AS rilasciati_senza_file
            FROM document_registry dr
            WHERE dr.organization_id = @organization_id
              AND dr.doc_type <> 'folder'
              ${scopeSql}
        `, { organization_id, ...docScope.params });

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
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const scopeSql = appendScopeSql(docScope);

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
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...docScope.params });

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
            status: statusRaw = 'rilasciato',
            issue_date,
            expiry_date,
            responsible,
            retention_years,
            attachment_id,
            import_status = 'active',
            notes,
            type_specific_data,
            content_scope: contentScopeRaw,
        } = req.body;

        // Validazione campi obbligatori
        if (!doc_type || !title) {
            return res.status(400).json({
                error:    'Campi obbligatori mancanti',
                code:     'VALIDATION_ERROR',
                required: ['doc_type', 'title'],
            });
        }

        // Etichetta esplicita di ambito (decisione di prodotto: "explicit over implicit").
        // Se non fornita, viene dedotta: norma -> reference; azienda valorizzata -> client;
        // altrimenti studio (patrimonio dello studio). I valori 'studio'/'reference'
        // forzano company_id NULL per coerenza.
        const ALLOWED_SCOPES = ['client', 'studio', 'reference'];
        let contentScope = ALLOWED_SCOPES.includes(contentScopeRaw) ? contentScopeRaw : null;
        let effectiveCompanyId = company_id ? parseInt(company_id) : null;
        if (contentScope == null) {
            if (doc_type === 'norma') contentScope = 'reference';
            else if (effectiveCompanyId != null) contentScope = 'client';
            else contentScope = 'studio';
        }
        if (contentScope === 'studio' || contentScope === 'reference') {
            effectiveCompanyId = null;
        }

        const writeDenied = await assertMutatingAllowed(req.user, { companyId: company_id });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const statusParsed = parseRegistryDocStatus(statusRaw);
        if (!statusParsed.ok) {
            return res.status(400).json({
                error:   'Status non valido',
                code:    'VALIDATION_ERROR',
                allowed: statusParsed.allowed,
            });
        }
        const status = statusParsed.status;

        const parent_id = req.body.parent_id ? parseInt(req.body.parent_id) : null;

        let finalDocCode = doc_code ? String(doc_code).trim().slice(0, 100) || null : null;
        if (!finalDocCode) {
            try {
                finalDocCode = await allocateDocCode(organization_id, doc_type);
            } catch (codeErr) {
                logger.warn('doc_code auto-allocation failed, proceeding without code', {
                    organization_id, doc_type, error: codeErr.message,
                });
            }
        }

        let finalExpiryDate = expiry_date || null;
        if (!finalExpiryDate && status === 'rilasciato') {
            finalExpiryDate = await resolveExpiryDate({
                organization_id,
                doc_type,
                issue_date: issue_date || null,
                expiry_date: null,
            });
        }

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
                parent_id, path_cache, type_specific_data, content_scope,
                created_by, created_at, updated_at
            )
            OUTPUT INSERTED.id
            VALUES (
                @organization_id, @company_id, @auditor_org_id,
                @standard_id, @clause_ref,
                @doc_type, @doc_code, @title, @revision, @status,
                @issue_date, @expiry_date, @responsible, @retention_years,
                @attachment_id, @import_status, @notes,
                @parent_id, @path_cache, @type_specific_data, @content_scope,
                @created_by, GETDATE(), GETDATE()
            )
        `, {
            organization_id,
            company_id:      effectiveCompanyId,
            content_scope:   contentScope,
            auditor_org_id:  auditor_org_id  ? parseInt(auditor_org_id)  : null,
            standard_id:     standard_id     ? parseInt(standard_id)     : null,
            clause_ref:      clause_ref      || null,
            doc_type,
            doc_code:        finalDocCode,
            title,
            revision:        revision        || null,
            status,
            parent_id,
            path_cache,
            issue_date:      issue_date      || null,
            expiry_date:     finalExpiryDate,
            responsible:     responsible     || null,
            retention_years: retention_years ? parseInt(retention_years) : null,
            attachment_id:   attachment_id   ? parseInt(attachment_id)   : null,
            import_status,
            notes:           notes           || null,
            type_specific_data: type_specific_data ? (typeof type_specific_data === 'string' ? type_specific_data : JSON.stringify(type_specific_data)) : null,
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
            data:    { id: newId, doc_type, title, status, parent_id, doc_code: finalDocCode, content_scope: contentScope, company_id: effectiveCompanyId },
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
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const scopeSql = appendScopeSql(docScope);

        const existing = await query(`
            SELECT id, is_system_folder, doc_type, title, folder_code,
                   issue_date, expiry_date, status, company_id
            FROM document_registry dr
            WHERE dr.id = @id AND dr.organization_id = @organization_id
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...docScope.params });

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                error: 'Documento non trovato',
                code:  'DOC_NOT_FOUND',
            });
        }

        const writeDenied = await assertMutatingAllowed(req.user, {
            companyId: existing.recordset[0].company_id,
        });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        // Protezione rinomina cartelle di sistema (solo cartelle, solo se il nome cambia)
        const doc = existing.recordset[0];
        if (doc.is_system_folder && doc.doc_type === 'folder') {
            const titleChanged = req.body.title !== undefined
                && String(req.body.title ?? '').trim() !== String(doc.title ?? '').trim();
            const folderCodeChanged = req.body.folder_code !== undefined
                && String(req.body.folder_code ?? '').trim() !== String(doc.folder_code ?? '').trim();
            if (titleChanged || folderCodeChanged) {
                return res.status(403).json({
                    error: 'Le cartelle di sistema non possono essere rinominate',
                    code:  'SYSTEM_FOLDER_PROTECTED',
                });
            }
            if (req.body.title !== undefined && !titleChanged) delete req.body.title;
            if (req.body.folder_code !== undefined && !folderCodeChanged) delete req.body.folder_code;
        }

        const allowed = [
            'company_id', 'auditor_org_id', 'standard_id', 'clause_ref',
            'doc_type', 'doc_code', 'title', 'revision', 'status',
            'issue_date', 'expiry_date', 'responsible', 'retention_years',
            'attachment_id', 'import_status', 'notes', 'parent_id',
            'type_specific_data', 'content_scope',
        ];

        // Validazione etichetta di ambito + coerenza company_id.
        if (req.body.content_scope !== undefined && req.body.content_scope !== null) {
            const ALLOWED_SCOPES = ['client', 'studio', 'reference'];
            if (!ALLOWED_SCOPES.includes(req.body.content_scope)) {
                return res.status(400).json({
                    error:   'content_scope non valido',
                    code:    'VALIDATION_ERROR',
                    allowed: ALLOWED_SCOPES,
                });
            }
            // studio/reference => documento dello studio, mai legato a un'azienda.
            if ((req.body.content_scope === 'studio' || req.body.content_scope === 'reference')
                && req.body.company_id === undefined) {
                req.body.company_id = null;
            }
        }

        const updates = [];
        const params  = { id: parseInt(id) };

        for (const field of allowed) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = @${field}`);
                // Campi interi
                if (['company_id', 'auditor_org_id', 'standard_id', 'retention_years', 'attachment_id', 'parent_id'].includes(field)) {
                    params[field] = req.body[field] !== null ? parseInt(req.body[field]) : null;
                } else if (field === 'type_specific_data') {
                    const val = req.body[field];
                    params[field] = val ? (typeof val === 'string' ? val : JSON.stringify(val)) : null;
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

        if (params.expiry_date === undefined && req.body.expiry_date === undefined) {
            const becomingReleased = isReleasedDocStatus(params.status)
                && !isReleasedDocStatus(doc.status);
            const targetDocType = params.doc_type || doc.doc_type;
            if (becomingReleased && !doc.expiry_date && targetDocType) {
                const computed = await resolveExpiryDate({
                    organization_id,
                    doc_type: targetDocType,
                    issue_date: params.issue_date || doc.issue_date,
                    expiry_date: null,
                });
                if (computed) {
                    updates.push('expiry_date = @expiry_date');
                    params.expiry_date = computed;
                }
            }
        }

        if (params.status !== undefined && params.status !== null) {
            const statusParsed = parseRegistryDocStatus(params.status);
            if (!statusParsed.ok) {
                return res.status(400).json({
                    error:   'Status non valido',
                    code:    'VALIDATION_ERROR',
                    allowed: statusParsed.allowed,
                });
            }
            params.status = statusParsed.status;
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
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const scopeSql = appendScopeSql(docScope);

        const existing = await query(`
            SELECT id, status, is_system_folder, doc_type, company_id FROM document_registry dr
            WHERE dr.id = @id AND dr.organization_id = @organization_id
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...docScope.params });

        if (existing.recordset.length === 0) {
            return res.status(404).json({
                error: 'Documento non trovato',
                code:  'DOC_NOT_FOUND',
            });
        }

        const writeDenied = await assertMutatingAllowed(req.user, {
            companyId: existing.recordset[0].company_id,
        });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

        const row = existing.recordset[0];

        if (row.is_system_folder) {
            return res.status(403).json({
                error: 'Le cartelle di sistema non possono essere archiviate',
                code:  'SYSTEM_FOLDER_PROTECTED',
            });
        }

        if (row.doc_type === 'folder') {
            const children = await query(`
                SELECT COUNT(*) AS cnt FROM document_registry
                WHERE parent_id = @id AND organization_id = @organization_id
                  AND ISNULL(status, 'rilasciato') <> 'obsoleto'
            `, { id: parseInt(id), organization_id });

            const childCount = children.recordset[0]?.cnt ?? 0;
            if (childCount > 0) {
                return res.status(409).json({
                    error: 'La cartella non è vuota: rimuovi documenti e sottocartelle prima di eliminarla',
                    code:  'FOLDER_NOT_EMPTY',
                    children_count: childCount,
                });
            }
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
        const docScope = documentRegistryScopeClause(req.user, 'dr');
        const scopeSql = appendScopeSql(docScope);

        const existing = await query(`
            SELECT id, status, revision_number, revision, company_id
            FROM document_registry dr
            WHERE dr.id = @id AND dr.organization_id = @organization_id
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...docScope.params });

        if (!existing.recordset.length) {
            return res.status(404).json({ error: 'Documento non trovato', code: 'DOC_NOT_FOUND' });
        }

        const writeDenied = await assertMutatingAllowed(req.user, {
            companyId: existing.recordset[0].company_id,
        });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

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

        let finalExpiry = expiry_date || null;
        if (!finalExpiry) {
            const fullDoc = await query(
                `SELECT doc_type, issue_date, expiry_date FROM document_registry WHERE id = @id`,
                { id: parseInt(id) }
            );
            const row = fullDoc.recordset[0];
            if (!row?.expiry_date) {
                finalExpiry = await resolveExpiryDate({
                    organization_id,
                    doc_type: row?.doc_type,
                    issue_date: row?.issue_date,
                    expiry_date: null,
                });
            }
        }

        const params = {
            id: parseInt(id),
            revision_number: newRevNum,
            revision:        newRevLabel,
            expiry_date:     finalExpiry,
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

// ─── GET /api/v1/documents/folder-suggestion ─────────────────────────────────
const DOC_TYPE_FOLDER_MAP = {
    procedura:            '1.2',
    istruzione:           '1.3',
    modulo:               '1.4',
    manuale:              '1.1',
    norma:                '2.3',
    cert_taratura:        '2.1',
    certificato_materiale:'2.1',
    qualifica:            '4.3',
    patentino_saldatore:  '4.3',
    qualifica_14732:      '4.3',
    wps:                  '9.1',
    wpqr:                 '9.1',
    cert_ndt:             '9.3',
    report_ndt:           '9.3',
    dichiarazione_ce:     '2.1',
    piano_qualita:        '1.2',
    sal:                  '14',
    rdp:                  '9.1',
    altro:                null,
};

/**
 * Suggerisce la cartella di archiviazione in base al tipo documento.
 * Cerca nel document_registry la cartella con folder_code corrispondente
 * e organization_id dell'utente autenticato.
 */
async function getFolderSuggestion(req, res) {
    try {
        const { organization_id } = req.user;
        const { doc_type } = req.query;

        if (!doc_type) {
            return res.status(400).json({
                error: 'Parametro doc_type obbligatorio',
                code: 'MISSING_DOC_TYPE',
            });
        }

        const folderCode = DOC_TYPE_FOLDER_MAP[doc_type] || null;

        if (!folderCode) {
            return res.json({ folder_id: null, folder_name: null, folder_code: null, confidence: 'none' });
        }

        const result = await query(`
            SELECT TOP 1 id, title, folder_code
            FROM document_registry
            WHERE folder_code = @folder_code
              AND organization_id = @organization_id
              AND is_system_folder = 1
        `, { folder_code: folderCode, organization_id });

        if (!result.recordset.length) {
            return res.json({ folder_id: null, folder_name: null, folder_code: folderCode, confidence: 'low' });
        }

        const folder = result.recordset[0];
        res.json({
            folder_id: folder.id,
            folder_name: folder.title,
            folder_code: folder.folder_code,
            confidence: 'high',
        });

    } catch (error) {
        logger.error('Error getting folder suggestion', { error: error.message });
        res.status(500).json({ error: 'Errore nel recupero suggerimento cartella', code: 'FOLDER_SUGGESTION_ERROR' });
    }
}

// ─── GET /api/v1/documents/orphans ────────────────────────────────────────────
/**
 * Lista documenti orfani: senza parent_id, non cartelle, non eliminati.
 * Usato dalla Inbox per mostrare documenti da archiviare.
 */
async function listOrphanDocuments(req, res) {
    try {
        const { organization_id } = req.user;

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
                dr.responsible,
                dr.clause_ref,
                dr.notes,
                dr.created_at,
                dr.updated_at,
                c.name        AS company_name,
                s.standard_code,
                u.email       AS created_by_email
            FROM document_registry dr
            LEFT JOIN companies     c ON dr.company_id   = c.id
            LEFT JOIN standards     s ON dr.standard_id  = s.standard_id
            LEFT JOIN users         u ON dr.created_by   = u.user_id
            WHERE dr.organization_id = @organization_id
              AND (dr.parent_id IS NULL OR dr.parent_id = 0)
              AND dr.doc_type != 'folder'
              AND dr.status != 'obsoleto'
            ORDER BY dr.created_at DESC
        `, { organization_id });

        res.json({
            success: true,
            data: result.recordset,
            count: result.recordset.length,
        });

    } catch (error) {
        logger.error('Error listing orphan documents', { error: error.message });
        res.status(500).json({
            error: 'Errore durante il recupero dei documenti orfani',
            code:  'DOC_ORPHANS_ERROR',
        });
    }
}

// ─── Multer memory storage per pre-extract (nessun file salvato su disco) ────
const _preExtractUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024, files: 1 },
}).single('file');

// ─── POST /api/v1/documents/pre-extract ───────────────────────────────────────
/**
 * Estrae metadati AI da un PDF caricato temporaneamente (NESSUN record DB creato).
 * Body: multipart/form-data con campi "file" (PDF) e "doc_type" (stringa).
 * Risposta: { metadata: { titolo, codice, ...campi tipo-specifici }, confidence: 0..1 }
 */
async function preExtractMetadata(req, res) {
    // Gestione multer inline (memory storage — niente su disco)
    await new Promise((resolve, reject) => {
        _preExtractUpload(req, res, (err) => {
            if (err) reject(err);
            else resolve();
        });
    }).catch((err) => {
        return res.status(400).json({
            error: err.message || 'Errore durante il caricamento del file',
            code:  'UPLOAD_ERROR',
        });
    });

    // Se la risposta è già stata inviata dal catch (errore multer)
    if (res.headersSent) return;

    const file    = req.file;
    const docType = (req.body?.doc_type || '').trim() || null;

    if (!file) {
        return res.status(400).json({
            error: 'Nessun file ricevuto — campo "file" obbligatorio',
            code:  'MISSING_FILE',
        });
    }

    // Solo PDF supportano l'estrazione testo affidabile
    const isPdf = file.mimetype === 'application/pdf' ||
                  file.originalname?.toLowerCase().endsWith('.pdf');

    if (!isPdf) {
        return res.status(422).json({
            error: 'Estrazione AI disponibile solo per file PDF',
            code:  'UNSUPPORTED_FILE_TYPE',
        });
    }

    try {
        const { extractPdfText, confidenceFromTextLength } = require('../utils/importPdfText');
        const { extractStructuredByDocType } = require('../services/importAiExtraction.service');

        // Estrazione testo dal buffer (nessun file su disco)
        let pdfText;
        try {
            pdfText = await extractPdfText(file.buffer);
        } catch (pdfErr) {
            return res.status(422).json({
                error: 'Impossibile leggere il PDF (file danneggiato o protetto da password)',
                code:  'PDF_PARSE_ERROR',
            });
        }

        if (!pdfText || pdfText.length < 20) {
            return res.status(422).json({
                error: 'PDF scansionato senza strato testo — estrazione AI non disponibile',
                code:  'EMPTY_PDF_TEXT',
            });
        }

        // Estrazione AI strutturata per tipo documento
        const result = await extractStructuredByDocType({ text: pdfText, docType });
        const aiData = result.data || {};

        // Confidence: media tra quella AI (0-100→0-1) e quella euristica testo
        const aiConfidence  = typeof aiData.extraction_confidence === 'number'
            ? aiData.extraction_confidence / 100
            : 0.5;
        const textConfidence = confidenceFromTextLength(pdfText.length) / 100;
        const confidence     = Math.round(((aiConfidence + textConfidence) / 2) * 100) / 100;

        // Normalizza metadata (campi flat + type_specific_data separati)
        const typeSpecific = aiData.type_specific_data || {};
        const metadata = {
            titolo:   aiData.title           || null,
            sommario: aiData.summary         || null,
            warnings: Array.isArray(aiData.warnings) ? aiData.warnings : [],
            ...typeSpecific,
        };

        logger.info('pre-extract completato', {
            docType,
            filename:    file.originalname,
            textLen:     pdfText.length,
            confidence,
            model:       result.model,
        });

        res.json({ metadata, confidence, model: result.model });

    } catch (aiErr) {
        const code = aiErr.code || 'AI_ERROR';
        const known = ['AI_NOT_CONFIGURED', 'AI_REQUEST_FAILED', 'AI_UPSTREAM_ERROR',
                       'AI_EMPTY_RESPONSE', 'AI_INVALID_JSON', 'AI_BAD_SHAPE'];
        const status = code === 'AI_NOT_CONFIGURED' ? 503 : 502;
        logger.warn('pre-extract AI fallito', { code, msg: aiErr.message });

        if (known.includes(code) || status < 500) {
            return res.status(status).json({
                error: aiErr.message || 'Estrazione AI non riuscita',
                code,
            });
        }

        logger.error('pre-extract errore inatteso', { error: aiErr.message });
        res.status(500).json({
            error: 'Errore interno durante l\'estrazione',
            code:  'PRE_EXTRACT_ERROR',
        });
    }
}

// ─── POST /api/v1/documents/norm-lookup ───────────────────────────────────────
/**
 * Interroga il catalogo pubblico dell'ente normativo per verificare lo stato
 * di validità di una norma (vigente / ritirata / sostituita).
 * Body: { standard_code, issuing_body }
 * Risposta: { status, supersededBy, catalogUrl, checkedAt }
 *
 * Non blocca: in caso di errore restituisce { status: 'unknown' } con HTTP 200.
 */
async function lookupNormStatus(req, res) {
    const { standard_code, issuing_body, document_id } = req.body || {};

    if (!standard_code || !String(standard_code).trim()) {
        return res.status(400).json({ error: 'standard_code obbligatorio', code: 'MISSING_CODE' });
    }

    try {
        const normCatalog = require('../services/normCatalogLookup.service');
        const result = await normCatalog.lookupNormStatus(
            String(standard_code).trim(),
            String(issuing_body || '').trim()
        );

        // R2: persisti il risultato su document_registry se document_id fornito e status noto
        if (document_id && result.status !== 'unknown') {
            const docId = parseInt(String(document_id), 10);
            const orgId = req.user?.organization_id;
            if (Number.isFinite(docId) && docId > 0 && orgId) {
                const validityStatus = result.status === 'active' ? 'vigente' : 'superata';
                try {
                    await query(
                        `UPDATE document_registry
                         SET type_specific_data = JSON_MODIFY(
                               JSON_MODIFY(
                                 JSON_MODIFY(
                                   JSON_MODIFY(
                                     ISNULL(type_specific_data, '{}'),
                                     '$.validity_status',    @validityStatus
                                   ),
                                   '$.last_validity_check', @lastCheck
                                 ),
                                 '$.validity_check_url',  @checkUrl
                               ),
                               '$.superseded_by',        @supersededBy
                             ),
                             updated_at = GETDATE()
                         WHERE id = @docId AND organization_id = @orgId AND doc_type = 'norma'`,
                        {
                            docId,
                            orgId,
                            validityStatus,
                            lastCheck:    result.checkedAt || new Date().toISOString(),
                            checkUrl:     result.catalogUrl   || null,
                            supersededBy: result.supersededBy || null,
                        }
                    );
                    logger.info('[norm-lookup] Persistito su document_registry', { docId, validityStatus });
                } catch (persistErr) {
                    logger.warn('[norm-lookup] Persist to registry failed:', persistErr.message);
                }
            }
        }

        res.json({ success: true, data: result });
    } catch (err) {
        logger.error('Error in norm-lookup', { error: err.message });
        // Graceful degradation: non bloccare il flusso
        res.json({
            success: true,
            data: {
                status:      'unknown',
                error:       'lookup_failed',
                supersededBy: null,
                catalogUrl:   null,
                checkedAt:    new Date().toISOString(),
            },
        });
    }
}

// ─── POST /api/v1/documents/norm-import-codes ─────────────────────────────────
/**
 * Import batch da lista codici norma/legge (senza PDF).
 * Body: { codes: string|string[], folder_id?: number }
 */
async function importNormCodes(req, res) {
    const { organization_id, user_id } = req.user;
    const { codes, folder_id } = req.body || {};

    if (!codes || (Array.isArray(codes) && codes.length === 0) || (typeof codes === 'string' && !codes.trim())) {
        return res.status(400).json({
            error: 'Fornire almeno un codice norma (codes: stringa multiriga o array)',
            code: 'VALIDATION_ERROR',
        });
    }

    try {
        const normCodesImport = require('../services/normCodesImport.service');
        const result = await normCodesImport.importNormCodes(
            organization_id,
            user_id,
            codes,
            { folderId: folder_id ? parseInt(String(folder_id), 10) : null }
        );

        const { summary } = result;
        const httpStatus = summary.created > 0 ? 201 : (summary.duplicates > 0 && summary.errors === 0 ? 200 : 200);

        res.status(httpStatus).json({
            success: summary.created > 0 || summary.duplicates > 0,
            ...result,
        });
    } catch (err) {
        if (err.code === 'NORM_FOLDER_NOT_FOUND') {
            return res.status(404).json({ error: err.message, code: err.code });
        }
        if (err.code === 'TOO_MANY_CODES') {
            return res.status(400).json({ error: err.message, code: err.code });
        }
        logger.error('Error in norm-import-codes', { error: err.message });
        res.status(500).json({ error: 'Errore interno', code: 'INTERNAL_ERROR' });
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
    getFolderSuggestion,
    listOrphanDocuments,
    preExtractMetadata,
    lookupNormStatus,
    importNormCodes,
};
