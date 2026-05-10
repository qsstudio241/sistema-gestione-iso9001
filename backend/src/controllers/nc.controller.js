/**
 * Non-Conformities Controller
 * Gestisce il workflow completo delle non conformità (NC)
 * 
 * Stati NC: open → in_progress → resolved → verified → closed
 * Severità: major (grave), minor (lieve), observation (osservazione)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /api/v1/non-conformities
 * Lista NC con filtri
 * 
 * Query params:
 * - audit_id: filter by audit
 * - status: filter by status (open, in_progress, resolved, verified, closed)
 * - severity: filter by severity (major, minor, observation)
 * - overdue: true/false (scadute)
 * - page: pagination (default 1)
 * - limit: items per page (default 50)
 */
async function listNonConformities(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            audit_id,
            status,
            severity,
            overdue,
            page = 1,
            limit = 50
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build WHERE clause dinamicamente
        let whereConditions = ['a.organization_id = @organization_id'];
        let params = { organization_id, limit: parseInt(limit), offset };

        if (audit_id) {
            whereConditions.push('nc.audit_id = @audit_id');
            params.audit_id = parseInt(audit_id);
        }

        if (status) {
            whereConditions.push('nc.status = @status');
            params.status = status;
        }

        if (severity) {
            whereConditions.push('nc.severity = @severity');
            params.severity = severity;
        }

        if (overdue === 'true') {
            whereConditions.push('nc.due_date < CAST(GETDATE() AS DATE)');
            whereConditions.push('nc.status NOT IN (\'closed\', \'verified\')');
        }

        const whereClause = whereConditions.join(' AND ');

        // Query principale
        const result = await query(`
      SELECT 
        nc.*,
        a.audit_number,
        a.client_name,
        cs.section_title,
        (SELECT COUNT(*) FROM attachments WHERE nc_id = nc.nc_id) AS attachments_count,
        CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 
          ELSE 0 
        END AS is_overdue
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      INNER JOIN checklist_sections cs ON nc.section_code = cs.section_code
      WHERE ${whereClause}
      ORDER BY 
        CASE nc.severity WHEN 'major' THEN 1 WHEN 'minor' THEN 2 ELSE 3 END,
        nc.created_at DESC
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `, params);

        // Count totale
        const countResult = await query(`
      SELECT COUNT(*) AS total
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE ${whereClause}
    `, params);

        const total = countResult.recordset[0].total;

        logger.info('NC list retrieved', {
            organization_id,
            count: result.recordset.length,
            filters: { audit_id, status, severity, overdue }
        });

        res.json({
            success: true,
            data: result.recordset,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('Error listing NC', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero delle non conformità',
            code: 'NC_LIST_ERROR'
        });
    }
}

/**
 * GET /api/v1/non-conformities/:id
 * Dettagli singola NC
 */
async function getNonConformityById(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        const result = await query(`
      SELECT 
        nc.*,
        a.audit_number,
        a.audit_uuid,
        a.client_name,
        a.audit_date,
        cs.section_title,
        (SELECT COUNT(*) FROM attachments WHERE nc_id = nc.nc_id) AS attachments_count,
        CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 
          ELSE 0 
        END AS is_overdue
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      INNER JOIN checklist_sections cs ON nc.section_code = cs.section_code
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id
    `, { id: parseInt(id), organization_id });

        if (result.recordset.length === 0) {
            return res.status(404).json({
                error: 'Non conformità non trovata',
                code: 'NC_NOT_FOUND'
            });
        }

        const nc = result.recordset[0];

        // Recupera allegati
        const attachmentsResult = await query(`
      SELECT 
        attachment_id,
        attachment_uuid,
        file_name,
        file_type,
        file_size,
        mime_type,
        category,
        description,
        created_at
      FROM attachments
      WHERE nc_id = @id
      ORDER BY created_at DESC
    `, { id: parseInt(id) });

        nc.attachments = attachmentsResult.recordset;

        logger.info('NC retrieved', { nc_id: id, organization_id });

        res.json({
            success: true,
            data: nc
        });

    } catch (error) {
        logger.error('Error getting NC', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero della non conformità',
            code: 'NC_GET_ERROR'
        });
    }
}

