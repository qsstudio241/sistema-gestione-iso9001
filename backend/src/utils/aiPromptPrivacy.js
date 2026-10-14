'use strict';

/**
 * aiPromptPrivacy.js — redazione dei dati personali/aziendali nei prompt di CONTORNO verso l'AI
 * (retry JSON, few-shot per organizzazione, pattern di riferimento, nome file).
 *
 * Perimetro: SOLO il contorno del prompt. Il testo del documento (PDF/OCR) resta inviato all'AI
 * per l'estrazione dei campi: e' un residuo da trattare con DPA/regione dati (slice A3), non qui.
 * Nulla di quanto fa questo modulo tocca i dati salvati nel DB: la redazione avviene a runtime,
 * quindi vale anche per le correzioni storiche gia' presenti in `import_extraction_feedback`.
 */

const PLACEHOLDERS = Object.freeze({
    FILE: '[FILE]',
    NOME: '[NOME]',
    NUMERO_CERTIFICATO: '[NUMERO_CERTIFICATO]',
    DATORE: '[DATORE]',
    DATA_NASCITA: '[DATA_NASCITA]',
    LUOGO_NASCITA: '[LUOGO_NASCITA]',
    ID_PERSONALE: '[ID_PERSONALE]',
    CODICE_FISCALE: '[CODICE_FISCALE]',
    EMAIL: '[EMAIL]',
    TELEFONO: '[TELEFONO]',
    INDIRIZZO: '[INDIRIZZO]',
    NUMERO_WPS_WPQR: '[NUMERO_WPS_WPQR]',
    NUMERO_RIFERIMENTO: '[NUMERO_RIFERIMENTO]',
});

/** Tipi documento di qualifica del personale: profilo di redazione completo. */
const QUALIFICATION_AI_DOC_TYPES = new Set(['patentino_saldatore', 'qualifica_14732', 'cert_ndt']);

function isQualificationAiDocType(docType) {
    return QUALIFICATION_AI_DOC_TYPES.has(docType);
}

/**
 * Chiavi sempre personali, per ogni tipo documento (contatti, anagrafica, nomi di persona).
 * L'ordine conta: la prima regola che combacia vince.
 */
const ALWAYS_KEY_RULES = [
    [/(^|_)(birth|nascita)_?(date|data)$|^(date_of_birth|data_nascita|dob|birthdate)$/, PLACEHOLDERS.DATA_NASCITA],
    [/^(place_of_birth|birth_place|birthplace|luogo_nascita|luogo_di_nascita)$/, PLACEHOLDERS.LUOGO_NASCITA],
    [/^(codice_fiscale|fiscal_code|tax_id|tax_code|cf|ssn|partita_iva|piva|vat_number|vat_no)$/, PLACEHOLDERS.CODICE_FISCALE],
    [/(^|_)(e_?mail|pec)(_address)?$/, PLACEHOLDERS.EMAIL],
    [/(^|_)(phone|telefono|tel|mobile|cellulare)(_number)?$/, PLACEHOLDERS.TELEFONO],
    [/(^|_)(address|indirizzo|city|citta|zip|cap|postal_code)$/, PLACEHOLDERS.INDIRIZZO],
    [
        /(^|_)(welder|operator|person|holder|employee|candidate|worker|titolare|full|first|last|sur)_?name$|^(nome|cognome|surname|titolare)$/,
        PLACEHOLDERS.NOME,
    ],
];

/** Chiavi aggiuntive per i documenti di qualifica (numeri certificato, datore, id personali, WPS/WPQR cliente). */
const QUALIFICATION_KEY_RULES = [
    [/^(certificate|cert|qualification|licen[sc]e|patent|card)_?(number|no|num|nr|id)$/, PLACEHOLDERS.NUMERO_CERTIFICATO],
    [
        /^(employer|employer_name|employer_company|datore|datore_lavoro|datore_di_lavoro|ragione_sociale|company_name|company|business_name|customer|cliente|client_name)$/,
        PLACEHOLDERS.DATORE,
    ],
    [
        /^(matricola|employee_id|employee_number|personal_id|welder_id|welder_number|operator_id|operator_number|stamp_number|badge|badge_number|id_number|identification_(number|no)|passport_number|id_card_number)$/,
        PLACEHOLDERS.ID_PERSONALE,
    ],
    [/^(wps|wpqr|pqr)(_(number|no|num|nr|ref|reference|id))?$/, PLACEHOLDERS.NUMERO_WPS_WPQR],
    [/^(reference|document|report|procedure)_(number|no)$/, PLACEHOLDERS.NUMERO_RIFERIMENTO],
];

