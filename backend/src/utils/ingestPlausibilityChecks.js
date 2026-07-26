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

module.exports = {
    parseIsoDate,
    checkDateOrder,
    checkNumericRangeOrder,
    checkFillerMaterial14341Plausibility,
    checkShieldingGasKnown,
};
