/**
 * ingestRoundTripSentinel.js
 *
 * "Round-trip a sentinella" — rete di sicurezza strutturale proposta nell'audit
 * ingest saldatura/3834 del 07/08/2026 (docs/gap-reports/GAP_WPQR_ESTENSIONI_ANNEX_B_2026-08-07.md,
 * §4). Intercetta la classe di bug ricorrente "campo presente in `fields`/`aiPrompt`/
 * `aiExpectedSchema` (quindi visibile e compilabile in UI, che è data-driven) ma perso
 * prima di arrivare al DB" — già trovata 4 volte (preheat_temp/interpass_temp WPQR,
 * shielding_gas qualifiche, thickness_max_unlimited WPQR e qualifiche, pipe_diameter_mm).
 *
 * Uso tipico in un test di servizio ingest:
 *   const { buildSentinelFields, findMissingSentinels } = require('.../ingestRoundTripSentinel');
 *   const { fields, tokens } = buildSentinelFields(schema.aiExpectedSchema, { unlimited: false });
 *   // ... mock runDocumentIngest -> fields, chiama il servizio, cattura i parametri DB ...
 *   const missing = findMissingSentinels(tokens, capturedValues, knownGaps);
 *   expect(missing).toEqual([]);
 */

let counter = 0;

/** Genera un token stringa univoco per una chiave (mai collidente tra run/test). */
function nextSentinelToken(key) {
    counter += 1;
    return `SENTINEL_${key}_${counter}_${Date.now().toString(36)}`;
}

/**
 * Costruisce un oggetto "fields" (come lo restituirebbe `runDocumentIngest`) con un
 * valore sentinella tipizzato e univoco per OGNI chiave di `aiExpectedSchema`, più
 * la mappa chiave→token per la verifica successiva.
 *
 * @param {Record<string,string>} aiExpectedSchema - da documentTypeSchemas.js (backend)
 * @param {Record<string, any>} [overrides] - valori espliciti per chiavi con effetti
 *   collaterali noti su altre chiavi (es. `thickness_max_unlimited: false` per non
 *   azzerare `thickness_max` per design — vedi resolveThicknessRange in wpqrIngest.service.js).
 *   Le chiavi in overrides vengono comunque incluse nella verifica finale.
 * @returns {{ fields: object, tokens: Map<string,string> }}
 */
function buildSentinelFields(aiExpectedSchema, overrides = {}) {
    const fields = {};
    const tokens = new Map();

    for (const key of Object.keys(aiExpectedSchema)) {
        if (Object.prototype.hasOwnProperty.call(overrides, key)) {
            fields[key] = overrides[key];
            tokens.set(key, overrides[key]);
            continue;
        }

        const typeDef = String(aiExpectedSchema[key]);
        let value;
        if (typeDef.includes('boolean')) {
            value = true;
        } else if (typeDef.includes('[]')) {
            value = [nextSentinelToken(key)];
        } else if (typeDef.includes('number')) {
            counter += 1;
            value = 900000 + counter; // improbabile collisione con dati reali
        } else {
            value = nextSentinelToken(key);
        }
        fields[key] = value;
        tokens.set(key, Array.isArray(value) ? value[0] : value);
    }

    return { fields, tokens };
}

/**
 * Confronto valore "sentinella-aware": gestisce le trasformazioni legittime che
 * un valore subisce nel percorso ingest → DB (booleano → BIT 0/1/'1', array a un
 * elemento → stringa joinata, numero invariato).
 */
function valuesMatch(actual, expected) {
    if (typeof expected === 'boolean') {
        const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
        const falsy = (v) => v === false || v === 0 || v === '0' || v === 'false' || v == null;
        return expected ? truthy(actual) : falsy(actual);
    }
    if (Array.isArray(actual)) return actual.some((x) => valuesMatch(x, expected));
    if (actual == null) return false;
    return String(actual) === String(expected);
}

/**
 * Verifica che ogni token sentinella (tranne le chiavi in `exclude`, da documentare
 * sempre col motivo nel test) compaia tra i valori effettivamente passati alla
 * persistenza (query params, o valori di `.input()` mssql).
 * @param {Map<string,any>} tokens
 * @param {any[]} capturedValues - tutti i valori catturati dal mock di persistenza
 * @param {string[]} [exclude]
 * @returns {string[]} chiavi il cui valore sentinella NON è stato trovato
 */
function findMissingSentinels(tokens, capturedValues, exclude = []) {
    const excludeSet = new Set(exclude);
    const missing = [];
    for (const [key, expected] of tokens.entries()) {
        if (excludeSet.has(key)) continue;
        const found = capturedValues.some((actual) => valuesMatch(actual, expected));
        if (!found) missing.push(key);
    }
    return missing;
}

module.exports = { buildSentinelFields, findMissingSentinels, valuesMatch };
