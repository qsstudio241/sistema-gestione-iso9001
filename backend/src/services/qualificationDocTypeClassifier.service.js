'use strict';

/**
 * qualificationDocTypeClassifier.service.js
 * Riconoscimento del tipo documento per file nel «Carica qualifiche (batch)» quando
 * l'operatore non indica `doc_type`. Tre livelli, dal meno costoso:
 *   1. regole deterministiche sul testo estratto (norma citata esplicitamente);
 *   2. OCR: testo già ottenuto da OCR (scansioni) oppure OCR della sola intestazione;
 *   3. AI (un solo prompt breve, solo classificazione) quando le regole non decidono.
 * Famiglie: patentino_saldatore (ISO 9606-x), qualifica_14732, cert_ndt (ISO 9712), altro.
 * Confidenza `low` o `altro` = il file resta «da scegliere» (nessuna estrazione automatica).
 * Il tipo è un metadato dell'upload, non un campo dello schema ingest.
 */

const logger = require('../utils/logger');
const { redactFileNameForLog } = require('../utils/ingestErrorMessage');
const { getActiveProvider, chat } = require('./aiProviderAdapter');
const { parseJsonWithRepair } = require('../utils/jsonRepair');

let extractHeaderTextWithOCR = null;
try {
    ({ extractHeaderTextWithOCR } = require('../utils/ocrExtractor'));
} catch (_) {}

const DOC_TYPES = Object.freeze(['patentino_saldatore', 'qualifica_14732', 'cert_ndt']);
const MAX_CLASSIFY_CHARS = 8000;
const AI_PROMPT_CHARS = 2500;
const MIN_TEXT_FOR_AI = 40;

const STRONG = {
    qualifica_14732: [/(?<!\d)14732(?!\d)/i],
    patentino_saldatore: [/(?<!\d)9606(?!\d)/i],
    cert_ndt: [/(?<!\d)9712(?!\d)/i],
};

