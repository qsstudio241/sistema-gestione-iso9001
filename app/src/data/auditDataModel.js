/**
 * Data Model per Audit ISO 9001/14001/45001
 * Sistema Gestione ISO 9001 - QS Studio
 * 
 * Questo file definisce la struttura dati completa per gli audit dei sistemi di gestione ISO.
 * Utilizzato per validazione, TypeScript types, e documentazione architettura.
 */

// ============================================================================
// COSTANTI E ENUMERAZIONI
// ============================================================================

/**
 * Status dell'audit durante il suo ciclo di vita
 */
export const AUDIT_STATUS = {
    DRAFT: 'draft',                    // Bozza iniziale
    IN_PROGRESS: 'in_progress',        // In corso di compilazione
    SUSPENDED: 'suspended',            // Sospeso temporaneamente
    COMPLETED: 'completed',            // Completato
    ARCHIVED: 'archived'               // Archiviato
};

/**
 * Status risposte checklist (ISO 9001:2015 terminology)
 */
export const CHECKLIST_STATUS = {
    COMPLIANT: 'compliant',            // Soddisfatto ✓
    PARTIAL: 'partial',                // Parzialmente soddisfatto (OSS) ○
    NON_COMPLIANT: 'non_compliant',   // Non Soddisfatto (NC) ✗
    NOT_APPLICABLE: 'not_applicable'  // Non applicabile -
};

/**
 * Norme ISO supportate
 */
export const ISO_STANDARDS = {
    ISO_9001: 'ISO_9001',    // Sistema Gestione Qualità
    ISO_14001: 'ISO_14001',  // Sistema Gestione Ambientale
    ISO_45001: 'ISO_45001'   // Sistema Gestione Salute e Sicurezza
};

/**
 * Categorie Non Conformità
 */
export const NC_CATEGORY = {
    MAJOR: 'major',              // Non conformità maggiore
    MINOR: 'minor',              // Non conformità minore
    OBSERVATION: 'observation'   // Osservazione
};

/**
 * Status tracking Non Conformità
 */
export const NC_STATUS = {
    OPEN: 'open',                    // Aperta
    IN_PROGRESS: 'in_progress',      // In corso di risoluzione
    COMPLETED: 'completed',          // Completata (in attesa verifica)
    VERIFIED: 'verified',            // Verificata e chiusa
    REJECTED: 'rejected'             // Rifiutata (richiede revisione)
};

/**
 * Categorie evidenze documentali
 */
export const EVIDENCE_CATEGORY = {
    GENERAL: 'Generale',
    DOCUMENT_MANAGEMENT: 'Gestione_Documentale',
    PROCESS_CONTROL: 'Controllo_Processi',
    CORRECTIVE_ACTIONS: 'Azioni_Correttive'
};

/**
 * Tipi di export disponibili
 */
export const EXPORT_TYPE = {
    CHECKLIST: 'checklist',
    NON_CONFORMITIES: 'nonconformities',
    METRICS: 'metrics',
    REPORT: 'report',
    BACKUP: 'backup',
    WORD: 'word'
};

// ============================================================================
// SCHEMA DATA MODEL
// ============================================================================

/**
 * @typedef {Object} AuditMetadata
 * @property {string} id - UUID univoco audit
 * @property {string} clientName - Nome cliente/organizzazione
 * @property {number} projectYear - Anno audit (es. 2025)
 * @property {string} auditNumber - Numero progressivo annuale (es. "2025-01")
 * @property {string} status - Status audit (vedi AUDIT_STATUS)
 * @property {string[]} selectedStandards - Norme ISO selezionate (es. ["ISO_9001", "ISO_14001"])
 * @property {string} auditor - Nome auditor principale
 * @property {string} areaAuditata - Area/processo auditato
 * @property {string} createdAt - Timestamp creazione (ISO 8601)
 * @property {string} lastModified - Timestamp ultima modifica (ISO 8601)
 * @property {boolean} fsConnected - Flag: connesso a File System Access API
 * @property {string|null} fsRootPath - Path directory File System (es. "Cliente/Audit_2025")
 */

