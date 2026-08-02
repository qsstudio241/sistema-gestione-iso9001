'use strict';

/**
 * ruleFieldExtractors.js — estrazione euristica campi da testo PDF (senza AI).
 * Complementare all'AI: fornisce fallback e cross-check.
 */

const {
    inferWeldingProcessFromText,
} = require('../data/weldingProcesses4063');
const {
    extractWeldingPositionsFromText,
} = require('../data/weldingPositions6947');

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
    return inferWeldingProcessFromText(text);
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
    if (/^\d{2}-\d{4,6}(?:-\d{1,2})?$/.test(base)) return base;
    if (/^WPQR[-_\s]?/i.test(base)) return base.replace(/^WPQR[-_\s]?/i, '').trim() || base;
    return base || null;
}

/**
 * Numero WPQR/certificato. Accetta suffisso di rivisione (es. "24-03390-01"),
 * frequente su verbali TEC Eurolab e simili (DEPUTYTASK1 25/07/2026).
 */
function extractWpqrReference(text, fileName) {
    const fromName = extractReferenceFromFileName(fileName);
    const m = text.match(/\b(?:WPQR|WPS|rif\.?|ref\.?|n[°º.]?\s*)\s*[:.]?\s*(\d{2}-\d{4,6}(?:-\d{1,2})?)\b/i)
        || text.match(/\b(\d{2}-\d{4,6}(?:-\d{1,2})?)\b/);
    return m ? (m[1] || m[0]) : fromName;
}

function extractCertificateNumber(text) {
    // Preferisci etichette esplicite "CERTIFICATO N° …" / "CERTIFICATE N° …"
    // (formati NDT tipo E-00951-UT-2 R — evita il falso positivo su "CERTIFICATION BODY"
    // che produceva "IFICATION", visto su TEC-Eurolab 02/08/2026).
    const labeled = text.match(
        /\b(?:CERTIFICATO|CERTIFICATE)\s*N[°º.]?\s*([A-Z0-9][A-Z0-9./\- ]{3,}?)\s*$/im,
    ) || text.match(
        /\b(?:CERTIFICATO|CERTIFICATE)\s*N[°º.]?\s*([A-Z0-9][A-Z0-9./\-]+(?:\s+[A-Z])?)\b/i,
    );
    if (labeled) {
        const val = labeled[1].trim().replace(/\s{2,}/g, ' ');
        if (!/^(ificato|ification|ication|body)$/i.test(val)) return val;
    }
    const m = text.match(/\b(?:cert(?:[\s\r\n]*ificato)?|certificate|n[°º.])\s*[:.]?\s*([A-Z0-9][A-Z0-9./\-]{4,})\b/i);
    if (!m) return null;
    const val = m[1].trim();
    // Scarta frammenti di "certificato"/"certification" (artefatto split PDF / OCR)
    if (/^(ificato|ification|ication|body)$/i.test(val)) return null;
    return val;
}

function extractThicknessMm(text) {
    const m = text.match(/\b(?:spessore|thickness|t)\s*[:.=]?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*mm\b/i)
        || text.match(/\b(\d{1,3}(?:[.,]\d{1,2})?)\s*mm\b/i);
    if (!m) return null;
    return parseFloat(String(m[1]).replace(',', '.'));
}

/**
 * Range dichiarato (min-max) accanto a un'etichetta spessore/diametro, es.
 * "Range of qualification thickness (mm): 3 - 24" oppure "Diameter range: 141 - 500 mm".
 * Estrae SOLO valori dichiarati sul verbale — nessun calcolo/formula.
 */
function extractDeclaredRangeMm(text, labelRe) {
    const re = new RegExp(`${labelRe.source}[^\\d]{0,30}(\\d{1,4}(?:[.,]\\d{1,2})?)\\s*(?:-|a|to|\u2013)\\s*(\\d{1,4}(?:[.,]\\d{1,2})?)(?:\\s*mm)?`, 'i');
    const m = text.match(re);
    if (!m) return { min: null, max: null };
    return {
        min: parseFloat(String(m[1]).replace(',', '.')),
        max: parseFloat(String(m[2]).replace(',', '.')),
    };
}

function extractThicknessRangeMm(text) {
    const { min, max } = extractDeclaredRangeMm(text, /\b(?:thickness|spessore)\b/);
    return { thickness_min: min, thickness_max: max };
}

function extractDiameterRangeMm(text) {
    const { min, max } = extractDeclaredRangeMm(text, /\b(?:diamet(?:er|ro)|pipe\s*diameter)\b/i);
    return { diameter_min: min, diameter_max: max };
}