const WEAK = {
    qualifica_14732: [/\bwelding\s+operator\b/i, /\boperatore\s+(?:di\s+)?saldatura\b/i, /\bweld(?:ing)?\s+setter\b/i],
    patentino_saldatore: [/\bwelder'?s?\b/i, /\bsaldatore\b/i, /\bpatentino\b/i],
    cert_ndt: [
        /\bnon[\s-]destructive\s+testing\b/i,
        /\b(?:prove|controlli)\s+non\s+distruttiv[ei]\b/i,
        /\b(?:ultrasonic|radiograph\w*|magnetic\s+particle|penetrant|eddy\s+current)\b.{0,40}\b(?:level|livello)\b/i,
        /\b(?:level|livello)\s*[123]\b.{0,40}\b(?:ultrasonic|radiograph\w*|magnetic|penetrant|eddy)/i,
    ],
};

const LABELS = {
    patentino_saldatore: 'ISO 9606',
    qualifica_14732: 'ISO 14732',
    cert_ndt: 'ISO 9712 (NDT)',
};

function matchesAny(patterns, text) {
    return patterns.some((p) => p.test(text));
}

function evidenceOf(text) {
    const strong = [];
    const weak = [];
    for (const dt of DOC_TYPES) {
        if (matchesAny(STRONG[dt], text)) strong.push(dt);
        else if (matchesAny(WEAK[dt], text)) weak.push(dt);
    }
    return { strong, weak };
}

function describeOtherType(text) {
    if (/(?<!\d)14731(?!\d)|\b(?:IWE|IWT|IWS|IWIP|EWE|EWT|EWS)\b/.test(text)) return 'Coordinatore ISO 14731';
    if (/\bPES\b|\bPAV\b/.test(text)) return 'Patentino PES/PAV (CEI 11-27)';
    return null;
}

/**
 * Livello 1/2: regole sul testo (e, come sola conferma/conflitto, sul nome file).
 * Il nome file non sostituisce mai l'evidenza dal documento: da solo propone un tipo con
 * confidenza `low` (il file resta «da scegliere» e l'OCR dell'intestazione/AI restano dovuti);
 * in disaccordo col testo abbassa a `low`.
 * @returns {{ doc_type: string, confidence: 'high'|'medium'|'low', reasons: string[], otherType: string|null, hasTextEvidence: boolean }}
 */
function classifyByRules(text, fileName = '') {
    const body = String(text || '').slice(0, MAX_CLASSIFY_CHARS);
    const reasons = [];
    const textEv = evidenceOf(body);
    const nameEv = evidenceOf(String(fileName || ''));
    const nameFamilies = [...nameEv.strong, ...nameEv.weak];

    let docType = 'altro';
    let confidence = 'low';

    if (textEv.strong.length > 0) {
        const s = new Set(textEv.strong);
        if (s.has('qualifica_14732') && !s.has('cert_ndt')) {
            docType = 'qualifica_14732';
            confidence = 'high';
            reasons.push(s.has('patentino_saldatore')
                ? 'Citata la norma ISO 14732 (la ISO 9606 compare come base della qualifica)'
                : 'Citata la norma ISO 14732');
        } else if (s.size === 1) {
            docType = textEv.strong[0];
            confidence = 'high';
            reasons.push(`Citata la norma ${LABELS[docType]}`);
        } else {
            reasons.push(`Norme in conflitto nel testo: ${textEv.strong.map((d) => LABELS[d]).join(' + ')}`);
        }
    } else if (textEv.weak.length === 1) {
        docType = textEv.weak[0];
        confidence = 'medium';
        reasons.push(`Indizi testuali compatibili con ${LABELS[docType]}, norma non citata`);
    } else if (textEv.weak.length > 1) {
        reasons.push('Indizi testuali ambigui tra più tipi di qualifica');
    }

    const hadTextEvidence = docType !== 'altro' || textEv.strong.length > 0 || textEv.weak.length > 0;
    const textOtherType = hadTextEvidence ? null : describeOtherType(body);

    if (nameFamilies.length > 0 && !textOtherType) {
        const nameSet = new Set(nameFamilies);
        if (docType === 'altro' && !hadTextEvidence && nameSet.size === 1) {
            docType = nameFamilies[0];
            confidence = 'low';
            reasons.push(`Solo il nome file richiama ${LABELS[docType]}: indizio debole, da verificare sul documento`);
        } else if (docType !== 'altro' && nameEv.strong.length > 0 && !nameEv.strong.includes(docType)) {
            if (docType === 'patentino_saldatore' && nameEv.strong.includes('qualifica_14732')) {
                reasons.push('Il nome file richiama ISO 14732 ma il testo cita ISO 9606');
            } else {
                reasons.push(`Il nome file richiama ${LABELS[nameEv.strong[0]]}, diverso dal testo`);
            }
            confidence = 'low';
        }
    }

    let otherType = null;
    if (docType === 'altro' && reasons.length === 0) {
        otherType = textOtherType;
        reasons.push(otherType
            ? `Riconosciuto come ${otherType}: tipo non gestito dal caricamento batch`
            : 'Nessuna norma o indizio riconoscibile nel testo');
    }

    return {
        doc_type: docType,
        confidence,
        reasons,
        otherType,
        hasTextEvidence: hadTextEvidence || Boolean(textOtherType),
    };
}

const AI_SYSTEM_PROMPT = 'Classifichi documenti di qualifica del personale. Rispondi SOLO con JSON valido, senza markdown.';

function buildAiPrompt(text) {
    return [
        'Classifica il documento tra: patentino_saldatore (qualifica saldatore ISO 9606), '
        + 'qualifica_14732 (qualifica operatore di saldatura ISO 14732), '
        + 'cert_ndt (certificato personale prove non distruttive ISO 9712), altro.',
        'Rispondi con JSON: {"doc_type":"...","confidence":"high|medium|low","reason":"max 15 parole"}.',
        'Se non sei certo usa "altro" o confidence "low".',
        `Testo:\n${text.slice(0, AI_PROMPT_CHARS)}`,
    ].join('\n');
}

async function classifyByAi(text, chatFn = chat) {
    const parsed = parseJsonWithRepair((await chatFn(
        [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: buildAiPrompt(text) },
        ],
        { temperature: 0, responseFormat: 'json', maxTokens: 200 },
    )).content || '');
    const dt = DOC_TYPES.includes(parsed?.doc_type) ? parsed.doc_type : 'altro';
    const conf = ['high', 'medium', 'low'].includes(parsed?.confidence) ? parsed.confidence : 'low';
    const reason = typeof parsed?.reason === 'string' ? parsed.reason.trim().slice(0, 160) : '';
    return { doc_type: dt, confidence: conf, reason };
}

function finalize(result, meta) {
    return {
        detected_doc_type: result.doc_type,
        confidence: result.confidence,
        classification_source: result.source,
        reasons: result.reasons,
        needs_choice: result.doc_type === 'altro' || result.confidence === 'low',
        ai_calls: meta.aiCalls,
    };
}

/**
 * Classifica un file senza `doc_type` esplicito. Non lancia mai: ogni errore dei livelli
 * OCR/AI degrada a `low` / «da scegliere».
 *
 * @param {object} p
 * @param {Buffer} p.pdfBuffer
 * @param {string} p.fileName
 * @param {string} p.text - testo già estratto (pdf-parse o OCR)
 * @param {boolean} [p.ocrUsed]
 * @param {object} [p.deps] - iniezione per test: { headerOcr, chatFn, hasAi }
 */
