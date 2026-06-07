/**
 * Stati documento nel registro SGQ (colonna document_registry.status).
 * "vigente" è alias legacy di "rilasciato" (migration 067).
 * Non confondere con type_specific_data.validity_status (vigore norme/leggi).
 */

const RELEASED_DOC_STATUSES = Object.freeze(['rilasciato', 'vigente']);

/** Stati ammessi in scrittura (valore canonico persistito). */
const REGISTRY_DOC_STATUSES = Object.freeze([
    'rilasciato',
    'bozza',
    'in_revisione',
    'obsoleto',
    'in_approvazione',
]);

/** Fragmento SQL per clausole IN (...) — valori fissi, no input utente */
const RELEASED_STATUS_SQL_IN = "('rilasciato', 'vigente')";

function isReleasedDocStatus(status) {
    return RELEASED_DOC_STATUSES.includes(status);
}

/**
 * Normalizza input utente/legacy verso stato canonico registro.
 * @param {unknown} raw
 * @returns {string}
 */
function normalizeRegistryDocStatus(raw) {
    if (raw == null || String(raw).trim() === '') return 'rilasciato';
    const s = String(raw).trim().toLowerCase();
    if (s === 'vigente') return 'rilasciato';
    return s;
}

/**
 * Valida e normalizza status registro per create/update API.
 * @param {unknown} raw
 * @returns {{ ok: true, status: string } | { ok: false, status: string, allowed: string[] }}
 */
function parseRegistryDocStatus(raw) {
    const status = normalizeRegistryDocStatus(raw);
    if (!REGISTRY_DOC_STATUSES.includes(status)) {
        return { ok: false, status, allowed: [...REGISTRY_DOC_STATUSES] };
    }
    return { ok: true, status };
}

module.exports = {
    RELEASED_DOC_STATUSES,
    REGISTRY_DOC_STATUSES,
    RELEASED_STATUS_SQL_IN,
    isReleasedDocStatus,
    normalizeRegistryDocStatus,
    parseRegistryDocStatus,
};
