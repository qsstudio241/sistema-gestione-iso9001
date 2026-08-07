'use strict';

/**
 * ingestPlausibilityChecks.js — controlli di plausibilità/coerenza normativa
 * sui campi ESTRATTI in fase di ingest (WPQR, qualifiche saldatori, WPS).
 *
 * Scope: intercettare errori probabili nel documento originale o
 * nell'estrazione (date incoerenti, range invertiti, designazioni fuori
 * pattern) — non validare ogni combinazione ammessa dalla norma.
 *
 * Funzioni pure, SOLO warning testuali: mai bloccanti. La conferma/commit
 * resta sempre possibile con revisione umana, come già per i campi
 * obbligatori 9606-1 (vedi qualificationIngest.service.js, mig. 092).
 *
 * Gap analysis WPQR/qualifiche saldatori (26/07/2026): prima di questo
 * modulo la pipeline di ingest (documentIngestPipeline/wpqrIngest/
 * qualificationIngest) estraeva SOLO valori — nessuna verifica di
 * plausibilità/coerenza rispetto a ISO 15609/13916/14175/14341/9606.
 */

const { normalizeShieldingGasCode } = require('../data/shieldingGases14175');
const { computeQualifiedMaterialThicknessRangeLevel2 } = require('../data/weldingQualificationRules15614');

/**
 * @param {string|null|undefined} value - atteso YYYY-MM-DD
 * @returns {Date|null}
 */
