/**
 * Filtro "situazione" qualifiche — stessa logica della barra statistiche (GET /qualifications/stats).
 * Garantisce coerenza tra conteggi e lista filtrata.
 */

const VALID_SITUAZIONI = [
    'valide',
    'in_scadenza_60',
    'urgenti_30',
    'scadute',
    'sospesa',
    'revocata',
];

/** Clausole SQL per alias tabella `q` */
const SITUAZIONE_SQL = {
    valide: "q.status = 'valida' AND (q.expiry_date IS NULL OR q.expiry_date > DATEADD(day, 60, CAST(GETDATE() AS DATE)))",
    in_scadenza_60: "q.expiry_date IS NOT NULL AND q.expiry_date BETWEEN DATEADD(day, 31, CAST(GETDATE() AS DATE)) AND DATEADD(day, 60, CAST(GETDATE() AS DATE)) AND q.status NOT IN ('revocata','sospesa')",
    urgenti_30: "q.expiry_date IS NOT NULL AND q.expiry_date BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(day, 30, CAST(GETDATE() AS DATE)) AND q.status NOT IN ('revocata','sospesa')",
    scadute: "q.expiry_date IS NOT NULL AND q.expiry_date < CAST(GETDATE() AS DATE) AND q.status NOT IN ('revocata','sospesa')",
    sospesa: "q.status = 'sospesa'",
    revocata: "q.status = 'revocata'",
};

function isValidSituazione(value) {
    return Boolean(value && VALID_SITUAZIONI.includes(String(value)));
}

function situazioneWhereClause(situazione) {
    if (!isValidSituazione(situazione)) return null;
    return SITUAZIONE_SQL[situazione];
}

function applySituazioneFilter(whereParts, situazione) {
    const clause = situazioneWhereClause(situazione);
    if (clause) whereParts.push(clause);
}

module.exports = {
    VALID_SITUAZIONI,
    SITUAZIONE_SQL,
    isValidSituazione,
    situazioneWhereClause,
    applySituazioneFilter,
};
