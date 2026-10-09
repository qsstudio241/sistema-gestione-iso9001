/**
 * verifyWpqr.js — verifyWpqr(recordOrFields, { mode, runs }) → VerifyResult (domain: 'wpqr').
 *
 * Stesso motore delle qualifiche (pipeline condivisa di verifyEngine): costruisce la vista WPQR,
 * risolve il profilo e delega ai pack del registry. Nessun `if (norma)` qui: il dispatch è solo
 * via registry. Nessun blocco, nessun valore da scrivere. Puro: nessun DB, nessun fs.
 */

'use strict';

const { STATUS, ENGINE_CODES, MODE } = require('./findingTypes');
const { toWpqrView, SOURCE } = require('./wpqrRecordView');
const {
    runVerifyPipeline, engineFinding, resolveMode, DOMAIN,
} = require('./verifyEngine');
const { ensureDefaultPacks } = require('./registerDefaultPacks');

/** ISO 15613 §8 rinvia ai range della parte 15614 di Tabella 2: senza parte dichiarata non c'è norma da applicare. */
function rangePartMissingFindings(view) {
    if (!view.range_part_missing) return null;
    const { label, edition } = view.qualification_standard || {};
    return [engineFinding({
        code: ENGINE_CODES.PROFILE_UNRESOLVED,
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field: 'range_standard_reference',
        read_value: view.range_standard_reference,
        source: { norm: label || 'ISO 15613', edition: edition || null },
        message_it: 'Qualifica ISO 15613: la parte ISO 15614 con cui sono espressi i range di validità non è dichiarata (ISO 15613 §8 rinvia alla parte 15614 di Tabella 2): controlli non eseguibili.',
    })];
}

/**
 * @param {object} input review-fields dell'ingest WPQR o riga DB `wpqr_records`
 * @param {{mode?: 'ingest'|'review'|'db', runs?: object[]}} [opts] `runs` = righe `wpqr_test_runs` (assenti = `[]`)
 */
function verifyWpqr(input, { mode = MODE.REVIEW, runs } = {}) {
    ensureDefaultPacks();
    const safeMode = resolveMode(mode);
    const view = toWpqrView(input, { source: safeMode === MODE.DB ? SOURCE.DB : SOURCE.REVIEW, runs });
    return runVerifyPipeline(view, { mode: safeMode, domain: DOMAIN.WPQR, earlyFindings: rangePartMissingFindings });
}

module.exports = { verifyWpqr };
