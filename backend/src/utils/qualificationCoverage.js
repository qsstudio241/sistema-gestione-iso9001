/**
 * qualificationCoverage.js — Logica range-aware per match qualifiche saldatori / WPS
 *
 * Ogni funzione è pura (no DB, no side-effect) per essere testabile in isolamento.
 *
 * Modello di match (ISO 9606 / ISO 3834):
 *   Una qualifica saldatore copre un requisito WPS SOLO SE soddisfa tutte le dimensioni:
 *     1. Processo di saldatura — corrispondenza stringa (già esistente)
 *     2. Spessore — il range richiesto dalla WPS deve essere contenuto nel range qualificato
 *     3. Gruppo materiale — il gruppo WPS deve essere compatibile con quello qualificato
 *     4. Posizione — le posizioni richieste dalla WPS devono essere un sottoinsieme di quelle qualificate
 *
 * Gestione NULL difensiva (scelta conservativa):
 *   - Campo NULL nella WPS → dimensione non vincolante (non fa fallire il match)
 *   - Campo NULL nella qualifica → dimensione NON verificabile → esito 'unverifiable'
 *     (la qualifica non viene esclusa ma viene segnalata come "da verificare manualmente")
 *   Motivazione: escludere una qualifica solo perché il dato non è stato inserito genererebbe
 *   falsi negativi su archivi storici; segnalare invece la lacuna dati stimola il completamento
 *   del registro senza bloccare il processo.
 */

'use strict';

/**
 * Verifica se un range richiesto [reqMin, reqMax] è contenuto nel range qualificato [qualMin, qualMax].
 *
 * Bug corretto (audit strutturale 07/08/2026 — ISO 3834-2 §8.2): prima di questo fix, un
 * `qualMax` NULL veniva SEMPRE trattato come "nessun limite superiore" (Infinity), anche
 * quando il dato era semplicemente assente/non estratto dal certificato (non un range aperto
 * dichiarato) — falso positivo che poteva dichiarare idoneo un saldatore oltre il suo range
 * reale. Ora un `qualMax` NULL senza il flag esplicito `qualMaxUnlimited` produce 'unverifiable'
 * (da controllare manualmente), MAI più 'ok' automatico. Stesso pattern già introdotto per la
 * WPQR (`thickness_max_unlimited`, migrazione 139) — vedi GUIDA_CONSOLIDATA.md.
 *
 * @param {number|null} qualMin  - thickness_min_mm dalla qualifica
 * @param {number|null} qualMax  - thickness_max_mm dalla qualifica
 * @param {number|null} reqMin   - thickness_range_min dalla WPS
 * @param {number|null} reqMax   - thickness_range_max dalla WPS
 * @param {boolean} [qualMaxUnlimited=false] - thickness_max_unlimited dalla qualifica: true SOLO
 *   se il certificato dichiara esplicitamente un range aperto (es. "≥5mm"), non se il dato è solo assente
 * @returns {'ok'|'out_of_range'|'unverifiable'}
 */
function checkThickness(qualMin, qualMax, reqMin, reqMax, qualMaxUnlimited = false) {
    // WPS non specifica spessore → non vincolante
    if (reqMin == null && reqMax == null) return 'ok';

    // Qualifica senza alcun dato spessore (e nessun range aperto dichiarato) → non verificabile
    if (qualMin == null && qualMax == null && !qualMaxUnlimited) return 'unverifiable';

    const qMin = qualMin != null ? Number(qualMin) : 0;
    let qMax;
    if (qualMaxUnlimited) {
        qMax = Infinity; // range aperto dichiarato esplicitamente (es. "≥5mm") — caso legittimo
    } else if (qualMax != null) {
        qMax = Number(qualMax);
    } else {
        qMax = null; // massimo non dichiarato e non marcato come illimitato: non verificabile
    }
    const rMin = reqMin != null ? Number(reqMin) : 0;
    const rMax = reqMax != null ? Number(reqMax) : 0;

    if (rMin < qMin) return 'out_of_range';
    if (qMax == null) return 'unverifiable';
    return rMax <= qMax ? 'ok' : 'out_of_range';
}

/**
 * Verifica compatibilità gruppo materiale.
 * Approccio: il gruppo WPS deve essere uguale o "contenuto" nel gruppo qualificato
 * (es. qualifica "1.1, 1.2" copre WPS "1.1"). Confronto case-insensitive normalizzato.
 *
 * @param {string|null} qualGroup  - material_group dalla qualifica
 * @param {string|null} reqGroup   - base_material_group dalla WPS
 * @returns {'ok'|'mismatch'|'unverifiable'}
 */
function checkMaterialGroup(qualGroup, reqGroup) {
    // WPS non specifica → non vincolante
    if (!reqGroup || String(reqGroup).trim() === '') return 'ok';

    // Qualifica senza dato → non verificabile
    if (!qualGroup || String(qualGroup).trim() === '') return 'unverifiable';

    const qNorm = normalizeGroupList(qualGroup);
    const rNorm = normalizeGroupList(reqGroup);

    // Ogni token del requisito deve essere coperto dalla qualifica
    for (const rToken of rNorm) {
        if (!qNorm.some(qToken => qToken === rToken || qToken.startsWith(rToken) || rToken.startsWith(qToken))) {
            return 'mismatch';
        }
    }
    return 'ok';
}