/**
 * @typedef {Object} ChecklistQuestion
 * @property {string} id - ID univoco domanda (es. "q4.1")
 * @property {string} text - Testo domanda audit
 * @property {string} clauseRef - Riferimento clausola norma (es. "4.1")
 * @property {string} status - Status risposta (vedi CHECKLIST_STATUS)
 * @property {number|null} score - Score 0-5 (opzionale)
 * @property {string} notes - Note auditor
 * @property {string} evidenceRef - Riferimento evidenza documentale (es. "PR02.05 rev.1 del 01/04/2019")
 * @property {string|null} auditDate - Data verifica (ISO 8601 date)
 * @property {string[]} linkedEvidences - Array fileId evidenze collegate
 */

/**
 * @typedef {Object} ChecklistClause
 * @property {string} id - ID clausola (es. "clause4")
 * @property {string} title - Titolo clausola (es. "4. Contesto dell'Organizzazione")
 * @property {ChecklistQuestion[]} questions - Array domande
 */

/**
 * @typedef {Object} Checklist
 * @property {Object.<string, ChecklistClause>} ISO_9001 - Checklist ISO 9001:2015
 * @property {Object.<string, ChecklistClause>} ISO_14001 - Checklist ISO 14001:2015
 * @property {Object.<string, ChecklistClause>} ISO_45001 - Checklist ISO 45001:2018
 */

/**
 * @typedef {Object} CorrectiveAction
 * @property {string} description - Descrizione azione correttiva
 * @property {string} responsible - Responsabile attuazione
 * @property {string} deadline - Scadenza (ISO 8601 date)
 * @property {string} status - Status tracking (vedi NC_STATUS)
 * @property {string|null} verificationDate - Data verifica completamento
 * @property {string} verificationNotes - Note verifica
 */

/**
 * @typedef {Object} NonConformity
 * @property {string} id - UUID non conformità
 * @property {string} norm - Norma origine (ISO_9001, ISO_14001, ISO_45001)
 * @property {string} clause - Clausola norma (es. "4.2")
 * @property {string} category - Categoria NC (vedi NC_CATEGORY)
 * @property {string} description - Descrizione non conformità
 * @property {string} rootCause - Analisi causa radice
 * @property {string|null} evidenceId - ID evidenza collegata
 * @property {CorrectiveAction} correctiveAction - Azione correttiva associata
 * @property {string} detectedBy - Auditor che ha rilevato NC
 * @property {string} detectedDate - Data rilevamento (ISO 8601)
 * @property {string[]} historyLog - Log modifiche NC
 */

/**
 * @typedef {Object} Evidence
 * @property {string} id - UUID evidenza
 * @property {string} name - Nome file
 * @property {string} path - Path relativo (es. "Evidenze/Generale/Piano_Strategico.pdf")
 * @property {number} size - Dimensione file (bytes)
 * @property {string} type - MIME type (es. "application/pdf")
 * @property {string} category - Categoria evidenza (vedi EVIDENCE_CATEGORY)
 * @property {string} uploadedAt - Timestamp upload (ISO 8601)
 * @property {string[]} linkedToQuestions - Array question IDs collegati
 * @property {string} uploadedBy - Utente che ha caricato evidenza
 */

/**
 * @typedef {Object} PendingIssue
 * @property {string} id - UUID rilievo pendente
 * @property {string} norm - Norma origine
 * @property {string} clause - Clausola norma
 * @property {string} description - Descrizione rilievo
 * @property {string} originAuditId - ID audit di origine
 * @property {string} originAuditNumber - Numero audit origine (es. "2024-03")
 * @property {string|null} transferredToAuditId - ID audit destinazione
 * @property {string} status - Status (open, in_progress, resolved)
 * @property {string|null} resolvedDate - Data risoluzione
 * @property {string} resolutionNotes - Note risoluzione
 */

