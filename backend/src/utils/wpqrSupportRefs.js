'use strict';

/**
 * wpqrSupportRefs.js — riga «WPQR di supporto n.» delle pagine WPS (EN ISO 15609-1, layout IIS e simili).
 *
 * Nel testo estratto dal PDF l'etichetta è bilingue e il numero NON la segue subito: la data della WPS sta in
 * mezzo («Supporting WPQR n./ WPQR di supporto n.  <data> <numero>»). Un WPQR può anche dichiarare il
 * proprio supporto in nota («This WPQR is supported by ... related to the WPQR n. <numero>»).
 * Funzioni pure, nessun accesso a DB, nessun log: i numeri trattati sono riferimenti documentali.
 */

const REF_SRC = '(?:[A-Z]{1,4})?\\d{2,6} ?[\\/\\-] ?\\d{2,6}(?:-\\d{1,2})?';
const NUM_ABBR = '(?:n(?:\\.|\\u00B0|\\u00BA|o\\.?|r\\.?)?)?';
const LABEL_SRC = `(?:supporting\\s+(?:wpqr|pqr)|(?:wpqr|pqr)\\s+di\\s+supporto|(?:wpqr|pqr)\\s+supporto)\\s*${NUM_ABBR}`;
const DATE_SRC = '\\d{1,2}[\\/.\\-]\\d{1,2}[\\/.\\-]\\d{2,4}';
const SEPARATOR_SRC = '(?:\\s*(?:,|;|\\+|&|\\be\\b|\\band\\b)\\s*)';

const LABEL_RUN_RE = new RegExp(`(?:${LABEL_SRC}[\\s/:.\\-]*)+`, 'gi');
const REF_LIST_RE = new RegExp(`^\\s*(?:${DATE_SRC}\\s*)?(?!${DATE_SRC})(${REF_SRC}(?:${SEPARATOR_SRC}${REF_SRC})*)`, 'i');
const REF_RE = new RegExp(REF_SRC, 'gi');
const DATE_RE = new RegExp(DATE_SRC, 'g');
const DATE_FRAGMENT_RE = /^(\d{1,2})[/.\-](\d{1,2})$/;

/** `10/08` o `10/08/2023`: frammento di data, non un numero di certificato. */
function isDateLikeToken(token) {
    const t = String(token || '').trim();
    if (!t) return true;
    if (new RegExp(`^${DATE_SRC}$`).test(t)) return true;
    const m = t.match(DATE_FRAGMENT_RE);
    if (!m) return false;
    const a = Number(m[1]);
    const b = Number(m[2]);
    return a <= 31 && b <= 31;
}
const SUPPORTED_BY_RE = new RegExp(
    `supported\\s+by[^.]{0,120}?(?:wpqr|pqr)\\s*${NUM_ABBR}\\s*[:.]?\\s*(${REF_SRC})`,
    'gi'
);

/** Chiave di confronto: maiuscolo, senza spazi, «-» e «/» equivalenti, senza suffisso «rev». */
function normalizeWpqrRef(ref) {
    if (ref == null || typeof ref === 'object') return '';
    return String(ref)
        .toUpperCase()
        .replace(/\bREV\.?\s*\d+\b/g, '')
        .replace(/[\s\u00A0]+/g, '')
        .replace(/[\\\u2010-\u2015]/g, '-')
        .replace(/[-/]+/g, '/');
}

/** Numero come mostrato all'utente: spazi compattati, maiuscolo. */
function cleanRefDisplay(ref) {
    return String(ref).trim().replace(/\s+/g, ' ').toUpperCase();
}

/**
 * Elenco di riferimenti da un campo di testo libero («VB0234/23, VB0301/24»).
 * @param {string|string[]|null} value
 * @returns {string[]} univoci per chiave normalizzata, ordine di apparizione
 */
function splitRefList(value) {
    if (value == null) return [];
    const raw = Array.isArray(value) ? value.join(' ; ') : String(value);
    const withoutDates = raw.replace(DATE_RE, ' ');
    const found = withoutDates.match(REF_RE) || [];
    return uniqueRefs(found.filter((item) => !isDateLikeToken(item)));
}

function uniqueRefs(list) {
    const seen = new Set();
    const out = [];
    for (const item of list) {
        const key = normalizeWpqrRef(item);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(cleanRefDisplay(item));
    }
    return out;
}

/**
 * Riferimenti «WPQR di supporto» dichiarati nel testo di un PDF (WPS o WPQR).
 * @param {string} text
 * @param {{ ownNumber?: string|null }} [options] `ownNumber`: numero del documento stesso, mai tra i supporti
 * @returns {string[]}
 */
function extractSupportingWpqrRefs(text, options = {}) {
    const body = String(text || '');
    if (!body) return [];
    const found = [];

    LABEL_RUN_RE.lastIndex = 0;
    let m;
    while ((m = LABEL_RUN_RE.exec(body)) !== null) {
        const tail = body.slice(m.index + m[0].length, m.index + m[0].length + 120);
        const list = REF_LIST_RE.exec(tail);
        if (list) found.push(...(list[1].match(REF_RE) || []));
        if (m.index === LABEL_RUN_RE.lastIndex) LABEL_RUN_RE.lastIndex += 1;
    }

    SUPPORTED_BY_RE.lastIndex = 0;
    while ((m = SUPPORTED_BY_RE.exec(body)) !== null) found.push(m[1]);

    const own = normalizeWpqrRef(options.ownNumber);
    return uniqueRefs(found).filter((ref) => !own || normalizeWpqrRef(ref) !== own);
}

/** Chiave di confronto per i codici WPS («MANNI 06/23 rev. 0» ≡ «MANNI 06/23»). */
function normalizeWpsRef(ref) {
    if (ref == null || typeof ref === 'object') return '';
    return String(ref)
        .toUpperCase()
        .replace(/\bREV(?:ISIONE|\.)?\s*[A-Z0-9]{1,3}\b/g, '')
        .replace(/[\s\u00A0]+/g, '')
        .replace(/[-/]+/g, '/');
}

module.exports = {
    extractSupportingWpqrRefs,
    splitRefList,
    normalizeWpqrRef,
    normalizeWpsRef,
};