/**
 * POST /api/v1/non-conformities
 * Crea nuova NC
 * 
 * Body:
 * {
 *   audit_id: number (REQUIRED),
 *   nc_number: string (REQUIRED, unique),
 *   section_code: string (REQUIRED, es. "4.1"),
 *   description: string (REQUIRED),
 *   severity: 'major' | 'minor' | 'observation' (REQUIRED),
 *   responsible_person?: string,
 *   due_date?: date,
 *   corrective_action?: string
 * }
 */
async function createNonConformity(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            audit_id,
            nc_number,
            section_code,
            description,
            severity,
            responsible_person,
            due_date,
            corrective_action
        } = req.body;

        // Validazione campi obbligatori
        if (!audit_id || !nc_number || !section_code || !description || !severity) {
            return res.status(400).json({
                error: 'Campi obbligatori mancanti',
                code: 'VALIDATION_ERROR',
                required: ['audit_id', 'nc_number', 'section_code', 'description', 'severity']
            });
        }

        // Verifica severity valida
        if (!['major', 'minor', 'observation'].includes(severity)) {
            return res.status(400).json({
                error: 'Severità non valida',
                code: 'VALIDATION_ERROR',
                allowed: ['major', 'minor', 'observation']
            });
        }

        // Verifica che audit appartenga all'organizzazione
        const auditCheck = await query(`
      SELECT audit_id FROM audits
      WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0
    `, { audit_id: parseInt(audit_id), organization_id });

        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        // Recupera il primo standard_id dalla junction table audit_standards
        const standardResult = await query(`
      SELECT TOP 1 standard_id FROM audit_standards
      WHERE audit_id = @audit_id
    `, { audit_id: parseInt(audit_id) });

        if (standardResult.recordset.length === 0) {
            return res.status(400).json({
                error: 'Audit non ha standard associati',
                code: 'NO_STANDARDS_FOUND'
            });
        }

        const standard_id = standardResult.recordset[0].standard_id;

        // Verifica unicità nc_number nell'organizzazione (scoped per tenant)
        const existingNC = await query(`
      SELECT nc.nc_id FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_number = @nc_number AND a.organization_id = @organization_id
    `, { nc_number, organization_id });

        if (existingNC.recordset.length > 0) {
            return res.status(409).json({
                error: 'Numero NC già esistente in questa organizzazione',
                code: 'NC_NUMBER_DUPLICATE'
            });
        }

        // Crea NC
        const result = await query(`
      INSERT INTO non_conformities (
        audit_id,
        standard_id,
        nc_number,
        section_code,
        description,
        severity,
        responsible_person,
        due_date,
        corrective_action,
        status,
        created_at,
        updated_at
      )
      OUTPUT INSERTED.nc_id, INSERTED.nc_uuid
      VALUES (
        @audit_id,
        @standard_id,
        @nc_number,
        @section_code,
        @description,
        @severity,
        @responsible_person,
        @due_date,
        @corrective_action,
        'open',
        GETDATE(),
        GETDATE()
      )
    `, {
            audit_id: parseInt(audit_id),
            standard_id: parseInt(standard_id),
            nc_number,
            section_code,
            description,
            severity,
            responsible_person: responsible_person || null,
            due_date: due_date || null,
            corrective_action: corrective_action || null
        });

        const newNC = result.recordset[0];

        // Aggiorna contatore NC nell'audit
        await query(`
      UPDATE audits
      SET non_conformities_count = (
        SELECT COUNT(*) FROM non_conformities WHERE audit_id = @audit_id
      ),
      updated_at = GETDATE()
      WHERE audit_id = @audit_id
    `, { audit_id: parseInt(audit_id) });

        logger.info('NC created', {
            nc_id: newNC.nc_id,
            audit_id,
            organization_id,
            severity
        });

        res.status(201).json({
            success: true,
            data: {
                nc_id: newNC.nc_id,
                nc_uuid: newNC.nc_uuid,
                nc_number,
                status: 'open'
            }
        });

    } catch (error) {
        logger.error('Error creating NC', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante la creazione della non conformità',
            code: 'NC_CREATE_ERROR'
        });
    }
}