/**
 * Normalizza una stringa di gruppi/posizioni separati da virgola, spazio o slash.
 * @param {string} s
 * @returns {string[]}
 */
function normalizeGroupList(s) {
    return String(s)
        .toUpperCase()
        .split(/[,\/\s]+/)
        .map(t => t.trim())
        .filter(Boolean);
}

/**
 * Verifica copertura posizioni di saldatura.
 * Le posizioni richieste dalla WPS devono essere un sottoinsieme di quelle qualificate.
 *
 * @param {string|null} qualPositions  - position_range dalla qualifica
 * @param {string|null} reqPositions   - welding_positions dalla WPS
 * @returns {'ok'|'mismatch'|'unverifiable'}
 */
function checkPositions(qualPositions, reqPositions) {
    // WPS non specifica → non vincolante
    if (!reqPositions || String(reqPositions).trim() === '') return 'ok';

    // Qualifica senza dato → non verificabile
    if (!qualPositions || String(qualPositions).trim() === '') return 'unverifiable';

    const qPos = normalizeGroupList(qualPositions);
    const rPos = normalizeGroupList(reqPositions);

    for (const pos of rPos) {
        if (!qPos.includes(pos)) return 'mismatch';
    }
    return 'ok';
}

/**
 * Verifica se la qualifica copre il requisito processo della WPS.
 * Logica esistente mantenuta: match su stringa processo (case-insensitive, include-based).
 *
 * @param {string|null} qualProcess
 * @param {string|null} reqProcess
 * @returns {boolean}
 */
function checkProcess(qualProcess, reqProcess) {
    if (!qualProcess) return false;
    if (!reqProcess) return true; // WPS senza processo → non vincolante
    const q = String(qualProcess).toUpperCase().trim();
    const r = String(reqProcess).toUpperCase().trim();
    return q === r || q.includes(r) || r.includes(q);
}

/**
 * @typedef {'ok'|'out_of_range'|'mismatch'|'unverifiable'} DimensionResult
 *
 * @typedef {Object} CoverageDetail
 * @property {DimensionResult} process
 * @property {DimensionResult} thickness
 * @property {DimensionResult} material_group
 * @property {DimensionResult} position
 * @property {'ok'|'partial'|'excluded'} overall
 *   - 'ok'       → tutte le dimensioni coperte
 *   - 'partial'  → processo OK ma ≥1 dimensione unverifiable (segnala verifica manuale)
 *   - 'excluded' → processo non coperto O ≥1 dimensione out_of_range/mismatch
 */

/**
 * Calcola la copertura di una qualifica rispetto a un requisito WPS.
 *
 * @param {Object} qual  - riga qualifiche (da DB)
 * @param {Object} wps   - riga welding_procedures (da DB)
 * @returns {CoverageDetail}
 */
function computeQualificationCoverage(qual, wps) {
    const processOk = checkProcess(qual.welding_process, wps.welding_process);

    if (!processOk) {
        return {
            process:        'mismatch',
            thickness:      'skipped',
            material_group: 'skipped',
            position:       'skipped',
            overall:        'excluded',
        };
    }

    const qualMaxUnlimited = qual.thickness_max_unlimited === true
        || qual.thickness_max_unlimited === 1
        || qual.thickness_max_unlimited === '1';
    const thickResult  = checkThickness(qual.thickness_min_mm, qual.thickness_max_mm,
                                        wps.thickness_range_min, wps.thickness_range_max,
                                        qualMaxUnlimited);
    const matResult    = checkMaterialGroup(qual.material_group, wps.base_material_group);
    const posResult    = checkPositions(qual.position_range, wps.welding_positions);

    const hasFailure = [thickResult, matResult, posResult]
        .some(r => r === 'out_of_range' || r === 'mismatch');
    const hasUnverifiable = [thickResult, matResult, posResult]
        .some(r => r === 'unverifiable');

    let overall;
    if (hasFailure) {
        overall = 'excluded';
    } else if (hasUnverifiable) {
        overall = 'partial';
    } else {
        overall = 'ok';
    }

    return {
        process:        'ok',
        thickness:      thickResult,
        material_group: matResult,
        position:       posResult,
        overall,
    };
}

/**
 * Calcola l'esito visivo (semaforo) per un WPS data la lista di qualifiche che lo coprono.
 *
 * @param {Array<{overall: string}>} coverageDetails
 * @returns {'verde'|'giallo'|'rosso'}
 *   - 'verde'  → almeno un saldatore con overall='ok'
 *   - 'giallo' → nessun 'ok' ma almeno un 'partial' (da verificare manualmente)
 *   - 'rosso'  → nessuna copertura
 */
function computeWpsCoverageEsito(coverageDetails) {
    if (coverageDetails.some(d => d.overall === 'ok'))      return 'verde';
    if (coverageDetails.some(d => d.overall === 'partial')) return 'giallo';
    return 'rosso';
}

module.exports = {
    checkThickness,
    checkMaterialGroup,
    checkPositions,
    checkProcess,
    computeQualificationCoverage,
    computeWpsCoverageEsito,
    normalizeGroupList,
};
