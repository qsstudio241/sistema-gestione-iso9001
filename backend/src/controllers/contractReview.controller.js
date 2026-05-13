/**
 * contractReview.controller.js — Riesame requisiti contratto / ciclo commerciale (commercial_cases)
 */

const { query, getPool, sql } = require('../config/database');
const logger = require('../utils/logger');

/** Stati ammessi sul workflow lineare + terminali */
const CASE_STATUSES = new Set([
    'DRAFT',
    'INTAKE_REVIEW',
    'CLARIFICATION',
    'QUOTE_PREP',
    'QUOTE_APPROVAL',
    'QUOTE_SENT',
    'ORDER_RECEIVED',
    'FINAL_REVIEW',
    'APPROVED',
    'CANCELLED',
    'REJECTED',
]);

/** Transizioni esplicite (esclusi CANCELLED / REJECTED gestiti come “any”) */
const ALLOWED_STATUS_TRANSITIONS = {
    DRAFT: ['INTAKE_REVIEW'],
    INTAKE_REVIEW: ['CLARIFICATION', 'QUOTE_PREP', 'DRAFT'],
    CLARIFICATION: ['INTAKE_REVIEW', 'QUOTE_PREP'],
    QUOTE_PREP: ['QUOTE_APPROVAL', 'INTAKE_REVIEW'],
    QUOTE_APPROVAL: ['QUOTE_SENT', 'QUOTE_PREP'],
    QUOTE_SENT: ['ORDER_RECEIVED', 'CANCELLED'],
    ORDER_RECEIVED: ['FINAL_REVIEW'],
    FINAL_REVIEW: ['APPROVED', 'ORDER_RECEIVED'],
};

/** Coppie from→to che sono “indietro” e richiedono motivazione */
const BACKWARD_TRANSITION_KEYS = new Set([
    'INTAKE_REVIEW|DRAFT',
    'CLARIFICATION|INTAKE_REVIEW',
    'QUOTE_PREP|INTAKE_REVIEW',
    'QUOTE_APPROVAL|QUOTE_PREP',
    'FINAL_REVIEW|ORDER_RECEIVED',
]);

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

function requiresTransitionReason(fromStatus, toStatus) {
    if (toStatus === 'CANCELLED' || toStatus === 'REJECTED') return true;
    return BACKWARD_TRANSITION_KEYS.has(`${fromStatus}|${toStatus}`);
}

function isTransitionAllowed(fromStatus, toStatus) {
    if (fromStatus === toStatus) return false;
    if (TERMINAL_FROM_STATUSES.has(fromStatus)) return false;
    if (toStatus === 'CANCELLED' || toStatus === 'REJECTED') return true;
    const next = ALLOWED_STATUS_TRANSITIONS[fromStatus];
    return Array.isArray(next) && next.includes(toStatus);
}

function normalizeReason(reason) {
    if (reason === undefined || reason === null) return '';
    return String(reason).trim();
}

async function fetchCaseRow(caseId, organizationId) {
    const r = await query(
        `SELECT * FROM commercial_cases WHERE id = @caseId AND organization_id = @organizationId`,
        { caseId, organizationId },
    );
    return r.recordset[0] || null;
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
            SELECT *
            FROM commercial_cases
            WHERE organization_id = @organizationId
              AND (@filterStatus IS NULL OR status = @filterStatus)
            ORDER BY updated_at DESC
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

        const [historyRes, checklistRes] = await Promise.all([
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
        ]);

        return res.json({
            case: caseRow,
            history: historyRes.recordset,
            checklist: checklistRes.recordset,
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
        const { title, company_id: companyId, external_ref: externalRef, notes } = req.body || {};

        if (!title || String(title).trim() === '') {
            return sendErr(res, 400, 'Il titolo è obbligatorio', 'VALIDATION_ERROR');
        }

        let companyIdVal = null;
        if (companyId != null && companyId !== '') {
            const co = parseInt(companyId, 10);
            if (!Number.isFinite(co) || co <= 0) {
                return sendErr(res, 400, 'company_id non valido', 'VALIDATION_ERROR');
            }
            companyIdVal = co;
        }

        await transaction.begin();

        const insertReq = new sql.Request(transaction);
        insertReq.input('organizationId', organizationId);
        insertReq.input('companyId', companyIdVal);
        insertReq.input('title', String(title).trim());
        insertReq.input('externalRef', externalRef != null ? String(externalRef).trim() : null);
        insertReq.input('notes', notes != null ? String(notes) : null);
        insertReq.input('userId', userId);

        const ins = await insertReq.query(`
            INSERT INTO commercial_cases (
                organization_id, company_id, title, external_ref, status, notes, created_by
            )
            OUTPUT INSERTED.*
            VALUES (
                @organizationId, @companyId, @title, @externalRef, 'DRAFT', @notes, @userId
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

        const { title, notes, external_ref: externalRef, current_assignee_id: assigneeRaw } =
            req.body || {};

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

        const upd = await query(
            `
            UPDATE commercial_cases
            SET title = @title,
                notes = @notes,
                external_ref = @externalRef,
                current_assignee_id = @assigneeId,
                updated_at = SYSUTCDATETIME()
            OUTPUT INSERTED.*
            WHERE id = @caseId AND organization_id = @organizationId
            `,
            {
                title: titleNext,
                notes: notesNext,
                externalRef: extNext,
                assigneeId,
                caseId,
                organizationId,
            },
        );

        if (!upd.recordset.length) {
            return sendErr(res, 404, 'Caso non trovato', 'NOT_FOUND');
        }

        return res.json(upd.recordset[0]);
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
        if (!isTransitionAllowed(fromStatus, toStatus)) {
            await transaction.rollback();
            return sendErr(res, 400, 'Transizione di stato non consentita', 'INVALID_TRANSITION');
        }

        const reasonNorm = normalizeReason(reason);
        if (requiresTransitionReason(fromStatus, toStatus)) {
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

module.exports = {
    listCases,
    getCase,
    createCase,
    updateCase,
    transitionStatus,
    saveChecklistAnswer,
    generateChecklist,
};
