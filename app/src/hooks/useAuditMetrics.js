/**
 * Hook Calcolo Metriche Audit
 * Calcola metriche real-time da dati audit
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { useMemo } from 'react';
import { CHECKLIST_STATUS, NC_STATUS, NC_CATEGORY } from '../data/auditDataModel';

/**
 * Hook per calcolo metriche audit in tempo reale
 * @param {Object} audit - Oggetto AuditISO
 * @returns {Object} metriche calcolate
 */
export function useAuditMetrics(audit) {
    return useMemo(() => {
        if (!audit) {
            return {
                completionPercentage: 0,
                totalQuestions: 0,
                answeredQuestions: 0,
                complianceStats: {},
                ncStats: {},
                evidenceCount: 0,
                pendingIssuesCount: 0
            };
        }

        // Calcolo completamento checklist
        let totalQuestions = 0;
        let answeredQuestions = 0;
        const complianceStats = {
            compliant: 0,
            partial: 0,
            non_compliant: 0,
            not_applicable: 0
        };

        // Itera su tutte le checklist (multi-standard)
        Object.values(audit.checklist || {}).forEach(normChecklist => {
            // normChecklist è già un oggetto di clausole (clause4_Context, clause5_Leadership, etc)
            Object.values(normChecklist || {}).forEach(clause => {
                if (clause.questions && Array.isArray(clause.questions)) {
                    clause.questions.forEach(q => {
                        totalQuestions++;
                        if (q.status !== CHECKLIST_STATUS.NOT_ANSWERED) {
                            answeredQuestions++;
                            complianceStats[q.status]++;
                        }
                    });
                }
            });
        });

        const completionPercentage = totalQuestions > 0
            ? Math.round((answeredQuestions / totalQuestions) * 100)
            : 0;

        // Calcolo NC per categoria e status
        const nonConformities = audit.nonConformities || [];
        const ncStats = {
            total: nonConformities.length,
            byCategory: {
                [NC_CATEGORY.MAJOR]: 0,
                [NC_CATEGORY.MINOR]: 0,
                [NC_CATEGORY.OBSERVATION]: 0
            },
            byStatus: {
                [NC_STATUS.OPEN]: 0,
                [NC_STATUS.IN_PROGRESS]: 0,
                [NC_STATUS.COMPLETED]: 0,
                [NC_STATUS.VERIFIED]: 0,
                [NC_STATUS.REJECTED]: 0
            }
        };

        nonConformities.forEach(nc => {
            ncStats.byCategory[nc.category]++;
            ncStats.byStatus[nc.status]++;
        });

        // Calcolo evidenze (evidences è un oggetto, non array)
        const evidencesObj = audit.evidences || {};
        const evidenceCount = Object.keys(evidencesObj).length;

        // Calcolo pending issues
        const pendingIssues = audit.pendingIssues || [];
        const pendingIssuesCount = pendingIssues.length;

        // Metriche sincronizzate con audit.metrics per validazione
        const metrics = audit.metrics || {};
        const syncCheck = {
            completionMatch: metrics.completionPercentage === completionPercentage,
            ncCountMatch: metrics.nonConformitiesCount === ncStats.total,
            evidenceMatch: metrics.evidencesCount === evidenceCount
        };

        return {
            completionPercentage,
            totalQuestions,
            answeredQuestions,
            complianceStats,
            ncStats,
            evidenceCount,
            pendingIssuesCount,
            syncCheck  // Verifica coerenza con audit.metrics
        };
    }, [audit]);
}

/**
 * Hook per calcolo metriche specifiche di una norma
 * @param {Object} audit - Oggetto AuditISO
 * @param {string} normKey - Chiave norma (ISO_9001, ISO_14001, ISO_45001)
 * @returns {Object} metriche della norma specifica
 */
export function useNormMetrics(audit, normKey) {
    return useMemo(() => {
        if (!audit || !audit.checklist[normKey]) {
            return {
                completionPercentage: 0,
                totalQuestions: 0,
                answeredQuestions: 0,
                complianceStats: {}
            };
        }

        const normChecklist = audit.checklist[normKey];
        let totalQuestions = 0;
        let answeredQuestions = 0;
        const complianceStats = {
            compliant: 0,
            partial: 0,
            non_compliant: 0,
            not_applicable: 0
        };

        Object.values(normChecklist.clauses).forEach(clause => {
            clause.questions.forEach(q => {
                totalQuestions++;
                if (q.status !== CHECKLIST_STATUS.NOT_ANSWERED) {
                    answeredQuestions++;
                    complianceStats[q.status]++;
                }
            });
        });

        const completionPercentage = totalQuestions > 0
            ? Math.round((answeredQuestions / totalQuestions) * 100)
            : 0;

        // NC specifiche della norma
        const normNCs = audit.nonConformities.filter(nc => nc.norm === normKey);

        return {
            completionPercentage,
            totalQuestions,
            answeredQuestions,
            complianceStats,
            ncCount: normNCs.length,
            normKey
        };
    }, [audit, normKey]);
}

export default useAuditMetrics;
