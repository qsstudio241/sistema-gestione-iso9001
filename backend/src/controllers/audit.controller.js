/**
 * Audit Controller
 * Gestisce operazioni CRUD su audit con isolamento multi-tenant
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { hardDeleteAudit } = require('../services/auditMaintenance.service');
const { getAllowedStandardIds } = require('./auth.controller');
const { assertWriteAllowed, getLockTokenFromRequest } = require('../services/auditLock.service');
const { allocateAuditReportNumber } = require('../services/auditNumberAllocation.service');
const { studioScopeClause } = require('../services/auditListRbac.service');

/**
 * GET /api/v1/audits
 * Lista audit dell'organizzazione corrente
 * 
 * Query params:
 * - status: filter by status (draft, in_progress, completed, approved)
 * - year: filter by project_year
 * - standard_id: filter by standard
 * - page: pagination (default 1)
 * - limit: items per page (default 50)
 */
async function listAudits(req, res) {
    try {
        const {
            status,
            year,
            standard_id,
            page = 1,
            limit = 50
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build WHERE clause dinamicamente
        let whereConditions = ['a.organization_id = @organization_id', 'a.is_deleted = 0'];
        let params = { organization_id, limit: parseInt(limit), offset };

        const scope = studioScopeClause(req.user, 'a');
        if (scope.clause) {
            whereConditions.push(scope.clause);
            Object.assign(params, scope.params);
        }

        if (status) {
            whereConditions.push('a.status = @status');
            params.status = status;
        }

        if (year) {
            whereConditions.push('a.project_year = @year');
            params.year = parseInt(year);
        }

        if (standard_id) {
            whereConditions.push('EXISTS (SELECT 1 FROM audit_standards WHERE audit_id = a.audit_id AND standard_id = @standard_id)');
            params.standard_id = parseInt(standard_id);
        }

        const whereClause = whereConditions.join(' AND ');

        // Query principale con paginazione
        const result = await query(`
      SELECT 
        a.audit_id,
        a.audit_uuid,
        a.audit_number,
        a.client_name,
        a.company_id,
        a.project_year,
        a.audit_date,
        a.auditor_name,
        a.audit_type,
        a.status,
        a.total_questions,
        a.answered_questions,
        a.conformities_count,
        a.non_conformities_count,
        a.completion_percentage,
        a.notes,
        a.audit_extra_data,
        a.custom_checklist_id,
        a.created_at,
        a.updated_at,
        u.full_name AS created_by_name,
        o.organization_name,
        (
          SELECT STRING_AGG(s.standard_code, ', ')
          FROM audit_standards ast
          INNER JOIN standards s ON ast.standard_id = s.standard_id
          WHERE ast.audit_id = a.audit_id
        ) AS standards
      FROM audits a
      LEFT JOIN users u ON a.created_by = u.user_id
      INNER JOIN organizations o ON a.organization_id = o.organization_id
      WHERE ${whereClause}
      ORDER BY a.audit_date DESC, a.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, params);

        // Count totale per pagination
        const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM audits a
      WHERE ${whereClause}
    `, params);

        const total = countResult.recordset[0].total;

        // Parsa audit_extra_data JSON per ogni audit
        const audits = result.recordset.map(a => {
            if (a.audit_extra_data && typeof a.audit_extra_data === 'string') {
                try { a.audit_extra_data = JSON.parse(a.audit_extra_data); } catch (_) { a.audit_extra_data = null; }
            }
            return a;
        });

        logger.info('Audit list retrieved', {
            organization_id,
            count: audits.length,
            filters: { status, year, standard_id }
        });

        res.json({
            success: true,
            data: audits,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('Error listing audits', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero degli audit',
            code: 'AUDIT_LIST_ERROR'
        });
    }
}

/**
 * GET /api/v1/audits/:id
 * Recupera dettagli di un singolo audit
 */
async function getAuditById(req, res) {
    try {
        const { id } = req.params;
        const scope = studioScopeClause(req.user, 'a');
        let whereExtra = scope.clause ? ` AND ${scope.clause}` : '';
        const params = { id: parseInt(id), organization_id, ...scope.params };

        const result = await query(`
      SELECT 
        a.*,
        u.full_name AS created_by_name,
        u.email AS created_by_email,
        o.organization_name,
        o.organization_code
      FROM audits a
      LEFT JOIN users u ON a.created_by = u.user_id
      INNER JOIN organizations o ON a.organization_id = o.organization_id
      WHERE a.audit_id = @id 
        AND a.organization_id = @organization_id
        AND a.is_deleted = 0
        ${whereExtra}
    `, params);

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        const audit = result.recordset[0];

        // Recupera standard associati
        const standardsResult = await query(`
      SELECT s.standard_id, s.standard_code, s.standard_name, s.version
      FROM audit_standards ast
      INNER JOIN standards s ON ast.standard_id = s.standard_id
      WHERE ast.audit_id = @id
    `, { id: parseInt(id) });

        audit.standards = standardsResult.recordset;

        // Parsa audit_extra_data JSON
        if (audit.audit_extra_data && typeof audit.audit_extra_data === 'string') {
            try { audit.audit_extra_data = JSON.parse(audit.audit_extra_data); } catch (_) { audit.audit_extra_data = null; }
        }

        logger.info('Audit retrieved', { audit_id: id, organization_id });

        res.json({
            success: true,
            data: audit
        });

    } catch (error) {
        logger.error('Error getting audit', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero dell\'audit',
            code: 'AUDIT_GET_ERROR'
        });
    }
}

/**
 * POST /api/v1/audits
 * Crea nuovo audit
 * 
 * Body:
 * {
 *   audit_number: string (REQUIRED, unique),
 *   client_name: string (REQUIRED),
 *   project_year: number (REQUIRED),
 *   audit_date: date (REQUIRED),
 *   auditor_name: string (REQUIRED),
 *   audit_type: string (REQUIRED),
 *   standard_ids: number[] (REQUIRED, array of standard IDs),
 *   notes?: string
 * }
 */
async function createAudit(req, res) {
    try {
        const { user_id, organization_id } = req.user;
        const {
            client_name,
            project_year,
            audit_date,
            auditor_name,
            audit_type,
            standard_ids,
            custom_checklist_id,
            notes,
            audit_party_type,
            fornitore_name,
            company_id
        } = req.body;

        // Validazione campi obbligatori (audit_number assegnato server-side: formato PREFISSO-YYMMDD-NN)
        if (!client_name || !project_year || !audit_date || !auditor_name || !audit_type) {
            return res.status(400).json({
                error: 'Campi obbligatori mancanti',
                code: 'VALIDATION_ERROR',
                required: ['client_name', 'project_year', 'audit_date', 'auditor_name', 'audit_type']
            });
        }

        let audit_number;
        const maxAttempts = 5;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            audit_number = await allocateAuditReportNumber(organization_id);
            const dup = await query(`
      SELECT audit_id FROM audits
      WHERE audit_number = @audit_number
        AND organization_id = @organization_id
        AND is_deleted = 0
    `, { audit_number, organization_id });
            if (dup.recordset.length === 0) break;
            if (attempt === maxAttempts - 1) {
                return res.status(409).json({
                    error: 'Impossibile assegnare un numero audit univoco',
                    code: 'AUDIT_NUMBER_ALLOCATION_FAILED'
                });
            }
        }

        // Verifica: almeno standard_ids O custom_checklist_id
        const hasStandards = standard_ids && Array.isArray(standard_ids) && standard_ids.length > 0;
        const hasCustomChecklist = custom_checklist_id && parseInt(custom_checklist_id, 10) > 0;
        if (!hasStandards && !hasCustomChecklist) {
            return res.status(400).json({
                error: 'Selezionare almeno una norma ISO oppure una checklist personalizzata',
                code: 'VALIDATION_ERROR'
            });
        }

        // Verifica standard consentiti per l'utente (user_standards) - solo se standard_ids forniti
        if (hasStandards) {
            const allowedStd = await getAllowedStandardIds(user_id);
            if (allowedStd) {
                const requested = standard_ids.map(id => parseInt(id)).filter(id => !isNaN(id));
                const forbidden = requested.filter(id => !allowedStd.includes(id));
                if (forbidden.length > 0) {
                    return res.status(403).json({
                        error: 'Non sei autorizzato a creare audit per uno o più standard selezionati',
                        code: 'STANDARDS_NOT_ALLOWED',
                        forbidden_standard_ids: forbidden
                    });
                }
            }
        }

        // Crea audit
        const result = await query(`
      INSERT INTO audits (
        audit_uuid,
        audit_number,
        client_name,
        project_year,
        audit_date,
        auditor_name,
        audit_type,
        status,
        notes,
        organization_id,
        created_by,
        custom_checklist_id,
        created_at,
        updated_at
      )
      OUTPUT INSERTED.audit_id, INSERTED.audit_uuid
      VALUES (
        NEWID(),
        @audit_number,
        @client_name,
        @project_year,
        @audit_date,
        @auditor_name,
        @audit_type,
        'draft',
        @notes,
        @organization_id,
        @user_id,
        @custom_checklist_id,
        GETDATE(),
        GETDATE()
      )
    `, {
            audit_number,
            client_name,
            project_year: parseInt(project_year),
            audit_date,
            auditor_name,
            audit_type,
            notes: notes || null,
            organization_id,
            user_id,
            custom_checklist_id: hasCustomChecklist ? parseInt(custom_checklist_id, 10) : null
        });

        const newAudit = result.recordset[0];

        // Persistenza tipologia audit, fornitore e company_id in audit_extra_data / colonne
        const extraData = {
            auditPartyType: audit_party_type || 'first_party',
            fornitoreName: fornitore_name || ''
        };
        await query(`
            UPDATE audits SET audit_extra_data = @audit_extra_data, company_id = @company_id, updated_at = GETDATE()
            WHERE audit_id = @audit_id
        `, {
            audit_id: newAudit.audit_id,
            audit_extra_data: JSON.stringify(extraData),
            company_id: company_id || null
        });

        // Associa standard (se forniti)
        if (hasStandards) {
            for (const standard_id of standard_ids) {
                await query(`
          INSERT INTO audit_standards (audit_id, standard_id)
          VALUES (@audit_id, @standard_id)
        `, { audit_id: newAudit.audit_id, standard_id: parseInt(standard_id) });
            }
        }

        logger.info('Audit created', {
            audit_id: newAudit.audit_id,
            organization_id,
            standards: standard_ids
        });

        res.status(201).json({
            success: true,
            data: {
                audit_id: newAudit.audit_id,
                audit_uuid: newAudit.audit_uuid,
                audit_number,
                status: 'draft'
            }
        });

    } catch (error) {
        logger.error('Error creating audit', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante la creazione dell\'audit',
            code: 'AUDIT_CREATE_ERROR'
        });
    }
}

