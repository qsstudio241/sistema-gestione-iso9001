/**
 * Fonte unica SQL di scadenza effettiva e bucket di situazione delle qualifiche.
 * Usata da card/lista Qualifiche (qualifications.controller), badge menu e lista alert
 * (alert.controller) e AmbitoFacts: stessa data guida, stessa finestra, stessi stati esclusi.
 * Tutte le espressioni presuppongono la tabella `qualifications` con alias `q`.
 */

'use strict';

const { visionFitnessSqlInList } = require('../constants/occupationalQualificationTypes');

// Soglie semaforo (giorni)
const DAYS_WARNING = 60;
const DAYS_URGENT  = 30;

/**
 * Match SQL dei tipi che richiedono conferma periodica semestrale (ISO 9606-1
 * saldatori manuali, ISO 14732 operatori automatica/meccanizzata). Deve restare
 * sincronizzato con isWelder9606Type/isOperator14732Type in
 * weldingCoordinatorAuth.service.js — qui serve la versione SQL per WHERE/CASE
 * (non si può richiamare la funzione JS dentro una query T-SQL).
 */
const SEMIANNUAL_TYPE_SQL_MATCH = `(
    LOWER(q.qualification_type) LIKE '%9606%'
    OR LOWER(q.qualification_type) LIKE '%patentino_saldatore%'
    OR LOWER(q.qualification_type) = '9606_1'
    OR LOWER(q.qualification_type) LIKE '%14732%'
    OR LOWER(q.qualification_type) LIKE '%qualifica_14732%'
)`;

/**
 * Data di scadenza "effettiva" calcolata in SQL — stessa regola di
 * effectiveExpiryDate() (weldingCoordinatorAuth.service, usata per il semaforo per-riga): per i tipi
 * a conferma semestrale vale la data più imminente tra expiry_date e
 * next_confirmation_due (per i coordinatori 14731: expiry_date e cpd_valid_until).
 * Per il certificato oculistico, se è compilata almeno una delle due date
 * (visita acuità / test dei colori), vale la più vicina; se sono entrambe
 * NULL resta expiry_date. Usata sia nelle statistiche (getStats) sia nel filtro
 * ?situazione= di listQualifications, così i conteggi delle card e il colore
 * mostrato riga per riga restano sempre coerenti tra loro.
 */
const VISION_TYPE_SQL_MATCH = `q.qualification_type IN (${visionFitnessSqlInList()})`;

const EFFECTIVE_EXPIRY_SQL = `
    CASE
        WHEN ${SEMIANNUAL_TYPE_SQL_MATCH} THEN
            CASE
                WHEN q.expiry_date IS NULL THEN q.next_confirmation_due
                WHEN q.next_confirmation_due IS NULL THEN q.expiry_date
                WHEN q.next_confirmation_due < q.expiry_date THEN q.next_confirmation_due
                ELSE q.expiry_date
            END
        WHEN LOWER(q.qualification_type) LIKE '%14731%' THEN
            CASE
                WHEN q.expiry_date IS NULL THEN q.cpd_valid_until
                WHEN q.cpd_valid_until IS NULL THEN q.expiry_date
                WHEN q.cpd_valid_until < q.expiry_date THEN q.cpd_valid_until
                ELSE q.expiry_date
            END
        WHEN ${VISION_TYPE_SQL_MATCH}
             AND (q.near_vision_expiry_date IS NOT NULL OR q.colour_vision_expiry_date IS NOT NULL) THEN
            CASE
                WHEN q.near_vision_expiry_date IS NULL THEN q.colour_vision_expiry_date
                WHEN q.colour_vision_expiry_date IS NULL THEN q.near_vision_expiry_date
                WHEN q.near_vision_expiry_date < q.colour_vision_expiry_date THEN q.near_vision_expiry_date
                ELSE q.colour_vision_expiry_date
            END
        ELSE q.expiry_date
    END
`;

const TODAY_SQL = 'CAST(GETDATE() AS DATE)';
const EFFECTIVE_SQL = `(${EFFECTIVE_EXPIRY_SQL})`;
const ACTIVE_STATUS_SQL = "q.status NOT IN ('revocata','sospesa')";

