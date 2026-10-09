'use strict';

/**
 * ruleFieldExtractors.js — estrazione euristica campi da testo PDF (senza AI).
 * Complementare all'AI: fornisce fallback e cross-check.
 *
 * Precedenza regole/AI (documentIngestPipeline.pickMergedValue): se l'AI restituisce un valore vince
 * sempre; la regola entra solo se l'AI e' null e, per i campi "deboli" (processo, gruppo materiale,
 * numero certificato, date), le funzioni qui sotto restituiscono null invece di un'ipotesi a bassa
 * confidenza: una regola debole non deve mai riempire un campo che l'AI ha lasciato vuoto.
 */

const {
    inferWeldingProcessFromText,
    inferWeldingProcessExplicit,
    normalizeWeldingProcessCode,
} = require('../data/weldingProcesses4063');
const {
    extractWeldingPositionsFromText,
} = require('../data/weldingPositions6947');
const {
    parseWelderQualificationDesignation,
    designationFieldsToIngest,
} = require('./weldingDesignation');

const DATE_PATTERNS = [
    { re: /\b(\d{4})-(\d{2})-(\d{2})\b/g, fmt: (m) => `${m[1]}-${m[2]}-${m[3]}` },
    { re: /\b(\d{1,2})[./](\d{1,2})[./](\d{4})\b/g, fmt: (m) => {
        const d = m[1].padStart(2, '0');
        const mo = m[2].padStart(2, '0');
        return `${m[3]}-${mo}-${d}`;
    }},
    { twoDigitYear: true, re: /(?<![\d./])(\d{1,2})[./](\d{1,2})[./](\d{2})(?![\d/]|\.\d)/g, fmt: (m) => {
        const day = Number(m[1]);
        const month = Number(m[2]);
        if (day < 1 || day > 31 || month < 1 || month > 12) return null;
        const yy = Number(m[3]);
        const year = yy <= 69 ? 2000 + yy : 1900 + yy;
        return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }},
];

function firstMatch(re, text) {
    const m = re.exec(text);
    re.lastIndex = 0;
    return m ? m[1] || m[0] : null;
}

/**
 * Tutte le date del testo. L'anno a 2 cifre e' escluso di default: nelle tabelle conferme e nei testi
 * liberi renderebbe "ultima data = scadenza" ambiguo; si abilita solo dove c'e' un'etichetta
 * (`extractLabeledDate`).
 */
