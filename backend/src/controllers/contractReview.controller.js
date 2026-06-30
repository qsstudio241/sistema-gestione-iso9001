/**
 * contractReview.controller.js — Riesame requisiti contratto / ciclo commerciale (commercial_cases)
 */

const path = require('path');
const fs = require('fs').promises;
const { query, getPool, sql } = require('../config/database');
const logger = require('../utils/logger');
const workflow = require('../services/contractReviewWorkflow.service');
const crNotify = require('../services/contractReviewNotification.service');
const contextBuilder = require('../services/aiContextBuilder.service');
const { chat, getActiveProvider } = require('../services/aiProviderAdapter');
const { enrichSystemPromptWithOrganization } = require('../services/aiOrganizationContext.service');
const { parseCompanyId, companyBelongsToOrg } = require('../services/qualificationCompany.service');
const {
    resolveCommercialCustomerFields,
    CASE_SELECT_SQL,
    CASE_FROM_SQL,
} = require('../services/commercialCustomerCounterparty.service');

const CASE_STATUSES = workflow.CASE_STATUSES;
const TERMINAL_FROM_STATUSES = new Set(['APPROVED', 'CANCELLED', 'REJECTED']);

const PRELIMINARY_ITEMS = [
    { ref: 'P1', text: 'Requisiti tecnici del cliente chiaramente identificati' },
    { ref: 'P2', text: 'Norme e standard applicabili identificati' },
    { ref: 'P3', text: 'Capacità produttiva adeguata ai requisiti' },
    { ref: 'P4', text: 'Competenze e qualifiche del personale disponibili' },
    { ref: 'P5', text: 'Attrezzature e strumenti necessari disponibili' },
    { ref: 'P6', text: 'Documentazione di sistema applicabile aggiornata' },
    { ref: 'P7', text: 'Requisiti di consegna e tempistiche realizzabili' },
    { ref: 'P8', text: 'Requisiti legali e cogenti applicabili identificati' },
    { ref: 'P9', text: 'Subforniture necessarie identificate' },
    { ref: 'P10', text: 'Rischi contrattuali valutati' },
];

const FINAL_ITEMS = [
    { ref: 'F1', text: "Ordine conforme all'offerta inviata" },
    { ref: 'F2', text: 'Variazioni rispetto all\'offerta documentate' },
    { ref: 'F3', text: 'Capacità confermata alla data dell\'ordine' },
    { ref: 'F4', text: 'Qualifiche personale ancora valide per la commessa' },
    { ref: 'F5', text: 'Piano qualità/controlli definito' },
    { ref: 'F6', text: 'Responsabile commessa assegnato' },
];

const CHECKLIST_ANSWERS = new Set(['yes', 'no', 'na', 'partial']);

function sendErr(res, httpStatus, message, code) {
    return res.status(httpStatus).json({ error: message, code });
}