/**
 * PUT /api/v1/non-conformities/:id
 * Aggiorna NC esistente
 * 
 * Body: campi opzionali da aggiornare
 */
async function updateNonConformity(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;
        const {
            description,
            severity,
            corrective_action,
            responsible_person,
            due_date,
            status,
            resolution_date,
            verification_notes
        } = req.body;

        // Verifica esistenza e ownership
        const existingNC = await query(`
      SELECT nc.nc_id, nc.status AS current_status, a.audit_id
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id
    `, { id: parseInt(id), organization_id });

        if (existingNC.recordset.length === 0) {
            return res.status(404).json({
                error: 'Non conformità non trovata',
                code: 'NC_NOT_FOUND'
            });
        }

        const currentStatus = existingNC.recordset[0].current_status;
        const audit_id = existingNC.recordset[0].audit_id;

        // Build UPDATE dinamicamente
        const updates = [];
        const params = { id: parseInt(id) };

        if (description !== undefined) {
            updates.push('description = @description');
            params.description = description;
        }
        if (severity !== undefined) {
            if (!['major', 'minor', 'observation'].includes(severity)) {
                return res.status(400).json({
                    error: 'Severità non valida',
                    code: 'VALIDATION_ERROR'
                });
            }
            updates.push('severity = @severity');
            params.severity = severity;
        }
        if (corrective_action !== undefined) {
            updates.push('corrective_action = @corrective_action');
            params.corrective_action = corrective_action;
        }
        if (responsible_person !== undefined) {
            updates.push('responsible_person = @responsible_person');
            params.responsible_person = responsible_person;
        }
        if (due_date !== undefined) {
            updates.push('due_date = @due_date');
            params.due_date = due_date;
        }
        if (resolution_date !== undefined) {
            updates.push('resolution_date = @resolution_date');
            params.resolution_date = resolution_date;
        }
        if (verification_notes !== undefined) {
            updates.push('verification_notes = @verification_notes');
            params.verification_notes = verification_notes;
        }

        // Gestione transizione stato (con validazione workflow)
        if (status !== undefined) {
            const validTransitions = {
                'open': ['in_progress', 'closed'],
                'in_progress': ['resolved', 'open'],
                'resolved': ['verified', 'in_progress'],
                'verified': ['closed', 'in_progress'],
                'closed': [] // NC chiusa non può cambiare stato
            };

            if (!validTransitions[currentStatus].includes(status)) {
                return res.status(400).json({
                    error: `Transizione di stato non valida: ${currentStatus} → ${status}`,
                    code: 'INVALID_STATE_TRANSITION',
                    currentStatus,
                    allowedTransitions: validTransitions[currentStatus]
                });
            }

            updates.push('status = @status');
            params.status = status;

            // Auto-set resolution_date quando si passa a 'resolved'
            if (status === 'resolved' && resolution_date === undefined) {
                updates.push('resolution_date = CAST(GETDATE() AS DATE)');
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Nessun campo da aggiornare',
                code: 'VALIDATION_ERROR'
            });
        }

        updates.push('updated_at = GETDATE()');

        // Update NC
        await query(`
      UPDATE non_conformities
      SET ${updates.join(', ')}
      WHERE nc_id = @id
    `, params);

        // Aggiorna contatore NC nell'audit se necessario
        await query(`
      UPDATE audits
      SET non_conformities_count = (
        SELECT COUNT(*) FROM non_conformities WHERE audit_id = @audit_id
      ),
      updated_at = GETDATE()
      WHERE audit_id = @audit_id
    `, { audit_id });

        logger.info('NC updated', {
            nc_id: id,
            organization_id,
            updates: Object.keys(params),
            statusTransition: status ? `${currentStatus} → ${status}` : null
        });

        res.json({
            success: true,
            message: 'Non conformità aggiornata con successo'
        });

    } catch (error) {
        logger.error('Error updating NC', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'aggiornamento della non conformità',
            code: 'NC_UPDATE_ERROR'
        });
    }
}

/**
 * DELETE /api/v1/non-conformities/:id
 * Elimina NC (hard delete - CASCADE su attachments)
 */