async function classifyQualificationDocType({ pdfBuffer, fileName = '', text = '', ocrUsed = false, deps = {} }) {
    const startedAt = Date.now();
    const headerOcr = deps.headerOcr === undefined ? extractHeaderTextWithOCR : deps.headerOcr;
    const chatFn = deps.chatFn || chat;
    const hasAi = deps.hasAi === undefined ? Boolean(getActiveProvider()) : deps.hasAi;
    const meta = { aiCalls: 0 };
    const cleanText = String(text || '').trim();

    let rules = classifyByRules(cleanText, fileName);
    let source = ocrUsed ? 'ocr' : 'rules';
    const reasons = [...rules.reasons];

    if (rules.otherType) {
        const out = finalize({ doc_type: 'altro', confidence: 'low', source, reasons }, meta);
        logSummary(fileName, out, startedAt, cleanText.length, ocrUsed);
        return out;
    }

    // L'OCR dell'intestazione dipende solo dall'evidenza nel documento: il nome file non lo sostituisce.
    const textHasEvidence = classifyByRules(cleanText, '').doc_type !== 'altro';
    const headerOcrDisabled = String(process.env.INGEST_HEADER_OCR || '').trim() === '0';
    if (!textHasEvidence && !ocrUsed && headerOcr && !headerOcrDisabled && pdfBuffer) {
        try {
            const headerText = await headerOcr(pdfBuffer, { pageNumber: 1, lang: 'ita+eng' });
            const headerOnly = classifyByRules(headerText, '');
            if (headerOnly.hasTextEvidence) {
                // L'intestazione ha detto qualcosa (tipo, tipo non gestito o norme in conflitto): il nome file non può scavalcarla.
                const tagged = headerOnly.reasons.map((r) => `${r} (OCR intestazione)`);
                rules = headerOnly.doc_type === 'altro' ? headerOnly : classifyByRules(headerText, fileName);
                source = 'ocr';
                reasons.length = 0;
                reasons.push(...tagged, ...rules.reasons.filter((r) => !headerOnly.reasons.includes(r)));
            }
        } catch (err) {
            logger.warn(`[QualifClassify] OCR intestazione non riuscito file=${redactFileNameForLog(fileName)}: ${err?.message || err}`);
        }
    }

    if (rules.otherType) {
        const out = finalize({ doc_type: 'altro', confidence: 'low', source, reasons }, meta);
        logSummary(fileName, out, startedAt, cleanText.length, ocrUsed);
        return out;
    }

    if (rules.confidence !== 'low' && rules.doc_type !== 'altro') {
        const out = finalize({ doc_type: rules.doc_type, confidence: rules.confidence, source, reasons }, meta);
        logSummary(fileName, out, startedAt, cleanText.length, ocrUsed);
        return out;
    }

    if (hasAi && cleanText.length >= MIN_TEXT_FOR_AI) {
        try {
            meta.aiCalls += 1;
            const ai = await classifyByAi(cleanText, chatFn);
            const aiReason = ai.reason ? `AI: ${ai.reason}` : 'Classificazione AI';
            if (ai.doc_type !== 'altro' && ai.confidence !== 'low') {
                // L'AI non diventa mai `high`: un tipo sbagliato qui avvierebbe l'estrazione sul tipo errato.
                const out = finalize({
                    doc_type: ai.doc_type,
                    confidence: 'medium',
                    source: 'ai',
                    reasons: [...reasons, aiReason],
                }, meta);
                logSummary(fileName, out, startedAt, cleanText.length, ocrUsed);
                return out;
            }
            reasons.push(`${aiReason} (non conclusiva)`);
            source = 'ai';
        } catch (err) {
            reasons.push('Classificazione AI non disponibile');
            logger.warn(`[QualifClassify] AI non riuscita file=${redactFileNameForLog(fileName)}: ${err?.message || err}`);
        }
    } else if (cleanText.length < MIN_TEXT_FOR_AI) {
        reasons.push('Testo del documento non leggibile o troppo breve');
    }

    const out = finalize({
        doc_type: rules.doc_type === 'altro' ? 'altro' : rules.doc_type,
        confidence: 'low',
        source,
        reasons,
    }, meta);
    logSummary(fileName, out, startedAt, cleanText.length, ocrUsed);
    return out;
}

function logSummary(fileName, out, startedAt, textChars, ocrUsed) {
    logger.info(
        `[QualifClassify] file=${redactFileNameForLog(fileName)} docType=${out.detected_doc_type}`
        + ` conf=${out.confidence} source=${out.classification_source} aiCalls=${out.ai_calls}`
        + ` ocr=${ocrUsed ? 1 : 0} chars=${textChars} ms=${Date.now() - startedAt}`,
    );
}

/** Risultato per override esplicito dell'operatore (nessuna classificazione eseguita). */
function overrideClassification(docType) {
    return {
        detected_doc_type: docType,
        confidence: 'high',
        classification_source: 'override',
        reasons: ['Tipo scelto dall\'operatore'],
        needs_choice: false,
        ai_calls: 0,
    };
}

module.exports = {
    DOC_TYPES,
    classifyQualificationDocType,
    classifyByRules,
    classifyByAi,
    overrideClassification,
};