function extractJointType(text) {
    const hasBW = /\bBW\b/.test(text) || /\bbutt\s*weld/i.test(text);
    const hasFW = /\bFW\b/.test(text) || /\bfillet\s*weld/i.test(text);
    if (hasBW && hasFW) return 'BW+FW';
    if (hasBW) return 'BW';
    if (hasFW) return 'FW';
    return null;
}

function extractQualificationLevel(text) {
    const m = text.match(/\blevel(?:lo)?\s*[:.]?\s*([12])\b/i);
    return m ? m[1] : null;
}

function extractFillerMaterial(text) {
    const m = text.match(/\bfiller\s*(?:metal)?\s*(?:designation|classification)?\s*[:.]?\s*([A-Z][A-Z0-9./\- ]{2,30})/i)
        || text.match(/\bmateriale\s*(?:d['’]\s*)?apporto\s*[:.]?\s*([A-Z0-9][A-Z0-9./\- ]{2,30})/i);
    if (!m) return null;
    return m[1].trim().replace(/\s{2,}/g, ' ');
}

/**
 * Data associata a un'etichetta specifica (es. "Record issued", "Expiry date"),
 * scansionando solo una finestra di testo subito dopo l'etichetta — evita di
 * assumere arbitrariamente l'ultima data del documento come scadenza (WPQR spesso
 * senza expiry — vedi nota DEPUTYTASK1 25/07/2026).
 */
function extractLabeledDate(text, labelRe) {
    const m = text.match(labelRe);
    if (!m) return null;
    const windowText = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
    const found = allDates(windowText);
    return found[0] || null;
}

function extractIssueDateLabeled(text) {
    return extractLabeledDate(text, /\b(?:record\s+issued|issued|data\s+di\s+emissione|emissione|approvazione|approval\s*date)\s*[:.]?\s*/i);
}

function extractExpiryDateLabeled(text) {
    return extractLabeledDate(text, /\b(?:expiry(?:\s*date)?|scadenza|valid\s*until|valido\s+fino\s+al)\s*[:.]?\s*/i);
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
        /(?:si\s+certifica\s+che|this\s+is\s+to\s+certify\s+that)\s*[:.\-]*\s*/i,
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
            // Rimuovi il punto di fine frase sull'ultimo cognome (es. "Rossi." → "Rossi"),
            // preservando le abbreviazioni brevi (es. "M." iniziale nome).
            const lastIdx = parts.length - 1;
            if (lastIdx >= 0 && parts[lastIdx].endsWith('.') && parts[lastIdx].length > 2) {
                parts[lastIdx] = parts[lastIdx].slice(0, -1);
            }
            const candidate = parts.join(' ');
            const allStop = parts.every((w) => NON_NAME_WORDS.has(w.toUpperCase().replace(/[.'']/g, '')));
            if (!allStop && parts.length >= 2) return candidate;
        }
    }

    // Fallback NDT/patentini: riga MAIUSCOLA 2–4 parole tra numero certificato e "Nato a"/"born in"
    // (es. TEC-Eurolab: "LUIGI LA FORGIA" senza etichetta Nome).
    const between = text.match(
        /(?:CERTIFICATO|CERTIFICATE)[^\n]{0,80}\n+([A-ZÀ-ÖØ-Þ][A-ZÀ-ÖØ-Þ' \-]{3,60})\n+(?:Nato\s+a|born\s+in)/i,
    );
    if (between) {
        const parts = between[1].trim().split(/\s+/).filter(Boolean);
        const allStop = parts.every((w) => NON_NAME_WORDS.has(w.toUpperCase().replace(/[.'\-]/g, '')));
        if (!allStop && parts.length >= 2 && parts.length <= 4) {
            return parts.join(' ');
        }
    }
    return null;
}

function extractIssuingBody(text) {
    const bodies = [
        'Bureau Veritas', 'DNV', 'Lloyd', 'RINA', 'TÜV', 'TUV', 'IMQ', 'IIS', 'CICPND', 'SGS',
        'TEC Eurolab', 'TEC-Eurolab', 'Sideius', 'BSI',
    ];
    const lower = text.toLowerCase();
    for (const b of bodies) {
        if (lower.includes(b.toLowerCase())) {
            // Normalizza varianti tipografiche verso l'etichetta canonica UI
            if (/^tec[- ]?eurolab$/i.test(b)) return 'TEC Eurolab';
            return b.replace('TUV', 'TÜV');
        }
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
    const positions = extractWeldingPositionsFromText(text);
    const { thickness_min, thickness_max } = extractThicknessRangeMm(text);
    const { diameter_min, diameter_max } = extractDiameterRangeMm(text);
    const issuedLabeled = extractIssueDateLabeled(text);
    const expiryLabeled = extractExpiryDateLabeled(text);
    return {
        wpqr_number: extractWpqrReference(text, fileName),
        reference_number: extractWpqrReference(text, fileName),
        qualification_level: extractQualificationLevel(text),
        welding_process: extractWeldingProcess(text),
        material_group: extractMaterialGroup(text),
        base_material_group: extractMaterialGroup(text),
        joint_type: extractJointType(text),
        thickness_tested: thickness,
        thickness_test_mm: thickness,
        thickness_min,
        thickness_max,
        diameter_min,
        diameter_max,
        welding_positions: positions.length ? positions : null,
        filler_material: extractFillerMaterial(text),
        welder_name: extractPersonName(text),
        // Data emissione: preferire etichetta esplicita ("Record issued"), altrimenti prima data trovata.
        approval_date: issuedLabeled || dates[0] || null,
        issue_date: issuedLabeled || dates[0] || null,
        // Scadenza: SOLO se etichettata esplicitamente — i WPQR spesso non hanno scadenza.
        expiry_date: expiryLabeled || null,
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
    const positions = extractWeldingPositionsFromText(text);
    return {
        welder_name: extractPersonName(text),
        certificate_number: extractCertificateNumber(text) || extractReferenceFromFileName(fileName),
        issuing_body: extractIssuingBody(text),
        welding_process: extractWeldingProcess(text),
        material_group: extractMaterialGroup(text),
        welding_positions: positions.length ? positions : null,
        thickness_min_mm: thickness,
        exam_date: dates[0] || null,
        expiry_date: dates.length > 1 ? dates[dates.length - 1] : (dates[0] || null),
    };
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {object}
 */
function extractQualifica14732Fields(text, fileName) {
    const dates = allDates(text);
    const positions = extractWeldingPositionsFromText(text);
    return {
        operator_name: extractPersonName(text),
        certificate_number: extractCertificateNumber(text) || extractReferenceFromFileName(fileName),
        issuing_body: extractIssuingBody(text),
        welding_process: extractWeldingProcess(text),
        welding_positions: positions.length ? positions : null,
        exam_date: dates[0] || null,
        expiry_date: dates.length > 1 ? dates[dates.length - 1] : (dates[0] || null),
    };
}

/**
 * Campi euristici per certificati NDT ISO 9712 (cert_ndt).
 * Complementa l'AI: metodo/livello/date spesso leggibili anche con OCR mediocre.
 */
function extractCertNdtFields(text, fileName) {
    const method = firstMatch(
        /\b(?:metodo|test\s*method)\s*[:.]?\s*(VT|MT|PT|UT|RT|ET|AE|TT|ST|LT)\b/i,
        text,
    ) || firstMatch(/\b(VT|MT|PT|UT|RT|ET)\b/, text);

    const level = firstMatch(/\b(?:livello|level)\s*[:.]?\s*([123]|I{1,3})\b/i, text);
    let certification_level = level;
    if (level && /^I+$/i.test(level)) {
        certification_level = String(level.length); // I→1, II→2, III→3
    }

    const issued = extractIssueDateLabeled(text)
        || extractLabeledDate(text, /\b(?:data\s+di\s+emissione|issued\s+on(?:\s+the)?)\s*[:.]?\s*/i);
    const expiry = extractExpiryDateLabeled(text)
        || extractLabeledDate(text, /\b(?:data\s+di\s+scadenza|expiration\s+date)\s*[:.]?\s*/i);
    const revalidation = extractLabeledDate(
        text,
        /\b(?:data\s+di\s+rinnovo|renewal\s+date|revalidat(?:ion|e)|rivalidazione)\s*[:.]?\s*/i,
    );

    // Settore: lettera Annex A solo se esplicita; altrimenti null (revisione umana)
    const sectorLetter = firstMatch(
        /\b(?:settore|sector)\s*[:.]?\s*([wptscram])\b/i,
        text,
    );

    return {
        operator_name: extractPersonName(text),
        certificate_number: extractCertificateNumber(text) || extractReferenceFromFileName(fileName),
        ndt_method: method ? String(method).toUpperCase() : null,
        certification_level: certification_level || null,
        ndt_sector: sectorLetter ? String(sectorLetter).toLowerCase() : null,
        issuing_body: extractIssuingBody(text),
        exam_date: issued,
        expiry_date: expiry,
        revalidation_date: revalidation,
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
    qualifica_14732: extractQualifica14732Fields,
    cert_ndt: extractCertNdtFields,
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
    extractQualifica14732Fields,
    extractCertNdtFields,
    extractWeldingProcess,
    extractMaterialGroup,
    extractWpqrReference,
    extractJointType,
    extractQualificationLevel,
    extractFillerMaterial,
    extractThicknessRangeMm,
    extractDiameterRangeMm,
    allDates,
};