async function deleteNonConformity(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Verifica esistenza e ownership
        const existingNC = await query(`
      SELECT nc.nc_id, a.audit_id
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id
    `, { id: parseInt(id), organization_id });

        if (existingNC.recordset.length === 0) {
            return res.status(404).json({
                error: 'Non conformità non trovata',
                code: 'NC_NOT_FOUND'
            });
        }

        const audit_id = existingNC.recordset[0].audit_id;

        // Delete NC (CASCADE elimina anche attachments)
        await query(`
      DELETE FROM non_conformities WHERE nc_id = @id
    `, { id: parseInt(id) });

        // Aggiorna contatore NC nell'audit
        await query(`
      UPDATE audits
      SET non_conformities_count = (
        SELECT COUNT(*) FROM non_conformities WHERE audit_id = @audit_id
      ),
      updated_at = GETDATE()
      WHERE audit_id = @audit_id
    `, { audit_id });

        logger.info('NC deleted', { nc_id: id, organization_id });

        res.json({
            success: true,
            message: 'Non conformità eliminata con successo'
        });

    } catch (error) {
        logger.error('Error deleting NC', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante l\'eliminazione della non conformità',
            code: 'NC_DELETE_ERROR'
        });
    }
}

/**
 * GET /api/v1/non-conformities/statistics/overview
 * Statistiche generali NC per organizzazione
 */
async function getNonConformitiesStatistics(req, res) {
    try {
        const { organization_id } = req.user;

        // Statistiche aggregate
        const statsResult = await query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN nc.status = 'open' THEN 1 ELSE 0 END) AS open,
        SUM(CASE WHEN nc.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN nc.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN nc.status = 'verified' THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN nc.status = 'closed' THEN 1 ELSE 0 END) AS closed,
        SUM(CASE WHEN nc.severity = 'major' THEN 1 ELSE 0 END) AS major,
        SUM(CASE WHEN nc.severity = 'minor' THEN 1 ELSE 0 END) AS minor,
        SUM(CASE WHEN nc.severity = 'observation' THEN 1 ELSE 0 END) AS observations,
        SUM(CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) 
            AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 ELSE 0 
        END) AS overdue
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE a.organization_id = @organization_id
    `, { organization_id });

        logger.info('NC statistics retrieved', { organization_id });

        res.json({
            success: true,
            data: statsResult.recordset[0]
        });

    } catch (error) {
        logger.error('Error getting NC statistics', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante il recupero delle statistiche',
            code: 'NC_STATS_ERROR'
        });
    }
}

// ─── NC ACTIONS ─────────────────────────────────────────────────────────────

/**
 * GET /api/v1/non-conformities/:id/actions
 * Lista azioni correttive per una NC
 */
async function listNcActions(req, res) {
    try {
        const { id } = req.params;
        const { organization_id } = req.user;

        // Verifica ownership NC
        const ncCheck = await query(`
            SELECT nc.nc_id FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE nc.nc_id = @id AND a.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (ncCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Non conformità non trovata', code: 'NC_NOT_FOUND' });
        }

        const result = await query(`
            SELECT a.*, u.full_name AS created_by_name
            FROM nc_actions a
            LEFT JOIN users u ON a.created_by = u.user_id
            WHERE a.nc_id = @id
            ORDER BY a.created_at ASC
        `, { id: parseInt(id) });

        res.json({ success: true, data: result.recordset });
    } catch (error) {
        logger.error('Error listing nc_actions', { error: error.message });
        res.status(500).json({ error: 'Errore recupero azioni', code: 'NC_ACTIONS_LIST_ERROR' });
    }
}

/**
 * POST /api/v1/non-conformities/:id/actions
 * Crea una nuova azione correttiva per una NC
 */
