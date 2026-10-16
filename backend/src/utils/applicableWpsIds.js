/**
 * Normalizzazione di projects.applicable_wps_ids (NVARCHAR(MAX), JSON array di id WPS).
 *
 * Formato canonico di scrittura: stringa JSON di un array di interi positivi unici ("[1,2]").
 * In lettura accetta anche valori già annidati o doppiamente serializzati (bug storico:
 * il client inviava JSON.stringify(array) e il backend lo avvolgeva di nuovo in un array).
 */

const MAX_NESTING_DEPTH = 32;
const MAX_SQL_INT = 2147483647;

function toPositiveId(n) {
    return Number.isSafeInteger(n) && n > 0 && n <= MAX_SQL_INT ? [n] : [];
}

function collectIds(value, depth) {
    if (depth > MAX_NESTING_DEPTH || value === null || value === undefined) return [];

    if (typeof value === 'number') return toPositiveId(value);

    if (Array.isArray(value)) {
        return value.flatMap((item) => collectIds(item, depth + 1));
    }

    if (typeof value !== 'string') return [];

    const text = value.trim();
    if (!text) return [];

    if (/^\d+$/.test(text)) return toPositiveId(Number(text));

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        if (/^[\d\s,;]+$/.test(text)) {
            return text
                .split(/[\s,;]+/)
                .filter(Boolean)
                .flatMap((token) => toPositiveId(Number(token)));
        }
        return [];
    }

    if (Array.isArray(parsed) || typeof parsed === 'string') {
        return collectIds(parsed, depth + 1);
    }
    return [];
}

/**
 * @param {unknown} input array, stringa JSON (anche annidata), CSV, null/undefined
 * @returns {number[]} interi positivi unici, nell'ordine di apparizione
 */
function normalizeApplicableWpsIds(input) {
    return [...new Set(collectIds(input, 0))];
}

/**
 * Valore da scrivere in colonna: JSON array di numeri come stringa ("[1,2]").
 * null/undefined restano null (campo non valorizzato); qualsiasi altro input produce un array valido.
 * @param {unknown} input
 * @returns {string|null}
 */
function serializeApplicableWpsIds(input) {
    if (input === null || input === undefined) return null;
    return JSON.stringify(normalizeApplicableWpsIds(input));
}

module.exports = {
    MAX_NESTING_DEPTH,
    normalizeApplicableWpsIds,
    serializeApplicableWpsIds,
};
