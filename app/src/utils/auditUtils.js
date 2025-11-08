/**
 * Audit Business Logic Utilities
 * Funzioni di utilità per gestione e validazione audit
 * Sistema Gestione ISO 9001 - QS Studio
 */

import {
    AUDIT_STATUS,
    CHECKLIST_STATUS,
    ISO_STANDARDS,
    NC_STATUS,
    NC_CATEGORY,
    validateAuditSchema
} from '../data/auditDataModel';

// ============================================
// CALCOLO METRICHE
// ============================================

/**
 * Calcola percentuale completamento checklist
 * @param {Object} checklist - Oggetto checklist (multi-standard)
 * @returns {number} Percentuale 0-100
 */
export function calculateCompletionPercentage(checklist) {
    if (!checklist || typeof checklist !== 'object') {
        return 0;
    }

    let totalQuestions = 0;
    let answeredQuestions = 0;

    Object.values(checklist).forEach(normChecklist => {
        // normChecklist è direttamente un oggetto di clausole (clause4_Context, etc)
        Object.values(normChecklist || {}).forEach(clause => {
            if (!Array.isArray(clause.questions)) return;

            clause.questions.forEach(q => {
                totalQuestions++;
                if (q.status !== CHECKLIST_STATUS.NOT_ANSWERED) {
                    answeredQuestions++;
                }
            });
        });
    });

    return totalQuestions > 0
        ? Math.round((answeredQuestions / totalQuestions) * 100)
        : 0;
}

/**
 * Calcola statistiche completamento per singola norma
 * @param {Object} checklist - Oggetto checklist
 * @param {string} normKey - Chiave norma (ISO_9001, ISO_14001, ISO_45001)
 * @returns {Object} { total, answered, percentage, byStatus }
 */
export function calculateNormCompletion(checklist, normKey) {
    if (!checklist || !checklist[normKey]) {
        return { total: 0, answered: 0, percentage: 0, byStatus: {} };
    }

    const normChecklist = checklist[normKey];
    let total = 0;
    let answered = 0;
    const byStatus = {
        [CHECKLIST_STATUS.COMPLIANT]: 0,
        [CHECKLIST_STATUS.PARTIAL]: 0,
        [CHECKLIST_STATUS.NON_COMPLIANT]: 0,
        [CHECKLIST_STATUS.NOT_APPLICABLE]: 0,
        [CHECKLIST_STATUS.NOT_ANSWERED]: 0
    };

    // normChecklist è direttamente un oggetto di clausole (clause4_Context, clause5_Leadership, etc)
    Object.values(normChecklist || {}).forEach(clause => {
        if (clause.questions && Array.isArray(clause.questions)) {
            clause.questions.forEach(q => {
                total++;
                byStatus[q.status]++;
                if (q.status !== CHECKLIST_STATUS.NOT_ANSWERED) {
                    answered++;
                }
            });
        }
    });

    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;

    return { total, answered, percentage, byStatus };
}

/**
 * Calcola statistiche NC per audit
 * @param {Array} nonConformities - Array NC
 * @returns {Object} Statistiche NC per categoria e status
 */
export function calculateNCStats(nonConformities) {
    if (!Array.isArray(nonConformities)) {
        return { total: 0, byCategory: {}, byStatus: {} };
    }

    const byCategory = {
        [NC_CATEGORY.MAJOR]: 0,
        [NC_CATEGORY.MINOR]: 0,
        [NC_CATEGORY.OBSERVATION]: 0
    };

    const byStatus = {
        [NC_STATUS.OPEN]: 0,
        [NC_STATUS.IN_PROGRESS]: 0,
        [NC_STATUS.COMPLETED]: 0,
        [NC_STATUS.VERIFIED]: 0,
        [NC_STATUS.REJECTED]: 0
    };

    nonConformities.forEach(nc => {
        if (nc.category) byCategory[nc.category]++;
        if (nc.status) byStatus[nc.status]++;
    });

    return {
        total: nonConformities.length,
        byCategory,
        byStatus
    };
}

// ============================================
// GENERAZIONE NUMERI AUDIT
// ============================================

/**
 * Estrae anno da numero audit (formato: YYYY-NN)
 * @param {string} auditNumber - Numero audit (es. "2025-01")
 * @returns {number|null} Anno o null se formato non valido
 */