/**
 * PUT /api/v1/audits/:id
 * Aggiorna audit esistente
 * 
 * Body: campi opzionali da aggiornare
 */
async function updateAudit(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const {
            client_name,
            project_year,
            audit_date,
            auditor_name,
            audit_type,
            status,
            notes,
            total_questions,
            answered_questions,
            conformities_count,
            non_conformities_count,
            completion_percentage,
            standard_ids,
            custom_checklist_id,
            audit_party_type,
            fornitore_name
        } = req.body;

        // Verifica esistenza e ownership (con timestamp e audit_extra_data per merge)
        const existingAudit = await query(`
      SELECT audit_id, updated_at, audit_extra_data FROM audits
      WHERE audit_id = @id 
        AND organization_id = @organization_id
        AND is_deleted = 0
    `, { id: parseInt(id), organization_id });

        if (existingAudit.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        const lockChkUpd = await assertWriteAllowed(req.user, parseInt(id, 10), getLockTokenFromRequest(req));
        if (!lockChkUpd.ok) {
            return res.status(lockChkUpd.status).json({
                error: lockChkUpd.message,
                code: lockChkUpd.code,
                locked_by_name: lockChkUpd.locked_by_name,
            });
        }

        // Conflict detection: verifica timestamp client vs server
        const currentUpdatedAt = existingAudit.recordset[0].updated_at;
        const clientUpdatedAt = req.headers['x-last-known-updated-at'];

        if (clientUpdatedAt) {
            const clientTimestamp = new Date(clientUpdatedAt);
            const serverTimestamp = new Date(currentUpdatedAt);

            // Se il client ha un timestamp più vecchio del server, c'è conflitto
            if (clientTimestamp < serverTimestamp) {
                logger.warn('Conflict detected', {
                    audit_id: id,
                    organization_id,
                    clientTimestamp: clientTimestamp.toISOString(),
                    serverTimestamp: serverTimestamp.toISOString()
                });

                return res.status(409).json({
                    error: 'Conflitto rilevato: l\'audit è stato modificato da un altro utente',
                    code: 'AUDIT_CONFLICT',
                    conflict: {
                        clientVersion: clientTimestamp.toISOString(),
                        serverVersion: serverTimestamp.toISOString(),
                        message: 'Recupera la versione più recente prima di sincronizzare le tue modifiche'
                    }
                });
            }
        }

        // Build UPDATE dinamicamente solo con campi presenti
        const updates = [];
        const params = { id: parseInt(id), organization_id };

        if (client_name !== undefined) {
            updates.push('client_name = @client_name');
            params.client_name = client_name;
        }
        if (project_year !== undefined) {
            updates.push('project_year = @project_year');
            params.project_year = parseInt(project_year);
        }
        if (audit_date !== undefined) {
            updates.push('audit_date = @audit_date');
            params.audit_date = audit_date;
        }
        if (auditor_name !== undefined) {
            updates.push('auditor_name = @auditor_name');
            params.auditor_name = auditor_name;
        }
        if (audit_type !== undefined) {
            updates.push('audit_type = @audit_type');
            params.audit_type = audit_type;
        }
        if (status !== undefined) {
            updates.push('status = @status');
            params.status = status;
        }
        if (notes !== undefined) {
            updates.push('notes = @notes');
            params.notes = notes;
        }
        if (total_questions !== undefined) {
            updates.push('total_questions = @total_questions');
            params.total_questions = parseInt(total_questions);
        }
        if (answered_questions !== undefined) {
            updates.push('answered_questions = @answered_questions');
            params.answered_questions = parseInt(answered_questions);
        }
        if (conformities_count !== undefined) {
            updates.push('conformities_count = @conformities_count');
            params.conformities_count = parseInt(conformities_count);
        }
        if (non_conformities_count !== undefined) {
            updates.push('non_conformities_count = @non_conformities_count');
            params.non_conformities_count = parseInt(non_conformities_count);
        }
        if (completion_percentage !== undefined) {
            updates.push('completion_percentage = @completion_percentage');
            params.completion_percentage = parseFloat(completion_percentage);
        }
        if (custom_checklist_id !== undefined) {
            updates.push('custom_checklist_id = @custom_checklist_id');
            params.custom_checklist_id = custom_checklist_id ? parseInt(custom_checklist_id) : null;
        }
        // Merge tipologia audit e fornitore in audit_extra_data
        if (audit_party_type !== undefined || fornitore_name !== undefined) {
            let extra = existingAudit.recordset[0].audit_extra_data;
            if (extra && typeof extra === 'string') {
                try { extra = JSON.parse(extra); } catch (_) { extra = {}; }
            }
            if (!extra || typeof extra !== 'object') extra = {};
            if (audit_party_type !== undefined) extra.auditPartyType = audit_party_type;
            if (fornitore_name !== undefined) extra.fornitoreName = fornitore_name;
            updates.push('audit_extra_data = @audit_extra_data');
            params.audit_extra_data = JSON.stringify(extra);
        }

        if (updates.length === 0 && !standard_ids && custom_checklist_id === undefined) {
            return res.status(400).json({
                error: 'Nessun campo da aggiornare',
                code: 'VALIDATION_ERROR'
            });
        }

        // Update audit
        if (updates.length > 0) {
            updates.push('updated_at = GETDATE()');

            await query(`
        UPDATE audits
        SET ${updates.join(', ')}
        WHERE audit_id = @id AND organization_id = @organization_id
      `, params);
        }

        // Update standard associations se forniti
        if (standard_ids && Array.isArray(standard_ids)) {
            // Remove existing
            await query(`
        DELETE FROM audit_standards WHERE audit_id = @id
      `, { id: parseInt(id) });

            // Add new
            for (const standard_id of standard_ids) {
                await query(`
          INSERT INTO audit_standards (audit_id, standard_id)
          VALUES (@audit_id, @standard_id)
        `, { audit_id: parseInt(id), standard_id: parseInt(standard_id) });
            }
        }

        logger.info('Audit updated', { audit_id: id, organization_id, updates: Object.keys(params) });

        res.json({
            success: true,
            message: 'Audit aggiornato con successo'
        });

    } catch (error) {
        logger.error('Error updating audit', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'aggiornamento dell\'audit',
            code: 'AUDIT_UPDATE_ERROR'
        });
    }
}

