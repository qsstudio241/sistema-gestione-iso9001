/**
 * Workflow riesame requisiti — transizioni e gate ISO §8.2
 */

const { query } = require('../config/database');
const {
    listMissingRequiredAttachmentRefs,
} = require('./commercialChecklistAttachment.service');

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

const BACKWARD_TRANSITION_KEYS = new Set([
    'INTAKE_REVIEW|DRAFT',
    'CLARIFICATION|INTAKE_REVIEW',
    'QUOTE_PREP|INTAKE_REVIEW',
    'QUOTE_APPROVAL|QUOTE_PREP',
    'FINAL_REVIEW|ORDER_RECEIVED',
]);

const TERMINAL_FROM_STATUSES = new Set(['APPROVED', 'CANCELLED', 'REJECTED']);

/** Transizioni che richiedono gate checklist/documenti */
const GATED_TRANSITIONS = new Set([
    'INTAKE_REVIEW|QUOTE_PREP',
    'ORDER_RECEIVED|FINAL_REVIEW',
    'FINAL_REVIEW|APPROVED',
]);

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

async function countUnansweredChecklist(caseId, phase) {
    const r = await query(
        `
        SELECT COUNT(*) AS cnt
        FROM commercial_case_checklist
        WHERE case_id = @caseId AND phase = @phase
          AND (answer IS NULL OR LTRIM(RTRIM(answer)) = '')
        `,
        { caseId, phase },
    );
    return r.recordset[0]?.cnt ?? 0;
}

async function countChecklistRows(caseId, phase) {
    const r = await query(
        `
        SELECT COUNT(*) AS cnt FROM commercial_case_checklist
        WHERE case_id = @caseId AND phase = @phase
        `,
        { caseId, phase },
    );
    return r.recordset[0]?.cnt ?? 0;
}

async function hasOrderEvidence(caseId) {
    const r = await query(
        `
        SELECT
          (SELECT COUNT(*) FROM commercial_case_documents
           WHERE case_id = @caseId AND doc_role IN ('order','ordine')) AS doc_cnt,
          (SELECT COUNT(*) FROM attachments
           WHERE commercial_case_id = @caseId
             AND commercial_doc_role IN ('order','ordine')) AS att_cnt
        `,
        { caseId },
    );
    const row = r.recordset[0] || {};
    return Number(row.doc_cnt || 0) + Number(row.att_cnt || 0) > 0;
}

/**
 * @returns {Promise<{ blocked: boolean, missing: string[] }>}
 */
async function evaluateTransitionBlockers(caseId, fromStatus, toStatus) {
    const key = `${fromStatus}|${toStatus}`;
    if (!GATED_TRANSITIONS.has(key)) {
        return { blocked: false, missing: [] };
    }

    const missing = [];

    if (key === 'INTAKE_REVIEW|QUOTE_PREP') {
        const total = await countChecklistRows(caseId, 'preliminary');
        if (total === 0) {
            missing.push('Generare e compilare la checklist preliminare');
        } else {
            const unanswered = await countUnansweredChecklist(caseId, 'preliminary');
            if (unanswered > 0) {
                missing.push(`Completare tutte le voci della checklist preliminare (${unanswered} senza risposta)`);
            }
            const missingAtt = await listMissingRequiredAttachmentRefs(caseId, 'preliminary');
            if (missingAtt.length > 0) {
                missing.push(
                    `Collegare allegati obbligatori alla checklist preliminare (${missingAtt.join(', ')})`,
                );
            }
        }
    }

    if (key === 'ORDER_RECEIVED|FINAL_REVIEW') {
        const hasOrder = await hasOrderEvidence(caseId);
        if (!hasOrder) {
            missing.push('Allegare o collegare almeno un documento ordine (ruolo: order)');
        }
    }

    if (key === 'FINAL_REVIEW|APPROVED') {
        const total = await countChecklistRows(caseId, 'final');
        if (total === 0) {
            missing.push('Generare e compilare la checklist finale');
        } else {
            const unanswered = await countUnansweredChecklist(caseId, 'final');
            if (unanswered > 0) {
                missing.push(`Completare tutte le voci della checklist finale (${unanswered} senza risposta)`);
            }
            const missingAtt = await listMissingRequiredAttachmentRefs(caseId, 'final');
            if (missingAtt.length > 0) {
                missing.push(
                    `Collegare allegati obbligatori alla checklist finale (${missingAtt.join(', ')})`,
                );
            }
        }
    }

    return { blocked: missing.length > 0, missing };
}

/**
 * Opzioni transizione con gate per UI
 */
async function buildTransitionOptions(fromStatus, caseId) {
    const candidates = [];
    if (TERMINAL_FROM_STATUSES.has(fromStatus)) {
        return candidates;
    }

    const allowedNext = ALLOWED_STATUS_TRANSITIONS[fromStatus] || [];
    for (const to of allowedNext) {
        const gate = await evaluateTransitionBlockers(caseId, fromStatus, to);
        candidates.push({
            to_status: to,
            allowed: !gate.blocked,
            requires_reason: requiresTransitionReason(fromStatus, to),
            missing_requirements: gate.missing,
        });
    }

    for (const terminal of ['CANCELLED', 'REJECTED']) {
        if (fromStatus !== terminal) {
            candidates.push({
                to_status: terminal,
                allowed: true,
                requires_reason: true,
                missing_requirements: [],
            });
        }
    }

    return candidates;
}

module.exports = {
    CASE_STATUSES,
    ALLOWED_STATUS_TRANSITIONS,
    requiresTransitionReason,
    isTransitionAllowed,
    evaluateTransitionBlockers,
    buildTransitionOptions,
};