async function createNcAction(req, res) {
    try {
        const { id } = req.params;
        const { user_id, organization_id } = req.user;
        const { action_type = 'corrective', description, responsible, due_date } = req.body;

        if (!description) {
            return res.status(400).json({ error: 'Descrizione obbligatoria', code: 'VALIDATION_ERROR' });
        }
        if (!['immediate', 'corrective', 'preventive'].includes(action_type)) {
            return res.status(400).json({
                error: 'Tipo azione non valido',
                code: 'VALIDATION_ERROR',
                allowed: ['immediate', 'corrective', 'preventive']
            });
        }

        // Verifica ownership NC
        const ncCheck = await query(`
            SELECT nc.nc_id FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE nc.nc_id = @id AND a.organization_id = @organization_id
        `, { id: parseInt(id), organization_id });

        if (ncCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Non conformità non trovata', code: 'NC_NOT_FOUND' });
        }

        const result = await query(`
            INSERT INTO nc_actions (nc_id, action_type, description, responsible, due_date, created_by)
            OUTPUT INSERTED.action_id
            VALUES (@nc_id, @action_type, @description, @responsible, @due_date, @created_by)
        `, {
            nc_id: parseInt(id),
            action_type,
            description,
            responsible: responsible || null,
            due_date: due_date || null,
            created_by: user_id
        });

        // Auto-transizione NC a in_progress se era open
        await query(`
            UPDATE non_conformities
            SET status = 'in_progress', updated_at = GETDATE()
            WHERE nc_id = @id AND status = 'open'
        `, { id: parseInt(id) });

        logger.info('NC action created', { nc_id: id, action_id: result.recordset[0].action_id, organization_id });

        res.status(201).json({ success: true, data: { action_id: result.recordset[0].action_id } });
    } catch (error) {
        logger.error('Error creating nc_action', { error: error.message });
        res.status(500).json({ error: 'Errore creazione azione', code: 'NC_ACTION_CREATE_ERROR' });
    }
}

/**
 * PUT /api/v1/non-conformities/:id/actions/:actionId
 * Aggiorna stato/dettagli di un'azione correttiva
 */
async function updateNcAction(req, res) {
    try {
        const { id, actionId } = req.params;
        const { organization_id } = req.user;
        const { status, description, responsible, due_date, verification_note } = req.body;

        // Verifica ownership
        const check = await query(`
            SELECT a.action_id, a.status AS current_status
            FROM nc_actions a
            INNER JOIN non_conformities nc ON a.nc_id = nc.nc_id
            INNER JOIN audits au ON nc.audit_id = au.audit_id
            WHERE a.action_id = @actionId AND nc.nc_id = @nc_id
              AND au.organization_id = @organization_id
        `, { actionId: parseInt(actionId), nc_id: parseInt(id), organization_id });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azione non trovata', code: 'NC_ACTION_NOT_FOUND' });
        }

        const updates = [];
        const params = { actionId: parseInt(actionId) };

        if (description !== undefined) { updates.push('description = @description'); params.description = description; }
        if (responsible !== undefined) { updates.push('responsible = @responsible'); params.responsible = responsible; }
        if (due_date !== undefined) { updates.push('due_date = @due_date'); params.due_date = due_date; }
        if (verification_note !== undefined) { updates.push('verification_note = @verification_note'); params.verification_note = verification_note; }

        if (status !== undefined) {
            const validTransitions = {
                'open': ['in_progress', 'completed'],
                'in_progress': ['completed', 'open'],
                'completed': ['verified', 'in_progress'],
                'verified': []
            };
            const current = check.recordset[0].current_status;
            if (!validTransitions[current]?.includes(status)) {
                return res.status(400).json({
                    error: `Transizione non valida: ${current} → ${status}`,
                    code: 'INVALID_STATE_TRANSITION',
                    allowedTransitions: validTransitions[current]
                });
            }
            updates.push('status = @status');
            params.status = status;
            if (status === 'completed') {
                updates.push('completed_at = GETDATE()');
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'Nessun campo da aggiornare', code: 'VALIDATION_ERROR' });
        }
        updates.push('updated_at = GETDATE()');

        await query(`
            UPDATE nc_actions SET ${updates.join(', ')}
            WHERE action_id = @actionId
        `, params);

        // Se tutte le azioni sono verified → auto-chiudi NC
        if (status === 'verified') {
            const openActions = await query(`
                SELECT COUNT(*) AS cnt FROM nc_actions
                WHERE nc_id = @nc_id AND status NOT IN ('verified')
            `, { nc_id: parseInt(id) });

            if (openActions.recordset[0].cnt === 0) {
                await query(`
                    UPDATE non_conformities
                    SET status = 'verified', updated_at = GETDATE()
                    WHERE nc_id = @nc_id AND status NOT IN ('closed', 'verified')
                `, { nc_id: parseInt(id) });
            }
        }

        logger.info('NC action updated', { action_id: actionId, status, organization_id });
        res.json({ success: true, message: 'Azione aggiornata' });
    } catch (error) {
        logger.error('Error updating nc_action', { error: error.message });
        res.status(500).json({ error: 'Errore aggiornamento azione', code: 'NC_ACTION_UPDATE_ERROR' });
    }
}