/**
 * DELETE /api/v1/audits/:id
 * Hard delete per admin/draft, soft delete per il resto.
 */
async function deleteAudit(req, res) {
    try {
        const { id } = req.params;
        const { organization_id, role } = req.user;

        const numericId = parseInt(id, 10);
        const isUuid = isNaN(numericId) && typeof id === 'string' && id.length > 10;

        // Recupera audit (id numerico, status) per UUID o ID
        const existingAudit = await query(
            isUuid
                ? `SELECT audit_id, audit_number, status 
                   FROM audits 
                   WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0`
                : `SELECT audit_id, audit_number, status 
                   FROM audits 
                   WHERE audit_id = @id AND organization_id = @organization_id AND is_deleted = 0`,
            isUuid ? { audit_uuid: id, organization_id } : { id: numericId, organization_id }
        );

        if (existingAudit.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        const auditRow = existingAudit.recordset[0];
        const auditIdToDelete = auditRow.audit_id;
        const canHardDelete = role === 'admin' || auditRow.status === 'draft';

        if (canHardDelete) {
            const ok = await hardDeleteAudit(auditIdToDelete, organization_id);
            if (!ok) {
                return res.status(500).json({
                    error: 'Hard delete fallito',
                    code: 'HARD_DELETE_FAILED'
                });
            }
            logger.info('Audit deleted (hard)', { audit_id: auditIdToDelete, organization_id });
            return res.json({
                success: true,
                message: 'Audit eliminato definitivamente'
            });
        }

        // Soft delete per audit non draft / non admin
        await query(`
      UPDATE audits
      SET is_deleted = 1, deleted_at = GETDATE(), updated_at = GETDATE()
      WHERE audit_id = @audit_id AND organization_id = @organization_id
    `, { audit_id: auditIdToDelete, organization_id });

        logger.info('Audit deleted (soft)', { audit_id: auditIdToDelete, organization_id });

        res.json({
            success: true,
            message: 'Audit eliminato (soft delete)'
        });

    } catch (error) {
        logger.error('Error deleting audit', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'eliminazione dell\'audit',
            code: 'AUDIT_DELETE_ERROR'
        });
    }
}

