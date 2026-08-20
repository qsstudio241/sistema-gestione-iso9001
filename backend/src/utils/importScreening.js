/**
 * Screening veloce Import PDF: path + nome + poco testo → doc_type registro.
 * Non è lo specialista (niente campi, niente Riesame). IA-5.
 */

const { classifyDocument } = require('./documentClassifier');
const { basenameImportRelativePath } = require('./importRelativePath');
const { folderCodeForDocType } = require('../services/documentTreeProvisioner.service');

const CLASSIFIER_TO_DOC_TYPE = Object.freeze({
    welder_qual: 'patentino_saldatore',
    operator_qual: 'qualifica_14732',
    coordinator: 'qualifica_14731',
    ndt: 'cert_ndt',
    wpqr: 'wpqr',
    wps: 'wps',
});

const QUALIFICATION_DOC_TYPES = new Set([
    'qualifica',
    'patentino_saldatore',
    'qualifica_14732',
    'qualifica_14731',
    'pes_pav',
    'cert_ndt',
]);

const PATH_RULES = [
    { re: /\b(capitolato|rfq|richiesta\s+di\s+offerta|ordine)\b/i, docType: 'capitolato' },
    { re: /\b(procedur|\bpg[-_\s]?\d)/i, docType: 'procedura' },
    { re: /\bmanuale\b/i, docType: 'manuale' },
    { re: /\b(istruzion|\biow\b)/i, docType: 'istruzione' },
    { re: /\b(modulo|\bmod[-_\s]?\d)/i, docType: 'modulo' },
    { re: /\b(wpqr|\bpqr\b|15614)\b/i, docType: 'wpqr' },
    { re: /\b(wps\b|15609)\b/i, docType: 'wps' },
    { re: /\b(9606|patentino|saldatore)\b/i, docType: 'patentino_saldatore' },
    { re: /\b14732\b/i, docType: 'qualifica_14732' },
    { re: /\b14731\b/i, docType: 'qualifica_14731' },
    { re: /\b(9712|cert[_-]?ndt|\bndt\b)\b/i, docType: 'cert_ndt' },
    { re: /\b(norma|iso[\s_-]?\d{3,5}|uni[\s_-]?\d)/i, docType: 'norma' },
];

function guessFromPath(originalName) {
    const hay = String(originalName || '').replace(/\\/g, '/');
    for (const rule of PATH_RULES) {
        if (rule.re.test(hay)) return rule.docType;
    }
    return null;
}

function guessFromText(extractedText) {
    const slice = String(extractedText || '').slice(0, 4000);
    if (!slice.trim()) return { docType: null, confidence: 'low' };

    const classified = classifyDocument(slice);
    const mapped = CLASSIFIER_TO_DOC_TYPE[classified.detected_type] || null;
    if (mapped && classified.score >= 2) {
        return {
            docType: mapped,
            confidence: classified.confidence === 'high' ? 'high' : 'medium',
        };
    }

    const lower = slice.toLowerCase();
    if (/\bcapitolato\b|\brfq\b|richiesta di offerta/.test(lower)) {
        return { docType: 'capitolato', confidence: 'medium' };
    }
    if (/\bprocedura\b/.test(lower)) {
        return { docType: 'procedura', confidence: 'medium' };
    }
    if (/\bmanuale\s+(qualit|del\s+sistema)/.test(lower)) {
        return { docType: 'manuale', confidence: 'medium' };
    }
    if (/\bnorma\b/.test(lower) && /\biso\b/.test(lower)) {
        return { docType: 'norma', confidence: 'medium' };
    }
    return { docType: null, confidence: 'low' };
}

/**
 * @param {{ original_name?: string, extracted_text?: string, hint?: string }} input
 * @returns {{ doc_type: string, confidence: 'high'|'medium'|'low', folder_code: string|null, reason: string, can_auto_place: boolean }}
 */
function screenImportFile(input) {
    const pathType = guessFromPath(input?.original_name);
    const textGuess = guessFromText(input?.extracted_text);
    const hint = String(input?.hint || '').trim() || null;

    let docType = pathType || textGuess.docType || hint || 'altro';
    let confidence = 'low';
    let reason = 'nessun indizio';

    if (pathType && textGuess.docType && pathType === textGuess.docType) {
        confidence = 'high';
        reason = 'path e testo concordano';
    } else if (pathType && textGuess.docType && pathType !== textGuess.docType) {
        docType = pathType;
        confidence = 'medium';
        reason = `path=${pathType}, testo=${textGuess.docType}`;
    } else if (pathType) {
        confidence = 'high';
        reason = 'nome/cartella';
    } else if (textGuess.docType && textGuess.confidence === 'high') {
        confidence = 'high';
        reason = 'testo';
    } else if (textGuess.docType) {
        confidence = 'medium';
        reason = 'testo debole';
    } else if (hint) {
        docType = hint;
        confidence = 'medium';
        reason = 'tipo suggerito del job';
    }

    const folder_code = folderCodeForDocType(docType);
    const can_auto_place = confidence === 'high'
        && !!folder_code
        && docType !== 'altro'
        && !QUALIFICATION_DOC_TYPES.has(docType);

    return {
        doc_type: docType,
        confidence,
        folder_code,
        reason,
        can_auto_place,
        basename: basenameImportRelativePath(input?.original_name) || input?.original_name || '',
    };
}

function isQualificationScreenType(docType) {
    return QUALIFICATION_DOC_TYPES.has(String(docType || '').trim());
}

module.exports = {
    screenImportFile,
    isQualificationScreenType,
    QUALIFICATION_DOC_TYPES,
};