/**
 * DELETE /api/v1/non-conformities/:id/actions/:actionId
 * Elimina un'azione correttiva
 */
async function deleteNcAction(req, res) {
    try {
        const { id, actionId } = req.params;
        const { organization_id } = req.user;

        const check = await query(`
            SELECT a.action_id FROM nc_actions a
            INNER JOIN non_conformities nc ON a.nc_id = nc.nc_id
            INNER JOIN audits au ON nc.audit_id = au.audit_id
            WHERE a.action_id = @actionId AND nc.nc_id = @nc_id
              AND au.organization_id = @organization_id
        `, { actionId: parseInt(actionId), nc_id: parseInt(id), organization_id });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azione non trovata', code: 'NC_ACTION_NOT_FOUND' });
        }

        await query(`DELETE FROM nc_actions WHERE action_id = @actionId`, { actionId: parseInt(actionId) });

        logger.info('NC action deleted', { action_id: actionId, organization_id });
        res.json({ success: true, message: 'Azione eliminata' });
    } catch (error) {
        logger.error('Error deleting nc_action', { error: error.message });
        res.status(500).json({ error: 'Errore eliminazione azione', code: 'NC_ACTION_DELETE_ERROR' });
    }
}

/**
 * POST /api/v1/audits/:auditRef/push-to-nc-register
 * Trasferisce automaticamente NC e OSS rilevate nella checklist di un audit
 * dentro al modulo organizzativo NC (non_conformities), creando un record per ogni
 * domanda con conformity_status IN ('NC','OSS').
 *
 * Idempotente: se per (audit_id, source_question_id) esiste gia una NC, viene saltata
 * (indice univoco IX_nc_audit_question_unique).
 *
 * Restituisce { created: [...], skipped: [...] } cosi la UI puo mostrare riepilogo.
 *
 * NOTE: l'endpoint richiede la licenza modulo 'nc' (gia applicata via router).
 */