/**
 * Fonte unica dei bucket "situazione" (card statistiche e filtro ?situazione= della lista).
 * Stessa regola del semaforo per-riga (semaforoForRow): conta solo la data effettiva e
 * l'essere sospesa/revocata. Lo stato salvato valida/scaduta/in_scadenza NON entra nel
 * calcolo (puo' essere obsoleto), cosi' ogni riga cade in uno e un solo bucket e
 * Totale = somma delle card.
 */
const SITUAZIONE_BUCKET_SQL = {
    valide:         `${ACTIVE_STATUS_SQL} AND (${EFFECTIVE_SQL} IS NULL OR ${EFFECTIVE_SQL} > DATEADD(day, ${DAYS_WARNING}, ${TODAY_SQL}))`,
    in_scadenza_60: `${ACTIVE_STATUS_SQL} AND ${EFFECTIVE_SQL} IS NOT NULL AND ${EFFECTIVE_SQL} BETWEEN DATEADD(day, ${DAYS_URGENT + 1}, ${TODAY_SQL}) AND DATEADD(day, ${DAYS_WARNING}, ${TODAY_SQL})`,
    urgenti_30:     `${ACTIVE_STATUS_SQL} AND ${EFFECTIVE_SQL} IS NOT NULL AND ${EFFECTIVE_SQL} BETWEEN ${TODAY_SQL} AND DATEADD(day, ${DAYS_URGENT}, ${TODAY_SQL})`,
    scadute:        `${ACTIVE_STATUS_SQL} AND ${EFFECTIVE_SQL} IS NOT NULL AND ${EFFECTIVE_SQL} < ${TODAY_SQL}`,
    // Bucket unico "Non attiva" (sospese + revocate): la colonna Stato le mostra uguali.
    non_attive:     "q.status IN ('sospesa','revocata')",
};

/**
 * Filtro `?status=` della lista: i valori del campo salvato (valida / in_scadenza / scaduta) sono
 * ricondotti ai bucket calcolati sulla data effettiva, gli stessi delle card. Lo stato salvato puo'
 * essere obsoleto (es. `valida` con data gia' passata): senza questa mappa la lista e le card
 * darebbero numeri diversi per lo stesso nome. `sospesa` e `revocata` sono decisioni manuali, non
 * derivano da una data, e restano un confronto sulla colonna.
 */
const EFFECTIVE_STATUS_FILTER_SQL = Object.freeze({
    valida:      `(${SITUAZIONE_BUCKET_SQL.valide})`,
    in_scadenza: `((${SITUAZIONE_BUCKET_SQL.in_scadenza_60}) OR (${SITUAZIONE_BUCKET_SQL.urgenti_30}))`,
    scaduta:     `(${SITUAZIONE_BUCKET_SQL.scadute})`,
    sospesa:     "(q.status = 'sospesa')",
    revocata:    "(q.status = 'revocata')",
});

/** Clausola SQL per `?status=` (stato effettivo) o null se il valore non e' uno stato noto. */
function effectiveStatusFilterSql(status) {
    const key = String(status ?? '').trim();
    return Object.prototype.hasOwnProperty.call(EFFECTIVE_STATUS_FILTER_SQL, key)
        ? EFFECTIVE_STATUS_FILTER_SQL[key]
        : null;
}

/**
 * Filtro `?expiring_days=` della lista sulla data effettiva: negativo = gia' scadute (bucket
 * `scadute`), altrimenti scadenza effettiva tra oggi e oggi + @expDays, escluse sospese/revocate.
 */
function expiringDaysFilterSql(days) {
    if (days < 0) return SITUAZIONE_BUCKET_SQL.scadute;
    return `${ACTIVE_STATUS_SQL} AND ${EFFECTIVE_SQL} IS NOT NULL AND ${EFFECTIVE_SQL} BETWEEN ${TODAY_SQL} AND DATEADD(day, @expDays, ${TODAY_SQL})`;
}

module.exports = {
    DAYS_WARNING,
    DAYS_URGENT,
    SEMIANNUAL_TYPE_SQL_MATCH,
    VISION_TYPE_SQL_MATCH,
    EFFECTIVE_EXPIRY_SQL,
    EFFECTIVE_SQL,
    ACTIVE_STATUS_SQL,
    SITUAZIONE_BUCKET_SQL,
    EFFECTIVE_STATUS_FILTER_SQL,
    effectiveStatusFilterSql,
    expiringDaysFilterSql,
};