/**
 * @typedef {Object} ReportChapter
 * @property {string} id - ID capitolo
 * @property {string} title - Titolo capitolo
 * @property {string} content - Contenuto testo (supporta Markdown)
 * @property {string} completionStatus - Status (empty, draft, complete)
 * @property {number} wordCount - Conteggio parole
 * @property {string} lastModified - Timestamp ultima modifica
 */

/**
 * @typedef {Object} AuditMetrics
 * @property {number} completionPercentage - % completamento audit (0-100)
 * @property {number} totalQuestions - Numero totale domande
 * @property {number} answeredQuestions - Numero domande risposte
 * @property {number} complianceScore - Score conformità medio (0-5)
 * @property {number} totalNC - Numero totale NC
 * @property {number} majorNC - Numero NC major
 * @property {number} minorNC - Numero NC minor
 * @property {number} observationsNC - Numero osservazioni
 * @property {number} totalEvidences - Numero evidenze caricate
 * @property {Object.<string, number>} completionByStandard - Completion % per norma
 */

/**
 * @typedef {Object} ExportRecord
 * @property {string} type - Tipo export (vedi EXPORT_TYPE)
 * @property {string} filename - Nome file generato
 * @property {string} exportedAt - Timestamp export (ISO 8601)
 * @property {string} method - Metodo salvataggio (filesystem, download)
 * @property {string} exportedBy - Utente che ha esportato
 */

/**
 * @typedef {Object} AuditISO
 * @property {AuditMetadata} metadata - Metadata audit
 * @property {Checklist} checklist - Checklist per norme selezionate
 * @property {NonConformity[]} nonConformities - Array non conformità
 * @property {Object.<string, Evidence>} evidences - Map evidenze (key: evidenceId)
 * @property {PendingIssue[]} pendingIssues - Rilievi pendenti da audit precedenti
 * @property {ReportChapter[]} reportChapters - Capitoli report narrativo
 * @property {AuditMetrics} metrics - Metriche calcolate real-time
 * @property {ExportRecord[]} exports - Storico export
 */

// ============================================================================
// SCHEMA FACTORY FUNCTIONS
// ============================================================================

/**
 * Crea nuovo oggetto audit con valori default
 * @param {Object} metadata - Metadata iniziali
 * @returns {AuditISO} Nuovo oggetto audit
 */
export function createNewAudit(metadata) {
    return {
        metadata: {
            id: crypto.randomUUID(),
            clientName: metadata.clientName || '',
            projectYear: metadata.projectYear || new Date().getFullYear(),
            auditNumber: metadata.auditNumber || '',
            status: AUDIT_STATUS.DRAFT,
            selectedStandards: metadata.selectedStandards || [ISO_STANDARDS.ISO_9001],
            auditor: metadata.auditor || '',
            areaAuditata: metadata.areaAuditata || '',
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            fsConnected: false,
            fsRootPath: null
        },
        checklist: {},
        nonConformities: [],
        evidences: {},
        pendingIssues: [],
        reportChapters: [],
        metrics: {
            completionPercentage: 0,
            totalQuestions: 0,
            answeredQuestions: 0,
            complianceScore: 0,
            totalNC: 0,
            majorNC: 0,
            minorNC: 0,
            observationsNC: 0,
            totalEvidences: 0,
            completionByStandard: {}
        },
        exports: []
    };
}

/**
 * Crea nuova domanda checklist con valori default
 * @param {string} id - ID domanda
 * @param {string} text - Testo domanda
 * @param {string} clauseRef - Riferimento clausola
 * @returns {ChecklistQuestion} Nuova domanda
 */
export function createChecklistQuestion(id, text, clauseRef) {
    return {
        id,
        text,
        clauseRef,
        status: CHECKLIST_STATUS.NOT_APPLICABLE,
        score: null,
        notes: '',
        evidenceRef: '',
        auditDate: null,
        linkedEvidences: []
    };
}