async function pushAuditToNcRegister(req, res) {
    try {
        const { auditRef } = req.params;
        const { organization_id, user_id } = req.user;

        // Risoluzione audit (INT o UUID)
        const auditRow = await query(`
            SELECT a.audit_id, a.audit_number, a.organization_id
            FROM audits a
            WHERE (a.audit_id = TRY_CAST(@auditRef AS INT) OR a.audit_uuid = @auditRef)
              AND a.organization_id = @organization_id
              AND a.is_deleted = 0
        `, { auditRef, organization_id });

        if (!auditRow.recordset || auditRow.recordset.length === 0) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const audit_id = auditRow.recordset[0].audit_id;
        const audit_number = auditRow.recordset[0].audit_number;

        // Prendi tutte le risposte NC/OSS dell'audit, con dettaglio domanda
        const findingsRes = await query(`
            SELECT
                ar.response_id,
                ar.question_id,
                ar.conformity_status,
                ar.notes,
                cq.section_code,
                cq.question_text
            FROM audit_responses ar
            INNER JOIN checklist_questions cq ON ar.question_id = cq.question_id
            WHERE ar.audit_id = @audit_id
              AND ar.conformity_status IN ('NC', 'OSS')
              AND ar.is_deleted = 0
            ORDER BY cq.section_code, ar.question_id
        `, { audit_id });

        const findings = findingsRes.recordset || [];

        // Standard di riferimento (primo della junction)
        const standardRes = await query(`
            SELECT TOP 1 standard_id FROM audit_standards WHERE audit_id = @audit_id
        `, { audit_id });
        const standard_id = standardRes.recordset?.[0]?.standard_id || null;

        // Recupera nc_id gia esistenti per questo audit (idempotenza)
        const existingNcRes = await query(`
            SELECT source_question_id, nc_id, nc_number, status
            FROM non_conformities
            WHERE audit_id = @audit_id AND source_question_id IS NOT NULL
        `, { audit_id });
        const existingByQid = {};
        (existingNcRes.recordset || []).forEach(r => {
            if (r.source_question_id != null) existingByQid[r.source_question_id] = r;
        });

        // Conta NC esistenti dell'organizzazione (per generare nc_number incrementale)
        const countRes = await query(`
            SELECT COUNT(*) AS cnt
            FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE a.organization_id = @organization_id
        `, { organization_id });
        let nextSeq = (countRes.recordset?.[0]?.cnt || 0) + 1;

        const created = [];
        const skipped = [];

        for (const f of findings) {
            if (existingByQid[f.question_id]) {
                skipped.push({
                    question_id: f.question_id,
                    section_code: f.section_code,
                    reason: 'already_pushed',
                    nc_id: existingByQid[f.question_id].nc_id,
                    nc_number: existingByQid[f.question_id].nc_number,
                });
                continue;
            }

            const isOss = f.conformity_status === 'OSS';
            const severity = isOss ? 'observation' : 'minor';
            const source_type = isOss ? 'audit_oss' : 'audit_nc';

            // Genera nc_number unico nella org (NC-<num_audit>-<seq>)
            let nc_number = '';
            let inserted = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                nc_number = `NC-${audit_number || audit_id}-${String(nextSeq).padStart(3, '0')}`;
                try {
                    const ins = await query(`
                        INSERT INTO non_conformities (
                            audit_id, standard_id, nc_number, section_code, description, severity,
                            status, source_type, source_question_id, source_response_id,
                            created_at, updated_at
                        )
                        OUTPUT INSERTED.nc_id, INSERTED.nc_uuid
                        VALUES (
                            @audit_id, @standard_id, @nc_number, @section_code, @description, @severity,
                            'open', @source_type, @source_question_id, @source_response_id,
                            GETDATE(), GETDATE()
                        )
                    `, {
                        audit_id,
                        standard_id,
                        nc_number,
                        section_code: f.section_code || '0.0',
                        description: (f.notes && String(f.notes).trim()) || `Rilievo ${f.conformity_status} su domanda "${(f.question_text || '').slice(0, 200)}"`,
                        severity,
                        source_type,
                        source_question_id: f.question_id,
                        source_response_id: f.response_id || null,
                    });
                    inserted = ins.recordset[0];
                    break;
                } catch (err) {
                    // Conflitto su nc_number unique -> incrementa e ritenta
                    if (err.number === 2627 || err.number === 2601 || /UNIQUE|duplicate/i.test(err.message)) {
                        nextSeq++;
                        continue;
                    }
                    throw err;
                }
            }

            if (!inserted) {
                logger.warn('[NC_PUSH] impossibile generare nc_number unico dopo 10 tentativi', { audit_id, question_id: f.question_id });
                continue;
            }

            // Link bidirezionale: se esiste pending_issue con stesso source_response_id, aggiorna nc_id
            await query(`
                UPDATE pending_issues
                SET nc_id = @nc_id, updated_at = GETDATE()
                WHERE source_response_id = @source_response_id
                  AND organization_id = @organization_id
                  AND nc_id IS NULL
            `, {
                nc_id: inserted.nc_id,
                source_response_id: f.response_id,
                organization_id,
            });

            created.push({
                nc_id: inserted.nc_id,
                nc_number,
                question_id: f.question_id,
                section_code: f.section_code,
                source_type,
                severity,
            });
            nextSeq++;
        }

        // Aggiorna contatore NC nell'audit (solo NC, escluse osservazioni)
        await query(`
            UPDATE audits
            SET non_conformities_count = (
                SELECT COUNT(*) FROM non_conformities WHERE audit_id = @audit_id AND severity != 'observation'
            ),
            updated_at = GETDATE()
            WHERE audit_id = @audit_id
        `, { audit_id });

        logger.info('NC bulk push completed', {
            audit_id,
            user_id,
            organization_id,
            created_count: created.length,
            skipped_count: skipped.length,
        });

        res.status(201).json({
            success: true,
            audit_id,
            created,
            skipped,
            summary: {
                created_count: created.length,
                skipped_count: skipped.length,
                total_findings: findings.length,
            },
        });

    } catch (error) {
        logger.error('Error in pushAuditToNcRegister', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore durante trasferimento al modulo NC',
            code: 'NC_PUSH_ERROR',
            details: error.message,
        });
    }
}

