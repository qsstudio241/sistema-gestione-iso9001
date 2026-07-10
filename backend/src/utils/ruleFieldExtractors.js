'use strict';

/**
 * ruleFieldExtractors.js — estrazione euristica campi da testo PDF (senza AI).
 * Complementare all'AI: fornisce fallback e cross-check.
 */

const ISO_4063_CODES = ['111', '121', '131', '135', '136', '138', '141', '145', '311'];

const DATE_PATTERNS = [
    { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, fmt: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { re: /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, fmt: (m) => {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        return `${m[3]}-${mo}-${d}`;
    }},
];

function firstMatch(re, text) {
    const m = re.exec(text);
    re.lastIndex = 0;
    return m ? m[1] || m[0] : null;
}

function allDates(text) {
    const found = [];
    for (const { re, fmt } of DATE_PATTERNS) {
        let m;
        const local = new RegExp(re.source, re.flags);
        while ((m = local.exec(text)) !== null) {
            found.push(fmt(m));
        }
    }
    return [...new Set(found)];
}

function extractWeldingProcess(text) {
    const upper = text.toUpperCase();
    for (const code of ISO_4063_CODES) {
        const re = new RegExp(`\\b${code}\\b`);
        if (re.test(upper) || new RegExp(`ISO\\s*4063[:\\s]*${code}`, 'i').test(text)) {
            return code;
        }
    }
    const m = text.match(/\bprocess(?:o)?\s*(?:di\s*)?saldatura\s*[:.]?\s*(\d{3})\b/i);
    return m ? m[1] : null;
}

const {
    normalizeMaterialGroupCode,
    inferMaterialGroupFromText,
} = require('../data/materialGroups15608');

function extractMaterialGroup(text) {
    const direct = text.match(/\b(?:gruppo|group|materiale)\s*(?:base\s*)?[:.]?\s*(\d{1,2}(?:\.\d{1,2})?)\b/i)
        || text.match(/\bISO\/TR\s*15608\s*[:.]?\s*(\d{1,2}(?:\.\d{1,2})?)\b/i)
        || text.match(/\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:\/|\||\-)\s*\d{1,2}(?:\.\d{1,2})?\b/);
    if (direct) {
        const normalized = normalizeMaterialGroupCode(direct[1]);
        if (normalized) return normalized;
    }
    return inferMaterialGroupFromText(text) || normalizeMaterialGroupCode(text);
}

function extractReferenceFromFileName(fileName) {
    const base = String(fileName || '').replace(/\.[^/.]+$/, '').trim();
    if (/^\d{2}-\d{4,6}$/.test(base)) return base;
    if (/^WPQR[-_\s]?/i.test(base)) return base.replace(/^WPQR[-_\s]?/i, '').trim() || base;
    return base || null;
}

function extractWpqrReference(text, fileName) {
    const fromName = extractReferenceFromFileName(fileName);
    const m = text.match(/\b(?:WPQR|WPS|rif\.?|ref\.?|n[°º.]?\s*)\s*[:.]?\s*(\d{2}-\d{4,6})\b/i)
        || text.match(/\b(\d{2}-\d{4,6})\b/);
    return m ? (m[1] || m[0]) : fromName;
}

function extractCertificateNumber(text) {
    const m = text.match(/\b(?:cert(?:[\s\r\n]*ificato)?|certificate|n[°º.])\s*[:.]?\s*([A-Z0-9][A-Z0-9./\-]{4,})\b/i);
    if (!m) return null;
    const val = m[1].trim();
    // Scarta frammenti della parola "certificato" (artefatto split PDF)
    if (/^ificato$/i.test(val)) return null;
    return val;
}