function parseCaseId(raw) {
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function parseItemId(raw) {
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeReason(reason) {
    if (reason === undefined || reason === null) return '';
    return String(reason).trim();
}

function normalizeOptionalText(raw, maxLen) {
    if (raw === undefined || raw === null) return null;
    const s = String(raw).trim();
    if (!s) return null;
    return maxLen ? s.substring(0, maxLen) : s;
}

async function resolveOptionalCompanyId(rawCompanyId, organizationId) {
    if (rawCompanyId == null || rawCompanyId === '') return { ok: true, companyId: null };
    const companyId = parseCompanyId(rawCompanyId);
    if (!companyId) {
        return { ok: false, status: 400, error: 'company_id non valido', code: 'VALIDATION_ERROR' };
    }
    const belongsToOrg = await companyBelongsToOrg(companyId, organizationId);
    if (!belongsToOrg) {
        return {
            ok: false,
            status: 400,
            error: "L'azienda selezionata non appartiene all'organizzazione.",
            code: 'VALIDATION_ERROR',
        };
    }
    return { ok: true, companyId };
}

async function fetchCaseRow(caseId, organizationId) {
    const r = await query(
        `
        SELECT ${CASE_SELECT_SQL}
        ${CASE_FROM_SQL}
        WHERE cc.id = @caseId AND cc.organization_id = @organizationId
        `,
        { caseId, organizationId },
    );
    return r.recordset[0] || null;
}

/** Valida supplier_id opzionale per collegamento documento (solo se counterparty=supplier). */
async function resolveLinkSupplierId(supplierIdRaw, counterparty, organizationId) {
    if (counterparty !== 'supplier') return { value: null };
    if (supplierIdRaw == null || supplierIdRaw === '') return { value: null };
    const sid = parseInt(supplierIdRaw, 10);
    if (!Number.isFinite(sid) || sid <= 0) {
        return { error: 'supplier_id non valido' };
    }
    const r = await query(
        `SELECT id FROM suppliers WHERE id = @sid AND organization_id = @organizationId`,
        { sid, organizationId },
    );
    if (!r.recordset.length) {
        return { error: 'Fornitore non trovato' };
    }
    return { value: sid };
}

async function listCases(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const rawStatus = req.query.status;
        const filterStatus =
            rawStatus !== undefined && rawStatus !== null && String(rawStatus).trim() !== ''
                ? String(rawStatus).trim()
                : null;

        if (filterStatus && !CASE_STATUSES.has(filterStatus)) {
            return sendErr(res, 400, 'Parametro status non valido', 'VALIDATION_ERROR');
        }

        const r = await query(
            `
            SELECT ${CASE_SELECT_SQL}
            ${CASE_FROM_SQL}
            WHERE cc.organization_id = @organizationId
              AND (@filterStatus IS NULL OR cc.status = @filterStatus)
            ORDER BY cc.updated_at DESC
            `,
            { organizationId, filterStatus },
        );

        return res.json(r.recordset);
    } catch (err) {
        logger.error('listCases', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function getCase(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) {
            return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        }

        const caseRow = await fetchCaseRow(caseId, organizationId);
        if (!caseRow) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const [historyRes, checklistRes, clarRes, docRes, attRes] = await Promise.all([
            query(
                `
                SELECT id, case_id, from_status, to_status, changed_by, reason, created_at
                FROM commercial_case_history
                WHERE case_id = @caseId
                ORDER BY id ASC
                `,
                { caseId },
            ),
            query(
                `
                SELECT *
                FROM commercial_case_checklist
                WHERE case_id = @caseId
                ORDER BY phase ASC, id ASC
                `,
                { caseId },
            ),
            query(
                `
                SELECT id, case_id, message, due_date, response_text, resolved_at, created_by, created_at, updated_at
                FROM commercial_case_clarifications
                WHERE case_id = @caseId
                ORDER BY id ASC
                `,
                { caseId },
            ).catch(() => ({ recordset: [] })),
            query(
                `
                SELECT ccd.id, ccd.case_id, ccd.document_id, ccd.doc_role, ccd.direction, ccd.counterparty,
                       ccd.supplier_id, ccd.linked_at, dr.title AS document_title, dr.doc_type,
                       s.name AS supplier_name
                FROM commercial_case_documents ccd
                INNER JOIN document_registry dr ON dr.id = ccd.document_id
                LEFT JOIN suppliers s ON s.id = ccd.supplier_id AND s.organization_id = @organizationId
                WHERE ccd.case_id = @caseId AND dr.organization_id = @organizationId
                ORDER BY ccd.linked_at DESC
                `,
                { caseId, organizationId },
            ).catch(() => ({ recordset: [] })),
            query(
                `
                SELECT attachment_id, attachment_uuid, file_name, file_size, mime_type, category,
                       commercial_direction, commercial_counterparty, commercial_doc_role, created_at
                FROM attachments
                WHERE commercial_case_id = @caseId
                ORDER BY created_at DESC
                `,
                { caseId },
            ).catch(() => ({ recordset: [] })),
        ]);

        return res.json({
            case: caseRow,
            history: historyRes.recordset,
            checklist: checklistRes.recordset,
            clarifications: clarRes.recordset,
            documents: docRes.recordset,
            attachments: attRes.recordset,
        });
    } catch (err) {
        logger.error('getCase', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function createCase(req, res) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const {
            title,
            company_id: companyId,
            external_ref: externalRef,
            notes,
            commercial_customer_id: commercialCustomerId,
            commercial_customer_name: commercialCustomerName,
            commercial_customer_ref: commercialCustomerRef,
        } = req.body || {};

        if (!title || String(title).trim() === '') {
            return sendErr(res, 400, 'Il titolo è obbligatorio', 'VALIDATION_ERROR');
        }

        const companyScope = await resolveOptionalCompanyId(companyId, organizationId);
        if (!companyScope.ok) {
            return sendErr(res, companyScope.status, companyScope.error, companyScope.code);
        }
        const companyIdVal = companyScope.companyId;

        const customerFields = await resolveCommercialCustomerFields({
            organizationId,
            companyId: companyIdVal,
            commercialCustomerIdRaw: commercialCustomerId,
            commercialCustomerNameRaw: commercialCustomerName,
            commercialCustomerRefRaw: commercialCustomerRef,
        });
        if (!customerFields.ok) {
            return sendErr(res, customerFields.status, customerFields.error, customerFields.code);
        }

        await transaction.begin();

        const insertReq = new sql.Request(transaction);
        insertReq.input('organizationId', organizationId);
        insertReq.input('companyId', companyIdVal);
        insertReq.input('title', String(title).trim());
        insertReq.input('externalRef', externalRef != null ? String(externalRef).trim() : null);
        insertReq.input('notes', notes != null ? String(notes) : null);
        insertReq.input('commercialCustomerId', customerFields.commercialCustomerId);
        insertReq.input('commercialCustomerName', customerFields.commercialCustomerName);
        insertReq.input('commercialCustomerRef', customerFields.commercialCustomerRef);
        insertReq.input('userId', userId);

        const ins = await insertReq.query(`
            INSERT INTO commercial_cases (
                organization_id, company_id, title, external_ref, status, notes,
                commercial_customer_id, commercial_customer_name, commercial_customer_ref, created_by
            )
            OUTPUT INSERTED.*
            VALUES (
                @organizationId, @companyId, @title, @externalRef, 'DRAFT', @notes,
                @commercialCustomerId, @commercialCustomerName, @commercialCustomerRef, @userId
            )
        `);

        const created = ins.recordset[0];
        const newCaseId = created.id;

        const histReq = new sql.Request(transaction);
        histReq.input('caseId', newCaseId);
        histReq.input('userId', userId);
        await histReq.query(`
            INSERT INTO commercial_case_history (case_id, from_status, to_status, changed_by, reason)
            VALUES (@caseId, NULL, 'DRAFT', @userId, NULL)
        `);

        await transaction.commit();
        return res.status(201).json(created);
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (_) {
            /* ignore */
        }
        logger.error('createCase', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function updateCase(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) {
            return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        }

        const existing = await fetchCaseRow(caseId, organizationId);
        if (!existing) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        if (['APPROVED', 'CANCELLED', 'REJECTED'].includes(existing.status)) {
            return sendErr(
                res,
                409,
                'Impossibile modificare un caso in stato terminale',
                'FORBIDDEN_STATE',
            );
        }

        const {
            title,
            notes,
            external_ref: externalRef,
            current_assignee_id: assigneeRaw,
            company_id: companyIdRaw,
            commercial_customer_id: commercialCustomerId,
            commercial_customer_name: commercialCustomerName,
            commercial_customer_ref: commercialCustomerRef,
        } = req.body || {};

        const titleNext =
            title !== undefined ? String(title).trim() : String(existing.title || '').trim();
        if (!titleNext) {
            return sendErr(res, 400, 'Il titolo non può essere vuoto', 'VALIDATION_ERROR');
        }

        let assigneeId = existing.current_assignee_id;
        if (assigneeRaw !== undefined) {
            if (assigneeRaw === null || assigneeRaw === '') {
                assigneeId = null;
            } else {
                const parsed = parseInt(assigneeRaw, 10);
                if (!Number.isFinite(parsed) || parsed <= 0) {
                    return sendErr(res, 400, 'current_assignee_id non valido', 'VALIDATION_ERROR');
                }
                assigneeId = parsed;
            }
        }

        const notesNext =
            notes !== undefined ? (notes != null ? String(notes) : null) : existing.notes;
        const extNext =
            externalRef !== undefined
                ? externalRef != null
                    ? String(externalRef).trim()
                    : null
                : existing.external_ref;

        let companyIdNext = existing.company_id;
        if (companyIdRaw !== undefined) {
            const companyScope = await resolveOptionalCompanyId(companyIdRaw, organizationId);
            if (!companyScope.ok) {
                return sendErr(res, companyScope.status, companyScope.error, companyScope.code);
            }
            companyIdNext = companyScope.companyId;
        }

        const customerFields = await resolveCommercialCustomerFields({
            organizationId,
            companyId: companyIdNext,
            commercialCustomerIdRaw: commercialCustomerId,
            commercialCustomerNameRaw: commercialCustomerName,
            commercialCustomerRefRaw: commercialCustomerRef,
            existing,
        });
        if (!customerFields.ok) {
            return sendErr(res, customerFields.status, customerFields.error, customerFields.code);
        }

        const upd = await query(
            `
            UPDATE commercial_cases
            SET title = @title,
                notes = @notes,
                external_ref = @externalRef,
                company_id = @companyId,
                commercial_customer_id = @commercialCustomerId,
                commercial_customer_name = @commercialCustomerName,
                commercial_customer_ref = @commercialCustomerRef,
                current_assignee_id = @assigneeId,
                updated_at = SYSUTCDATETIME()
            OUTPUT INSERTED.*
            WHERE id = @caseId AND organization_id = @organizationId
            `,
            {
                title: titleNext,
                notes: notesNext,
                externalRef: extNext,
                companyId: companyIdNext,
                commercialCustomerId: customerFields.commercialCustomerId,
                commercialCustomerName: customerFields.commercialCustomerName,
                commercialCustomerRef: customerFields.commercialCustomerRef,
                assigneeId,
                caseId,
                organizationId,
            },
        );

        if (!upd.recordset.length) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const updatedRow = upd.recordset[0];
        if (assigneeRaw !== undefined && assigneeId !== existing.current_assignee_id) {
            await crNotify.notifyAfterAssigneeChange({
                organizationId,
                caseRow: updatedRow,
                previousAssigneeId: existing.current_assignee_id,
                newAssigneeId: assigneeId,
                actorUserId: req.user.user_id,
            });
        }

        return res.json(updatedRow);
    } catch (err) {
        logger.error('updateCase', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function transitionStatus(req, res) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) {
            return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        }

        const { to_status: toStatusRaw, reason } = req.body || {};
        const toStatus =
            toStatusRaw !== undefined && toStatusRaw !== null
                ? String(toStatusRaw).trim()
                : '';

        if (!toStatus || !CASE_STATUSES.has(toStatus)) {
            return sendErr(res, 400, 'to_status non valido', 'VALIDATION_ERROR');
        }

        await transaction.begin();

        const lockReq = new sql.Request(transaction);
        lockReq.input('caseId', caseId);
        lockReq.input('organizationId', organizationId);
        const curRes = await lockReq.query(`
            SELECT * FROM commercial_cases WITH (UPDLOCK, ROWLOCK)
            WHERE id = @caseId AND organization_id = @organizationId
        `);
        const row = curRes.recordset[0];
        if (!row) {
            await transaction.rollback();
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const fromStatus = row.status;
        if (!workflow.isTransitionAllowed(fromStatus, toStatus)) {
            await transaction.rollback();
            return sendErr(res, 400, 'Transizione di stato non consentita', 'INVALID_TRANSITION');
        }

        const gate = await workflow.evaluateTransitionBlockers(caseId, fromStatus, toStatus);
        if (gate.blocked) {
            await transaction.rollback();
            return res.status(409).json({
                error: 'Requisiti mancanti per la transizione',
                code: 'TRANSITION_BLOCKED',
                missing_requirements: gate.missing,
            });
        }

        const reasonNorm = normalizeReason(reason);
        if (workflow.requiresTransitionReason(fromStatus, toStatus)) {
            if (!reasonNorm) {
                await transaction.rollback();
                return sendErr(
                    res,
                    400,
                    'Motivazione obbligatoria per questa transizione',
                    'VALIDATION_ERROR',
                );
            }
        }

        const updReq = new sql.Request(transaction);
        updReq.input('toStatus', toStatus);
        updReq.input('caseId', caseId);
        updReq.input('organizationId', organizationId);
        await updReq.query(`
            UPDATE commercial_cases
            SET status = @toStatus, updated_at = SYSUTCDATETIME()
            WHERE id = @caseId AND organization_id = @organizationId
        `);

        const histReq = new sql.Request(transaction);
        histReq.input('caseId', caseId);
        histReq.input('fromStatus', fromStatus);
        histReq.input('toStatus', toStatus);
        histReq.input('userId', userId);
        histReq.input(
            'reason',
            reasonNorm ? reasonNorm.substring(0, 500) : null,
        );
        await histReq.query(`
            INSERT INTO commercial_case_history (case_id, from_status, to_status, changed_by, reason)
            VALUES (@caseId, @fromStatus, @toStatus, @userId, @reason)
        `);

        await transaction.commit();

        const refreshed = await fetchCaseRow(caseId, organizationId);
        await crNotify.notifyAfterStatusTransition({
            organizationId,
            caseRow: refreshed,
            fromStatus,
            toStatus,
            actorUserId: userId,
        });
        return res.json(refreshed);
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (_) {
            /* ignore */
        }
        logger.error('transitionStatus', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function saveChecklistAnswer(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        const itemId = parseItemId(req.params.itemId);

        if (!caseId || !itemId) {
            return sendErr(res, 400, 'ID non valido', 'VALIDATION_ERROR');
        }

        const existing = await fetchCaseRow(caseId, organizationId);
        if (!existing) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const { answer: answerRaw, notes } = req.body || {};

        let answerVal = null;
        if (answerRaw !== undefined && answerRaw !== null && String(answerRaw).trim() !== '') {
            answerVal = String(answerRaw).trim().toLowerCase();
            if (!CHECKLIST_ANSWERS.has(answerVal)) {
                return sendErr(res, 400, 'Valore answer non valido', 'VALIDATION_ERROR');
            }
        }

        const params = {
            answerVal,
            userId,
            caseId,
            itemId,
            organizationId,
        };

        let setClause =
            'answer = @answerVal, answered_by = @userId, answered_at = SYSUTCDATETIME()';
        if (notes !== undefined) {
            setClause += ', notes = @notesNext';
            params.notesNext = notes != null ? String(notes) : null;
        }

        const upd = await query(
            `
            UPDATE ccl
            SET ${setClause}
            OUTPUT INSERTED.*
            FROM commercial_case_checklist AS ccl
            INNER JOIN commercial_cases AS cc ON cc.id = ccl.case_id
            WHERE ccl.id = @itemId AND ccl.case_id = @caseId AND cc.organization_id = @organizationId
            `,
            params,
        );

        if (!upd.recordset.length) {
            return sendErr(res, 404, 'Voce checklist non trovata', 'NOT_FOUND');
        }

        return res.json(upd.recordset[0]);
    } catch (err) {
        logger.error('saveChecklistAnswer', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function generateChecklist(req, res) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) {
            return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        }

        const existing = await fetchCaseRow(caseId, organizationId);
        if (!existing) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        const phaseRaw = (req.body || {}).phase;
        const phase =
            phaseRaw !== undefined && phaseRaw !== null ? String(phaseRaw).trim().toLowerCase() : '';

        if (phase !== 'preliminary' && phase !== 'final') {
            return sendErr(res, 400, 'phase deve essere preliminary o final', 'VALIDATION_ERROR');
        }

        const items = phase === 'preliminary' ? PRELIMINARY_ITEMS : FINAL_ITEMS;

        await transaction.begin();

        let inserted = 0;
        for (const item of items) {
            const insReq = new sql.Request(transaction);
            insReq.input('caseId', caseId);
            insReq.input('phase', phase);
            insReq.input('itemRef', item.ref);
            insReq.input('itemText', item.text);
            const ins = await insReq.query(`
                INSERT INTO commercial_case_checklist (case_id, phase, item_ref, item_text)
                SELECT @caseId, @phase, @itemRef, @itemText
                WHERE NOT EXISTS (
                    SELECT 1 FROM commercial_case_checklist
                    WHERE case_id = @caseId AND phase = @phase AND item_ref = @itemRef
                )
            `);
            const ra = ins.rowsAffected && ins.rowsAffected[0];
            if (ra) inserted += ra;
        }

        await transaction.commit();

        const listRes = await query(
            `
            SELECT *
            FROM commercial_case_checklist
            WHERE case_id = @caseId AND phase = @phase
            ORDER BY item_ref ASC
            `,
            { caseId, phase },
        );

        return res.status(201).json({
            phase,
            insertedCount: inserted,
            checklist: listRes.recordset,
        });
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (_) {
            /* ignore */
        }
        logger.error('generateChecklist', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function getSummary(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const r = await query(
            `
            SELECT
              COUNT(*) AS total,
              SUM(CASE WHEN status NOT IN ('APPROVED','CANCELLED','REJECTED') THEN 1 ELSE 0 END) AS open_count,
              SUM(CASE WHEN current_assignee_id = @userId AND status NOT IN ('APPROVED','CANCELLED','REJECTED') THEN 1 ELSE 0 END) AS assigned_to_me,
              SUM(CASE WHEN status IN ('QUOTE_APPROVAL','FINAL_REVIEW') THEN 1 ELSE 0 END) AS pending_approval
            FROM commercial_cases
            WHERE organization_id = @organizationId
            `,
            { organizationId, userId },
        );
        return res.json(r.recordset[0] || {});
    } catch (err) {
        logger.error('getSummary', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function getInbox(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const kind = String(req.query.kind || 'assigned_to_me').trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

        let where = 'cc.organization_id = @organizationId AND cc.status NOT IN (\'APPROVED\',\'CANCELLED\',\'REJECTED\')';
        if (kind === 'pending_approval') {
            where += " AND cc.status IN ('QUOTE_APPROVAL','FINAL_REVIEW')";
        } else if (kind === 'stale') {
            where += ' AND cc.updated_at < DATEADD(day, -14, SYSUTCDATETIME())';
        } else {
            where += ' AND cc.current_assignee_id = @userId';
        }

        const r = await query(
            `
            SELECT TOP (@limit) cc.*, co.name AS company_name
            FROM commercial_cases cc
            LEFT JOIN companies co ON co.id = cc.company_id
            WHERE ${where}
            ORDER BY cc.updated_at DESC
            `,
            { organizationId, userId, limit },
        );
        return res.json({ kind, items: r.recordset });
    } catch (err) {
        logger.error('getInbox', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function getTransitionOptions(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');

        const caseRow = await fetchCaseRow(caseId, organizationId);
        if (!caseRow) return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');

        const options = await workflow.buildTransitionOptions(caseRow.status, caseId);
        return res.json({ from_status: caseRow.status, options });
    } catch (err) {
        logger.error('getTransitionOptions', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function listClarifications(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const r = await query(
            `SELECT * FROM commercial_case_clarifications WHERE case_id = @caseId ORDER BY id ASC`,
            { caseId },
        );
        return res.json(r.recordset);
    } catch (err) {
        logger.error('listClarifications', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function createClarification(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        const { message, due_date: dueDate } = req.body || {};
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        if (!message || !String(message).trim()) {
            return sendErr(res, 400, 'Il messaggio è obbligatorio', 'VALIDATION_ERROR');
        }
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const ins = await query(
            `
            INSERT INTO commercial_case_clarifications (case_id, message, due_date, created_by)
            OUTPUT INSERTED.*
            VALUES (@caseId, @message, @dueDate, @userId)
            `,
            {
                caseId,
                message: String(message).trim(),
                dueDate: dueDate || null,
                userId,
            },
        );
        return res.status(201).json(ins.recordset[0]);
    } catch (err) {
        logger.error('createClarification', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function updateClarification(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        const clarId = parseItemId(req.params.clarificationId);
        const { response_text: responseText, resolved } = req.body || {};
        if (!caseId || !clarId) return sendErr(res, 400, 'ID non valido', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const resolvedAt =
            resolved === true || resolved === 'true' || resolved === 1 ? 'SYSUTCDATETIME()' : null;
        const r = await query(
            `
            UPDATE commercial_case_clarifications
            SET response_text = COALESCE(@responseText, response_text),
                resolved_at = CASE WHEN @markResolved = 1 THEN SYSUTCDATETIME() ELSE resolved_at END,
                updated_at = SYSUTCDATETIME()
            OUTPUT INSERTED.*
            WHERE id = @clarId AND case_id = @caseId
            `,
            {
                clarId,
                caseId,
                responseText: responseText != null ? String(responseText) : null,
                markResolved: resolvedAt ? 1 : 0,
            },
        );
        if (!r.recordset.length) return sendErr(res, 404, 'Chiarimento non trovato', 'NOT_FOUND');
        return res.json(r.recordset[0]);
    } catch (err) {
        logger.error('updateClarification', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function listCaseDocuments(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const r = await query(
            `
            SELECT ccd.*, dr.title AS document_title, dr.doc_type, dr.status AS document_status,
                   s.name AS supplier_name
            FROM commercial_case_documents ccd
            INNER JOIN document_registry dr ON dr.id = ccd.document_id
            LEFT JOIN suppliers s ON s.id = ccd.supplier_id AND s.organization_id = @organizationId
            WHERE ccd.case_id = @caseId AND dr.organization_id = @organizationId
            ORDER BY ccd.linked_at DESC
            `,
            { caseId, organizationId },
        );
        return res.json(r.recordset);
    } catch (err) {
        logger.error('listCaseDocuments', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function linkDocument(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        const { document_id: documentId, doc_role: docRole, direction, counterparty, supplier_id: supplierIdRaw } =
            req.body || {};
        if (!caseId || !documentId) {
            return sendErr(res, 400, 'case id e document_id obbligatori', 'VALIDATION_ERROR');
        }
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const docId = parseInt(documentId, 10);
        const docCheck = await query(
            `SELECT id FROM document_registry WHERE id = @docId AND organization_id = @organizationId`,
            { docId, organizationId },
        );
        if (!docCheck.recordset.length) {
            return sendErr(res, 404, 'Documento non trovato', 'NOT_FOUND');
        }
        const dir = direction === 'out' ? 'out' : 'in';
        const cp =
            counterparty === 'supplier' || counterparty === 'internal' ? counterparty : 'customer';
        const supplierResolved = await resolveLinkSupplierId(supplierIdRaw, cp, organizationId);
        if (supplierResolved.error) {
            return sendErr(res, 400, supplierResolved.error, 'VALIDATION_ERROR');
        }
        const role = docRole ? String(docRole).trim().substring(0, 30) : 'other';
        const ins = await query(
            `
            INSERT INTO commercial_case_documents (case_id, document_id, doc_role, direction, counterparty, supplier_id, linked_by)
            OUTPUT INSERTED.*
            VALUES (@caseId, @docId, @role, @dir, @cp, @supplierId, @userId)
            `,
            {
                caseId,
                docId,
                role,
                dir,
                cp,
                supplierId: supplierResolved.value,
                userId,
            },
        );
        return res.status(201).json(ins.recordset[0]);
    } catch (err) {
        if (String(err.message).includes('UQ_ccd_case_doc') || String(err.message).includes('UNIQUE')) {
            return sendErr(res, 409, 'Documento già collegato al caso', 'DUPLICATE');
        }
        logger.error('linkDocument', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function unlinkDocument(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        const linkId = parseItemId(req.params.linkId);
        if (!caseId || !linkId) return sendErr(res, 400, 'ID non valido', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const del = await query(
            `DELETE FROM commercial_case_documents OUTPUT DELETED.id WHERE id = @linkId AND case_id = @caseId`,
            { linkId, caseId },
        );
        if (!del.recordset.length) return sendErr(res, 404, 'Collegamento non trovato', 'NOT_FOUND');
        return res.json({ success: true });
    } catch (err) {
        logger.error('unlinkDocument', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function listCaseAttachments(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const r = await query(
            `
            SELECT attachment_id, attachment_uuid, file_name, file_size, mime_type, category,
                   commercial_direction, commercial_counterparty, commercial_doc_role, description, created_at
            FROM attachments
            WHERE commercial_case_id = @caseId
            ORDER BY created_at DESC
            `,
            { caseId },
        );
        return res.json(r.recordset);
    } catch (err) {
        logger.error('listCaseAttachments', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function uploadCaseAttachment(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        if (!req.file) return sendErr(res, 400, 'Nessun file caricato', 'VALIDATION_ERROR');
        if (!(await fetchCaseRow(caseId, organizationId))) {
            await fs.unlink(req.file.path).catch(() => {});
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        const {
            category = 'document',
            description,
            direction,
            counterparty,
            doc_role: docRole,
        } = req.body || {};
        const dir = direction === 'out' ? 'out' : 'in';
        const cp =
            counterparty === 'supplier' || counterparty === 'internal' ? counterparty : 'customer';
        const result = await query(
            `
            INSERT INTO attachments (
              commercial_case_id, file_name, file_type, file_size, mime_type, storage_path,
              category, description, commercial_direction, commercial_counterparty, commercial_doc_role,
              uploaded_by, created_at
            )
            OUTPUT INSERTED.attachment_id, INSERTED.attachment_uuid
            VALUES (
              @caseId, @fileName, @fileType, @fileSize, @mimeType, @storagePath,
              @category, @description, @dir, @cp, @docRole,
              @userId, GETDATE()
            )
            `,
            {
                caseId,
                fileName: req.file.originalname,
                fileType: path.extname(req.file.originalname).toLowerCase(),
                fileSize: req.file.size,
                mimeType: req.file.mimetype,
                storagePath: req.file.path,
                category: category || 'document',
                description: description || null,
                dir,
                cp,
                docRole: docRole ? String(docRole).trim().substring(0, 30) : null,
                userId,
            },
        );
        const row = result.recordset[0];
        return res.status(201).json({
            attachment_id: row.attachment_id,
            attachment_uuid: row.attachment_uuid,
            file_name: req.file.originalname,
        });
    } catch (err) {
        if (req.file?.path) await fs.unlink(req.file.path).catch(() => {});
        logger.error('uploadCaseAttachment', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

const IMPORT_FILE_STATUSES = new Set(['extracted', 'reviewed']);
const NOTES_PREFILL_MAX = 2000;

function parseJobId(raw) {
    const id = parseInt(String(raw), 10);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function parseFileIdList(raw) {
    if (raw === undefined || raw === null) return null;
    if (!Array.isArray(raw)) return [];
    const ids = [];
    for (const item of raw) {
        const id = parseInt(String(item), 10);
        if (!Number.isFinite(id) || id <= 0) return [];
        ids.push(id);
    }
    return ids;
}

function guessDocRoleFromAi(aiJson) {
    if (!aiJson) return 'rfq';
    let data = aiJson;
    if (typeof aiJson === 'string') {
        try {
            data = JSON.parse(aiJson);
        } catch (_) {
            return 'rfq';
        }
    }
    const guess = String(
        data.document_type_guess || data.document_type || data.doc_type || '',
    )
        .trim()
        .toLowerCase();
    if (guess.includes('ordine') || guess.includes('order')) return 'order';
    if (guess.includes('offerta') || guess.includes('quote') || guess.includes('preventiv')) {
        return 'quote';
    }
    if (guess.includes('capitolato') || guess.includes('rfq') || guess.includes('richiesta')) {
        return 'rfq';
    }
    return 'rfq';
}

function buildNotesPrefill(explicitNotes, jobNotes, files) {
    if (explicitNotes !== undefined && explicitNotes !== null && String(explicitNotes).trim() !== '') {
        return String(explicitNotes);
    }
    const parts = [];
    if (jobNotes && String(jobNotes).trim()) {
        parts.push(String(jobNotes).trim());
    }
    for (const file of files) {
        if (file.extracted_text && String(file.extracted_text).trim()) {
            parts.push(String(file.extracted_text).trim());
            break;
        }
    }
    const merged = parts.join('\n\n');
    if (!merged) return null;
    return merged.length > NOTES_PREFILL_MAX ? `${merged.slice(0, NOTES_PREFILL_MAX)}…` : merged;
}

async function importFromJob(req, res) {
    const pool = await getPool();
    const transaction = new sql.Transaction(pool);

    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const body = req.body || {};
        const jobId = parseJobId(body.job_id);
        const fileIds = parseFileIdList(body.file_ids);

        if (!jobId) {
            return sendErr(res, 400, 'job_id obbligatorio e valido', 'VALIDATION_ERROR');
        }
        if (body.file_ids !== undefined && body.file_ids !== null && fileIds !== null && fileIds.length === 0) {
            return sendErr(res, 400, 'file_ids non valido', 'VALIDATION_ERROR');
        }

        const jobRes = await query(
            `
            SELECT id, title, company_id, notes
            FROM import_jobs
            WHERE id = @jobId AND organization_id = @organizationId
            `,
            { jobId, organizationId },
        );
        if (!jobRes.recordset.length) {
            return sendErr(res, 404, 'Job non trovato', 'NOT_FOUND');
        }
        const job = jobRes.recordset[0];

        const filesRes = await query(
            `
            SELECT f.id, f.original_name, f.storage_path, f.mime_type, f.file_size, f.status,
                   f.extracted_text, f.ai_extraction_json, f.commercial_case_id
            FROM import_job_files f
            WHERE f.job_id = @jobId
            ORDER BY f.id ASC
            `,
            { jobId },
        );
        let files = filesRes.recordset || [];

        if (fileIds && fileIds.length > 0) {
            const allowed = new Set(fileIds);
            files = files.filter((f) => allowed.has(f.id));
            if (files.length !== fileIds.length) {
                return sendErr(res, 400, 'Uno o più file_ids non appartengono al job', 'VALIDATION_ERROR');
            }
        } else {
            files = files.filter((f) => IMPORT_FILE_STATUSES.has(f.status));
        }

        if (!files.length) {
            return sendErr(
                res,
                400,
                'Nessun file in stato extracted o reviewed disponibile per il job',
                'NO_ELIGIBLE_FILES',
            );
        }

        for (const file of files) {
            if (!IMPORT_FILE_STATUSES.has(file.status)) {
                return sendErr(
                    res,
                    400,
                    `Il file ${file.id} deve essere in stato extracted o reviewed`,
                    'INVALID_FILE_STATUS',
                );
            }
        }

        const selectedIds = new Set(files.map((f) => f.id));

        const linkedByColumn = files.find((f) => f.commercial_case_id);
        if (linkedByColumn) {
            const caseRes = await query(
                `
                SELECT id, uuid
                FROM commercial_cases
                WHERE id = @caseId AND organization_id = @organizationId
                `,
                { caseId: linkedByColumn.commercial_case_id, organizationId },
            );
            const caseRow = caseRes.recordset[0];
            if (caseRow) {
                return res.status(409).json({
                    error: 'Uno o più file sono già collegati a un caso Riesame',
                    code: 'ALREADY_LINKED',
                    case_id: caseRow.id,
                    uuid: caseRow.uuid,
                    file_id: linkedByColumn.id,
                });
            }
        }

        const linkedRes = await query(
            `
            SELECT f.id AS file_id, a.commercial_case_id AS case_id, c.uuid AS case_uuid
            FROM import_job_files f
            INNER JOIN attachments a ON a.storage_path = f.storage_path AND a.commercial_case_id IS NOT NULL
            LEFT JOIN commercial_cases c ON c.id = a.commercial_case_id AND c.organization_id = @organizationId
            WHERE f.job_id = @jobId
            `,
            { jobId, organizationId },
        );
        const alreadyLinked = (linkedRes.recordset || []).find((row) => selectedIds.has(row.file_id));
        if (alreadyLinked) {
            return res.status(409).json({
                error: 'Uno o più file sono già collegati a un caso Riesame',
                code: 'ALREADY_LINKED',
                case_id: alreadyLinked.case_id,
                uuid: alreadyLinked.case_uuid,
                file_id: alreadyLinked.file_id,
            });
        }

        let companyIdVal = job.company_id;
        if (body.company_id != null && body.company_id !== '') {
            companyIdVal = body.company_id;
        }
        const companyScope = await resolveOptionalCompanyId(companyIdVal, organizationId);
        if (!companyScope.ok) {
            return sendErr(res, companyScope.status, companyScope.error, companyScope.code);
        }
        companyIdVal = companyScope.companyId;

        const titleRaw =
            body.title !== undefined && body.title !== null && String(body.title).trim() !== ''
                ? String(body.title).trim()
                : String(job.title || files[0].original_name || 'Riesame da import').trim();
        if (!titleRaw) {
            return sendErr(res, 400, 'Il titolo è obbligatorio', 'VALIDATION_ERROR');
        }

        const externalRef =
            body.external_ref != null && String(body.external_ref).trim() !== ''
                ? String(body.external_ref).trim()
                : null;
        const customerFields = await resolveCommercialCustomerFields({
            organizationId,
            companyId: companyIdVal,
            commercialCustomerIdRaw: body.commercial_customer_id,
            commercialCustomerNameRaw: body.commercial_customer_name,
            commercialCustomerRefRaw: body.commercial_customer_ref,
        });
        if (!customerFields.ok) {
            return sendErr(res, customerFields.status, customerFields.error, customerFields.code);
        }
        const notesVal = buildNotesPrefill(body.notes, job.notes, files);

        await transaction.begin();

        const insertReq = new sql.Request(transaction);
        insertReq.input('organizationId', organizationId);
        insertReq.input('companyId', companyIdVal);
        insertReq.input('title', titleRaw.substring(0, 255));
        insertReq.input('externalRef', externalRef);
        insertReq.input('notes', notesVal);
        insertReq.input('commercialCustomerId', customerFields.commercialCustomerId);
        insertReq.input('commercialCustomerName', customerFields.commercialCustomerName);
        insertReq.input('commercialCustomerRef', customerFields.commercialCustomerRef);
        insertReq.input('userId', userId);
        insertReq.input('sourceImportJobId', jobId);

        const ins = await insertReq.query(`
            INSERT INTO commercial_cases (
                organization_id, company_id, title, external_ref, status, notes, created_by,
                source_import_job_id, commercial_customer_id,
                commercial_customer_name, commercial_customer_ref
            )
            OUTPUT INSERTED.*
            VALUES (
                @organizationId, @companyId, @title, @externalRef, 'DRAFT', @notes, @userId,
                @sourceImportJobId, @commercialCustomerId,
                @commercialCustomerName, @commercialCustomerRef
            )
        `);
        const created = ins.recordset[0];
        const newCaseId = created.id;

        const histReq = new sql.Request(transaction);
        histReq.input('caseId', newCaseId);
        histReq.input('userId', userId);
        await histReq.query(`
            INSERT INTO commercial_case_history (case_id, from_status, to_status, changed_by, reason)
            VALUES (@caseId, NULL, 'DRAFT', @userId, 'Creato da import job')
        `);

        for (const item of PRELIMINARY_ITEMS) {
            const chkReq = new sql.Request(transaction);
            chkReq.input('caseId', newCaseId);
            chkReq.input('phase', 'preliminary');
            chkReq.input('itemRef', item.ref);
            chkReq.input('itemText', item.text);
            await chkReq.query(`
                INSERT INTO commercial_case_checklist (case_id, phase, item_ref, item_text)
                SELECT @caseId, @phase, @itemRef, @itemText
                WHERE NOT EXISTS (
                    SELECT 1 FROM commercial_case_checklist
                    WHERE case_id = @caseId AND phase = @phase AND item_ref = @itemRef
                )
            `);
        }

        const linkedAttachments = [];
        for (const file of files) {
            const docRole = guessDocRoleFromAi(file.ai_extraction_json);
            const attReq = new sql.Request(transaction);
            attReq.input('caseId', newCaseId);
            attReq.input('fileName', file.original_name || 'documento.pdf');
            attReq.input(
                'fileType',
                path.extname(file.original_name || '').toLowerCase() || '.pdf',
            );
            attReq.input('fileSize', file.file_size || null);
            attReq.input('mimeType', file.mime_type || 'application/pdf');
            attReq.input('storagePath', file.storage_path);
            attReq.input('docRole', docRole.substring(0, 30));
            attReq.input('userId', userId);
            const attIns = await attReq.query(`
                INSERT INTO attachments (
                  commercial_case_id, file_name, file_type, file_size, mime_type, storage_path,
                  category, description, commercial_direction, commercial_counterparty, commercial_doc_role,
                  uploaded_by, created_at
                )
                OUTPUT INSERTED.attachment_id, INSERTED.attachment_uuid, INSERTED.file_name
                VALUES (
                  @caseId, @fileName, @fileType, @fileSize, @mimeType, @storagePath,
                  'document', NULL, 'in', 'customer', @docRole,
                  @userId, GETDATE()
                )
            `);
            linkedAttachments.push(attIns.recordset[0]);
        }

        for (const file of files) {
            const linkReq = new sql.Request(transaction);
            linkReq.input('fileId', file.id);
            linkReq.input('caseId', newCaseId);
            await linkReq.query(`
                UPDATE import_job_files
                SET commercial_case_id = @caseId
                WHERE id = @fileId AND commercial_case_id IS NULL
            `);
        }

        await transaction.commit();

        return res.status(201).json({
            case_id: newCaseId,
            uuid: created.uuid,
            title: created.title,
            status: created.status,
            job_id: jobId,
            linked_files: linkedAttachments.map((a) => ({
                attachment_id: a.attachment_id,
                attachment_uuid: a.attachment_uuid,
                file_name: a.file_name,
            })),
        });
    } catch (err) {
        try {
            await transaction.rollback();
        } catch (_) {
            /* ignore */
        }
        logger.error('importFromJob', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function analyzeRequirements(req, res) {
    try {
        const provider = getActiveProvider();
        if (!provider) {
            return res.status(503).json({ error: 'Nessun provider AI configurato.', code: 'AI_NOT_CONFIGURED' });
        }
        const organizationId = req.user.organization_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        const caseRow = await fetchCaseRow(caseId, organizationId);
        if (!caseRow) return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');

        let capitolatoText = req.body?.capitolatoText ? String(req.body.capitolatoText) : '';
        if (!capitolatoText.trim() && caseRow.notes) {
            capitolatoText = String(caseRow.notes);
        }
        if (!capitolatoText.trim()) {
            return sendErr(res, 400, 'Fornire capitolatoText nel body o note sul caso', 'VALIDATION_ERROR');
        }

        const standardCodes = Array.isArray(req.body?.standardCodes) && req.body.standardCodes.length
            ? req.body.standardCodes
            : undefined;
        const built = await contextBuilder.buildReviewRequirementsContext({
            capitolatoText,
            companyId: caseRow.company_id,
            organizationId,
            commercialCustomerName: caseRow.commercial_customer_name,
            commercialCustomerRef: caseRow.commercial_customer_ref,
            standardCodes,
        });
        const systemPrompt = await enrichSystemPromptWithOrganization(built.systemPrompt, organizationId);
        const result = await chat(
            [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: built.userPrompt },
            ],
            { temperature: 0.3, responseFormat: 'json' },
        );
        let suggestion;
        try {
            suggestion = JSON.parse(String(result.content).replace(/^```json\s*/i, '').replace(/\s*```$/i, ''));
        } catch {
            suggestion = { raw: result.content };
        }
        return res.json({
            feature: 'review_requirements',
            case_id: caseId,
            suggestion,
            _aiMeta: {
                provider,
                model: result.model,
                contextSummary: (built.contextSummary || '').substring(0, 500),
            },
        });
    } catch (err) {
        logger.error('analyzeRequirements', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

async function registerHandoff(req, res) {
    try {
        const organizationId = req.user.organization_id;
        const userId = req.user.user_id;
        const caseId = parseCaseId(req.params.id);
        if (!caseId) {
            return sendErr(res, 400, 'ID caso non valido', 'VALIDATION_ERROR');
        }

        const existing = await fetchCaseRow(caseId, organizationId);
        if (!existing) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }
        if (existing.status !== 'APPROVED') {
            return sendErr(
                res,
                409,
                'Handoff consentito solo per casi approvati',
                'FORBIDDEN_STATE',
            );
        }

        const { handoff_ref: handoffRefRaw, notes } = req.body || {};
        const handoffRef =
            handoffRefRaw !== undefined && handoffRefRaw !== null
                ? String(handoffRefRaw).trim()
                : '';
        if (!handoffRef) {
            return sendErr(res, 400, 'handoff_ref obbligatorio', 'VALIDATION_ERROR');
        }

        const notesVal =
            notes !== undefined && notes !== null ? String(notes).trim().substring(0, 500) : null;

        const upd = await query(
            `
            UPDATE commercial_cases
            SET handoff_ref = @handoffRef,
                handoff_at = SYSUTCDATETIME(),
                handoff_by = @userId,
                handoff_notes = @notesVal,
                updated_at = SYSUTCDATETIME()
            OUTPUT INSERTED.*
            WHERE id = @caseId AND organization_id = @organizationId
            `,
            {
                handoffRef: handoffRef.substring(0, 100),
                userId,
                notesVal,
                caseId,
                organizationId,
            },
        );

        if (!upd.recordset.length) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        return res.json(upd.recordset[0]);
    } catch (err) {
        logger.error('registerHandoff', err.message);
        return sendErr(res, 500, err.message, 'SERVER_ERROR');
    }
}

module.exports = {
    listCases,
    getCase,
    createCase,
    updateCase,
    transitionStatus,
    saveChecklistAnswer,
    generateChecklist,
    getSummary,
    getInbox,
    getTransitionOptions,
    listClarifications,
    createClarification,
    updateClarification,
    listCaseDocuments,
    linkDocument,
    unlinkDocument,
    listCaseAttachments,
    uploadCaseAttachment,
    analyzeRequirements,
    importFromJob,
    registerHandoff,
    isTransitionAllowed: workflow.isTransitionAllowed,
    requiresTransitionReason: workflow.requiresTransitionReason,
};