/**
 * DELETE /api/v1/audits/:auditRef/push-to-nc-register
 * Annulla push: elimina tutte le NC create con source_type='audit_nc'|'audit_oss' per quell'audit.
 * Usato dal toast "undo" nella UI (entro 10 secondi dalla creazione).
 *
 * Per sicurezza: elimina SOLO se non sono state aggiunte azioni correttive (nc_actions) o
 * cambiato lo stato dal default 'open'. Tutela: una volta che la NC e' stata presa in carico,
 * va eliminata manualmente dal modulo NC.
 */
async function undoPushAuditToNcRegister(req, res) {
    try {
        const { auditRef } = req.params;
        const { organization_id, user_id } = req.user;

        const auditRow = await query(`
            SELECT audit_id FROM audits
            WHERE (audit_id = TRY_CAST(@auditRef AS INT) OR audit_uuid = @auditRef)
              AND organization_id = @organization_id
              AND is_deleted = 0
        `, { auditRef, organization_id });

        if (!auditRow.recordset || auditRow.recordset.length === 0) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const audit_id = auditRow.recordset[0].audit_id;

        // Trova NC eliminabili: status='open', source_type IN ('audit_nc','audit_oss'),
        // senza nc_actions
        const eligibleRes = await query(`
            SELECT nc.nc_id
            FROM non_conformities nc
            WHERE nc.audit_id = @audit_id
              AND nc.source_type IN ('audit_nc', 'audit_oss')
              AND nc.status = 'open'
              AND NOT EXISTS (SELECT 1 FROM nc_actions a WHERE a.nc_id = nc.nc_id)
        `, { audit_id });

        const eligibleIds = (eligibleRes.recordset || []).map(r => r.nc_id);

        if (eligibleIds.length === 0) {
            return res.json({
                success: true,
                deleted_count: 0,
                message: 'Nessuna NC eliminabile (gia in lavorazione o assente).',
            });
        }

        // Rimuovi link da pending_issues (FK SET NULL non e' disponibile per evitare cascade cycle)
        const idList = eligibleIds.join(',');
        await query(`UPDATE pending_issues SET nc_id = NULL WHERE nc_id IN (${idList})`);

        // Elimina le NC
        const delRes = await query(`DELETE FROM non_conformities WHERE nc_id IN (${idList})`);

        // Aggiorna contatore audit
        await query(`
            UPDATE audits
            SET non_conformities_count = (
                SELECT COUNT(*) FROM non_conformities WHERE audit_id = @audit_id AND severity != 'observation'
            ),
            updated_at = GETDATE()
            WHERE audit_id = @audit_id
        `, { audit_id });

        logger.info('NC bulk push UNDO completed', { audit_id, user_id, organization_id, deleted_count: eligibleIds.length });

        res.json({
            success: true,
            deleted_count: eligibleIds.length,
            deleted_ids: eligibleIds,
        });

    } catch (error) {
        logger.error('Error in undoPushAuditToNcRegister', { error: error.message });
        res.status(500).json({
            error: 'Errore durante annullamento push',
            code: 'NC_PUSH_UNDO_ERROR',
            details: error.message,
        });
    }
}

module.exports = {
    listNonConformities,
    getNonConformityById,
    createNonConformity,
    updateNonConformity,
    deleteNonConformity,
    getNonConformitiesStatistics,
    listNcActions,
    createNcAction,
    updateNcAction,
    deleteNcAction,
    pushAuditToNcRegister,
    undoPushAuditToNcRegister,
};