function extractThicknessMm(text) {
    const m = text.match(/\b(?:spessore|thickness|t)\s*[:.=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*mm\b/i)
        || text.match(/\b(\d{1,3}(?:[.,]\d{1,2})?)\s*mm\b/i);
    if (!m) return null;
    return parseFloat(String(m[1]).replace(',', '.'));
}

// Parole in MAIUSCOLO che NON sono nomi propri (etichette tipiche nei patentini/scansioni OCR)
const NON_NAME_WORDS = new Set([
    'SALDATORE', 'WELDER', 'CERTIFICATO', 'CERTIFICATE', 'CERTIFICAZIONE',
    'PROCESSO', 'SALDATURA', 'QUALIFICA', 'QUALIFICAZIONE', 'NUMERO', 'NOME',
    'COGNOME', 'ENTE', 'DATA', 'ISO', 'EN', 'UNI', 'TUV', 'RINA', 'DNV',
    'MATERIALE', 'GRUPPO', 'POSIZIONE', 'GIUNTO', 'SPESSORE', 'DIAMETRO',
    'NOMINATIVO', 'TITOLARE', 'RILASCIO', 'SCADENZA', 'VALIDITA',
]);

/**
 * Nome persona: gestisce sia Titlecase (Mario Rossi) sia MAIUSCOLO (MARIO ROSSI),
 * frequente nell'output OCR delle scansioni. Prova prima le etichette specifiche
 * del nome, poi il fallback "saldatore/welder".
 */
function extractPersonName(text) {
    // Parola-nome: iniziale maiuscola, poi lettere di qualsiasi caso (gestisce MAIUSCOLO)
    const NAME_TOKEN = "[A-ZÀ-ÖØ-Þ][A-Za-zÀ-ÖØ-Þà-öø-ÿ'.]+";
    const nameRe = new RegExp(`^(${NAME_TOKEN}(?:\\s+${NAME_TOKEN}){1,3})`);

    const labelGroups = [
        /(?:nome\s+e\s+cognome|cognome\s+e\s+nome|nominativo|nome|cognome|titolare|name)\s*[:.\-]*\s*/i,
        /(?:saldatore|welder)\s*[:.\-]*\s*/i,
    ];

    for (const labelRe of labelGroups) {
        const globalRe = new RegExp(labelRe.source, 'gi');
        let lm;
        while ((lm = globalRe.exec(text)) !== null) {
            const after = text.slice(lm.index + lm[0].length);
            const nm = after.match(nameRe);
            if (!nm) continue;
            let parts = nm[1].trim().split(/\s+/);
            // Rimuovi parole-etichetta in coda (es. "MARIO ROSSI Numero")
            while (parts.length > 2 && NON_NAME_WORDS.has(parts[parts.length - 1].toUpperCase().replace(/[.'']/g, ''))) {
                parts.pop();
            }
            const candidate = parts.join(' ');
            const allStop = parts.every((w) => NON_NAME_WORDS.has(w.toUpperCase().replace(/[.'']/g, '')));
            if (!allStop && parts.length >= 2) return candidate;
        }
    }
    return null;
}

function extractIssuingBody(text) {
    const bodies = [
        'Bureau Veritas', 'DNV', 'Lloyd', 'RINA', 'TÜV', 'TUV', 'IMQ', 'IIS', 'CICPND', 'SGS',
    ];
    const lower = text.toLowerCase();
    for (const b of bodies) {
        if (lower.includes(b.toLowerCase())) return b.replace('TUV', 'TÜV');
    }
    return null;
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {object}
 */
function extractWpqrFields(text, fileName) {
    const dates = allDates(text);
    const thickness = extractThicknessMm(text);
    return {
        wpqr_number: extractWpqrReference(text, fileName),
        reference_number: extractWpqrReference(text, fileName),
        welding_process: extractWeldingProcess(text),
        material_group: extractMaterialGroup(text),
        base_material_group: extractMaterialGroup(text),
        thickness_tested: thickness,
        thickness_test_mm: thickness,
        approval_date: dates[0] || null,
        issue_date: dates[0] || null,
        expiry_date: dates.length > 1 ? dates[dates.length - 1] : null,
        certificate_number: extractCertificateNumber(text),
        examiner_body: extractIssuingBody(text),
        issuing_body: extractIssuingBody(text),
    };
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {object}
 */
function extractPatentinoFields(text, fileName) {
    const dates = allDates(text);
    const thickness = extractThicknessMm(text);
    return {
        welder_name: extractPersonName(text),
        certificate_number: extractCertificateNumber(text) || extractReferenceFromFileName(fileName),
        issuing_body: extractIssuingBody(text),
        welding_process: extractWeldingProcess(text),
        material_group: extractMaterialGroup(text),
        thickness_min_mm: thickness,
        exam_date: dates[0] || null,
        expiry_date: dates.length > 1 ? dates[dates.length - 1] : (dates[0] || null),
    };
}

const { guessStandardCodeFromFilename } = require('../services/documentRegistryNorm.service');

function extractNormFields(text, fileName) {
    const fromName = guessStandardCodeFromFilename(fileName);
    const trMatch = text.match(/\bISO\/TR\s+(\d+(?:-\d+)?)\s*:?\s*((?:19|20)\d{2})?/i);
    let codeFromText = null;
    if (trMatch) {
        codeFromText = `ISO/TR ${trMatch[1]}${trMatch[2] ? `:${trMatch[2]}` : ''}`;
    } else {
        codeFromText = firstMatch(
            /\b((?:UNI\s*)?(?:EN\s*)?(?:ISO\/TR|ISO\s+\d|IEC|EN|BS|DIN|AWS|ASME)\s*[\d]+(?:[-\s/][\d]+)*(?::\d{4})?)\b/i,
            text,
        );
    }
    let standard_code = codeFromText || fromName || null;
    if (fromName && codeFromText && /^ISO\s+20\d{2}$/i.test(String(codeFromText).trim())) {
        standard_code = fromName;
    }
    const yearFromCode = standard_code ? String(standard_code).match(/:(\d{4})\b/) : null;
    const yearInText = text.match(/\b((?:19|20)\d{2})\b/);
    const edition_year = yearFromCode
      ? parseInt(yearFromCode[1], 10)
      : (yearInText ? parseInt(yearInText[1], 10) : null);
    const issuing_body = standard_code
        ? (String(standard_code).toUpperCase().startsWith('UNI') ? 'UNI' : /\bISO\b/i.test(standard_code) ? 'ISO' : null)
        : null;
    return {
        standard_code,
        issuing_body,
        edition_year,
    };
}

const EXTRACTORS_BY_DOC_TYPE = {
    wpqr: extractWpqrFields,
    patentino_saldatore: extractPatentinoFields,
    wps: (text, fileName) => ({
        wps_number: extractWpqrReference(text, fileName),
        welding_process: extractWeldingProcess(text),
        base_material: extractMaterialGroup(text),
        wpqr_ref: firstMatch(/\bWPQR\s*[:.]?\s*(\d{2}-\d{4,6})\b/i, text),
    }),
    norma: extractNormFields,
};

/**
 * @param {string} text
 * @param {string} docType
 * @param {string} [fileName]
 * @returns {object}
 */
function extractFieldsByRules(text, docType, fileName = '') {
    const fn = EXTRACTORS_BY_DOC_TYPE[docType];
    if (!fn) return {};
    const body = String(text || '');
    if (body.trim().length < 10) {
        const fromName = extractReferenceFromFileName(fileName);
        return fromName ? { reference_number: fromName, wpqr_number: fromName } : {};
    }
    return fn(body, fileName);
}

module.exports = {
    extractFieldsByRules,
    extractWpqrFields,
    extractPatentinoFields,
    extractWeldingProcess,
    extractMaterialGroup,
    allDates,
};
