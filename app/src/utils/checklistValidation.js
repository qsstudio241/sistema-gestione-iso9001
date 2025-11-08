/**
 * Checklist Validation Utilities
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Validazioni per assicurare integrità dati checklist
 */

import { CHECKLIST_STATUS } from '../data/auditDataModel';

/**
 * Valida una singola domanda della checklist
 * @param {Object} question - Domanda da validare
 * @returns {Object} { isValid, errors }
 */
export function validateQuestion(question) {
    const errors = [];

    // ID obbligatorio
    if (!question.id) {
        errors.push('ID domanda mancante');
    }

    // Testo obbligatorio
    if (!question.text || question.text.trim() === '') {
        errors.push('Testo domanda vuoto');
    }

    // Riferimento clausola obbligatorio
    if (!question.clauseRef) {
        errors.push('Riferimento clausola mancante');
    }

    // Status deve essere valido
    const validStatuses = Object.values(CHECKLIST_STATUS);
    if (!validStatuses.includes(question.status)) {
        errors.push(`Status non valido: ${question.status}`);
    }

    // Se status è COMPLIANT o PARTIAL, dovrebbe avere evidenza
    if (
        (question.status === CHECKLIST_STATUS.COMPLIANT ||
            question.status === CHECKLIST_STATUS.PARTIAL) &&
        !hasEvidence(question)
    ) {
        errors.push('Manca evidenza per domanda conforme/parzialmente conforme');
    }

    // Se status è NON_COMPLIANT, dovrebbe avere note
    if (
        question.status === CHECKLIST_STATUS.NON_COMPLIANT &&
        (!question.notes || question.notes.trim() === '')
    ) {
        errors.push('Mancano note per domanda non conforme');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Verifica se una domanda ha evidenza documentata
 * @param {Object} question - Domanda da verificare
 * @returns {boolean}
 */
function hasEvidence(question) {
    // Nuovo formato evidence object
    if (question.evidence && typeof question.evidence === 'object') {
        return !!(
            question.evidence.mainDocumentRef ||
            (question.evidence.detailedObservations &&
                question.evidence.detailedObservations.length > 0)
        );
    }

    // Vecchio formato evidenceRef string
    if (question.evidenceRef && question.evidenceRef.trim() !== '') {
        return true;
    }

    return false;
}

/**
 * Valida una clausola completa
 * @param {Object} clause - Clausola da validare
 * @returns {Object} { isValid, errors, warnings }
 */
export function validateClause(clause) {
    const errors = [];
    const warnings = [];

    if (!clause.questions || !Array.isArray(clause.questions)) {
        errors.push('Clausola senza domande');
        return { isValid: false, errors, warnings };
    }

    // Valida ogni domanda
    let unansweredCount = 0;
    clause.questions.forEach((q, idx) => {
        const validation = validateQuestion(q);

        if (!validation.isValid) {
            errors.push(`Domanda ${idx + 1} (${q.id}): ${validation.errors.join(', ')}`);
        }

        if (q.status === CHECKLIST_STATUS.NOT_ANSWERED) {
            unansweredCount++;
        }
    });

    // Warning se ci sono domande inevase
    if (unansweredCount > 0) {
        warnings.push(`${unansweredCount} domande non ancora valutate`);
    }

    return {
        isValid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Valida checklist completa per una norma
 * @param {Object} checklist - Checklist norma (es. ISO_9001)
 * @returns {Object} { isValid, errors, warnings, stats }
 */
export function validateNormChecklist(checklist) {
    const errors = [];
    const warnings = [];
    const stats = {
        totalClauses: 0,
        totalQuestions: 0,
        answeredQuestions: 0,
        compliantQuestions: 0,
        nonCompliantQuestions: 0
    };

    if (!checklist || typeof checklist !== 'object') {
        errors.push('Checklist non valida o mancante');
        return { isValid: false, errors, warnings, stats };
    }

    // Itera su ogni clausola
    Object.entries(checklist).forEach(([clauseId, clause]) => {
        stats.totalClauses++;

        const clauseValidation = validateClause(clause);

        if (!clauseValidation.isValid) {
            errors.push(`Clausola ${clauseId}: ${clauseValidation.errors.join('; ')}`);
        }

        if (clauseValidation.warnings.length > 0) {
            warnings.push(`Clausola ${clauseId}: ${clauseValidation.warnings.join('; ')}`);
        }

        // Aggiorna statistiche
        if (clause.questions) {
            stats.totalQuestions += clause.questions.length;
            clause.questions.forEach(q => {
                if (q.status !== CHECKLIST_STATUS.NOT_ANSWERED) {
                    stats.answeredQuestions++;
                }
                if (q.status === CHECKLIST_STATUS.COMPLIANT) {
                    stats.compliantQuestions++;
                }
                if (q.status === CHECKLIST_STATUS.NON_COMPLIANT) {
                    stats.nonCompliantQuestions++;
                }
            });
        }
    });

    return {
        isValid: errors.length === 0,
        errors,
        warnings,
        stats
    };
}

/**
 * Calcola completezza checklist (%)
 * @param {Object} stats - Statistiche da validateNormChecklist
 * @returns {number} Percentuale 0-100
 */
export function calculateCompleteness(stats) {
    if (stats.totalQuestions === 0) return 0;
    return Math.round((stats.answeredQuestions / stats.totalQuestions) * 100);
}

/**
 * Verifica se checklist è pronta per finalizzazione audit
 * @param {Object} checklist - Checklist completa norma
 * @returns {Object} { ready, blockers }
 */
export function isChecklistReadyForCompletion(checklist) {
    const validation = validateNormChecklist(checklist);
    const blockers = [];

    // Deve essere valida
    if (!validation.isValid) {
        blockers.push('Checklist contiene errori di validazione');
    }

    // Tutte le domande devono essere valutate
    if (validation.stats.answeredQuestions < validation.stats.totalQuestions) {
        const unanswered = validation.stats.totalQuestions - validation.stats.answeredQuestions;
        blockers.push(`${unanswered} domande ancora da valutare`);
    }

    // Domande non conformi devono avere azioni correttive (future implementation)
    if (validation.stats.nonCompliantQuestions > 0) {
        // Questo sarà verificato quando implementeremo gestione NC
        // Per ora è solo un warning, non un blocker
        validation.warnings.push(
            `${validation.stats.nonCompliantQuestions} non conformità rilevate - verificare azioni correttive`
        );
    }

    return {
        ready: blockers.length === 0,
        blockers,
        warnings: validation.warnings
    };
}
