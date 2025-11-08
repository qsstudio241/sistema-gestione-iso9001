/**
 * Export Manager
 * Sistema export JSON e report summaries
 * Sistema Gestione ISO 9001 - QS Studio
 */

import { AUDIT_STATUS, CHECKLIST_STATUS, NC_CATEGORY, NC_STATUS } from '../data/auditDataModel';

/**
 * Export completo audit in formato JSON
 * @param {Object} audit - Audit da esportare
 * @returns {string} JSON string
 */
export function exportAuditJSON(audit) {
    const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        audit: audit
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Export multipli audit
 * @param {Array} audits - Array di audit
 * @returns {string} JSON string
 */
export function exportAllAuditsJSON(audits) {
    const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        auditsCount: audits.length,
        audits: audits
    };

    return JSON.stringify(exportData, null, 2);
}

/**
 * Export summary audit (metriche + NC)
 * @param {Object} audit - Audit da esportare
 * @returns {Object} Summary object
 */
export function exportAuditSummary(audit) {
    const summary = {
        auditInfo: {
            number: audit.metadata.auditNumber,
            clientName: audit.metadata.clientName,
            auditDate: audit.metadata.auditDate,
            auditor: audit.metadata.auditor,
            norms: audit.metadata.norms,
            status: audit.metadata.status
        },
        metrics: {
            completionPercentage: audit.metrics.completionPercentage,
            compliantCount: audit.metrics.compliantCount,
            partialCount: audit.metrics.partialCount,
            nonCompliantCount: audit.metrics.nonCompliantCount,
            notApplicableCount: audit.metrics.notApplicableCount,
            totalQuestions: audit.metrics.totalQuestions
        },
        nonConformities: {
            total: audit.nonConformities.length,
            major: audit.nonConformities.filter(nc => nc.category === NC_CATEGORY.MAJOR).length,
            minor: audit.nonConformities.filter(nc => nc.category === NC_CATEGORY.MINOR).length,
            observations: audit.nonConformities.filter(nc => nc.category === NC_CATEGORY.OBSERVATION).length,
            open: audit.nonConformities.filter(nc => nc.status === NC_STATUS.OPEN).length,
            list: audit.nonConformities.map(nc => ({
                norm: nc.norm,
                clause: nc.clauseReference,
                category: nc.category,
                description: nc.description,
                status: nc.status
            }))
        },
        evidences: {
            total: audit.evidences.length,
            byCategory: {
                documents: audit.evidences.filter(e => e.category === 'document').length,
                photos: audit.evidences.filter(e => e.category === 'photo').length,
                records: audit.evidences.filter(e => e.category === 'record').length,
                other: audit.evidences.filter(e => e.category === 'other').length
            }
        },
        pendingIssues: {
            total: audit.pendingIssues.length,
            open: audit.pendingIssues.filter(i => !i.resolved).length,
            resolved: audit.pendingIssues.filter(i => i.resolved).length
        }
    };

    return summary;
}

/**
 * Download file helper
 * @param {string} content - Contenuto file
 * @param {string} filename - Nome file
 * @param {string} mimeType - MIME type
 */
export function downloadFile(content, filename, mimeType = 'application/json') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/**
 * Export audit come file JSON scaricabile
 * @param {Object} audit - Audit da esportare
 */
export function downloadAuditJSON(audit) {
    const json = exportAuditJSON(audit);
    const filename = `audit_${audit.metadata.auditNumber}_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
}

/**
 * Export tutti gli audit come file JSON
 * @param {Array} audits - Array di audit
 */
export function downloadAllAuditsJSON(audits) {
    const json = exportAllAuditsJSON(audits);
    const filename = `all_audits_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
}

/**
 * Export summary come file JSON
 * @param {Object} audit - Audit da esportare
 */
export function downloadAuditSummaryJSON(audit) {
    const summary = exportAuditSummary(audit);
    const json = JSON.stringify(summary, null, 2);
    const filename = `audit_summary_${audit.metadata.auditNumber}_${new Date().toISOString().split('T')[0]}.json`;
    downloadFile(json, filename, 'application/json');
}

/**
 * Export summary come CSV
 * @param {Object} audit - Audit da esportare
 */
export function downloadAuditSummaryCSV(audit) {
    const summary = exportAuditSummary(audit);

    let csv = 'AUDIT SUMMARY\n\n';

    // Audit Info
    csv += 'INFORMAZIONI AUDIT\n';
    csv += `Numero,${summary.auditInfo.number}\n`;
    csv += `Cliente,${summary.auditInfo.clientName}\n`;
    csv += `Data,${new Date(summary.auditInfo.auditDate).toLocaleDateString('it-IT')}\n`;
    csv += `Auditor,${summary.auditInfo.auditor}\n`;
    csv += `Norme,${summary.auditInfo.norms.join(' | ')}\n`;
    csv += `Status,${summary.auditInfo.status}\n\n`;

    // Metrics
    csv += 'METRICHE\n';
    csv += `Completamento,%${summary.metrics.completionPercentage}\n`;
    csv += `Conformi,${summary.metrics.compliantCount}\n`;
    csv += `Parziali,${summary.metrics.partialCount}\n`;
    csv += `Non Conformi,${summary.metrics.nonCompliantCount}\n`;
    csv += `Non Applicabili,${summary.metrics.notApplicableCount}\n`;
    csv += `Totale Domande,${summary.metrics.totalQuestions}\n\n`;

    // NC
    csv += 'NON CONFORMITA\n';
    csv += `Totale,${summary.nonConformities.total}\n`;
    csv += `Major,${summary.nonConformities.major}\n`;
    csv += `Minor,${summary.nonConformities.minor}\n`;
    csv += `Osservazioni,${summary.nonConformities.observations}\n\n`;

    // NC List
    if (summary.nonConformities.list.length > 0) {
        csv += 'DETTAGLIO NC\n';
        csv += 'Norma,Clausola,Categoria,Descrizione,Status\n';
        summary.nonConformities.list.forEach(nc => {
            csv += `${nc.norm},${nc.clause},${nc.category},"${nc.description.replace(/"/g, '""')}",${nc.status}\n`;
        });
    }

    const filename = `audit_summary_${audit.metadata.auditNumber}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
}

/**
 * Import audit da JSON
 * @param {string} jsonString - JSON string
 * @returns {Object} Audit object
 */
export function importAuditJSON(jsonString) {
    try {
        const data = JSON.parse(jsonString);

        // Verifica formato
        if (data.audit) {
            return data.audit; // Export singolo
        } else if (data.audits && Array.isArray(data.audits)) {
            return data.audits; // Export multiplo
        } else {
            throw new Error('Formato JSON non valido');
        }
    } catch (error) {
        console.error('Errore import JSON:', error);
        throw error;
    }
}

export default {
    exportAuditJSON,
    exportAllAuditsJSON,
    exportAuditSummary,
    downloadFile,
    downloadAuditJSON,
    downloadAllAuditsJSON,
    downloadAuditSummaryJSON,
    downloadAuditSummaryCSV,
    importAuditJSON
};