/**
 * GET /api/v1/audits/:id/statistics
 * Statistiche dettagliate audit (conformità per sezione, etc.)
 */
async function getAuditStatistics(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Verifica ownership
        const auditCheck = await query(`
      SELECT audit_id FROM audits
      WHERE audit_id = @id AND organization_id = @organization_id AND is_deleted = 0
    `, { id: parseInt(id), organization_id });

        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        // Statistiche per sezione
        const sectionStats = await query(`
      SELECT 
        cs.section_code,
        cs.section_title,
        COUNT(ar.response_id) AS total_responses,
        SUM(CASE WHEN ar.is_answered = 1 THEN 1 ELSE 0 END) AS answered,
        SUM(CASE WHEN ar.conformity_status = 'C' THEN 1 ELSE 0 END) AS conformities,
        SUM(CASE WHEN ar.conformity_status = 'NC' THEN 1 ELSE 0 END) AS non_conformities,
        SUM(CASE WHEN ar.conformity_status = 'OM' THEN 1 ELSE 0 END) AS observations,
        SUM(CASE WHEN ar.conformity_status = 'NA' THEN 1 ELSE 0 END) AS not_applicable
      FROM checklist_sections cs
      LEFT JOIN checklist_questions cq ON cs.section_code = cq.section_code
      LEFT JOIN audit_responses ar ON cq.question_id = ar.question_id AND ar.audit_id = @id
      GROUP BY cs.section_code, cs.section_title
      ORDER BY cs.section_code
    `, { id: parseInt(id) });

        logger.info('Audit statistics retrieved', { audit_id: id, organization_id });

        res.json({
            success: true,
            data: sectionStats.recordset
        });

    } catch (error) {
        logger.error('Error getting audit statistics', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero delle statistiche',
            code: 'AUDIT_STATS_ERROR'
        });
    }
}

/**
 * POST /api/v1/audits/sync
 * Upsert audit (INSERT se nuovo, UPDATE se esiste)
 * Usato da sync service per offline-first
 */
