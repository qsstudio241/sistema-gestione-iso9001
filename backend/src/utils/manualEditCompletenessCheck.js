/**
 * manualEditCompletenessCheck.js — verifica sistematica "ingest -> modifica manuale".
 *
 * Formalizza l'audit manuale del 08/08/2026 (WPQR + Qualifiche saldatori): ogni
 * campo che l'ingest AI puo' popolare (aiExpectedSchema) deve poter essere anche
 * corretto o inserito a mano tramite il form/API di modifica — altrimenti un
 * errore dell'AI, o un dato non presente sul PDF, diventa permanentemente
 * irrecuperabile dopo la creazione del record.
 *
 * Complementare al "round-trip a sentinella" (ingestRoundTripSentinel.js), che
 * verifica ingest -> DB. Questo modulo verifica ingest -> possibilita' di
 * modifica manuale (form + API create/update).
 *
 * Uso tipico in un test di completezza per modulo:
 *   const { findIngestFieldsMissingFromManualEdit } = require('.../manualEditCompletenessCheck');
 *   const missing = findIngestFieldsMissingFromManualEdit(
 *     schema.aiExpectedSchema,
 *     MODULE_MANUAL_EDITABLE_FIELDS,
 *     { aliases: { wpqr_number: 'wpqr_code' }, exclude: ['campo_intenzionalmente_solo_ai'] }
 *   );
 *   expect(missing).toEqual([]);
 */

/**
 * @param {Record<string,string>} aiExpectedSchema - da documentTypeSchemas.js (backend)
 * @param {string[]} manualEditableFields - whitelist campi editabili da form/API manuale
 *   (fonte unica esportata dal controller — mai duplicata a mano nel test)
 * @param {{ aliases?: Record<string,string|string[]>, exclude?: string[] }} [options]
 *   aliases: mappa chiave-ingest -> nome/i colonna DB equivalenti, se il nome differisce
 *   exclude: chiavi ingest intenzionalmente non editabili a mano — ogni voce qui
 *     DEVE avere una motivazione nel test che la usa (mai un elenco "di comodo")
 * @returns {string[]} chiavi ingest prive di corrispondenza editabile a mano
 */
function findIngestFieldsMissingFromManualEdit(aiExpectedSchema, manualEditableFields, options = {}) {
    const { aliases = {}, exclude = [] } = options;
    const editableSet = new Set(manualEditableFields);
    const excludeSet = new Set(exclude);
    const missing = [];

    for (const key of Object.keys(aiExpectedSchema || {})) {
        if (excludeSet.has(key)) continue;
        const rawCandidates = aliases[key] ? aliases[key] : key;
        const candidates = Array.isArray(rawCandidates) ? rawCandidates : [rawCandidates];
        const covered = candidates.some((c) => editableSet.has(c));
        if (!covered) missing.push(key);
    }
    return missing;
}

module.exports = { findIngestFieldsMissingFromManualEdit };
