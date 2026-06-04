/**
 * Non-Conformities Controller
 * Gestisce il workflow completo delle non conformità (NC)
 * 
 * Stati NC: open → in_progress → resolved → verified → closed
 * Severità: major (grave), minor (lieve), observation (osservazione)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { studioScopeClause, appendScopeSql, isOrgWideAdmin } = require('../services/auditListRbac.service');
const {
    assertMutatingAllowed,
    sendAccessDenied,
    assertCompanyAccess,
    ensureCompanyAccessLoaded,
    hasCompanyAccessRows,
} = require('../services/companyAccess.service');
const { listNcResponsibleOptions, VALID_SCOPES } = require('../services/ncResponsibleOptions.service');
const { materializeNcActionsFromDescription } = require('../services/ncDescriptionActions.service');

/** Ruoli che possono approvare la chiusura NC (RQ / admin org). */
function isNcClosureApprover(user) {
    const role = user?.role;
    return role === 'admin' || role === 'superadmin';
}

/** Verifica scope NC + permesso write (RBAC Fase 4.1). */
async function assertNcWriteAccess(req, res, ncId) {
    const { organization_id } = req.user;
    const scope = studioScopeClause(req.user, 'a');
    const scopeSql = appendScopeSql(scope);
    const result = await query(`
      SELECT nc.nc_id, a.company_id, a.audit_id
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id
        ${scopeSql}
    `, { id: parseInt(ncId, 10), organization_id, ...scope.params });

    if (result.recordset.length === 0) {
        return { notFound: true };
    }

    const writeDenied = await assertMutatingAllowed(req.user, {
        companyId: result.recordset[0].company_id,
    });
    if (writeDenied) {
        sendAccessDenied(res, writeDenied);
        return { denied: true };
    }

    return { row: result.recordset[0] };
}

/** Risolve contact_id rubrica → nome testo fallback (retrocompatibilità). */
async function resolveNotificationContact(organization_id, contactId, textFallback) {
    const parsedId = contactId != null && contactId !== '' ? parseInt(contactId, 10) : null;
    if (!parsedId) {
        return { contact_id: null, text: textFallback != null ? String(textFallback).trim() || null : null };
    }
    const result = await query(`
        SELECT id, name FROM notification_contacts
        WHERE id = @id AND organization_id = @org AND active = 1
    `, { id: parsedId, org: organization_id });
    if (result.recordset.length === 0) {
        return { contact_id: null, text: textFallback != null ? String(textFallback).trim() || null : null };
    }
    return { contact_id: parsedId, text: result.recordset[0].name };
}

async function resolveAuditStandardId(audit_id) {
    const standardResult = await query(`
        SELECT TOP 1 ast.standard_id FROM audit_standards ast
        WHERE ast.audit_id = @audit_id
        ORDER BY ast.standard_id
    `, { audit_id });
    if (standardResult.recordset?.length) {
        return standardResult.recordset[0].standard_id;
    }
    const isoFallback = await query(`
        SELECT TOP 1 standard_id FROM standards
        WHERE standard_code IN ('ISO9001', 'ISO 9001') AND is_active = 1
        ORDER BY standard_id
    `);
    return isoFallback.recordset?.[0]?.standard_id || 1;
}

async function resolveNcSectionForStandard(standard_id) {
    const clause10 = await query(`
        SELECT TOP 1 section_code FROM checklist_sections
        WHERE standard_id = @standard_id AND section_code = 'clause10' AND is_active = 1
    `, { standard_id });
    if (clause10.recordset?.length) return clause10.recordset[0].section_code;
    const anySection = await query(`
        SELECT TOP 1 section_code FROM checklist_sections
        WHERE standard_id = @standard_id AND is_active = 1
        ORDER BY display_order
    `, { standard_id });
    return anySection.recordset?.[0]?.section_code || 'clause10';
}

function extractCustomFindingDescription(evidence_blocks, item_text, status) {
    let text = '';
    try {
        const blocks = typeof evidence_blocks === 'string'
            ? JSON.parse(evidence_blocks || '[]')
            : (evidence_blocks || []);
        if (Array.isArray(blocks)) {
            text = blocks
                .map(b => (b?.text || b?.content || '').trim())
                .filter(Boolean)
                .join(' — ');
        }
    } catch { /* noop */ }
    if (text) return text.slice(0, 2000);
    const label = (item_text || '').trim();
    if (label) return `Rilievo ${status} su voce custom "${label.slice(0, 200)}"`;
    return `Rilievo ${status} su checklist personalizzata`;
}

/**
 * GET /api/v1/non-conformities
 * Lista NC con filtri
 * 
 * Query params:
 * - audit_id: filter by audit
 * - status: filter by status (open, in_progress, resolved, verified, closed)
 * - severity: filter by severity (major, minor, observation)
 * - overdue: true/false (scadute)
 * - due_within_days: NC non terminali con scadenza entro N giorni (non ancora scadute)
 * - page: pagination (default 1)
 * - limit: items per page (default 50)
 */