async function upsertAudit(req, res) {
    try {
        const { organization_id, user_id } = req.user;
        const {
            audit_uuid,
            audit_number,
            client_name,
            company_id,
            project_year,
            audit_date,
            auditor_name,
            audit_type,
            status,
            notes,
            total_questions,
            answered_questions,
            conformities_count,
            non_conformities_count,
            completion_percentage,
            standard_id,
            standard_ids,   // array [1, 2] da syncService — aggiorna audit_standards completo
            custom_checklist_id,
            updated_at,
            audit_extra_data: bodyExtra, // JSON con generalData, auditObjective, auditOutcome, auditPartyType, fornitoreName
            audit_party_type,
            fornitore_name
        } = req.body;

        // Merge tipologia e fornitore in audit_extra_data (da body root o da audit_extra_data)
        const audit_extra_data = (() => {
            const base = bodyExtra && typeof bodyExtra === 'object' ? { ...bodyExtra } : (typeof bodyExtra === 'string' ? (() => { try { return JSON.parse(bodyExtra); } catch (_) { return {}; } })() : {});
            base.auditPartyType = audit_party_type ?? base.auditPartyType ?? 'first_party';
            base.fornitoreName = fornitore_name ?? base.fornitoreName ?? '';
            return base;
        })();

        // Risolve la lista di standard_id da registrare in audit_standards
        // Priorità: standard_ids array (nuovo) > standard_id scalare (legacy) > default ISO 9001 (se no custom_checklist_id)
        const bodyHasCustomChecklistField = Object.prototype.hasOwnProperty.call(req.body, 'custom_checklist_id');
        const bodyHasStandardField = Object.prototype.hasOwnProperty.call(req.body, 'standard_id');
        const bodyHasStandardsArray = Array.isArray(standard_ids) && standard_ids.length > 0;
        const clearCustomChecklist = req.body.custom_checklist_clear === true;
        const parsedCustomChecklistId = (custom_checklist_id && parseInt(custom_checklist_id, 10) > 0)
            ? parseInt(custom_checklist_id, 10)
            : null;
        // Standard richiesti esplicitamente dal payload corrente (usati per controllo permessi)
        const requestedStandardIds = bodyHasStandardsArray
            ? standard_ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
            : (bodyHasStandardField ? [parseInt(standard_id) || 1] : []);

        // Validazione campi obbligatori
        if (!audit_uuid || !audit_number || !client_name) {
            return res.status(400).json({
                error: 'Campi obbligatori mancanti',
                code: 'VALIDATION_ERROR',
                required: ['audit_uuid', 'audit_number', 'client_name']
            });
        }

        // Verifica standard consentiti per l'utente (user_standards) — solo se standard presenti
        if (requestedStandardIds.length > 0) {
            const allowedStd = await getAllowedStandardIds(user_id);
            if (allowedStd) {
                const forbidden = requestedStandardIds.filter(id => !allowedStd.includes(id));
                if (forbidden.length > 0) {
                    return res.status(403).json({
                        error: 'Non sei autorizzato a usare uno o più standard selezionati',
                        code: 'STANDARDS_NOT_ALLOWED',
                        forbidden_standard_ids: forbidden
                    });
                }
            }
        }

        // ⚠️ BLACKLIST UUID temporanea - rimuovere dopo cleanup completo cache client
        const BLACKLISTED_UUIDS = [
            'audit-002-acme-2025',
            'audit-003-template-2025'
        ];

        if (BLACKLISTED_UUIDS.includes(audit_uuid)) {
            logger.warn(`[UPSERT] UUID blacklisted rifiutato: ${audit_uuid} da organization ${organization_id}`);
            return res.status(403).json({
                error: 'Audit obsoleto - cancella cache browser',
                code: 'AUDIT_DEPRECATED',
                message: `L'audit "${client_name}" è stato rimosso. Cancella la cache del browser.`,
                audit_uuid
            });
        }

        // Check esistenza per audit_uuid
        const existing = await query(`
      SELECT audit_id, updated_at, status, standard_id, custom_checklist_id
      FROM audits
      WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id
    `, { audit_uuid, organization_id });

        if (existing.recordset.length > 0) {
            // ========== UPDATE ESISTENTE ==========
            const existingAudit = existing.recordset[0];
            const audit_id = existingAudit.audit_id;

            const lockChk = await assertWriteAllowed(req.user, audit_id, getLockTokenFromRequest(req));
            if (!lockChk.ok) {
                return res.status(lockChk.status).json({
                    error: lockChk.message,
                    code: lockChk.code,
                    locked_by_name: lockChk.locked_by_name,
                });
            }

            // Determina il custom checklist effettivo:
            // - se payload include custom_checklist_id, usa quel valore (anche null per "stacco")
            // - altrimenti preserva valore esistente in DB
            // custom_checklist_id robusto:
            // - se payload contiene un ID valido >0, aggiorna
            // - se payload chiede esplicitamente clear (custom_checklist_clear=true), azzera
            // - se payload contiene null/empty senza clear esplicito, preserva valore DB (evita "stacco" accidentale)
            // - se payload non contiene il campo, preserva valore DB
            const effectiveCustomChecklistId = bodyHasCustomChecklistField
                ? (parsedCustomChecklistId != null
                    ? parsedCustomChecklistId
                    : (clearCustomChecklist ? null : (existingAudit.custom_checklist_id ?? null)))
                : (existingAudit.custom_checklist_id ?? null);
            const hasCustomChecklist = effectiveCustomChecklistId != null;

            // standard_ids da sincronizzare in junction table:
            // - se array esplicito presente, usa quello
            // - se custom checklist effettiva presente e nessun array standard, lista vuota
            // - altrimenti, usa standard_id payload se presente, altrimenti preserva standard_id esistente
            const standardIdsToSync = bodyHasStandardsArray
                ? standard_ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
                : (hasCustomChecklist ? [] : [bodyHasStandardField ? (parseInt(standard_id) || 1) : (existingAudit.standard_id || 1)]);

            // Conflict detection: se server updated_at > client updated_at
            const serverTime = new Date(existingAudit.updated_at).getTime();
            const clientTime = updated_at ? new Date(updated_at).getTime() : 0;

            if (serverTime > clientTime && !req.body.force) {
                logger.warn(`[UPSERT] Conflict rilevato per audit ${audit_uuid}: server=${serverTime}, client=${clientTime}`);
                return res.status(409).json({
                    error: 'Conflict',
                    code: 'AUDIT_CONFLICT',
                    message: 'Versione server più recente. Usa force=true per sovrascrivere.',
                    serverData: {
                        audit_id,
                        updated_at: existingAudit.updated_at,
                        status: existingAudit.status
                    }
                });
            }

            // UPDATE — SQL Server non supporta OUTPUT diretto su tabelle con trigger;
            // usiamo una table variable come destinazione intermedia dell'OUTPUT clause
            const updateResult = await query(`
        DECLARE @out TABLE (updated_at DATETIME2);
        UPDATE audits
        SET 
          audit_number = @audit_number,
          client_name = @client_name,
          company_id = @company_id,
          project_year = @project_year,
          audit_date = @audit_date,
          auditor_name = @auditor_name,
          audit_type = @audit_type,
          status = @status,
          notes = @notes,
          total_questions = @total_questions,
          answered_questions = @answered_questions,
          conformities_count = @conformities_count,
          non_conformities_count = @non_conformities_count,
          completion_percentage = @completion_percentage,
          standard_id = @standard_id,
          custom_checklist_id = @custom_checklist_id,
          audit_extra_data = COALESCE(@audit_extra_data, audit_extra_data),
          updated_at = GETDATE()
        OUTPUT INSERTED.updated_at INTO @out
        WHERE audit_id = @audit_id AND organization_id = @organization_id;
        SELECT updated_at FROM @out;
      `, {
                audit_id,
                audit_number,
                client_name,
                company_id: company_id || null,
                project_year: project_year || new Date().getFullYear(),
                audit_date: audit_date || new Date().toISOString(),
                auditor_name: auditor_name || 'Non specificato',
                audit_type: audit_type || 'internal',
                status: status || 'draft',
                notes: notes || null,
                total_questions: total_questions || 78,
                answered_questions: answered_questions || 0,
                conformities_count: conformities_count || 0,
                non_conformities_count: non_conformities_count || 0,
                completion_percentage: completion_percentage || 0,
                standard_id: standardIdsToSync.length > 0 ? standardIdsToSync[0] : null,
                custom_checklist_id: effectiveCustomChecklistId,
                audit_extra_data: audit_extra_data ? JSON.stringify(audit_extra_data) : null,
                organization_id
            });

            logger.info(`[UPSERT] Audit aggiornato: ${audit_id} (${audit_uuid})`);

            // Aggiorna audit_standards: delete + reinsert per garantire coerenza con tutti gli standard selezionati
            try {
                await query('DELETE FROM audit_standards WHERE audit_id = @audit_id', { audit_id });
                for (const stdId of standardIdsToSync) {
                    await query(
                        'INSERT INTO audit_standards (audit_id, standard_id) VALUES (@audit_id, @standard_id)',
                        { audit_id, standard_id: stdId }
                    );
                }
                logger.info(`[UPSERT] audit_standards aggiornati per audit ${audit_id}: [${standardIdsToSync.join(',')}]`);
            } catch (e) {
                logger.warn('[UPSERT] audit_standards update failed:', e.message);
            }

            // Ritorna updated_at server → il client lo memorizza per evitare conflict ciclici
            const serverUpdatedAt = updateResult.recordset?.[0]?.updated_at || new Date().toISOString();

            return res.json({
                audit_id,
                audit_uuid,
                action: 'updated',
                updated_at: serverUpdatedAt,
                message: 'Audit aggiornato con successo'
            });

        } else {
            // ========== INSERT NUOVO ==========
            // audit_uuid: da frontend arriva come stringa; SQL Server UNIQUEIDENTIFIER accetta CONVERT da NVARCHAR
            const auditUuidStr = (audit_uuid != null && String(audit_uuid).trim()) ? String(audit_uuid).trim() : null;
            if (!auditUuidStr) {
                return res.status(400).json({
                    error: 'audit_uuid obbligatorio per creare un audit',
                    code: 'VALIDATION_ERROR'
                });
            }

            // Determina lo standard principale da salvare nella colonna standard_id:
            // - se ci sono standard selezionati (solo ISO o audit ibrido), usa il primo di standardIdsToSync
            // - se NON ci sono standard ma esiste una checklist personalizzata, lascia NULL (solo checklist custom)
            // - altrimenti (nessuno standard e nessuna checklist custom), fallback a 1 (ISO 9001)
            const hasCustomChecklist = parsedCustomChecklistId != null;
            const hasTypeInfo = hasCustomChecklist || bodyHasStandardsArray || bodyHasStandardField;
            if (!hasTypeInfo) {
                return res.status(400).json({
                    error: 'Tipologia audit mancante: specificare standard_id/standard_ids oppure custom_checklist_id',
                    code: 'MISSING_AUDIT_TYPE'
                });
            }
            const standardIdsToSync = Array.isArray(standard_ids) && standard_ids.length > 0
                ? standard_ids.map(id => parseInt(id)).filter(id => !isNaN(id) && id > 0)
                : (hasCustomChecklist ? [] : [parseInt(standard_id) || 1]);
            const hasAnyStandard = Array.isArray(standardIdsToSync) && standardIdsToSync.length > 0;
            const stdIdForMainColumn = hasAnyStandard
                ? standardIdsToSync[0]
                : (hasCustomChecklist ? null : 1);

            // Usiamo table variable per OUTPUT (compatibilità trigger SQL Server)
            const result = await query(`
        DECLARE @out TABLE (audit_id INT, audit_uuid UNIQUEIDENTIFIER, updated_at DATETIME2);
        INSERT INTO audits (
          audit_uuid,
          audit_number,
          client_name,
          company_id,
          project_year,
          audit_date,
          auditor_name,
          audit_type,
          status,
          notes,
          total_questions,
          answered_questions,
          conformities_count,
          non_conformities_count,
          completion_percentage,
          standard_id,
          custom_checklist_id,
          audit_extra_data,
          organization_id,
          created_by,
          created_at,
          updated_at,
          is_deleted
        )
        OUTPUT INSERTED.audit_id, INSERTED.audit_uuid, INSERTED.updated_at INTO @out
        VALUES (
          CONVERT(UNIQUEIDENTIFIER, @audit_uuid),
          @audit_number,
          @client_name,
          @company_id,
          @project_year,
          @audit_date,
          @auditor_name,
          @audit_type,
          @status,
          @notes,
          @total_questions,
          @answered_questions,
          @conformities_count,
          @non_conformities_count,
          @completion_percentage,
          @standard_id,
          @custom_checklist_id,
          @audit_extra_data,
          @organization_id,
          @user_id,
          GETDATE(),
          GETDATE(),
          0
        );
        SELECT audit_id, audit_uuid, updated_at FROM @out;
      `, {
                audit_uuid: auditUuidStr,
                audit_number,
                client_name,
                company_id: company_id || null,
                project_year: project_year || new Date().getFullYear(),
                audit_date: audit_date || new Date().toISOString(),
                auditor_name: auditor_name || 'Non specificato',
                audit_type: audit_type || 'internal',
                status: status || 'draft',
                notes: notes || null,
                total_questions: total_questions || 78,
                answered_questions: answered_questions || 0,
                conformities_count: conformities_count || 0,
                non_conformities_count: non_conformities_count || 0,
                completion_percentage: completion_percentage || 0,
                standard_id: stdIdForMainColumn,
                custom_checklist_id: hasCustomChecklist ? parsedCustomChecklistId : null,
                audit_extra_data: audit_extra_data ? JSON.stringify(audit_extra_data) : null,
                organization_id,
                user_id
            });

            const newAudit = result.recordset[0];

            // Inserisce in audit_standards (junction table) per tutti gli standard selezionati
            try {
                for (const stdId of standardIdsToSync) {
                    await query(
                        'IF NOT EXISTS (SELECT 1 FROM audit_standards WHERE audit_id=@audit_id AND standard_id=@standard_id) INSERT INTO audit_standards (audit_id, standard_id) VALUES (@audit_id, @standard_id)',
                        { audit_id: newAudit.audit_id, standard_id: stdId }
                    );
                }
                logger.info(`[UPSERT] audit_standards inseriti per nuovo audit ${newAudit.audit_id}: [${standardIdsToSync.join(',')}]`);
            } catch (e) { logger.warn('[UPSERT] audit_standards insert failed:', e.message); }

            logger.info(`[UPSERT] Audit creato: ${newAudit.audit_id} (${newAudit.audit_uuid})`);

            return res.status(201).json({
                audit_id: newAudit.audit_id,
                audit_uuid: newAudit.audit_uuid,
                action: 'created',
                updated_at: newAudit.updated_at,
                message: 'Audit creato con successo'
            });
        }

    } catch (error) {
        logger.error('[UPSERT] Errore upsert audit:', { message: error.message, stack: error.stack });
        return res.status(500).json({
            error: 'Errore server durante upsert audit',
            code: 'SERVER_ERROR',
            details: error.message,
            hint: 'Verifica i log del backend per lo stack trace completo.'
        });
    }
}

