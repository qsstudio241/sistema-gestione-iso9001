/**
 * Utility per calcolo metriche audit da checklist
 * Sistema Gestione ISO 9001 - QS Studio
 */

/**
 * Status mapping checklist → findings type
 * Supporta sia nuovo formato (C, NC, OSS, OM) che legacy (compliant, non_compliant, partial)
 */
const STATUS_TO_FINDING = {
    // Nuovo formato (ChecklistModule)
    NC: "NC", // Non Conformità
    OSS: "OSS", // Osservazione
    OM: "OM", // Opportunità di Miglioramento
    C: null, // Conforme - nessun finding
    NA: null, // Non Applicabile - nessun finding
    NOT_ANSWERED: null, // Non risposto - nessun finding

    // Legacy formato (mock data auditDataModel.js)
    'non_compliant': "NC",
    'partial': "OSS", // partial = osservazione
    'compliant': null,
    'not_applicable': null,
};/**
 * Calcola metriche findings da checklist ISO
 * @param {Object} checklist - Checklist completa audit (es. { ISO_9001: {...}, ISO_14001: {...} })
 * @returns {Object} Metriche { totalNC, totalOSS, totalOM, totalQuestions, answeredQuestions }
 */
export function calculateFindingsMetrics(checklist) {
    if (!checklist || typeof checklist !== "object") {
        return {
            totalNC: 0,
            totalOSS: 0,
            totalOM: 0,
            totalQuestions: 0,
            answeredQuestions: 0,
        };
    }

    let totalNC = 0;
    let totalOSS = 0;
    let totalOM = 0;
    let totalQuestions = 0;
    let answeredQuestions = 0;

    // Itera su tutte le norme (ISO_9001, ISO_14001, ISO_45001)
    Object.values(checklist).forEach((norm) => {
        if (!norm || typeof norm !== "object") return;

        // Itera su tutte le clausole
        Object.values(norm).forEach((clause) => {
            if (!clause?.questions || !Array.isArray(clause.questions)) return;

            // Itera su tutte le domande
            clause.questions.forEach((question) => {
                totalQuestions++;

                const status = question.status;

                // Conta domande risposte (escludi NOT_ANSWERED e status vuoti)
                if (status && status !== "NOT_ANSWERED" && status !== 'not_applicable') {
                    answeredQuestions++;
                }

                // Mappa status a finding type usando STATUS_TO_FINDING
                const findingType = STATUS_TO_FINDING[status];

                // Conta findings per tipo
                if (findingType === "NC") {
                    totalNC++;
                } else if (findingType === "OSS") {
                    totalOSS++;
                } else if (findingType === "OM") {
                    totalOM++;
                }
            });
        });
    });

    return {
        totalNC,
        totalOSS,
        totalOM,
        totalQuestions,
        answeredQuestions,
    };
}

/**
 * Calcola percentuale completamento checklist
 * @param {Object} checklist - Checklist completa audit
 * @returns {number} Percentuale (0-100)
 */
export function calculateCompletionPercentage(checklist) {
    const { totalQuestions, answeredQuestions } =
        calculateFindingsMetrics(checklist);

    if (totalQuestions === 0) return 0;

    return Math.round((answeredQuestions / totalQuestions) * 100);
}

/**
 * Calcola metriche per singola norma
 * @param {Object} normChecklist - Checklist singola norma (es. checklist.ISO_9001)
 * @returns {Object} Metriche norma
 */
export function calculateNormMetrics(normChecklist) {
    if (!normChecklist || typeof normChecklist !== "object") {
        return {
            totalNC: 0,
            totalOSS: 0,
            totalOM: 0,
            totalQuestions: 0,
            answeredQuestions: 0,
            completionPercentage: 0,
        };
    }

    // Wrappa in oggetto per riutilizzare calculateFindingsMetrics
    const wrappedChecklist = { NORM: normChecklist };
    const metrics = calculateFindingsMetrics(wrappedChecklist);

    return {
        ...metrics,
        completionPercentage:
            metrics.totalQuestions > 0
                ? Math.round((metrics.answeredQuestions / metrics.totalQuestions) * 100)
                : 0,
    };
}

/**
 * Calcola metriche per singola clausola
 * @param {Object} clause - Clausola checklist (es. clause4_Context)
 * @returns {Object} Metriche clausola
 */
export function calculateClauseMetrics(clause) {
    if (!clause?.questions || !Array.isArray(clause.questions)) {
        return {
            totalNC: 0,
            totalOSS: 0,
            totalOM: 0,
            totalQuestions: 0,
            answeredQuestions: 0,
            completionPercentage: 0,
        };
    }

    let totalNC = 0;
    let totalOSS = 0;
    let totalOM = 0;
    let totalQuestions = clause.questions.length;
    let answeredQuestions = 0;

    clause.questions.forEach((question) => {
        const status = question.status;

        if (status && status !== "NOT_ANSWERED" && status !== 'not_applicable') {
            answeredQuestions++;
        }

        // Mappa status a finding type
        const findingType = STATUS_TO_FINDING[status];

        if (findingType === "NC") {
            totalNC++;
        } else if (findingType === "OSS") {
            totalOSS++;
        } else if (findingType === "OM") {
            totalOM++;
        }
    });

    return {
        totalNC,
        totalOSS,
        totalOM,
        totalQuestions,
        answeredQuestions,
        completionPercentage:
            totalQuestions > 0
                ? Math.round((answeredQuestions / totalQuestions) * 100)
                : 0,
    };
}

/**
 * Aggiorna metriche audit in base a checklist
 * @param {Object} audit - Audit completo
 * @returns {Object} Audit con metriche aggiornate
 */
export function updateAuditMetrics(audit) {
    const metrics = calculateFindingsMetrics(audit.checklist);

    return {
        ...audit,
        metadata: {
            ...audit.metadata,
            auditOutcome: {
                ...audit.metadata.auditOutcome,
                emergingFindings: {
                    ...audit.metadata.auditOutcome?.emergingFindings,
                    totalNC: metrics.totalNC,
                    totalOSS: metrics.totalOSS,
                    totalOM: metrics.totalOM,
                },
            },
        },
        metrics: {
            ...audit.metrics,
            totalQuestions: metrics.totalQuestions,
            answeredQuestions: metrics.answeredQuestions,
            completionPercentage: calculateCompletionPercentage(audit.checklist),
            totalNC: metrics.totalNC,
            observationsNC: metrics.totalOSS, // OSS mappato a observationsNC
            // OM non ha campo dedicato in metrics, solo in auditOutcome
        },
    };
}