function parseIsoDate(value) {
    if (!value) return null;
    const s = String(value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const d = new Date(`${s}T00:00:00Z`);
    return isNaN(d.getTime()) ? null : d;
}

/**
 * Verifica che una data "successiva" (es. scadenza) non sia anteriore o
 * uguale a una data "precedente" (es. emissione/esame). Non vincolante se
 * una delle due date è assente o non in formato ISO (nessun warning: molti
 * WPQR non hanno scadenza — vedi lezione DEPUTYTASK1 25/07/2026).
 *
 * @param {object} params
 * @param {string|null} params.laterDate
 * @param {string|null} params.earlierDate
 * @param {string} params.laterLabel
 * @param {string} params.earlierLabel
 * @returns {string|null}
 */
function checkDateOrder({ laterDate, earlierDate, laterLabel, earlierLabel }) {
    const later = parseIsoDate(laterDate);
    const earlier = parseIsoDate(earlierDate);
    if (!later || !earlier) return null;
    if (later.getTime() <= earlier.getTime()) {
        return `${laterLabel} (${laterDate}) non successiva a ${earlierLabel} (${earlierDate}) — verificare le date estratte`;
    }
    return null;
}

/**
 * Verifica che un range numerico [min, max] non sia invertito.
 * @param {object} params
 * @param {number|string|null} params.min
 * @param {number|string|null} params.max
 * @param {string} params.label
 * @returns {string|null}
 */
function checkNumericRangeOrder({ min, max, label }) {
    if (min == null || max == null || min === '' || max === '') return null;
    const minNum = Number(min);
    const maxNum = Number(max);
    if (isNaN(minNum) || isNaN(maxNum)) return null;
    if (minNum > maxNum) {
        return `Range ${label} invertito (min ${minNum} > max ${maxNum}) — verificare i valori estratti`;
    }
    return null;
}

/**
 * Designazione ISO 14341 attesa: "[ISO 14341-A|B-]G <resistenza> [<impatto>] <gas> <composizione>"
 * oppure solo filo "[ISO 14341-A|B-]G <composizione>". Pattern volutamente
 * permissivo (soft check): intercetta estrazioni palesemente incoerenti,
 * non valida ogni combinazione ammessa dalla norma (GAP Tabella 3A/3B —
 * docs/reference/ISO-14341-consumabili-filo.md).
 */
const FILLER_14341_PATTERN = /^(?:ISO\s*14341-[AB]-)?G\s+[A-Za-z0-9]/i;

/**
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function checkFillerMaterial14341Plausibility(value) {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim();
    if (!v) return null;
    if (FILLER_14341_PATTERN.test(v)) return null;
    // Non blocca: molti materiali sono legittimamente fuori scope 14341
    // (inox ISO 14343, alluminio ISO 18274, MMA, o designazione AWS es. "ER70S-6").
    return `Designazione filler "${v}" non riconosciuta come ISO 14341 (attesa forma "G <resistenza> <impatto> <gas> <composizione>") — verificare; può essere fuori scope (inox/alluminio) o AWS`;
}

/**
 * Verifica che il codice gas dichiarato sia nel catalogo ISO 14175
 * (o normalizzabile). Non blocca: il campo resta testo libero.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
function checkShieldingGasKnown(value) {
    if (!value || typeof value !== 'string') return null;
    const v = value.trim();
    if (!v || v.toLowerCase() === 'altro') return null;
    const normalized = normalizeShieldingGasCode(v);
    if (!normalized) {
        return `Gas di protezione "${v}" non riconosciuto nel catalogo ISO 14175 — verificare`;
    }
    return null;
}

/**
 * Cross-check (solo warning, mai bloccante) tra il range spessore DICHIARATO
 * sul WPQR e quello atteso da ISO 15614-1 Tabella 7 colonna Level 2 — SOLO
 * per Level 2 e SOLO nelle bande 3-40mm coperte con certezza (vedi GAP
 * dichiarato in docs/reference/ISO-15614-1-range-validita-WPQR.md e
 * weldingQualificationRules15614.js). Fuori da questi limiti ritorna null:
 * non è un errore, è semplicemente fuori dallo scope verificato di questo check.
 * @param {object} params
 * @param {number|string|null} params.thicknessTestMm
 * @param {number|string|null} params.thicknessMin
 * @param {number|string|null} params.thicknessMax
 * @param {string|number|null} params.qualificationLevel
 * @returns {string|null}
 */
function checkThicknessRangeAgainstIso15614Level2({ thicknessTestMm, thicknessMin, thicknessMax, qualificationLevel }) {
    if (String(qualificationLevel) !== '2') return null;
    if (thicknessMin == null || thicknessMax == null || thicknessMin === '' || thicknessMax === '') return null;
    const expected = computeQualifiedMaterialThicknessRangeLevel2({ testThicknessMm: thicknessTestMm });
    if (!expected) return null;
    const min = Number(thicknessMin);
    const max = Number(thicknessMax);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    const tolerance = 0.5; // margine arrotondamenti/varianti processo, non un valore normativo
    if (min < expected.minMm - tolerance || max > expected.maxMm + tolerance) {
        return `Range spessore dichiarato [${min}, ${max}] fuori dal range atteso ISO 15614-1 Tabella 7 Level 2 per spessore provino ${thicknessTestMm}mm (atteso [${expected.minMm.toFixed(1)}, ${expected.maxMm.toFixed(1)}]) — verificare`;
    }
    return null;
}

/**
 * Per giunti FW (fillet/angolo), il range spessore materiale base (t1/t2)
 * NON segue la Tabella 7 (BW) — l'ingest (wpqrIngest.service.js,
 * resolveThicknessRange) non applica un fallback calcolato in questo caso.
 * Se il range non è dichiarato sul verbale (né marcato come "senza limite
 * superiore" tramite thickness_max_unlimited), segnala che serve verifica
 * manuale invece di lasciare intendere un calcolo automatico affidabile.
 *
 * Gap analysis 07/08/2026 (WPQR reale VB0377/23, cliente Mason): "Fillet
 * Weld: t1 = >=5 ; t2 => 5" — range aperto, nessun limite superiore.
 *
 * @param {{ jointType: string|null, thicknessMin: number|null,
 *   thicknessMax: number|null, thicknessMaxUnlimited: boolean|null }} params
 * @returns {string|null}
 */
function checkFilletThicknessRangeNeedsManualVerification({ jointType, thicknessMin, thicknessMax, thicknessMaxUnlimited }) {
    const isFillet = String(jointType || '').trim().toUpperCase().includes('FW');
    if (!isFillet) return null;
    if (thicknessMaxUnlimited) return null;
    if (thicknessMin != null && thicknessMax != null) return null;
    return 'Range spessore materiale base (t1/t2) per giunto FW (angolo) non calcolabile automaticamente dalla formula generica Tabella 7 (BW) — verificare manualmente sul WPQR i valori dichiarati, oppure l\'eventuale range aperto "senza limite superiore"';
}

module.exports = {
    parseIsoDate,
    checkDateOrder,
    checkNumericRangeOrder,
    checkFillerMaterial14341Plausibility,
    checkShieldingGasKnown,
    checkThicknessRangeAgainstIso15614Level2,
    checkFilletThicknessRangeNeedsManualVerification,
};