function allDates(text, { includeTwoDigitYear = false } = {}) {
    const found = [];
    for (const { re, fmt, twoDigitYear } of DATE_PATTERNS) {
        if (twoDigitYear && !includeTwoDigitYear) continue;
        let m;
        const local = new RegExp(re.source, re.flags);
        while ((m = local.exec(text)) !== null) {
            const iso = fmt(m);
            if (iso) found.push(iso);
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
    // STUD-2: stud/prigioniero prima di BW/FW — non collassare in fillet.
    const hasSW = /\bSW\b/.test(text)
        || /\bstud\s*weld/i.test(text)
        || /\barc\s*stud/i.test(text)
        || /ISO\s*14555/i.test(text)
        || /prigionier/i.test(text);
    if (hasSW) return 'SW';
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
    const found = allDates(windowText, { includeTwoDigitYear: true });
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
    'PHOTOGRAPH', 'PHOTO', 'FOTOGRAFIA', 'FOTO', 'NAME', 'SURNAME', 'FIRSTNAME', 'LASTNAME',
    'FIRST', 'LAST', 'GIVEN', 'FAMILY', 'FULL', 'BIRTH', 'BORN', 'NATO', 'NATA', 'SIGNATURE', 'FIRMA',
    'DATE', 'HOLDER', 'OPERATOR', 'OPERATORE', 'PLACE', 'LUOGO', 'NATIONALITY', 'NAZIONALITA',
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
        /\b(?:nome\s+e\s+cognome|cognome\s+e\s+nome|nominativo|nome|cognome|titolare|name)\s*[:.\-]*\s*/i,
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
            // Rimuovi parole-etichetta in testa (es. "Photograph ROSSI MARIO", "Surname Name ROSSI MARIO")
            while (parts.length && NON_NAME_WORDS.has(parts[0].toUpperCase().replace(/[.'']/g, ''))) {
                parts.shift();
            }
            if (parts.length < 2) continue;
            // Rimuovi parole-etichetta in coda (es. "MARIO ROSSI Numero")
            while (parts.length > 1 && NON_NAME_WORDS.has(parts[parts.length - 1].toUpperCase().replace(/[.'']/g, ''))) {
                parts.pop();
            }
            // Rimuovi il punto di fine frase sull'ultimo cognome (es. "Rossi." → "Rossi"),
            // preservando le abbreviazioni brevi (es. "M." iniziale nome).
            const lastIdx = parts.length - 1;
            if (lastIdx >= 0 && parts[lastIdx].endsWith('.') && parts[lastIdx].length > 2) {
                parts[lastIdx] = parts[lastIdx].slice(0, -1);
            }
            if (parts.length < 2) continue;
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

/**
 * Processo ISO 4063 (campo legacy `welding_process`) per patentini/14732, solo ad alta confidenza:
 * 1) codice con etichetta esplicita ("Welding process 138"), che nei patentini indica il processo di validita';
 * 2) altrimenti il processo della designazione di prova (token strutturato, es. "141 P BW ...").
 * I codici "nudi" sparsi nel testo e gli alias non sono usati: con piu codici vinceva il piu alto (145 su 141).
 */
function extractWeldingProcessConfident(text, designationFields = {}) {
    const explicit = inferWeldingProcessExplicit(text);
    if (explicit) return explicit;
    return designationFields.welding_process_test
        ? normalizeWeldingProcessCode(designationFields.welding_process_test)
        : null;
}

const EXAM_DATE_LABEL_RE = /\b(?:date\s+of\s+(?:the\s+)?(?:test|examination|welding)|(?:test|examination)\s+date|data\s+(?:di\s+|della\s+|dell['’]\s*)?(?:prova|esame|test|saldatura))\s*[:.]?\s*/i;
const QUALIFICATION_EXPIRY_STRONG_LABEL_RE = /\b(?:expiry(?:\s*date)?|data\s+di\s+scadenza|scadenza|valid\s*(?:until|to)|valido\s+fino\s+al)\s*[:.]?\s*/i;
const QUALIFICATION_EXPIRY_WEAK_LABEL_RE = /\bvalidity\s*[:.]?\s*/i;
const BIRTH_LABEL_RE = /(?:nat[oa]\s+a\s+[^\n\d]{1,40}?\s+il|born\s+in\s+[^\n\d]{1,40}?\s+on|date\s+of\s+birth|birth\s*date|data\s+di\s+nascita|nat[oa]\s+il|born(?:\s+on)?)\b/gi;
const DATE_AT_START_RE = /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}[./]\d{1,2}[./]\d{2,4})/;
const MIN_PLAUSIBLE_QUALIFICATION_YEAR = 1990;

/** Date di nascita: solo la data scritta subito dopo un'etichetta di nascita (mai quella di una riga successiva). */
function extractBirthDates(text) {
    const birth = new Set();
    const re = new RegExp(BIRTH_LABEL_RE.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 20).replace(/^[\s:.\-]+/, '');
        const dateText = after.match(DATE_AT_START_RE);
        const first = dateText ? allDates(dateText[0], { includeTwoDigitYear: true })[0] : null;
        if (first) birth.add(first);
    }
    return birth;
}

/** Prima data utile dopo QUALUNQUE occorrenza dell'etichetta (titoli di sezione senza data non la oscurano). */
function extractLabeledDateAny(text, labelRe, exclude = new Set()) {
    const re = new RegExp(labelRe.source, 'gi');
    let m;
    while ((m = re.exec(text)) !== null) {
        const windowText = text.slice(m.index + m[0].length, m.index + m[0].length + 30);
        const found = allDates(windowText, { includeTwoDigitYear: true }).find((d) => !exclude.has(d));
        if (found) return found;
    }
    return null;
}

/**
 * Data esame e scadenza per qualifiche persona (patentini, 14732): esclude le date di nascita, preferisce le
 * etichette esplicite, scarta anni implausibili se esistono alternative; la scadenza non puo' coincidere con
 * (ne' precedere) la data esame. La scadenza etichettata vince sulla posizione: non diventa exam_date solo
 * perche' e' la prima data del testo o perche' allDates raccoglie prima il formato ISO.
 */
function extractQualificationDates(text) {
    const birth = extractBirthDates(text);
    const all = allDates(text).filter((d) => !birth.has(d));
    const plausible = all.filter((d) => Number(d.slice(0, 4)) >= MIN_PLAUSIBLE_QUALIFICATION_YEAR);
    const candidates = plausible.length ? plausible : all;

    const labeledExam = extractLabeledDateAny(text, EXAM_DATE_LABEL_RE, birth);
    const labeledExpiry = extractLabeledDateAny(text, QUALIFICATION_EXPIRY_STRONG_LABEL_RE, birth)
        || extractLabeledDateAny(text, QUALIFICATION_EXPIRY_WEAK_LABEL_RE, birth);

    const exam = labeledExam
        || candidates.find((d) => d !== labeledExpiry)
        || null;
    let expiry = labeledExpiry
        || (candidates.length > 1 ? candidates[candidates.length - 1] : null);
    if (expiry && exam && expiry <= exam) expiry = null;
    return { exam_date: exam, expiry_date: expiry };
}

function extractCertificateNumberFromFileName(fileName) {
    const base = String(fileName || '').replace(/\.[^/.]+$/, '').trim();
    const m = base.match(/^(\d{2}-\d{4,5}(?:-\d{2}(?:-\d{3})?)?)(?!\d)/);
    return m ? m[1] : null;
}

const CERTIFICATE_NUMBER_LABEL_RE = /(?:(?:qualification\s+)?certificate\s*(?:no|n[°º]|nr|number)\b\.?|n[°º]\s*(?:del\s+)?certificat[oi]|numero\s+(?:del\s+)?certificato|certificato\s+n[°º.])\s*[:.\-]?\s*([A-Z0-9][A-Z0-9/.\-]{3,}(?:\s?[A-Z0-9][A-Z0-9/.\-]*)?)/i;

/**
 * Numero certificato per patentini/14732: etichetta esplicita nel testo, poi legacy purche' contenga cifre,
 * infine il solo prefisso numerico del nome file (mai il nome file intero, che puo' contenere il titolare).
 */
function extractQualificationCertificateNumber(text, fileName) {
    const hasDigit = (v) => (v && /\d/.test(v) ? v : null);
    const labeled = String(text || '').match(CERTIFICATE_NUMBER_LABEL_RE);
    const fromLabel = labeled ? hasDigit(labeled[1].trim().split(/\s+/)[0]) : null;
    return fromLabel
        || hasDigit(extractCertificateNumber(text))
        || extractCertificateNumberFromFileName(fileName);
}

const MATERIAL_GROUP_LABEL_RE = /\b(?:material\s+group|gruppo\s+(?:del\s+)?materiale|parent\s+material(?:\s+group)?|base\s+material(?:\s+group)?|materiale\s+base)\s*(?:\(s\))?\s*(?:ISO\/TR\s*15608(?:\s*[:\-]\s*(?:19|20)\d{2})?\s*)?[:.\-]?\s*(\d{1,2}(?:\.\d{1,2})?)(?![.\d])(?![\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const ISO_TR_15608_GROUP_RE = /\bISO\/TR\s*15608(?:\s*[:\-]\s*(?:19|20)\d{2})?\s*[:.]?\s*(\d{1,2}(?:\.\d{1,2})?)(?![.\d])(?![\/\-]\d{1,2}[\/\-]\d{2,4})/i;

/** Gruppo materiale (ISO/TR 15608) solo con etichetta esplicita, norma citata o designazione acciaio: mai da indirizzi/CAP/civici. */
function extractMaterialGroupLabeled(text) {
    const body = String(text || '');
    const m = body.match(MATERIAL_GROUP_LABEL_RE);
    if (m) {
        const normalized = normalizeMaterialGroupCode(m[1]);
        if (normalized && normalized !== 'altro') return normalized;
    }
    const iso = body.match(ISO_TR_15608_GROUP_RE);
    if (iso) {
        const normalized = normalizeMaterialGroupCode(iso[1]);
        if (normalized && normalized !== 'altro') return normalized;
    }
    return inferMaterialGroupFromText(body);
}

const LETTER_BEFORE = '(?<![A-Za-z\\u00C0-\\u00FF])';
const LETTER_AFTER = '(?![A-Za-z\\u00C0-\\u00FF])';
const acronym = (word) => new RegExp(`${LETTER_BEFORE}${word}${LETTER_AFTER}`, 'i');

/**
 * Enti riconosciuti dal fallback, nell'ordine storico. Le sigle brevi richiedono confini di parola
 * (RINA non deve scattare su "Katerina"); TEC Eurolab tollera maiuscole, punti, trattini, spazi multipli,
 * ritorni a capo e la forma attaccata ("TECEUROLAB", "T.E.C. Eurolab", "TEC Eurolab S.r.l.").
 */
const ISSUING_BODY_MATCHERS = [
    { label: 'Bureau Veritas', re: /Bureau\s+Veritas/i },
    { label: 'DNV', re: acronym('DNV') },
    { label: 'Lloyd', re: new RegExp(`${LETTER_BEFORE}Lloyd`, 'i') },
    { label: 'RINA', re: acronym('RINA') },
    { label: 'TÜV', re: new RegExp(`${LETTER_BEFORE}T[ÜUü]V${LETTER_AFTER}`, 'i') },
    { label: 'IMQ', re: acronym('IMQ') },
    { label: 'IIS', re: acronym('IIS') },
    { label: 'CICPND', re: acronym('CICPND') },
    { label: 'SGS', re: acronym('SGS') },
    {
        label: 'TEC Eurolab',
        re: new RegExp(
            `${LETTER_BEFORE}T\\.?\\s*E\\.?\\s*C\\.?[\\s_:-]*Euro[\\s_.-]*lab${LETTER_AFTER}|tec[\\s_.-]?eurolab\\.(?:com|it)`,
            'i'
        ),
    },
    { label: 'Sideius', re: /Sideius/i },
    { label: 'BSI', re: acronym('BSI') },
];

function extractIssuingBody(text) {
    const body = String(text || '');
    for (const { label, re } of ISSUING_BODY_MATCHERS) {
        if (re.test(body)) return label;
    }
    return null;
}

/**
 * Tutti gli enti riconosciuti nel testo (stessi matcher ancorati di `extractIssuingBody`, che invece
 * restituisce solo il primo in ordine di lista): serve a verificare se un ente dato dall'AI ha riscontro nel testo.
 * @param {string} text
 * @returns {string[]} etichette (es. 'TEC Eurolab', 'TÜV')
 */
function extractAllIssuingBodies(text) {
    const body = String(text || '');
    return ISSUING_BODY_MATCHERS.filter(({ re }) => re.test(body)).map(({ label }) => label);
}

const EXAMINER_LABEL_RE = /(?:examiner\s+or\s+examining\s+body|examining\s+body|name\s+of\s+(?:the\s+)?examiner|esaminatore\s+o\s+ente\s+d['’]\s*esame|nome\s+dell['’]\s*esaminatore|ente\s+d['’]\s*esame|witnessed\s+by|testimoniato\s+da)(?:\s*[-\u2013\u2014]\s*reference\s*no\.?)?(?:\s*[-\u2013\u2014]\s*n\.?\s*rif(?:erimento)?\.?)?/gi;
const EXAMINER_NOT_A_VALUE_RE = /^(?:date|data|name|nome|signature|firma|reference|rif\b|place|location|luogo|position|title|photograph|photo|foto|valid(?:ity|it\u00E0|[oae])?|employer|code|identification|role|welding|test|variables|requalification|revalidation|confirmation|manufacturer|the qualification|results)(?![A-Za-z\u00C0-\u00FF])/i;

function cleanExaminerCandidate(raw) {
    let v = String(raw || '').replace(/^[\s:.\-\u2013\u2014|]+/, '').split(/\t| {3,}/)[0];
    v = v.replace(/^reference\s*no\.?\s*[:.\-\u2013\u2014]*\s*/i, '');
    v = v.replace(/\s+[-\u2013\u2014,]?\s*(?:ref(?:erence)?\.?\s*(?:no\.?)?|n\u00B0|rif\.?)\s*[:.]?\s*[A-Z0-9][A-Z0-9/.\-]*\s*$/i, '');
    v = v.replace(/\s+[-\u2013\u2014]\s*\d{2}-\d{4,6}(?:-\d{2}(?:-\d{3})?)?\s*$/, '');
    const endsWithAbbreviation = /(?:^|[\s.])[A-Za-z]\.[A-Za-z]\.$/.test(v.trim());
    v = v.replace(/[\s:;,.\-\u2013\u2014|]+$/, '').replace(/\s{2,}/g, ' ').trim();
    if (endsWithAbbreviation) v += '.';
    if (v.length < 3 || v.length > 80 || v.split(/\s+/).length > 7 || !/[A-Za-z\u00C0-\u00FF]{2}/.test(v)) return null;
    if (EXAMINER_NOT_A_VALUE_RE.test(v)) return null;
    if (/^\d{2}-\d{4,6}/.test(v) || /^\d{1,2}[./]\d{1,2}[./]\d{2,4}/.test(v)) return null;
    return v;
}

/**
 * Esaminatore / ente d'esame ("Examiner or examining body", "Name of the examiner", "Esaminatore o ente d'esame"):
 * valore sulla stessa riga dell'etichetta oppure sulle due righe successive. Persona (es. "I.W.I. ..."), titolo o ente.
 * Serve come rule-fill quando l'AI lascia il campo vuoto: non sovrascrive mai un valore AI (vedi pickMergedValue).
 */
const SIGNATURE_BLOCK_LABEL_RE = /Name\s+(?:and|&|e)\s+signature\s+(?:of\s+(?:the\s+)?)?(?:Examining\s+Body|examiner)|Nome\s+e\s+firma\s+(?:dell['\u2019]\s*)?(?:Organismo\s+di\s+Esame|esaminatore)/gi;
const IWI_LINE_RE = /^\s*(I\.?\s?W\.?\s?I\.?)(?![A-Za-z])\s*([-\u2013\u2014:])?\s*(.*)$/i;
const NAME_TOKEN_RE = /^[A-Za-z\u00C0-\u00FF][A-Za-z\u00C0-\u00FF'\u2019`-]*\.?$/;
const NAME_PARTICLES = new Set(['de', 'di', 'da', 'del', 'della', 'dei', 'degli', 'van', 'von', 'dos', 'la', 'lo']);

/** Nome dopo "I.W.I.": parole alfabetiche con iniziale maiuscola (o particelle); si ferma alla prima spazzatura OCR. */
function cleanIwiName(rest) {
    const out = [];
    for (const raw of String(rest || '').split(/\s+/)) {
        const tok = raw.replace(/^[(\[]+|[)\],;:]+$/g, '');
        if (!tok || out.length >= 5 || !NAME_TOKEN_RE.test(tok)) break;
        const isParticle = NAME_PARTICLES.has(tok.toLowerCase());
        if (!isParticle && !/^[A-Z\u00C0-\u00DE]/.test(tok)) break;
        if (!isParticle && tok.replace(/\./g, '').length < 2) break;
        out.push(tok.replace(/[.,;:-]+$/, ''));
    }
    while (out.length && NAME_PARTICLES.has(out[out.length - 1].toLowerCase())) out.pop();
    return out.length ? out.join(' ') : null;
}

/**
 * Blocco firma ("Name and signature Examining Body" / "Nome e firma Organismo di Esame"): il nome compare come
 * "I.W.I. <nome>" o "IWI - <nome>" nelle righe seguenti (anche ~12 righe dopo, es. dopo luogo, data, costruttore).
 * Non si prende mai la riga successiva a prescindere: nell'OCR e' la firma a mano letta come parole sconnesse.
 */
function extractExaminerFromSignatureBlock(body) {
    const re = new RegExp(SIGNATURE_BLOCK_LABEL_RE.source, 'gi');
    let m;
    while ((m = re.exec(body)) !== null) {
        const lines = body.slice(m.index + m[0].length).split('\n').slice(0, 14);
        for (const line of lines) {
            const iwi = IWI_LINE_RE.exec(line);
            if (!iwi) continue;
            const name = cleanIwiName(iwi[3]);
            if (!name) continue;
            const prefix = iwi[1].replace(/\s+/g, '');
            return iwi[2] && iwi[2] !== ':' ? `${prefix} ${iwi[2]} ${name}` : `${prefix} ${name}`;
        }
    }
    return null;
}

function extractExaminerBody(text) {
    const body = String(text || '');
    const fromSignatureBlock = extractExaminerFromSignatureBlock(body);
    if (fromSignatureBlock) return fromSignatureBlock;
    const re = new RegExp(EXAMINER_LABEL_RE.source, 'gi');
    let m;
    while ((m = re.exec(body)) !== null) {
        const lineStart = body.lastIndexOf('\n', m.index) + 1;
        if (/signature|firma/i.test(body.slice(lineStart, m.index))) continue;
        const lineEnd = body.indexOf('\n', m.index + m[0].length);
        const sameLine = body.slice(m.index + m[0].length, lineEnd === -1 ? undefined : lineEnd);
        const candidates = [sameLine];
        if (lineEnd !== -1) {
            const nextLines = body.slice(lineEnd + 1).split('\n').filter((l) => l.trim()).slice(0, 2);
            candidates.push(...nextLines);
        }
        for (const c of candidates) {
            const v = cleanExaminerCandidate(c);
            if (v) return v;
            if (c.trim() && c !== sameLine) break;
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

const QUALIFICATION_METHODS_4_1 = ['iso_15614', 'iso_15613', 'iso_9606', 'production_test'];
const METHOD_ENTRY_RE = /\b4\.1\s*([a-d])\s*[)\]]/i;
const MARK_GLYPHS = '\\[\\s*[xX]\\s*\\]|[\\u2612\\u2611\\u2713\\u2714]';
const INLINE_MARK_RE = new RegExp(`(?:${MARK_GLYPHS})|(?:^|\\s)[xX]\\s*$`);
const STANDALONE_MARK_RE = new RegExp(`^\\s*(?:${MARK_GLYPHS}|[xX])\\s*$`);
const DASH_ONLY_RE = /^\s*[-\u2013\u2014]{1,3}\s*$/;
const INLINE_DASH_RE = /(?:^|\s)[-\u2013\u2014]{1,3}\s*$/;

/**
 * Metodo di qualifica ISO 14732:2013 §4.1 a/b/c/d -> iso_15614 / iso_15613 / iso_9606 / production_test.
 * Il marcatore puo' stare sulla riga della voce ("[x]", "x", "check"), su righe a se' tra le voci o dopo la voce d)
 * (colonna "-- -- X --" nel testo; "x" isolata nell'OCR tesseract.js, che stacca il marcatore dalla riga c).
 * Una "x" isolata dopo l'elenco vale per l'UNICA voce senza marcatore ne' trattino; con piu' candidati
 * o piu' marcatori restituisce null (ambiguo).
 * Se il testo e' ambiguo e c'e' il layout OCR (righe con bounding box), il marcatore isolato viene assegnato
 * alla voce a)..d) per posizione verticale (vedi extractQualificationMethod14732FromLayout).
 * @param {string} text
 * @param {Array} [ocrLayout] - `[{ page, lines|words: [{ text, bbox:{x0,y0,x1,y1} }] }]` da ocrExtractor
 */
function extractQualificationMethod14732(text, ocrLayout = null) {
    const fromText = extractQualificationMethod14732FromText(text);
    if (fromText != null || !ocrLayout) return fromText;
    return extractQualificationMethod14732FromLayout(ocrLayout);
}

function extractQualificationMethod14732FromText(text) {
    const lines = String(text || '').split('\n');
    const entryIdx = [];
    let last = -1;
    for (const letter of ['a', 'b', 'c', 'd']) {
        let found = -1;
        for (let i = last + 1; i < lines.length; i += 1) {
            const m = METHOD_ENTRY_RE.exec(lines[i]);
            if (m && m[1].toLowerCase() === letter) { found = i; break; }
        }
        if (found === -1) return null;
        entryIdx.push(found);
        last = found;
    }

    const state = entryIdx.map((idx) => {
        const rest = lines[idx].slice(lines[idx].search(METHOD_ENTRY_RE)).replace(METHOD_ENTRY_RE, '');
        return { marked: INLINE_MARK_RE.test(rest), dashed: INLINE_DASH_RE.test(rest) };
    });

    const standaloneTokens = (from, to) => lines.slice(from, to)
        .filter((l) => STANDALONE_MARK_RE.test(l) || DASH_ONLY_RE.test(l))
        .map((l) => (STANDALONE_MARK_RE.test(l) ? 'mark' : 'dash'));

    for (let i = 0; i < 3; i += 1) {
        const tokens = standaloneTokens(entryIdx[i] + 1, entryIdx[i + 1]);
        if (tokens.length === 1) {
            if (tokens[0] === 'mark') state[i].marked = true;
            else state[i].dashed = true;
        }
    }

    const tail = [];
    let seenText = 0;
    for (const l of lines.slice(entryIdx[3] + 1)) {
        if (!l.trim()) continue;
        if (STANDALONE_MARK_RE.test(l)) tail.push('mark');
        else if (DASH_ONLY_RE.test(l)) tail.push('dash');
        else if (tail.length) break;
        else if ((seenText += 1) > 3) break;
    }

    const marked = state.map((e, i) => (e.marked ? i : -1)).filter((i) => i >= 0);
    const tailMarks = tail.filter((t) => t === 'mark').length;

    if (tail.length === 4 && marked.length === 0) {
        return tailMarks === 1 ? QUALIFICATION_METHODS_4_1[tail.indexOf('mark')] : null;
    }
    if (tailMarks === 1 && tail.length === 1) {
        if (marked.length) return null;
        const unmarked = state.map((e, i) => (e.dashed ? -1 : i)).filter((i) => i >= 0);
        return unmarked.length === 1 ? QUALIFICATION_METHODS_4_1[unmarked[0]] : null;
    }
    if (tailMarks === 0 && marked.length === 1) return QUALIFICATION_METHODS_4_1[marked[0]];
    return null;
}

const LAYOUT_ROW_MIN_OVERLAP = 0.6;
const LAYOUT_NEAR_BEFORE_ROWS = 2;
const LAYOUT_NEAR_AFTER_ROWS = 4;

function _validBbox(b) {
    return b && [b.x0, b.y0, b.x1, b.y1].every(Number.isFinite) && b.y1 > b.y0;
}

function _verticalOverlap(a, b) {
    return Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
}

/**
 * Righe visive di una pagina del layout OCR: usa `lines` se presenti, altrimenti raggruppa le `words`
 * che si sovrappongono verticalmente (almeno il 50% della piu' bassa).
 * @returns {Array<{ text: string, bbox: object }>} ordinate dall'alto in basso
 */
function _layoutRows(page) {
    const clean = (arr) => (Array.isArray(arr) ? arr : [])
        .filter((e) => e && _validBbox(e.bbox) && String(e.text || '').trim())
        .map((e) => ({ text: String(e.text).trim(), bbox: { ...e.bbox } }));
    const byY = (a, b) => (a.bbox.y0 + a.bbox.y1) - (b.bbox.y0 + b.bbox.y1) || a.bbox.x0 - b.bbox.x0;
    const lines = clean(page && page.lines);
    if (lines.length) return lines.sort(byY);

    const rows = [];
    for (const w of clean(page && page.words).sort(byY)) {
        const row = rows.find((r) => _verticalOverlap(r.bbox, w.bbox)
            >= 0.5 * Math.min(r.bbox.y1 - r.bbox.y0, w.bbox.y1 - w.bbox.y0));
        if (!row) {
            rows.push({ words: [w], bbox: { ...w.bbox } });
        } else {
            row.words.push(w);
            row.bbox = {
                x0: Math.min(row.bbox.x0, w.bbox.x0),
                y0: Math.min(row.bbox.y0, w.bbox.y0),
                x1: Math.max(row.bbox.x1, w.bbox.x1),
                y1: Math.max(row.bbox.y1, w.bbox.y1),
            };
        }
    }
    return rows
        .map((r) => ({ text: r.words.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((w) => w.text).join(' '), bbox: r.bbox }))
        .sort(byY);
}

/**
 * Metodo di qualifica 14732 §4.1 dal layout OCR (posizione), per il caso in cui tesseract.js stacca la "x"
 * dalla riga c) e la mette su riga propria dopo la d): il marcatore isolato appartiene alla voce a..d il cui
 * intervallo verticale lo contiene (sovrapposizione >= 60% dell'altezza del marcatore).
 * Restituisce null se: voci a..d non trovate nella stessa pagina; marcatori totali (in riga + isolati vicini
 * al blocco) diversi da uno; marcatore fuori da ogni riga o a cavallo di due righe; voce designata con trattino.
 * @param {Array} layout - `[{ page, lines|words }]`
 * @returns {string|null}
 */
function extractQualificationMethod14732FromLayout(layout) {
    if (!Array.isArray(layout)) return null;
    for (const page of layout) {
        const rows = _layoutRows(page);
        const entryIdx = [];
        let last = -1;
        for (const letter of ['a', 'b', 'c', 'd']) {
            const found = rows.findIndex((r, i) => {
                if (i <= last) return false;
                const m = METHOD_ENTRY_RE.exec(r.text);
                return !!m && m[1].toLowerCase() === letter;
            });
            if (found === -1) break;
            entryIdx.push(found);
            last = found;
        }
        if (entryIdx.length !== 4) continue;

        const entries = entryIdx.map((i) => {
            const row = rows[i];
            const rest = row.text.slice(row.text.search(METHOD_ENTRY_RE)).replace(METHOD_ENTRY_RE, '');
            return { bbox: row.bbox, marked: INLINE_MARK_RE.test(rest), dashed: INLINE_DASH_RE.test(rest) };
        });
        const heights = entries.map((e) => e.bbox.y1 - e.bbox.y0).sort((x, y) => x - y);
        const rowH = heights[Math.floor(heights.length / 2)];
        const top = entries[0].bbox.y0 - LAYOUT_NEAR_BEFORE_ROWS * rowH;
        const bottom = entries[3].bbox.y1 + LAYOUT_NEAR_AFTER_ROWS * rowH;

        const marks = entries.map((e, i) => (e.marked ? i : -1)).filter((i) => i >= 0);
        const entrySet = new Set(entryIdx);
        for (let i = 0; i < rows.length; i += 1) {
            if (entrySet.has(i) || !STANDALONE_MARK_RE.test(rows[i].text)) continue;
            const mb = rows[i].bbox;
            const centre = (mb.y0 + mb.y1) / 2;
            if (centre < top || centre > bottom) continue;
            const overlaps = entries.map((e, k) => ({ k, ratio: _verticalOverlap(mb, e.bbox) / (mb.y1 - mb.y0) }))
                .filter((o) => o.ratio >= LAYOUT_ROW_MIN_OVERLAP);
            if (overlaps.length !== 1) return null;
            marks.push(overlaps[0].k);
        }

        if (marks.length !== 1 || entries[marks[0]].dashed) return null;
        return QUALIFICATION_METHODS_4_1[marks[0]];
    }
    return null;
}

/**
 * Dettagli di saldatura ISO 9606-1 (Tab. 11/12, §5.9): backing (ss, bs, ci, fb, mb, nb, gb)
 * e numero di passate/lato (sl, ml, lw, rw). Tutto il resto (tubo/piastra, derivazione,
 * testo libero) non e' un dettaglio di saldatura.
 */
const KNOWN_WELD_DETAILS = new Set(['sl', 'ml', 'ss', 'bs', 'nb', 'mb', 'gb', 'fb', 'ci', 'lw', 'rw']);

/**
 * Tiene solo le voci note (maiuscole/minuscole come stampate), separate da ", " e senza doppioni.
 * @param {any} raw
 * @returns {string|null} null se non resta nessuna voce nota
 */
function sanitizeWeldDetails(raw) {
    if (raw == null) return null;
    const kept = [];
    for (const tok of String(raw).split(/[\s,;/+]+/)) {
        const t = tok.trim();
        if (!t || !KNOWN_WELD_DETAILS.has(t.toLowerCase())) continue;
        if (!kept.some((k) => k.toLowerCase() === t.toLowerCase())) kept.push(t);
    }
    return kept.length ? kept.join(', ') : null;
}

/**
 * Riga ISO 9606-1 a tre colonne (Variabili / PROVA / VALIDITA'): il testo estratto riporta PROVA e
 * VALIDITA' sulla stessa riga, con il prefisso ripetuto ("a) 3 a) >=3"). Il secondo valore e' la validita'.
 */
const VALIDITY_PAIR_RE = /^\s*([a-dD]\d?)\)\s+(\S.*?)\s+\1\)\s*(.*?)\s*$/;
const WELD_DETAILS_ROW_RE = /(?:Particolari|Dettagli)\s+(?:di\s+)?saldatura(?:\s*\/\s*Weld(?:ing)?\s+details?)?|Weld(?:ing)?\s+details?/i;
const THICKNESS_ROW_RE = /(?:Spessore|(?:Material\s+|Deposited\s+)?Thickness)(?:\s*\/\s*(?:Spessore|(?:Material\s+|Deposited\s+)?Thickness))?(?:\s*\(\s*mm\s*\))?/i;
const OTHER_ROW_LABEL_RE = /(?:Plate\s+or\s+pipe|Welding\s+position|Posizione|Diam|\u00D8|Outside|Process|Processo|Spessore|Thickness|Particolari|Dettagli|Weld(?:ing)?\s+details?|Filler|Materiale)/i;
const VALIDITY_ROW_MAX_PAIRS = 4;
const VARIANT_PREFIX_RE = /^[a-d]$/;

/**
 * Coppie PROVA/VALIDITA' sotto l'etichetta di riga (sulla stessa riga o nelle successive, al piu' una
 * riga intermedia); `prefixRe` limita i prefissi accettati (a)/b) per spessore e dettagli, D1) per il
 * diametro). Layout non riconosciuto -> array vuoto: il chiamante non deve indovinare.
 * @returns {Array<{ prefix: string, test: string, validity: string }>}
 */
function extractValidityColumnPairs(text, labelRe, prefixRe = null) {
    const lines = String(text || '').split(/\r?\n/);
    const label = new RegExp(labelRe.source, 'i');
    const pairs = [];
    for (let i = 0; i < lines.length; i += 1) {
        const m = label.exec(lines[i]);
        if (!m) continue;
        let candidate = lines[i].slice(m.index + m[0].length);
        let skipped = 0;
        let found = 0;
        for (let j = i; j < lines.length && found < VALIDITY_ROW_MAX_PAIRS; j += 1) {
            if (j > i) candidate = lines[j];
            const pm = VALIDITY_PAIR_RE.exec(candidate);
            if (pm && (!prefixRe || prefixRe.test(pm[1]))) {
                pairs.push({ prefix: pm[1], test: pm[2].trim(), validity: pm[3].trim() });
                found += 1;
                continue;
            }
            if (found > 0) break;
            if (j === i) continue;
            if (skipped >= 1 || OTHER_ROW_LABEL_RE.test(candidate)) break;
            skipped += 1;
        }
    }
    return pairs;
}

const THICKNESS_NUM = /(\d{1,3}(?:[.,]\d{1,2})?)/.source;
const THICKNESS_OPEN_WORDS = /(?:unlimited|illimitat[oa]|senza\s+limit[ei](?:\s+superiore)?|no\s+(?:upper\s+)?(?:limit|restriction))/.source;
const THICKNESS_RANGE_SEP = /(?:-|\.\.+|\u2026|\ba\b|to)/.source;
const THICKNESS_GE_RE = new RegExp(`^(?:>=|=>|\u2265|\u2A7E)\\s*${THICKNESS_NUM}$`);
const THICKNESS_OPEN_ONLY_RE = new RegExp(`^${THICKNESS_OPEN_WORDS}$`, 'i');
const THICKNESS_MIN_OPEN_RE = new RegExp(`^(?:da\\s+|from\\s+)?${THICKNESS_NUM}\\s*${THICKNESS_RANGE_SEP}\\s*${THICKNESS_OPEN_WORDS}$`, 'i');
const THICKNESS_MIN_MAX_RE = new RegExp(`^(?:da\\s+|from\\s+)?${THICKNESS_NUM}\\s*${THICKNESS_RANGE_SEP}\\s*${THICKNESS_NUM}$`, 'i');

function thicknessNum(s) {
    return parseFloat(String(s).replace(',', '.'));
}

/**
 * Colonna VALIDITA' della riga spessore -> { min, max, unlimited }. Formati: ">=3", "\u22653", "3-10",
 * "3 \u2013 10", "da 3 a 10", "3..10", "3 - unlimited", "unlimited" (solo apertura, min null).
 * Valore non riconosciuto (anche un numero singolo, ambiguo) -> null.
 * @param {string} raw
 * @returns {{ min: number|null, max: number|null, unlimited: boolean }|null}
 */
function parseThicknessValidity(raw) {
    const s = String(raw || '').replace(/\s*mm\b/i, '').replace(/[\u2013\u2014\u2212]/g, '-').trim();
    if (!s) return null;
    let m = THICKNESS_GE_RE.exec(s);
    if (m) return { min: thicknessNum(m[1]), max: null, unlimited: true };
    if (THICKNESS_OPEN_ONLY_RE.test(s)) return { min: null, max: null, unlimited: true };
    m = THICKNESS_MIN_OPEN_RE.exec(s);
    if (m) return { min: thicknessNum(m[1]), max: null, unlimited: true };
    m = THICKNESS_MIN_MAX_RE.exec(s);
    if (m) {
        const min = thicknessNum(m[1]);
        const max = thicknessNum(m[2]);
        if (max < min) return null;
        return { min, max, unlimited: false };
    }
    return null;
}

/**
 * Dettagli di saldatura nella colonna VALIDITA' (campo di validita', mai i dati di prova).
 * @returns {{ value: string|null }|null} null se la riga a tre colonne non e' riconosciuta
 *   (altro emittente/OCR): il chiamante lascia l'AI. `value` null = riga trovata ma validita' vuota/N.A.
 */
function extractWeldDetailsValidity(text) {
    const pairs = extractValidityColumnPairs(text, WELD_DETAILS_ROW_RE, VARIANT_PREFIX_RE);
    if (!pairs.length) return null;
    return { value: sanitizeWeldDetails(pairs.map((p) => p.validity).join(' ')) };
}

/**
 * Spessore di validita' dalla colonna VALIDITA' della riga spessore (a), b)).
 * Se le validita' riportate sono diverse tra loro o non leggibili non si sceglie: l'AI resta.
 * @returns {{ min: number|null, max: number|null, unlimited: boolean }|null}
 */
function extractThicknessValidity(text) {
    const pairs = extractValidityColumnPairs(text, THICKNESS_ROW_RE, VARIANT_PREFIX_RE);
    const validities = pairs.map((p) => p.validity).filter(Boolean);
    if (!validities.length) return null;
    const parsed = validities.map(parseThicknessValidity);
    if (parsed.some((p) => !p)) return null;
    const distinct = new Set(parsed.map((p) => `${p.min}|${p.max}|${p.unlimited}`));
    return distinct.size === 1 ? parsed[0] : null;
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {object}
 */
function extractPatentinoFields(text, fileName) {
    const { exam_date, expiry_date } = extractQualificationDates(text);
    const thickness = extractThicknessMm(text);
    const positions = extractWeldingPositionsFromText(text);
    const fromDesignation = designationFieldsToIngest(parseWelderQualificationDesignation(text));
    const processFromText = extractWeldingProcessConfident(text, fromDesignation);
    const processTest = fromDesignation.welding_process_test || null;
    return {
        welder_name: extractPersonName(text),
        certificate_number: extractQualificationCertificateNumber(text, fileName),
        issuing_body: extractIssuingBody(text),
        welding_process_test: processTest,
        welding_process: processFromText || null,
        welding_processes_validity: fromDesignation.welding_processes_validity || null,
        material_group: extractMaterialGroupLabeled(text),
        welding_positions: positions.length ? positions : null,
        welding_position_test: fromDesignation.welding_position_test || null,
        thickness_min_mm: thickness,
        thickness_s_test_mm: fromDesignation.thickness_s_test_mm ?? null,
        thickness_t_test_mm: fromDesignation.thickness_t_test_mm ?? null,
        pipe_diameter_test_mm: fromDesignation.pipe_diameter_test_mm ?? null,
        joint_type: fromDesignation.joint_type || extractJointType(text),
        product_type: fromDesignation.product_type || null,
        filler_material_group: fromDesignation.filler_material_group || null,
        qualification_designation: fromDesignation.qualification_designation || null,
        examiner_body: extractExaminerBody(text),
        exam_date,
        expiry_date,
    };
}

/**
 * @param {string} text
 * @param {string} fileName
 * @returns {object}
 */
function extractQualifica14732Fields(text, fileName, options = {}) {
    const { exam_date, expiry_date } = extractQualificationDates(text);
    const positions = extractWeldingPositionsFromText(text);
    return {
        operator_name: extractPersonName(text),
        certificate_number: extractQualificationCertificateNumber(text, fileName),
        issuing_body: extractIssuingBody(text),
        welding_process: extractWeldingProcessConfident(text),
        welding_positions: positions.length ? positions : null,
        qualification_method: extractQualificationMethod14732(text, options && options.ocrLayout),
        examiner_body: extractExaminerBody(text),
        exam_date,
        expiry_date,
    };
}

/**
 * Settore ISO 9712 Annex A da testo certificato.
 * Preferisce settore industriale (A.3) se presente insieme al prodotto (A.2),
 * come sui certificati TEC-Eurolab (plurisettoriale + pre-servizio/in servizio).
 * @param {string} text
 * @returns {string|null}
 */
function extractNdtSector(text) {
    const t = String(text || '');
    // Industriali A.3 — priorità alta
    if (/(?:pre[-\s]?servizio|pre[-\s]?and\s+in[-\s]?service|in\s+servizio|in[-\s]?service\s+testing)/i.test(t)) {
        return 's';
    }
    if (/\b(?:manutenzione\s+ferroviaria|railway\s+maintenance)\b/i.test(t)) return 'r';
    if (/\b(?:aerospaziale|aerospace)\b/i.test(t)) return 'a';
    // "fabbricazione metalli" / manufacturing senza pre-servizio → m
    if (/\b(?:fabbricazione(?:\s+metalli)?|manufacturing)\b/i.test(t)
        && !/(?:pre[-\s]?servizio|in\s+servizio|in[-\s]?service)/i.test(t)) {
        return 'm';
    }
    // Prodotto A.2 — solo se codice/etichetta espliciti (non "plurisettoriale")
    const explicit = firstMatch(
        /\b(?:settore|sector)\s*[:.]?\s*(wp|[cfwtprm]|s|a)\b/i,
        t,
    );
    if (explicit) {
        const code = String(explicit).toLowerCase();
        if (/^(c|f|w|t|wp|p|m|s|r|a)$/.test(code)) return code;
    }
    if (/\b(?:saldature|welded\s+products|\bwelds\b)\b/i.test(t) && /\b(?:settore|sector|prodotto)\b/i.test(t)) {
        return 'w';
    }
    if (/\b(?:getti|castings)\b/i.test(t)) return 'c';
    if (/\b(?:forgiati|forgings)\b/i.test(t) && !/\bfabbricazione\b/i.test(t)) return 'f';
    if (/\b(?:tubi|tubes?\s+and\s+pipes?)\b/i.test(t) && /\b(?:settore|sector|prodotto)\b/i.test(t)) {
        return 't';
    }
    if (/\b(?:compositi|composite\s+materials?)\b/i.test(t)) return 'p';
    if (/\b(?:wrought\s+products?|prodotti\s+laminati)\b/i.test(t)) return 'wp';
    // "plurisettoriale" da solo non è un codice Annex A
    return null;
}

/**
 * Campi euristici per certificati NDT ISO 9712 (cert_ndt).
 * Complementa l'AI: metodo/livello/date spesso leggibili anche con OCR mediocre.
 */
function extractCertNdtFields(text, fileName) {
    let method = firstMatch(
        /\b(?:metodo|test\s*method)\s*[:.]?\s*(VT|MT|PT|UT|RT|ET|AE|TT|ST|LT)\b/i,
        text,
    ) || firstMatch(/\b(VT|MT|PT|UT|RT|ET)\b/, text);
    if (!method) {
        if (/\bmagnetoscop/i.test(text) || /\bmagnetic\s+particle/i.test(text)) method = 'MT';
        else if (/\b(?:liquidi\s+penetranti|penetrant)/i.test(text)) method = 'PT';
        else if (/\b(?:radiografic|radiograph)/i.test(text)) method = 'RT';
        else if (/\b(?:ultrasuon|ultrasonic)/i.test(text)) method = 'UT';
        else if (/\b(?:esame\s+visivo|visual\s+test)/i.test(text)) method = 'VT';
    }

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

    return {
        operator_name: extractPersonName(text),
        certificate_number: extractCertificateNumber(text) || extractReferenceFromFileName(fileName),
        ndt_method: method ? String(method).toUpperCase() : null,
        certification_level: certification_level || null,
        ndt_sector: extractNdtSector(text),
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
 * @param {{ ocrLayout?: Array }} [options] - layout OCR opzionale (solo qualifica_14732 lo usa)
 * @returns {object}
 */
function extractFieldsByRules(text, docType, fileName = '', options = {}) {
    const fn = EXTRACTORS_BY_DOC_TYPE[docType];
    if (!fn) return {};
    const body = String(text || '');
    if (body.trim().length < 10) {
        const fromName = extractReferenceFromFileName(fileName);
        return fromName ? { reference_number: fromName, wpqr_number: fromName } : {};
    }
    return fn(body, fileName, options);
}

module.exports = {
    extractFieldsByRules,
    sanitizeWeldDetails,
    extractValidityColumnPairs,
    parseThicknessValidity,
    extractWeldDetailsValidity,
    extractThicknessValidity,
    extractWpqrFields,
    extractPatentinoFields,
    extractQualifica14732Fields,
    extractCertNdtFields,
    extractNdtSector,
    extractWeldingProcess,
    extractWeldingProcessConfident,
    extractIssuingBody,
    extractAllIssuingBodies,
    extractExaminerBody,
    extractQualificationMethod14732,
    extractQualificationMethod14732FromLayout,
    extractQualificationDates,
    extractQualificationCertificateNumber,
    extractMaterialGroupLabeled,
    extractMaterialGroup,
    extractWpqrReference,
    extractJointType,
    extractQualificationLevel,
    extractFillerMaterial,
    extractThicknessRangeMm,
    extractDiameterRangeMm,
    allDates,
};