/**
 * GET /api/v1/audits/:id/pending-issues
 * Recupera le pending issues (NC/OSS non risolte) dall'ultimo audit completato dello stesso cliente
 * @route GET /api/v1/audits/:id/pending-issues
 * @access Private (require auth)
 */
async function getPendingIssues(req, res) {
    const { id: audit_id } = req.params;
    const { organization_id } = req.user;

    try {
        logger.info(`[PENDING_ISSUES] Audit ID: ${audit_id}`);

        // Step 1: Trova il client_name dell'audit corrente
        const currentAuditResult = await query(`
            SELECT audit_id, client_name, audit_date
            FROM audits
            WHERE (audit_id = TRY_CAST(@audit_id AS INT) OR audit_uuid = @audit_id) AND organization_id = @organization_id
        `, { audit_id, organization_id });

        if (!currentAuditResult.recordset || currentAuditResult.recordset.length === 0) {
            logger.warn(`[PENDING_ISSUES] Audit ${audit_id} non trovato`);
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        const { client_name, audit_date: current_audit_date } = currentAuditResult.recordset[0];
        logger.info(`[PENDING_ISSUES] Cliente: ${client_name}, Data: ${current_audit_date}`);

        // Step 2: Trova l'ultimo audit COMPLETATO dello stesso cliente (data precedente)
        const lastAuditResult = await query(`
            SELECT TOP 1 audit_id
            FROM audits
            WHERE organization_id = @organization_id
            AND client_name = @client_name
            AND audit_date < @current_audit_date
            AND status IN ('completed', 'finalized')
            ORDER BY audit_date DESC
        `, { organization_id, client_name, current_audit_date });

        // Se non esiste audit precedente → nessuna pending issue
        if (!lastAuditResult.recordset || lastAuditResult.recordset.length === 0) {
            logger.info(`[PENDING_ISSUES] Nessun audit precedente per cliente ${client_name}`);
            return res.json({
                pending_issues: [],
                source_audit_id: null,
                message: 'Nessun audit precedente trovato per questo cliente'
            });
        }

        const source_audit_id = lastAuditResult.recordset[0].audit_id;
        logger.info(`[PENDING_ISSUES] Ultimo audit completato: ${source_audit_id}`);

        // Step 3: Trova pending issues NON RISOLTE dall'ultimo audit
        const pendingIssuesResult = await query(`
            SELECT 
                pi.issue_id,
                pi.source_audit_id,
                pi.nc_id,
                pi.status AS issue_status,
                pi.follow_up_notes,
                pi.created_at,
                pi.updated_at,
                nc.nc_number,
                nc.nc_type,
                nc.description AS nc_description,
                nc.severity,
                nc.category,
                nc.requirement_reference,
                nc.section_id
            FROM pending_issues pi
            INNER JOIN non_conformities nc ON pi.nc_id = nc.nc_id
            WHERE pi.source_audit_id = @source_audit_id
            AND pi.status IN ('open', 'in_progress')
            ORDER BY nc.severity DESC, pi.created_at DESC
        `, { source_audit_id });

        const pendingIssues = pendingIssuesResult.recordset || [];
        logger.info(`[PENDING_ISSUES] Trovate ${pendingIssues.length} pending issues`);

        return res.json({
            pending_issues: pendingIssues,
            source_audit_id,
            count: pendingIssues.length
        });

    } catch (error) {
        logger.error('[PENDING_ISSUES] Errore:', error);
        return res.status(500).json({
            error: 'Errore server durante recupero pending issues',
            code: 'SERVER_ERROR',
            details: error.message
        });
    }
}

/**
 * POST /api/v1/audits/check-reaudit
 * Verifica se esiste un audit precedente per il cliente e quanti rilievi aperti ha
 * Body: { client_name }
 * Response: { has_previous_audit, pending_count, last_audit_id, last_audit_date }
 */
async function checkReaudit(req, res) {
    const { organization_id } = req.user;
    const { client_name, current_audit_uuid } = req.body;

    if (!client_name || !client_name.trim()) {
        return res.status(400).json({
            error: 'client_name obbligatorio',
            code: 'MISSING_CLIENT_NAME'
        });
    }

    try {
        // 1. Trova il più recente audit dello stesso cliente che abbia almeno 1 NC/OSS/OM
        //    (non necessariamente l'ultimo in assoluto: un re-audit vuoto non deve
        //     nascondere le NC dell'audit ancora più precedente)
        const lastAuditResult = await query(`
            SELECT TOP 1
                a.audit_id,
                a.audit_date,
                a.audit_number,
                COUNT(ar.response_id) AS pending_count
            FROM audits a
            JOIN audit_responses ar
              ON ar.audit_id = a.audit_id
             AND ar.conformity_status IN ('NC', 'OSS', 'NV')
            WHERE a.organization_id = @organization_id
              AND a.client_name = @client_name
              AND (@exclude_uuid IS NULL OR a.audit_uuid <> TRY_CAST(@exclude_uuid AS UNIQUEIDENTIFIER))
            GROUP BY a.audit_id, a.audit_date, a.audit_number
            ORDER BY a.audit_date DESC, a.audit_id DESC
        `, { organization_id, client_name: client_name.trim(), exclude_uuid: current_audit_uuid || null });

        if (!lastAuditResult.recordset || lastAuditResult.recordset.length === 0) {
            return res.json({
                has_previous_audit: false,
                pending_count: 0,
                last_audit_id: null,
                last_audit_date: null
            });
        }

        const lastAudit = lastAuditResult.recordset[0];
        const pending_count = lastAudit.pending_count || 0;

        logger.info('[CHECK_REAUDIT]', { client_name, last_audit_id: lastAudit.audit_id, pending_count });

        return res.json({
            has_previous_audit: true,
            pending_count,
            last_audit_id: lastAudit.audit_id,
            last_audit_date: lastAudit.audit_date,
            last_audit_number: lastAudit.audit_number
        });

    } catch (error) {
        logger.error('[CHECK_REAUDIT] Errore:', error);
        return res.status(500).json({
            error: 'Errore server',
            code: 'SERVER_ERROR'
        });
    }
}


/**
 * Salva in bulk le risposte checklist (UPSERT)
 * POST /api/v1/audits/:id/responses/bulk
 * Body: { responses: [{question_id, conformity_status, notes, evidence}] }
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function bulkSaveResponses(req, res) {
    const { id: auditUuid } = req.params;
    const { responses } = req.body;
    const organizationId = req.user?.organization_id;

    if (!responses || !Array.isArray(responses) || responses.length === 0) {
        return res.status(400).json({ error: 'Nessuna risposta fornita', code: 'NO_RESPONSES' });
    }

    try {
        // Recupera audit_id interno dalla UUID
        const auditResult = await query(
            'SELECT audit_id FROM audits WHERE audit_uuid = @audit_uuid AND organization_id = @org_id',
            { audit_uuid: auditUuid, org_id: organizationId }
        );
        if (!auditResult.recordset?.length) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const auditId = auditResult.recordset[0].audit_id;

        let saved = 0;
        const errors = [];

        for (const resp of responses) {
            const { question_id, conformity_status, notes } = resp;

            if (!question_id) {
                errors.push({ question_id: null, error: 'question_id mancante' });
                continue;
            }

            try {
                await query(
                    `MERGE audit_responses AS target
                     USING (SELECT @audit_id AS audit_id, @question_id AS question_id) AS source
                     ON target.audit_id = source.audit_id AND target.question_id = source.question_id
                     WHEN MATCHED THEN
                         UPDATE SET conformity_status = @conformity_status,
                                    notes = @notes,
                                    is_answered = 1,
                                    updated_at = GETDATE()
                     WHEN NOT MATCHED THEN
                         INSERT (response_uuid, audit_id, question_id, conformity_status, notes, is_answered, created_at, updated_at)
                         VALUES (NEWID(), @audit_id, @question_id, @conformity_status, @notes, 1, GETDATE(), GETDATE());`,
                    {
                        audit_id: auditId,
                        question_id: Number(question_id),
                        conformity_status: conformity_status || null,
                        notes: notes || null
                    }
                );
                saved++;
            } catch (e) {
                logger.warn('[BULK_RESPONSES] Errore riga:', { question_id, error: e.message });
                errors.push({ question_id, error: e.message });
            }
        }

        logger.info(`[BULK_RESPONSES] audit_uuid=${auditUuid} saved=${saved} errors=${errors.length}`);
        return res.json({ saved, errors, total: responses.length });

    } catch (error) {
        logger.error('[BULK_RESPONSES] Errore generale:', error);
        return res.status(500).json({ error: 'Errore server', code: 'SERVER_ERROR' });
    }
}


/**
 * GET /api/v1/audits/:id/nc-responses
 * Restituisce le risposte NC/OSS/OM di un audit specifico (per pre-visualizzazione rilievi nel re-audit modal)
 * :id = audit_id INTEGER
 */
async function getNcResponses(req, res) {
    const { id: audit_id } = req.params;
    const { organization_id } = req.user;

    try {
        const result = await query(
            `SELECT
                ar.response_id,
                ar.question_id,
                ar.conformity_status,
                ar.notes,
                ar.updated_at,
                cq.question_text,
                cq.section_code
             FROM audit_responses ar
             LEFT JOIN checklist_questions cq ON ar.question_id = cq.question_id
             JOIN audits a ON ar.audit_id = a.audit_id
             WHERE (ar.audit_id = TRY_CAST(@audit_id AS INT) OR a.audit_uuid = @audit_id)
               AND a.organization_id = @organization_id
               AND ar.conformity_status IN ('NC', 'OSS', 'NV')
             ORDER BY ar.conformity_status, cq.section_code`,
            { audit_id: String(audit_id), organization_id }
        );

        return res.json({
            responses: result.recordset || [],
            audit_id: Number(audit_id),
            total: result.recordset?.length || 0
        });

    } catch (error) {
        logger.error('[NC_RESPONSES] Errore:', error);
        return res.status(500).json({ error: 'Errore server', code: 'SERVER_ERROR' });
    }
}

module.exports = {
    listAudits,
    getAuditById,
    createAudit,
    updateAudit,
    deleteAudit,
    getAuditStatistics,
    upsertAudit,
    getPendingIssues,
    checkReaudit,
    bulkSaveResponses,
    getNcResponses
};