function normalizeKey(key) {
    return String(key || '').normalize('NFC').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Segnaposto per una chiave campo personale, o null se la chiave non e' sensibile.
 * @param {string} key
 * @param {string|null} [docType]
 * @returns {string|null}
 */
function placeholderForFieldKey(key, docType = null) {
    const k = normalizeKey(key);
    if (!k) return null;
    for (const [re, ph] of ALWAYS_KEY_RULES) if (re.test(k)) return ph;
    if (isQualificationAiDocType(docType)) {
        for (const [re, ph] of QUALIFICATION_KEY_RULES) if (re.test(k)) return ph;
    }
    return null;
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CODICE_FISCALE_RE = /(?<![A-Z0-9])[A-Z]{6}\d{2}[A-EHLMPR-T]\d{2}[A-Z]\d{3}[A-Z](?![A-Z0-9])/gi;
const PHONE_CANDIDATE_RE = /(?<![\w.])\+?\d[\d ./-]{7,}\d(?![\w])/g;
const PHONE_CONTEXT_RE = /(?:tel(?:efono)?|cell(?:ulare)?|mobile|fax)[:.]?\s*$/i;
const ISO_DATE_RE = /^\d{4}[-/.]\d{2}[-/.]\d{2}$/;
const NAME_STOPWORDS = new Set(['di', 'de', 'del', 'della', 'dei', 'da', 'van', 'von', 'la', 'le', 'lo', 'the', 'and']);

/**
 * Codici tecnici / liste processo: NON sono telefoni.
 * Es. WPQR/certificato `24-03390-01`, processi `135-138-141`, coppia `111/135`.
 */
function isTechnicalDigitGroup(token) {
    const t = String(token).trim();
    if (/^\d{2}-\d{4,6}-\d{2}$/.test(t)) return !/^[03]/.test(t);
    if (/^\d{3}(?:-\d{3})+$/.test(t)) return true;
    if (/^\d{2,4}\/\d{2,4}$/.test(t)) return true;
    const digits = t.replace(/\D/g, '');
    if (/^\d+(?:-\d+){2,}$/.test(t) && digits.length >= 9 && !/^[03]/.test(digits)) return true;
    return false;
}

/**
 * Telefono reale, non "qualsiasi 9+ cifre".
 * Accetta: prefisso +39/0039, mobile 3xx, fisso 0x, oppure contesto tel/telefono/cell/mobile/fax.
 */
function isLikelyPhoneToken(token, source, offset) {
    const m = String(token).trim();
    if (!m || ISO_DATE_RE.test(m)) return false;
    const digits = m.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) return false;

    const compact = m.replace(/[\s./-]/g, '');
    if (/^(?:\+|00)39/.test(compact) || compact.startsWith('+')) return true;
    if (isTechnicalDigitGroup(m)) return false;

    const before = String(source || '').slice(Math.max(0, offset - 24), offset);
    if (PHONE_CONTEXT_RE.test(before)) return true;

    if (/^3\d{8,9}$/.test(compact)) return true;
    if (/^0\d{8,10}$/.test(compact)) return true;
    return false;
}

const TECHNICAL_ATOM_RE = /(?<!\d)(?:\d{2}-\d{4,6}-\d{2}|\d{3}(?:-\d{3})+|\d{2,4}\/\d{2,4})(?!\d)/g;
const DIGIT_GROUP_RE = /\+?\d+/g;

/**
 * Il candidato regex puo' contenere piu' numeri adiacenti (telefono + codice tecnico).
 * Si spezza in "atomi" (gruppi di cifre; i codici tecnici restano un atomo unico) e si
 * redige solo il sotto-intervallo piu' lungo che e' davvero un telefono.
 * @returns {string} candidato con i soli telefoni sostituiti dal segnaposto
 */
function redactPhonesInCandidate(candidate, source, offset) {
    const protectedRanges = [];
    for (const m of candidate.matchAll(TECHNICAL_ATOM_RE)) {
        protectedRanges.push([m.index, m.index + m[0].length]);
    }
    const atoms = [];
    for (const m of candidate.matchAll(DIGIT_GROUP_RE)) {
        const start = m.index;
        const end = start + m[0].length;
        const range = protectedRanges.find(([a, b]) => start >= a && start < b);
        if (range) {
            const last = atoms[atoms.length - 1];
            if (last && last.rangeStart === range[0]) {
                last.end = range[1];
            } else {
                atoms.push({ start: range[0], end: range[1], rangeStart: range[0] });
            }
        } else {
            atoms.push({ start, end, rangeStart: null });
        }
    }

    let out = '';
    let cursor = 0;
    let i = 0;
    while (i < atoms.length) {
        let hit = -1;
        for (let j = atoms.length - 1; j >= i; j -= 1) {
            const sub = candidate.slice(atoms[i].start, atoms[j].end);
            if (isLikelyPhoneToken(sub, source, offset + atoms[i].start)) {
                hit = j;
                break;
            }
        }
        if (hit < 0) {
            i += 1;
            continue;
        }
        out += candidate.slice(cursor, atoms[i].start) + PLACEHOLDERS.TELEFONO;
        cursor = atoms[hit].end;
        i = hit + 1;
    }
    return out + candidate.slice(cursor);
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Toglie da un testo libero email, codici fiscali, telefoni e i valori personali noti
 * (token del nome, numeri certificato, datore...) che compaiono altrove nell'esempio.
 * @param {unknown} text
 * @param {Array<{ value: string, placeholder: string }>} [known]
 * @returns {unknown} stringa redatta; i non-stringa tornano invariati
 */
function scrubFreeTextForAi(text, known = []) {
    if (typeof text !== 'string' || !text) return text;
    let out = text
        .replace(EMAIL_RE, PLACEHOLDERS.EMAIL)
        .replace(CODICE_FISCALE_RE, PLACEHOLDERS.CODICE_FISCALE);
    for (const { value, placeholder } of known) {
        const re = new RegExp(
            `(?<![\\p{L}\\p{N}])${escapeRegExp(value)}(?![\\p{L}\\p{N}])`,
            'giu'
        );
        out = out.replace(re, placeholder);
    }
    out = out.replace(PHONE_CANDIDATE_RE, (m, offset, src) => redactPhonesInCandidate(m, src, offset));
    return out;
}

function nameTokens(name) {
    return String(name || '')
        .normalize('NFC')
        .split(/[\s,;]+/)
        .map((t) => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
        .filter((t) => t.length >= 3 && !NAME_STOPWORDS.has(t.toLowerCase()));
}

function pushKnown(list, value, placeholder, { tokens = false } = {}) {
    if (typeof value !== 'string' && typeof value !== 'number') return;
    const s = String(value).normalize('NFC').trim();
    if (s.length < 3) return;
    list.push({ value: s, placeholder });
    if (tokens) {
        for (const t of nameTokens(s)) if (t !== s) list.push({ value: t, placeholder });
    }
}

function collectKnownFromPayload(payload, docType, known) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return;
    for (const [key, val] of Object.entries(payload)) {
        const ph = placeholderForFieldKey(key, docType);
        if (!ph) continue;
        const values = Array.isArray(val) ? val : [val];
        for (const v of values) {
            pushKnown(known, v, ph, { tokens: ph === PLACEHOLDERS.NOME });
        }
    }
}

function dedupeKnown(known) {
    const seen = new Set();
    return known
        .filter(({ value }) => {
            const k = value.toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        })
        .sort((a, b) => b.value.length - a.value.length);
}

function isEmptyValue(v) {
    return v == null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
}

function redactValue(value, known) {
    if (typeof value === 'string') return scrubFreeTextForAi(value, known);
    if (Array.isArray(value)) return value.map((v) => redactValue(v, known));
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) out[k] = redactValue(v, known);
        return out;
    }
    return value;
}

