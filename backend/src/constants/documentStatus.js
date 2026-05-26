/**
 * Stati documento nel registro SGQ.
 * "vigente" è alias legacy di "rilasciato" (migration 067 default 'vigente').
 */

const RELEASED_DOC_STATUSES = Object.freeze(['rilasciato', 'vigente']);

/** Fragmento SQL per clausole IN (...) — valori fissi, no input utente */
const RELEASED_STATUS_SQL_IN = "('rilasciato', 'vigente')";

function isReleasedDocStatus(status) {
    return RELEASED_DOC_STATUSES.includes(status);
}

module.exports = {
    RELEASED_DOC_STATUSES,
    RELEASED_STATUS_SQL_IN,
    isReleasedDocStatus,
};