async function listNonConformities(req, res) {
    try {
        const { organization_id } = req.user;
        const {
            audit_id,
            company_id,
            status,
            severity,
            overdue,
            due_within_days,
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

        if (company_id) {
            whereConditions.push('a.company_id = @company_id');
            params.company_id = parseInt(company_id);
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

        const dueWithin = parseInt(due_within_days, 10);
        if (!Number.isNaN(dueWithin) && dueWithin > 0) {
            whereConditions.push('nc.due_date IS NOT NULL');
            whereConditions.push('nc.due_date >= CAST(GETDATE() AS DATE)');
            whereConditions.push(`nc.due_date <= DATEADD(day, ${dueWithin}, CAST(GETDATE() AS DATE))`);
            whereConditions.push('nc.status NOT IN (\'closed\', \'verified\')');
        }

        const scope = studioScopeClause(req.user, 'a');
        if (scope.clause) {
            whereConditions.push(scope.clause);
            Object.assign(params, scope.params);
        }

        const whereClause = whereConditions.join(' AND ');

        // Query principale
        const result = await query(`
      SELECT 
        nc.*,
        a.audit_number,
        a.audit_uuid,
        a.client_name,
        a.company_id,
        cs.section_title,
        c.complaint_number AS source_complaint_number,
        approver.full_name AS approved_by_name,
        (SELECT COUNT(*) FROM attachments WHERE nc_id = nc.nc_id) AS attachments_count,
        CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 
          ELSE 0 
        END AS is_overdue,
        CASE 
          WHEN nc.due_date IS NOT NULL
            AND nc.due_date >= CAST(GETDATE() AS DATE)
            AND nc.due_date <= DATEADD(day, 7, CAST(GETDATE() AS DATE))
            AND nc.status NOT IN ('closed', 'verified')
          THEN 1
          ELSE 0
        END AS is_due_soon
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      INNER JOIN checklist_sections cs ON nc.section_code = cs.section_code AND cs.standard_id = nc.standard_id
      LEFT JOIN complaints c ON c.id = nc.source_complaint_id
      LEFT JOIN users approver ON nc.approved_by = approver.user_id
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
            filters: { audit_id, status, severity, overdue, due_within_days }
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
 * GET /api/v1/non-conformities/responsible-options
 * Personale azienda + rubrica per select responsabili NC (slice S8)
 *
 * Query: company_id (required), scope=attuazione|verifica
 */
async function listNcResponsibleOptionsHandler(req, res) {
    try {
        const { organization_id } = req.user;
        const companyId = parseInt(req.query.company_id, 10);
        const scope = String(req.query.scope || '').trim().toLowerCase();

        if (!Number.isFinite(companyId)) {
            return res.status(400).json({
                error: 'company_id obbligatorio',
                code: 'MISSING_COMPANY_ID',
            });
        }
        if (!VALID_SCOPES.has(scope)) {
            return res.status(400).json({
                error: 'scope non valido (attuazione|verifica)',
                code: 'INVALID_SCOPE',
            });
        }

        const accessList = await ensureCompanyAccessLoaded(req.user);
        if (hasCompanyAccessRows(accessList)) {
            const denied = await assertCompanyAccess(req.user, companyId, 'read');
            if (denied) return sendAccessDenied(res, denied);
        } else {
            const { auditor_org_id } = req.user;
            let check;
            if (isOrgWideAdmin(req.user)) {
                check = await query(`
                    SELECT c.id FROM companies c
                    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
                    WHERE c.id = @company_id AND ao.organization_id = @organization_id
                `, { company_id: companyId, organization_id });
            } else if (auditor_org_id) {
                check = await query(`
                    SELECT c.id FROM companies c
                    INNER JOIN auditor_orgs ao ON ao.id = c.auditor_org_id
                    WHERE c.id = @company_id AND ao.organization_id = @organization_id
                      AND c.auditor_org_id = @auditor_org_id
                `, { company_id: companyId, organization_id, auditor_org_id });
            } else {
                return res.status(403).json({
                    error: 'Specificare auditor_org_id (superadmin) o appartenere a un auditor_org',
                    code: 'AUDITOR_ORG_REQUIRED',
                });
            }
            if (check.recordset.length === 0) {
                return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
            }
        }

        const data = await listNcResponsibleOptions(organization_id, companyId, scope);
        res.json({ success: true, data });
    } catch (error) {
        logger.error('Error listing NC responsible options', { error: error.message, stack: error.stack });
        res.status(500).json({
            error: 'Errore recupero responsabili NC',
            code: 'NC_RESPONSIBLE_OPTIONS_ERROR',
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
        const scope = studioScopeClause(req.user, 'a');
        const whereExtra = scope.clause ? ` AND ${scope.clause}` : '';
        const queryParams = { id: parseInt(id), organization_id, ...scope.params };

        const result = await query(`
      SELECT 
        nc.*,
        a.audit_number,
        a.audit_uuid,
        a.client_name,
        a.company_id,
        a.audit_date,
        cs.section_title,
        approver.full_name AS approved_by_name,
        (SELECT COUNT(*) FROM attachments WHERE nc_id = nc.nc_id) AS attachments_count,
        CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 
          ELSE 0 
        END AS is_overdue
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      INNER JOIN checklist_sections cs ON nc.section_code = cs.section_code AND cs.standard_id = nc.standard_id
      LEFT JOIN users approver ON nc.approved_by = approver.user_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id${whereExtra}
    `, queryParams);

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
            responsible_contact_id,
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

        // Verifica che audit appartenga all'organizzazione e al perimetro studio RBAC
        const scope = studioScopeClause(req.user, 'a');
        let auditWhere = 'audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0';
        const auditParams = { audit_id: parseInt(audit_id), organization_id };
        if (scope.clause) {
            auditWhere += ` AND ${scope.clause}`;
            Object.assign(auditParams, scope.params);
        }
        const auditCheck = await query(`
      SELECT audit_id, company_id FROM audits a
      WHERE ${auditWhere}
    `, auditParams);

        if (auditCheck.recordset.length === 0) {
            return res.status(404).json({
                error: 'Audit non trovato',
                code: 'AUDIT_NOT_FOUND'
            });
        }

        const writeDenied = await assertMutatingAllowed(req.user, {
            companyId: auditCheck.recordset[0].company_id,
        });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

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

        let responsibleResolved = { contact_id: null, text: null };
        if (responsible_contact_id != null && responsible_contact_id !== '') {
            responsibleResolved = await resolveNotificationContact(
                organization_id, responsible_contact_id, null,
            );
        }

        // Crea NC (source_type manual: creazione diretta, non da push audit)
        const result = await query(`
      INSERT INTO non_conformities (
        audit_id,
        standard_id,
        nc_number,
        section_code,
        description,
        severity,
        responsible_person,
        responsible_contact_id,
        due_date,
        corrective_action,
        status,
        source_type,
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
        @responsible_contact_id,
        @due_date,
        @corrective_action,
        'open',
        'manual',
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
            responsible_person: responsibleResolved.text,
            responsible_contact_id: responsibleResolved.contact_id,
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
        if (error.number === 547) {
            return res.status(400).json({
                error: 'Sezione ISO non valida per lo standard dell\'audit selezionato. Scegliere un audit ISO 9001 o una sezione compatibile.',
                code: 'INVALID_SECTION_FOR_STANDARD'
            });
        }
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
            verification_notes,
            verification_responsible,
            responsible_contact_id,
            verification_contact_id,
            root_cause,
            reopen_reason
        } = req.body;

        const scope = studioScopeClause(req.user, 'a');
        const whereExtra = scope.clause ? ` AND ${scope.clause}` : '';
        const ownershipParams = { id: parseInt(id), organization_id, ...scope.params };

        // Verifica esistenza, ownership org e perimetro studio RBAC
        const existingNC = await query(`
      SELECT nc.nc_id, nc.status AS current_status, nc.verification_notes, nc.approved_at, a.audit_id, a.company_id
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id${whereExtra}
    `, ownershipParams);

        if (existingNC.recordset.length === 0) {
            return res.status(404).json({
                error: 'Non conformità non trovata',
                code: 'NC_NOT_FOUND'
            });
        }

        const writeDenied = await assertMutatingAllowed(req.user, {
            companyId: existingNC.recordset[0].company_id,
        });
        if (writeDenied) return sendAccessDenied(res, writeDenied);

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
        if (responsible_contact_id !== undefined) {
            const resolved = await resolveNotificationContact(
                organization_id, responsible_contact_id, null,
            );
            updates.push('responsible_person = @responsible_person');
            params.responsible_person = resolved.text;
            updates.push('responsible_contact_id = @responsible_contact_id');
            params.responsible_contact_id = resolved.contact_id;
        }
        if (verification_contact_id !== undefined || verification_responsible !== undefined) {
            if (verification_contact_id !== undefined) {
                const resolved = await resolveNotificationContact(
                    organization_id, verification_contact_id, verification_responsible,
                );
                updates.push('verification_responsible = @verification_responsible');
                params.verification_responsible = resolved.text;
                updates.push('verification_contact_id = @verification_contact_id');
                params.verification_contact_id = resolved.contact_id;
            } else {
                updates.push('verification_responsible = @verification_responsible');
                params.verification_responsible = verification_responsible != null
                    ? String(verification_responsible).trim() || null : null;
                updates.push('verification_contact_id = @verification_contact_id');
                params.verification_contact_id = null;
            }
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
        if (root_cause !== undefined) {
            updates.push('root_cause = @root_cause');
            params.root_cause = root_cause;
        }

        // Gestione transizione stato (con validazione workflow)
        if (status !== undefined) {
            const validTransitions = {
                'open': ['in_progress', 'closed'],
                'in_progress': ['resolved', 'open'],
                'resolved': ['verified', 'in_progress'],
                'verified': ['closed', 'in_progress'],
                'closed': ['in_progress'],
            };

            if (currentStatus === 'closed' && status === 'in_progress' && !isNcClosureApprover(req.user)) {
                return res.status(403).json({
                    error: 'Solo admin o responsabile qualità possono riaprire una NC chiusa',
                    code: 'NC_REOPEN_FORBIDDEN',
                });
            }

            const allowedTransitions = currentStatus === 'closed' && !isNcClosureApprover(req.user)
                ? []
                : (validTransitions[currentStatus] || []);

            if (!allowedTransitions.includes(status)) {
                return res.status(400).json({
                    error: `Transizione di stato non valida: ${currentStatus} → ${status}`,
                    code: 'INVALID_STATE_TRANSITION',
                    currentStatus,
                    allowedTransitions
                });
            }

            // Gate ISO 10.2: note verifica obbligatorie per verified/closed
            if (status === 'verified' || status === 'closed') {
                const notesCandidate = verification_notes !== undefined
                    ? verification_notes
                    : existingNC.recordset[0].verification_notes;
                if (!notesCandidate || !String(notesCandidate).trim()) {
                    return res.status(400).json({
                        error: 'Note verifica obbligatorie prima di passare a Verificata o Chiusa',
                        code: 'VERIFICATION_NOTES_REQUIRED'
                    });
                }
            }

            // Gate RQ: chiusura solo dopo approvazione esplicita
            if (status === 'closed') {
                const approvedAt = existingNC.recordset[0].approved_at;
                if (!approvedAt) {
                    return res.status(400).json({
                        error: 'Approvazione del Responsabile Qualità richiesta prima della chiusura',
                        code: 'NC_APPROVAL_REQUIRED'
                    });
                }
            }

            updates.push('status = @status');
            params.status = status;

            // Riapertura: revoca approvazione RQ e traccia in note verifica
            if (currentStatus === 'closed' && status === 'in_progress') {
                updates.push('approved_at = NULL');
                updates.push('approved_by = NULL');
                const existingNotes = existingNC.recordset[0].verification_notes || '';
                const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
                const reason = reopen_reason != null ? String(reopen_reason).trim() : '';
                const auditLine = `\n\n[Riapertura RQ ${stamp} - utente ${req.user.user_id}]${reason ? ` ${reason}` : ''}`;
                const mergedNotes = `${String(existingNotes).trimEnd()}${auditLine}`;
                updates.push('verification_notes = @reopen_verification_notes');
                params.reopen_verification_notes = mergedNotes;
            }

            // Auto-set resolution_date quando si passa a 'resolved'
            if (status === 'resolved' && resolution_date === undefined) {
                updates.push('resolution_date = CAST(GETDATE() AS DATE)');
            }

            logger.info('NC status transition', {
                nc_id: id,
                organization_id,
                user_id: req.user.user_id,
                from: currentStatus,
                to: status,
                reopened: currentStatus === 'closed' && status === 'in_progress',
            });
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

        const scope = studioScopeClause(req.user, 'a');
        const scopeSql = appendScopeSql(scope);

        // Verifica esistenza, tenant e scope studio
        const existingNC = await query(`
      SELECT nc.nc_id, a.audit_id
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE nc.nc_id = @id AND a.organization_id = @organization_id
        ${scopeSql}
    `, { id: parseInt(id), organization_id, ...scope.params });

        if (existingNC.recordset.length === 0) {
            return res.status(404).json({
                error: 'Non conformità non trovata',
                code: 'NC_NOT_FOUND'
            });
        }

        const ncWrite = await assertNcWriteAccess(req, res, id);
        if (ncWrite.denied) return;

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
 * Statistiche generali NC per organizzazione (opzionale: filtro company_id)
 */
async function getNonConformitiesStatistics(req, res) {
    try {
        const { organization_id } = req.user;
        const { company_id } = req.query;

        let whereConditions = ['a.organization_id = @organization_id'];
        const params = { organization_id };

        if (company_id) {
            whereConditions.push('a.company_id = @company_id');
            params.company_id = parseInt(company_id);
        }

        const scope = studioScopeClause(req.user, 'a');
        if (scope.clause) {
            whereConditions.push(scope.clause);
            Object.assign(params, scope.params);
        }

        const whereClause = whereConditions.join(' AND ');

        // Statistiche aggregate
        const statsResult = await query(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN nc.status = 'open' THEN 1 ELSE 0 END) AS [open],
        SUM(CASE WHEN nc.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
        SUM(CASE WHEN nc.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
        SUM(CASE WHEN nc.status = 'verified' THEN 1 ELSE 0 END) AS verified,
        SUM(CASE WHEN nc.status = 'closed' THEN 1 ELSE 0 END) AS [closed],
        SUM(CASE WHEN nc.severity = 'major' THEN 1 ELSE 0 END) AS major,
        SUM(CASE WHEN nc.severity = 'minor' THEN 1 ELSE 0 END) AS minor,
        SUM(CASE WHEN nc.severity = 'observation' THEN 1 ELSE 0 END) AS observations,
        SUM(CASE 
          WHEN nc.due_date < CAST(GETDATE() AS DATE) 
            AND nc.status NOT IN ('closed', 'verified') 
          THEN 1 ELSE 0 
        END) AS overdue,
        SUM(CASE 
          WHEN nc.due_date IS NOT NULL
            AND nc.due_date >= CAST(GETDATE() AS DATE)
            AND nc.due_date <= DATEADD(day, 7, CAST(GETDATE() AS DATE))
            AND nc.status NOT IN ('closed', 'verified')
          THEN 1 ELSE 0 
        END) AS due_soon
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE ${whereClause}
    `, params);

        logger.info('NC statistics retrieved', { organization_id, company_id });

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

        const scope = studioScopeClause(req.user, 'a');
        const scopeSql = appendScopeSql(scope);

        // Verifica ownership NC + scope studio
        const ncCheck = await query(`
            SELECT nc.nc_id, nc.description, nc.source_type
            FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE nc.nc_id = @id AND a.organization_id = @organization_id
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...scope.params });

        if (ncCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Non conformità non trovata', code: 'NC_NOT_FOUND' });
        }

        const ncRow = ncCheck.recordset[0];
        const auditSourceTypes = new Set(['audit_nc', 'audit_oss']);
        if (auditSourceTypes.has(ncRow.source_type)) {
            const materialized = await materializeNcActionsFromDescription(query, {
                ncId: parseInt(id, 10),
                description: ncRow.description,
                createdBy: req.user.user_id,
            });
            if (materialized > 0) {
                logger.info('NC actions materialized from description', {
                    nc_id: id,
                    organization_id,
                    count: materialized,
                });
            }
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
        const { action_type = 'corrective', description, responsible, responsible_contact_id, due_date } = req.body;

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

        const scope = studioScopeClause(req.user, 'a');
        const scopeSql = appendScopeSql(scope);

        // Verifica ownership NC + scope studio
        const ncCheck = await query(`
            SELECT nc.nc_id FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE nc.nc_id = @id AND a.organization_id = @organization_id
              ${scopeSql}
        `, { id: parseInt(id), organization_id, ...scope.params });

        if (ncCheck.recordset.length === 0) {
            return res.status(404).json({ error: 'Non conformità non trovata', code: 'NC_NOT_FOUND' });
        }

        const ncWrite = await assertNcWriteAccess(req, res, id);
        if (ncWrite.denied) return;

        const responsibleResolved = await resolveNotificationContact(
            organization_id, responsible_contact_id, responsible,
        );

        const result = await query(`
            INSERT INTO nc_actions (nc_id, action_type, description, responsible, responsible_contact_id, due_date, created_by)
            OUTPUT INSERTED.action_id
            VALUES (@nc_id, @action_type, @description, @responsible, @responsible_contact_id, @due_date, @created_by)
        `, {
            nc_id: parseInt(id),
            action_type,
            description,
            responsible: responsibleResolved.text,
            responsible_contact_id: responsibleResolved.contact_id,
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
        const { status, description, responsible, responsible_contact_id, due_date, verification_note } = req.body;

        const scope = studioScopeClause(req.user, 'au');
        const scopeSql = appendScopeSql(scope);

        // Verifica ownership + scope studio
        const check = await query(`
            SELECT a.action_id, a.status AS current_status, a.verification_note
            FROM nc_actions a
            INNER JOIN non_conformities nc ON a.nc_id = nc.nc_id
            INNER JOIN audits au ON nc.audit_id = au.audit_id
            WHERE a.action_id = @actionId AND nc.nc_id = @nc_id
              AND au.organization_id = @organization_id
              ${scopeSql}
        `, { actionId: parseInt(actionId), nc_id: parseInt(id), organization_id, ...scope.params });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azione non trovata', code: 'NC_ACTION_NOT_FOUND' });
        }

        const ncWrite = await assertNcWriteAccess(req, res, id);
        if (ncWrite.denied) return;

        const updates = [];
        const params = { actionId: parseInt(actionId) };

        if (description !== undefined) { updates.push('description = @description'); params.description = description; }
        if (responsible !== undefined || responsible_contact_id !== undefined) {
            const resolved = await resolveNotificationContact(
                organization_id, responsible_contact_id, responsible,
            );
            updates.push('responsible = @responsible');
            params.responsible = resolved.text;
            updates.push('responsible_contact_id = @responsible_contact_id');
            params.responsible_contact_id = resolved.contact_id;
        }
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
            if (status === 'verified') {
                const noteCandidate = verification_note !== undefined
                    ? verification_note
                    : check.recordset[0].verification_note;
                if (!noteCandidate || !String(noteCandidate).trim()) {
                    return res.status(400).json({
                        error: 'Nota verifica obbligatoria per segnare l\'azione come verificata',
                        code: 'ACTION_VERIFICATION_NOTE_REQUIRED'
                    });
                }
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

        const scope = studioScopeClause(req.user, 'au');
        const scopeSql = appendScopeSql(scope);

        const check = await query(`
            SELECT a.action_id FROM nc_actions a
            INNER JOIN non_conformities nc ON a.nc_id = nc.nc_id
            INNER JOIN audits au ON nc.audit_id = au.audit_id
            WHERE a.action_id = @actionId AND nc.nc_id = @nc_id
              AND au.organization_id = @organization_id
              ${scopeSql}
        `, { actionId: parseInt(actionId), nc_id: parseInt(id), organization_id, ...scope.params });

        if (check.recordset.length === 0) {
            return res.status(404).json({ error: 'Azione non trovata', code: 'NC_ACTION_NOT_FOUND' });
        }

        const ncWrite = await assertNcWriteAccess(req, res, id);
        if (ncWrite.denied) return;

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

        const scope = studioScopeClause(req.user, 'a');
        const scopeSql = appendScopeSql(scope);

        const auditRow = await query(`
            SELECT a.audit_id, a.audit_number, a.organization_id, a.custom_checklist_id
            FROM audits a
            WHERE (a.audit_id = TRY_CAST(@auditRef AS INT) OR a.audit_uuid = @auditRef)
              AND a.organization_id = @organization_id
              AND a.is_deleted = 0
              ${scopeSql}
        `, { auditRef, organization_id, ...scope.params });

        if (!auditRow.recordset || auditRow.recordset.length === 0) {
            return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
        }
        const audit_id = auditRow.recordset[0].audit_id;
        const audit_number = auditRow.recordset[0].audit_number;

        // ── Rilievi ISO (audit_responses) ──
        const findingsRes = await query(`
            SELECT
                ar.response_id,
                ar.question_id,
                ar.conformity_status,
                ar.notes,
                cq.section_code,
                cq.question_text,
                cs.standard_id AS finding_standard_id
            FROM audit_responses ar
            INNER JOIN checklist_questions cq ON ar.question_id = cq.question_id
            INNER JOIN checklist_sections cs ON cs.section_code = cq.section_code AND cs.standard_id = cq.standard_id
            WHERE ar.audit_id = @audit_id
              AND ar.conformity_status IN ('NC', 'OSS')
            ORDER BY cq.section_code, ar.question_id
        `, { audit_id });

        const isoFindings = findingsRes.recordset || [];

        // ── Rilievi checklist custom (audit_custom_checklist_responses) ──
        const customFindingsRes = await query(`
            SELECT
                accr.id AS response_id,
                accr.custom_item_id,
                accr.status AS conformity_status,
                accr.evidence_blocks,
                cci.title AS item_text,
                ccs.code AS custom_section_code
            FROM audit_custom_checklist_responses accr
            INNER JOIN custom_checklist_items cci ON accr.custom_item_id = cci.id
            INNER JOIN custom_checklist_sections ccs ON cci.section_id = ccs.id
            WHERE accr.audit_id = @audit_id
              AND accr.status IN ('NC', 'OSS')
            ORDER BY ccs.display_order, accr.custom_item_id
        `, { audit_id });

        const customFindings = customFindingsRes.recordset || [];
        const defaultStandardId = await resolveAuditStandardId(audit_id);
        const defaultSectionCode = await resolveNcSectionForStandard(defaultStandardId);

        const existingNcRes = await query(`
            SELECT source_question_id, source_custom_item_id, nc_id, nc_number, status
            FROM non_conformities
            WHERE audit_id = @audit_id
              AND (source_question_id IS NOT NULL OR source_custom_item_id IS NOT NULL)
        `, { audit_id });

        const existingByQid = {};
        const existingByCustomItem = {};
        (existingNcRes.recordset || []).forEach(r => {
            if (r.source_question_id != null) existingByQid[r.source_question_id] = r;
            if (r.source_custom_item_id != null) existingByCustomItem[r.source_custom_item_id] = r;
        });

        const countRes = await query(`
            SELECT COUNT(*) AS cnt
            FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE a.organization_id = @organization_id
        `, { organization_id });
        let nextSeq = (countRes.recordset?.[0]?.cnt || 0) + 1;

        const created = [];
        const skipped = [];

        async function insertFinding({
            sourceKey, sourceType, existingMap, sourceQuestionId, sourceCustomItemId,
            standard_id, section_code, description, severity, source_type, response_id,
        }) {
            if (existingMap[sourceKey]) {
                skipped.push({
                    question_id: sourceQuestionId || undefined,
                    custom_item_id: sourceCustomItemId || undefined,
                    section_code,
                    reason: 'already_pushed',
                    nc_id: existingMap[sourceKey].nc_id,
                    nc_number: existingMap[sourceKey].nc_number,
                });
                return;
            }

            let nc_number = '';
            let inserted = null;
            for (let attempt = 0; attempt < 10; attempt++) {
                nc_number = `NC-${audit_number || audit_id}-${String(nextSeq).padStart(3, '0')}`;
                try {
                    const ins = await query(`
                        INSERT INTO non_conformities (
                            audit_id, standard_id, nc_number, section_code, description, severity,
                            status, source_type, source_question_id, source_custom_item_id,
                            created_at, updated_at
                        )
                        OUTPUT INSERTED.nc_id, INSERTED.nc_uuid
                        VALUES (
                            @audit_id, @standard_id, @nc_number, @section_code, @description, @severity,
                            'open', @source_type, @source_question_id, @source_custom_item_id,
                            GETDATE(), GETDATE()
                        )
                    `, {
                        audit_id,
                        standard_id,
                        nc_number,
                        section_code,
                        description,
                        severity,
                        source_type,
                        source_question_id: sourceQuestionId ?? null,
                        source_custom_item_id: sourceCustomItemId ?? null,
                    });
                    inserted = ins.recordset[0];
                    break;
                } catch (err) {
                    if (err.number === 2627 || err.number === 2601 || /UNIQUE|duplicate/i.test(err.message)) {
                        nextSeq++;
                        continue;
                    }
                    throw err;
                }
            }

            if (!inserted) {
                logger.warn('[NC_PUSH] impossibile generare nc_number unico', { audit_id, sourceKey });
                return;
            }

            if (response_id) {
                await query(`
                    UPDATE pending_issues
                    SET nc_id = @nc_id, updated_at = GETDATE()
                    WHERE source_response_id = @source_response_id
                      AND organization_id = @organization_id
                      AND nc_id IS NULL
                `, {
                    nc_id: inserted.nc_id,
                    source_response_id: response_id,
                    organization_id,
                });
            }

            await materializeNcActionsFromDescription(query, {
                ncId: inserted.nc_id,
                description,
                createdBy: user_id,
            });

            created.push({
                nc_id: inserted.nc_id,
                nc_number,
                question_id: sourceQuestionId || undefined,
                custom_item_id: sourceCustomItemId || undefined,
                section_code,
                source_type,
                severity,
            });
            nextSeq++;
        }

        for (const f of isoFindings) {
            const isOss = f.conformity_status === 'OSS';
            await insertFinding({
                sourceKey: f.question_id,
                existingMap: existingByQid,
                sourceQuestionId: f.question_id,
                sourceCustomItemId: null,
                standard_id: f.finding_standard_id,
                section_code: f.section_code,
                description: (f.notes && String(f.notes).trim())
                    || `Rilievo ${f.conformity_status} su domanda "${(f.question_text || '').slice(0, 200)}"`,
                severity: isOss ? 'observation' : 'minor',
                source_type: isOss ? 'audit_oss' : 'audit_nc',
                response_id: f.response_id,
            });
        }

        for (const f of customFindings) {
            const isOss = f.conformity_status === 'OSS';
            await insertFinding({
                sourceKey: f.custom_item_id,
                existingMap: existingByCustomItem,
                sourceQuestionId: null,
                sourceCustomItemId: f.custom_item_id,
                standard_id: defaultStandardId,
                section_code: defaultSectionCode,
                description: extractCustomFindingDescription(f.evidence_blocks, f.item_text, f.conformity_status),
                severity: isOss ? 'observation' : 'minor',
                source_type: isOss ? 'audit_oss' : 'audit_nc',
                response_id: null,
            });
        }

        const totalFindings = isoFindings.length + customFindings.length;

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
            iso_findings: isoFindings.length,
            custom_findings: customFindings.length,
        });

        res.status(201).json({
            success: true,
            audit_id,
            created,
            skipped,
            summary: {
                created_count: created.length,
                skipped_count: skipped.length,
                total_findings: totalFindings,
                iso_findings: isoFindings.length,
                custom_findings: customFindings.length,
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

        const scope = studioScopeClause(req.user, 'a');
        const scopeSql = appendScopeSql(scope);

        const auditRow = await query(`
            SELECT a.audit_id FROM audits a
            WHERE (a.audit_id = TRY_CAST(@auditRef AS INT) OR a.audit_uuid = @auditRef)
              AND a.organization_id = @organization_id
              AND a.is_deleted = 0
              ${scopeSql}
        `, { auditRef, organization_id, ...scope.params });

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

/**
 * POST /api/v1/non-conformities/:id/approve-closure
 * Approvazione RQ prima della chiusura definitiva (stato verified → abilita closed).
 */
async function approveNcClosure(req, res) {
    try {
        const { id } = req.params;
        const { organization_id, user_id } = req.user;

        if (!isNcClosureApprover(req.user)) {
            return res.status(403).json({
                error: 'Solo admin o responsabile qualità possono approvare la chiusura',
                code: 'FORBIDDEN'
            });
        }

        const scope = studioScopeClause(req.user, 'a');
        const whereExtra = scope.clause ? ` AND ${scope.clause}` : '';
        const params = { id: parseInt(id), organization_id, ...scope.params };

        const existing = await query(`
            SELECT nc.nc_id, nc.status, nc.approved_at
            FROM non_conformities nc
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE nc.nc_id = @id AND a.organization_id = @organization_id${whereExtra}
        `, params);

        if (!existing.recordset.length) {
            return res.status(404).json({ error: 'Non conformità non trovata', code: 'NC_NOT_FOUND' });
        }

        const row = existing.recordset[0];
        if (row.status !== 'verified') {
            return res.status(400).json({
                error: 'La NC deve essere in stato Verificata per l\'approvazione chiusura',
                code: 'INVALID_STATUS_FOR_APPROVAL',
                currentStatus: row.status
            });
        }
        if (row.approved_at) {
            return res.status(409).json({
                error: 'Chiusura già approvata',
                code: 'NC_ALREADY_APPROVED'
            });
        }

        await query(`
            UPDATE non_conformities
            SET approved_by = @approved_by, approved_at = GETDATE(), updated_at = GETDATE()
            WHERE nc_id = @id
        `, { id: parseInt(id), approved_by: user_id });

        logger.info('NC closure approved', { nc_id: id, approved_by: user_id, organization_id });

        res.json({
            success: true,
            nc_id: parseInt(id),
            approved_by: user_id,
            approved_at: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error approving NC closure', { error: error.message });
        res.status(500).json({ error: 'Errore approvazione chiusura NC', code: 'NC_APPROVE_ERROR' });
    }
}

/**
 * GET /api/v1/non-conformities/actions/due
 * Azioni correttive cross-NC con filtri scadenza (registro organizzativo).
 */
async function listAggregateDueNcActions(req, res) {
    try {
        const { organization_id } = req.user;
        const { overdue, due_within_days, limit = 100 } = req.query;

        let whereConditions = ['a.organization_id = @organization_id', "na.status NOT IN ('verified')"];
        const params = { organization_id, limit: parseInt(limit, 10) || 100 };
        const dueWithin = parseInt(due_within_days, 10);

        if (overdue === 'true') {
            whereConditions.push('na.due_date IS NOT NULL');
            if (!Number.isNaN(dueWithin) && dueWithin > 0) {
                whereConditions.push(`(
                    na.due_date < CAST(GETDATE() AS DATE)
                    OR (
                        na.due_date >= CAST(GETDATE() AS DATE)
                        AND na.due_date <= DATEADD(day, ${dueWithin}, CAST(GETDATE() AS DATE))
                    )
                )`);
            } else {
                whereConditions.push('na.due_date < CAST(GETDATE() AS DATE)');
            }
        } else if (!Number.isNaN(dueWithin) && dueWithin > 0) {
            whereConditions.push('na.due_date IS NOT NULL');
            whereConditions.push('na.due_date >= CAST(GETDATE() AS DATE)');
            whereConditions.push(`na.due_date <= DATEADD(day, ${dueWithin}, CAST(GETDATE() AS DATE))`);
        }

        const scope = studioScopeClause(req.user, 'a');
        if (scope.clause) {
            whereConditions.push(scope.clause);
            Object.assign(params, scope.params);
        }

        const whereClause = whereConditions.join(' AND ');

        const result = await query(`
            SELECT TOP (@limit)
                na.action_id, na.nc_id, na.action_type, na.description, na.responsible,
                na.due_date, na.status AS action_status,
                nc.nc_number, nc.status AS nc_status, nc.severity,
                a.audit_number, a.client_name,
                CASE WHEN na.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS is_overdue
            FROM nc_actions na
            INNER JOIN non_conformities nc ON na.nc_id = nc.nc_id
            INNER JOIN audits a ON nc.audit_id = a.audit_id
            WHERE ${whereClause}
            ORDER BY na.due_date ASC, nc.nc_number ASC
        `, params);

        res.json({ success: true, data: result.recordset || [] });
    } catch (error) {
        logger.error('Error listing aggregate NC actions', { error: error.message });
        res.status(500).json({ error: 'Errore recupero azioni in scadenza', code: 'NC_ACTIONS_DUE_ERROR' });
    }
}

module.exports = {
    listNonConformities,
    listNcResponsibleOptionsHandler,
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
    approveNcClosure,
    listAggregateDueNcActions,
};