/**
 * Copia del payload (flat o annidato) con i valori personali sostituiti da segnaposto e il testo libero
 * ripulito. Chiavi, null/vuoti, numeri e campi tecnici (processo, spessori, norma...) restano identici.
 * @param {object} payload
 * @param {{ docType?: string|null, known?: Array<{value:string, placeholder:string}> }} [options]
 * @returns {object}
 */
function redactPayloadForAi(payload, { docType = null, known = null } = {}) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
    const knownValues = known || (() => {
        const list = [];
        collectKnownFromPayload(payload, docType, list);
        return dedupeKnown(list);
    })();
    const out = {};
    for (const [key, val] of Object.entries(payload)) {
        const ph = placeholderForFieldKey(key, docType);
        if (ph) {
            out[key] = isEmptyValue(val) ? val : ph;
        } else {
            out[key] = redactValue(val, knownValues);
        }
    }
    return out;
}

/**
 * field_diffs `{ chiave: { ai, human } }`: i valori personali diventano segnaposto; una correzione che dopo la
 * redazione non porta piu' informazione (stesso segnaposto da entrambi i lati) viene omessa.
 * @param {object} diffs
 * @param {{ docType?: string|null, known?: Array }} [options]
 * @returns {object}
 */
function redactFieldDiffsForAi(diffs, { docType = null, known = [] } = {}) {
    const out = {};
    if (!diffs || typeof diffs !== 'object') return out;
    for (const [key, diff] of Object.entries(diffs)) {
        const ph = placeholderForFieldKey(key, docType);
        const side = (v) => (ph ? (isEmptyValue(v) ? (v ?? null) : ph) : redactValue(v, known));
        const ai = side(diff?.ai);
        const human = side(diff?.human);
        if (ph && ai === human) continue;
        out[key] = { ai, human };
    }
    return out;
}