/**
 * Crea nuova non conformità con valori default
 * @param {string} norm - Norma ISO
 * @param {string} clause - Clausola
 * @returns {NonConformity} Nuova NC
 */
export function createNonConformity(norm, clause) {
    return {
        id: crypto.randomUUID(),
        norm,
        clause,
        category: NC_CATEGORY.MINOR,
        description: '',
        rootCause: '',
        evidenceId: null,
        correctiveAction: {
            description: '',
            responsible: '',
            deadline: '',
            status: NC_STATUS.OPEN,
            verificationDate: null,
            verificationNotes: ''
        },
        detectedBy: '',
        detectedDate: new Date().toISOString(),
        historyLog: []
    };
}

/**
 * Crea nuova evidenza con valori default
 * @param {File} file - File object
 * @param {string} category - Categoria evidenza
 * @returns {Evidence} Nuova evidenza
 */
export function createEvidence(file, category) {
    return {
        id: crypto.randomUUID(),
        name: file.name,
        path: `Evidenze/${category}/${file.name}`,
        size: file.size,
        type: file.type,
        category,
        uploadedAt: new Date().toISOString(),
        linkedToQuestions: [],
        uploadedBy: ''
    };
}

/**
 * Crea nuovo rilievo pendente
 * @param {string} norm - Norma ISO
 * @param {string} clause - Clausola
 * @param {string} description - Descrizione
 * @param {string} originAuditId - ID audit origine
 * @param {string} originAuditNumber - Numero audit origine
 * @returns {PendingIssue} Nuovo pending issue
 */
export function createPendingIssue(norm, clause, description, originAuditId, originAuditNumber) {
    return {
        id: crypto.randomUUID(),
        norm,
        clause,
        description,
        originAuditId,
        originAuditNumber,
        transferredToAuditId: null,
        status: 'open',
        resolvedDate: null,
        resolutionNotes: ''
    };
}

/**
 * Crea nuovo capitolo report
 * @param {string} id - ID capitolo
 * @param {string} title - Titolo
 * @returns {ReportChapter} Nuovo capitolo
 */
export function createReportChapter(id, title) {
    return {
        id,
        title,
        content: '',
        completionStatus: 'empty',
        wordCount: 0,
        lastModified: new Date().toISOString()
    };
}

// ============================================================================
// VALIDAZIONE SCHEMA
// ============================================================================

/**
 * Valida struttura oggetto audit
 * @param {AuditISO} audit - Audit da validare
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateAuditSchema(audit) {
    const errors = [];

    // Valida metadata
    if (!audit.metadata?.id) errors.push('Missing metadata.id');
    if (!audit.metadata?.clientName) errors.push('Missing metadata.clientName');
    if (!audit.metadata?.projectYear) errors.push('Missing metadata.projectYear');
    if (!audit.metadata?.selectedStandards?.length) errors.push('Missing selectedStandards');

    // Valida checklist
    if (!audit.checklist || typeof audit.checklist !== 'object') {
        errors.push('Invalid checklist structure');
    }

    // Valida arrays
    if (!Array.isArray(audit.nonConformities)) errors.push('nonConformities must be array');
    if (!Array.isArray(audit.pendingIssues)) errors.push('pendingIssues must be array');
    if (!Array.isArray(audit.reportChapters)) errors.push('reportChapters must be array');
    if (!Array.isArray(audit.exports)) errors.push('exports must be array');

    // Valida evidences
    if (!audit.evidences || typeof audit.evidences !== 'object') {
        errors.push('evidences must be object');
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default {
    AUDIT_STATUS,
    CHECKLIST_STATUS,
    ISO_STANDARDS,
    NC_CATEGORY,
    NC_STATUS,
    EVIDENCE_CATEGORY,
    EXPORT_TYPE,
    createNewAudit,
    createChecklistQuestion,
    createNonConformity,
    createEvidence,
    createPendingIssue,
    createReportChapter,
    validateAuditSchema
};