export function extractYearFromAuditNumber(auditNumber) {
    if (!auditNumber || typeof auditNumber !== 'string') {
        return null;
    }

    const match = auditNumber.match(/^(\d{4})-\d+$/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Estrae progressivo da numero audit (formato: YYYY-NN)
 * @param {string} auditNumber - Numero audit (es. "2025-01")
 * @returns {number|null} Progressivo o null se formato non valido
 */
export function extractProgressiveFromAuditNumber(auditNumber) {
    if (!auditNumber || typeof auditNumber !== 'string') {
        return null;
    }

    const match = auditNumber.match(/^\d{4}-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Genera prossimo numero audit per anno specifico
 * @param {Array} audits - Array di tutti gli audit
 * @param {number} year - Anno (default: anno corrente)
 * @returns {string} Prossimo numero audit (es. "2025-04")
 */
export function getNextAuditNumber(audits, year = new Date().getFullYear()) {
    if (!Array.isArray(audits)) {
        return `${year}-01`;
    }

    // Filtra audit dello stesso anno
    const sameYearAudits = audits.filter(audit => {
        const auditYear = extractYearFromAuditNumber(audit.metadata?.auditNumber);
        return auditYear === year;
    });

    if (sameYearAudits.length === 0) {
        return `${year}-01`;
    }

    // Trova progressivo massimo
    const maxProgressive = sameYearAudits.reduce((max, audit) => {
        const progressive = extractProgressiveFromAuditNumber(audit.metadata?.auditNumber);
        return progressive !== null && progressive > max ? progressive : max;
    }, 0);

    const nextProgressive = maxProgressive + 1;
    return `${year}-${String(nextProgressive).padStart(2, '0')}`;
}

/**
 * Valida formato numero audit
 * @param {string} auditNumber - Numero audit
 * @returns {boolean} True se valido
 */
export function isValidAuditNumber(auditNumber) {
    if (!auditNumber || typeof auditNumber !== 'string') {
        return false;
    }

    return /^\d{4}-\d{2}$/.test(auditNumber);
}

// ============================================
// FILTRI E ORDINAMENTO
// ============================================

/**
 * Filtra audit per anno
 * @param {Array} audits - Array audit
 * @param {number} year - Anno
 * @returns {Array} Audit filtrati
 */
export function filterAuditsByYear(audits, year) {
    if (!Array.isArray(audits)) {
        return [];
    }

    return audits.filter(audit => {
        const auditYear = extractYearFromAuditNumber(audit.metadata?.auditNumber);
        return auditYear === year;
    });
}

/**
 * Filtra audit per cliente
 * @param {Array} audits - Array audit
 * @param {string} clientName - Nome cliente (case-insensitive, partial match)
 * @returns {Array} Audit filtrati
 */
export function filterAuditsByClient(audits, clientName) {
    if (!Array.isArray(audits) || !clientName) {
        return [];
    }

    const searchTerm = clientName.toLowerCase();
    return audits.filter(audit => {
        const client = audit.metadata?.clientName || '';
        return client.toLowerCase().includes(searchTerm);
    });
}

/**
 * Filtra audit per norma
 * @param {Array} audits - Array audit
 * @param {string} norm - Chiave norma (ISO_9001, ISO_14001, ISO_45001)
 * @returns {Array} Audit filtrati
 */
export function filterAuditsByNorm(audits, norm) {
    if (!Array.isArray(audits) || !norm) {
        return [];
    }

    return audits.filter(audit => {
        const norms = audit.metadata?.norms || [];
        return norms.includes(norm);
    });
}

/**
 * Filtra audit per status
 * @param {Array} audits - Array audit
 * @param {string} status - Status audit
 * @returns {Array} Audit filtrati
 */
export function filterAuditsByStatus(audits, status) {
    if (!Array.isArray(audits) || !status) {
        return [];
    }

    return audits.filter(audit => audit.metadata?.status === status);
}

/**
 * Filtra audit per range date
 * @param {Array} audits - Array audit
 * @param {string} startDate - Data inizio (ISO 8601)
 * @param {string} endDate - Data fine (ISO 8601)
 * @returns {Array} Audit filtrati
 */
export function filterAuditsByDateRange(audits, startDate, endDate) {
    if (!Array.isArray(audits)) {
        return [];
    }

    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    return audits.filter(audit => {
        const auditDate = new Date(audit.metadata?.auditDate);

        if (start && auditDate < start) return false;
        if (end && auditDate > end) return false;

        return true;
    });
}

/**
 * Ordina audit per numero (anno + progressivo)
 * @param {Array} audits - Array audit
 * @param {boolean} ascending - Ordine crescente (default: false = decrescente)
 * @returns {Array} Audit ordinati (nuovo array)
 */
export function sortAuditsByNumber(audits, ascending = false) {
    if (!Array.isArray(audits)) {
        return [];
    }

    return [...audits].sort((a, b) => {
        const numA = a.metadata?.auditNumber || '';
        const numB = b.metadata?.auditNumber || '';

        const comparison = numA.localeCompare(numB);
        return ascending ? comparison : -comparison;
    });
}

/**
 * Ordina audit per data
 * @param {Array} audits - Array audit
 * @param {boolean} ascending - Ordine crescente (default: false = più recente prima)
 * @returns {Array} Audit ordinati (nuovo array)
 */
export function sortAuditsByDate(audits, ascending = false) {
    if (!Array.isArray(audits)) {
        return [];
    }

    return [...audits].sort((a, b) => {
        const dateA = new Date(a.metadata?.auditDate);
        const dateB = new Date(b.metadata?.auditDate);

        const comparison = dateA - dateB;
        return ascending ? comparison : -comparison;
    });
}

/**
 * Ordina audit per completamento
 * @param {Array} audits - Array audit
 * @param {boolean} ascending - Ordine crescente (default: false = più completi prima)
 * @returns {Array} Audit ordinati (nuovo array)
 */
export function sortAuditsByCompletion(audits, ascending = false) {
    if (!Array.isArray(audits)) {
        return [];
    }

    return [...audits].sort((a, b) => {
        const compA = a.metrics?.completionPercentage || 0;
        const compB = b.metrics?.completionPercentage || 0;

        return ascending ? compA - compB : compB - compA;
    });
}

// ============================================
// RICERCA E QUERY
// ============================================

/**
 * Cerca audit per ID
 * @param {Array} audits - Array audit
 * @param {string} id - UUID audit
 * @returns {Object|null} Audit trovato o null
 */
export function findAuditById(audits, id) {
    if (!Array.isArray(audits) || !id) {
        return null;
    }

    return audits.find(audit => audit.metadata?.id === id) || null;
}

/**
 * Cerca audit per numero
 * @param {Array} audits - Array audit
 * @param {string} auditNumber - Numero audit
 * @returns {Object|null} Audit trovato o null
 */
export function findAuditByNumber(audits, auditNumber) {
    if (!Array.isArray(audits) || !auditNumber) {
        return null;
    }

    return audits.find(audit => audit.metadata?.auditNumber === auditNumber) || null;
}

/**
 * Ottieni tutti gli audit di un cliente
 * @param {Array} audits - Array audit
 * @param {string} clientName - Nome cliente (exact match)
 * @returns {Array} Array audit ordinati per data (più recenti prima)
 */
export function getAuditsByClient(audits, clientName) {
    if (!Array.isArray(audits) || !clientName) {
        return [];
    }

    const clientAudits = audits.filter(audit =>
        audit.metadata?.clientName === clientName
    );

    return sortAuditsByDate(clientAudits, false);
}

/**
 * Ottieni tutti gli audit per norma
 * @param {Array} audits - Array audit
 * @param {string} norm - Chiave norma
 * @returns {Array} Array audit ordinati per numero
 */
export function getAuditsByNorm(audits, norm) {
    if (!Array.isArray(audits) || !norm) {
        return [];
    }

    const normAudits = filterAuditsByNorm(audits, norm);
    return sortAuditsByNumber(normAudits, false);
}

/**
 * Ottieni tutti i clienti unici
 * @param {Array} audits - Array audit
 * @returns {Array} Array nomi clienti ordinati alfabeticamente
 */
export function getUniqueClients(audits) {
    if (!Array.isArray(audits)) {
        return [];
    }

    const clients = new Set();
    audits.forEach(audit => {
        const clientName = audit.metadata?.clientName;
        if (clientName) {
            clients.add(clientName);
        }
    });

    return Array.from(clients).sort();
}

/**
 * Ottieni tutti gli anni con audit
 * @param {Array} audits - Array audit
 * @returns {Array} Array anni ordinati decrescente
 */
export function getAvailableYears(audits) {
    if (!Array.isArray(audits)) {
        return [];
    }

    const years = new Set();
    audits.forEach(audit => {
        const year = extractYearFromAuditNumber(audit.metadata?.auditNumber);
        if (year) {
            years.add(year);
        }
    });

    return Array.from(years).sort((a, b) => b - a);
}

// ============================================
// VALIDAZIONE BUSINESS RULES
// ============================================

/**
 * Valida dati audit con business rules
 * @param {Object} audit - Oggetto audit
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
export function validateAuditData(audit) {
    const result = {
        valid: true,
        errors: [],
        warnings: []
    };

    // Validazione schema base
    const schemaValidation = validateAuditSchema(audit);
    if (!schemaValidation.valid) {
        result.valid = false;
        result.errors.push(...schemaValidation.errors);
    }

    if (!audit || typeof audit !== 'object') {
        result.valid = false;
        result.errors.push('Audit object is required');
        return result;
    }

    const metadata = audit.metadata || {};

    // Business Rule 1: Numero audit valido
    if (!isValidAuditNumber(metadata.auditNumber)) {
        result.valid = false;
        result.errors.push(`Invalid audit number format: ${metadata.auditNumber}`);
    }

    // Business Rule 2: Data audit non nel futuro
    if (metadata.auditDate) {
        const auditDate = new Date(metadata.auditDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (auditDate > today) {
            result.warnings.push('Audit date is in the future');
        }
    }

    // Business Rule 3: Status coerente con completamento
    const completion = audit.metrics?.completionPercentage || 0;
    const status = metadata.status;

    if (status === AUDIT_STATUS.COMPLETED && completion < 100) {
        result.warnings.push(`Audit marked as completed but checklist is only ${completion}% complete`);
    }

    if (status === AUDIT_STATUS.DRAFT && completion > 50) {
        result.warnings.push(`Audit is ${completion}% complete but still in draft status`);
    }

    // Business Rule 4: NC aperte con audit completato
    const openNC = audit.nonConformities?.filter(nc =>
        nc.status === NC_STATUS.OPEN || nc.status === NC_STATUS.IN_PROGRESS
    ).length || 0;

    if (status === AUDIT_STATUS.COMPLETED && openNC > 0) {
        result.warnings.push(`Audit completed but ${openNC} NC still open/in progress`);
    }

    // Business Rule 5: Almeno una norma specificata
    if (!metadata.norms || metadata.norms.length === 0) {
        result.valid = false;
        result.errors.push('At least one norm must be specified');
    }

    // Business Rule 6: Norme valide
    if (metadata.norms) {
        const validNorms = Object.values(ISO_STANDARDS);
        const invalidNorms = metadata.norms.filter(norm => !validNorms.includes(norm));

        if (invalidNorms.length > 0) {
            result.valid = false;
            result.errors.push(`Invalid norms: ${invalidNorms.join(', ')}`);
        }
    }

    // Business Rule 7: Checklist presente per ogni norma dichiarata
    if (metadata.norms && audit.checklist) {
        metadata.norms.forEach(norm => {
            if (!audit.checklist[norm]) {
                result.warnings.push(`Checklist missing for declared norm: ${norm}`);
            }
        });
    }

    // Business Rule 8: NC con azioni correttive se status != open
    if (audit.nonConformities) {
        audit.nonConformities.forEach((nc, index) => {
            if (nc.status !== NC_STATUS.OPEN && nc.correctiveActions.length === 0) {
                result.warnings.push(`NC ${index + 1} has status "${nc.status}" but no corrective actions`);
            }
        });
    }

    // Business Rule 9: Evidenze linkate esistono
    if (audit.nonConformities && audit.evidences) {
        const evidenceIds = new Set(audit.evidences.map(e => e.id));

        audit.nonConformities.forEach((nc, index) => {
            nc.evidences.forEach(evidenceId => {
                if (!evidenceIds.has(evidenceId)) {
                    result.warnings.push(`NC ${index + 1} references non-existent evidence: ${evidenceId}`);
                }
            });
        });
    }

    return result;
}

/**
 * Verifica se audit può essere archiviato
 * @param {Object} audit - Oggetto audit
 * @returns {Object} { canArchive: boolean, reason: string }
 */
export function canArchiveAudit(audit) {
    if (!audit) {
        return { canArchive: false, reason: 'Invalid audit object' };
    }

    const status = audit.metadata?.status;

    // Solo audit completati possono essere archiviati
    if (status !== AUDIT_STATUS.COMPLETED) {
        return { canArchive: false, reason: 'Only completed audits can be archived' };
    }

    // Verifica NC chiuse
    const openNC = audit.nonConformities?.filter(nc =>
        nc.status === NC_STATUS.OPEN || nc.status === NC_STATUS.IN_PROGRESS
    ).length || 0;

    if (openNC > 0) {
        return { canArchive: false, reason: `${openNC} NC still open or in progress` };
    }

    // Verifica pending issues risolti
    const unresolvedPending = audit.pendingIssues?.filter(pi => !pi.resolved).length || 0;

    if (unresolvedPending > 0) {
        return { canArchive: false, reason: `${unresolvedPending} pending issues unresolved` };
    }

    return { canArchive: true, reason: 'OK' };
}

// ============================================
// EXPORT UTILITIES
// ============================================

/**
 * Estrae summary audit per export
 * @param {Object} audit - Oggetto audit
 * @returns {Object} Summary oggetto
 */
export function exportAuditSummary(audit) {
    if (!audit) {
        return null;
    }

    const metadata = audit.metadata || {};
    const metrics = audit.metrics || {};

    return {
        id: metadata.id,
        auditNumber: metadata.auditNumber,
        clientName: metadata.clientName,
        auditDate: metadata.auditDate,
        auditorName: metadata.auditorName,
        norms: metadata.norms,
        status: metadata.status,
        completionPercentage: metrics.completionPercentage,
        nonConformitiesCount: metrics.nonConformitiesCount,
        majorNC: audit.nonConformities?.filter(nc => nc.category === NC_CATEGORY.MAJOR).length || 0,
        minorNC: audit.nonConformities?.filter(nc => nc.category === NC_CATEGORY.MINOR).length || 0,
        observations: audit.nonConformities?.filter(nc => nc.category === NC_CATEGORY.OBSERVATION).length || 0,
        evidencesCount: metrics.evidencesCount,
        pendingIssuesCount: audit.pendingIssues?.length || 0,
        createdAt: metadata.createdAt,
        lastModified: metadata.lastModified
    };
}

/**
 * Estrae statistiche aggregate da array audit
 * @param {Array} audits - Array audit
 * @returns {Object} Statistiche aggregate
 */
export function getAggregateStats(audits) {
    if (!Array.isArray(audits) || audits.length === 0) {
        return {
            totalAudits: 0,
            byStatus: {},
            byNorm: {},
            totalNC: 0,
            averageCompletion: 0,
            totalEvidences: 0
        };
    }

    const stats = {
        totalAudits: audits.length,
        byStatus: {
            [AUDIT_STATUS.DRAFT]: 0,
            [AUDIT_STATUS.IN_PROGRESS]: 0,
            [AUDIT_STATUS.SUSPENDED]: 0,
            [AUDIT_STATUS.COMPLETED]: 0,
            [AUDIT_STATUS.ARCHIVED]: 0
        },
        byNorm: {
            [ISO_STANDARDS.ISO_9001]: 0,
            [ISO_STANDARDS.ISO_14001]: 0,
            [ISO_STANDARDS.ISO_45001]: 0
        },
        totalNC: 0,
        averageCompletion: 0,
        totalEvidences: 0
    };

    let totalCompletion = 0;

    audits.forEach(audit => {
        // Status
        const status = audit.metadata?.status;
        if (status && stats.byStatus[status] !== undefined) {
            stats.byStatus[status]++;
        }

        // Norme
        const norms = audit.metadata?.norms || [];
        norms.forEach(norm => {
            if (stats.byNorm[norm] !== undefined) {
                stats.byNorm[norm]++;
            }
        });

        // NC
        stats.totalNC += audit.nonConformities?.length || 0;

        // Completion
        totalCompletion += audit.metrics?.completionPercentage || 0;

        // Evidenze
        stats.totalEvidences += audit.evidences?.length || 0;
    });

    stats.averageCompletion = Math.round(totalCompletion / audits.length);

    return stats;
}

export default {
    // Metriche
    calculateCompletionPercentage,
    calculateNormCompletion,
    calculateNCStats,

    // Numeri audit
    extractYearFromAuditNumber,
    extractProgressiveFromAuditNumber,
    getNextAuditNumber,
    isValidAuditNumber,

    // Filtri
    filterAuditsByYear,
    filterAuditsByClient,
    filterAuditsByNorm,
    filterAuditsByStatus,
    filterAuditsByDateRange,

    // Ordinamento
    sortAuditsByNumber,
    sortAuditsByDate,
    sortAuditsByCompletion,

    // Ricerca
    findAuditById,
    findAuditByNumber,
    getAuditsByClient,
    getAuditsByNorm,
    getUniqueClients,
    getAvailableYears,

    // Validazione
    validateAuditData,
    canArchiveAudit,

    // Export
    exportAuditSummary,
    getAggregateStats
};