/**
 * Esempio few-shot (riga `import_extraction_feedback`) pronto per il prompt: nome file -> `[FILE]`,
 * valori personali -> segnaposto, stessa struttura. I valori personali raccolti da TUTTI i payload
 * dell'esempio vengono tolti anche dal testo libero.
 * @param {{ file_name?: string, action?: string, ai_payload?: object, human_payload?: object, field_diffs?: object }} example
 * @param {string|null} [docType]
 */
function redactFeedbackExampleForAi(example, docType = null) {
    const ex = example || {};
    const list = [];
    collectKnownFromPayload(ex.human_payload, docType, list);
    collectKnownFromPayload(ex.ai_payload, docType, list);
    for (const [key, diff] of Object.entries(ex.field_diffs || {})) {
        const ph = placeholderForFieldKey(key, docType);
        if (!ph) continue;
        pushKnown(list, diff?.ai, ph, { tokens: ph === PLACEHOLDERS.NOME });
        pushKnown(list, diff?.human, ph, { tokens: ph === PLACEHOLDERS.NOME });
    }
    const known = dedupeKnown(list);
    return {
        ...ex,
        file_name: redactFileNameForAi(ex.file_name),
        ai_payload: redactPayloadForAi(ex.ai_payload, { docType, known }),
        human_payload: redactPayloadForAi(ex.human_payload, { docType, known }),
        field_diffs: redactFieldDiffsForAi(ex.field_diffs, { docType, known }),
    };
}

/**
 * Il nome file non porta informazione utile all'estrazione e puo' contenere il titolare:
 * all'AI arriva sempre e solo il segnaposto.
 * @param {unknown} _name
 * @returns {string}
 */
function redactFileNameForAi(_name) {
    return PLACEHOLDERS.FILE;
}

/**
 * Pattern di riferimento cross-tenant (Livello B). I pattern su campi personali o numerici di cliente
 * (numero certificato, numero riferimento, WPS/WPQR; per i documenti di qualifica) vengono scartati: una
 * coppia "numero -> numero" non insegna nulla e identifica un cliente. Sugli altri il testo viene ripulito.
 * @param {Array<{ field_key: string, from_pattern: string, to_pattern: string, hit_count: number }>} patterns
 * @param {string|null} [docType]
 */
function redactReferencePatternsForAi(patterns, docType = null) {
    if (!Array.isArray(patterns)) return [];
    const out = [];
    for (const p of patterns) {
        if (placeholderForFieldKey(p.field_key, docType)) continue;
        out.push({
            ...p,
            from_pattern: scrubFreeTextForAi(p.from_pattern),
            to_pattern: scrubFreeTextForAi(p.to_pattern),
        });
    }
    return out;
}

const PLACEHOLDER_VALUES = new Set(Object.values(PLACEHOLDERS));

/**
 * Rete di sicurezza: se l'AI ricopia un segnaposto dei few-shot come valore di un campo estratto,
 * il campo torna null (mai "[NOME]" nei dati di revisione/DB). Solo valori stringa di primo livello.
 * @param {object} fields
 * @returns {object}
 */
function dropPlaceholderValues(fields) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) return fields;
    const out = {};
    for (const [k, v] of Object.entries(fields)) {
        out[k] = typeof v === 'string' && PLACEHOLDER_VALUES.has(v.trim()) ? null : v;
    }
    return out;
}

module.exports = {
    dropPlaceholderValues,
    PLACEHOLDERS,
    QUALIFICATION_AI_DOC_TYPES,
    isQualificationAiDocType,
    placeholderForFieldKey,
    scrubFreeTextForAi,
    redactPayloadForAi,
    redactFieldDiffsForAi,
    redactFeedbackExampleForAi,
    redactFileNameForAi,
    redactReferencePatternsForAi,
};
