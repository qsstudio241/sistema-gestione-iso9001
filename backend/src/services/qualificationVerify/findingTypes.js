/**
 * findingTypes.js — contratto `Finding` della verifica qualifiche vs norma.
 * Contratto congelato: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md § 1.3.
 * Modulo puro: nessun DB, nessun fs, nessuna scrittura.
 */

'use strict';

const FAMILY = Object.freeze({
    COMPLETEZZA: 'completezza',
    CORRETTEZZA: 'correttezza',
});

const SEVERITY = Object.freeze({
    INFO: 'info',
    WARN: 'warn',
});

const STATUS = Object.freeze({
    VERIFICABILE: 'verificabile',
    NON_VERIFICABILE_FONTE_MANCANTE: 'non_verificabile_fonte_mancante',
    NON_VERIFICABILE_DATO_MANCANTE: 'non_verificabile_dato_mancante',
});

const DIRECTION = Object.freeze({
    MISSING: 'missing',
    OVER_CLAIM: 'over_claim',
    UNDER_CLAIM: 'under_claim',
    MISMATCH: 'mismatch',
});

const TEXT_STATUS = Object.freeze({
    MD_INTEGRALE: 'md_integrale',
    ESTRATTO: 'estratto',
    ESTRATTO_OCR: 'estratto_ocr',
    ASSENTE: 'assente',
});

const MODE = Object.freeze({
    INGEST: 'ingest',
    REVIEW: 'review',
    DB: 'db',
});

const ENGINE_CODES = Object.freeze({
    RULE_ERROR: 'QV.ENGINE.RULE_ERROR',
    SOURCE_MISSING: 'QV.ENGINE.SOURCE_MISSING',
    PROFILE_UNRESOLVED: 'QV.ENGINE.PROFILE_UNRESOLVED',
});

const FORBIDDEN_KEYS = ['blocking', 'error'];

const valuesOf = (o) => Object.values(o);

function emptySource() {
    return { norm: null, edition: null, clause: null, text_status: TEXT_STATUS.ASSENTE, ref: null };
}

/**
 * @param {object} partial campi del Finding; quelli opzionali hanno default `null`/`[]`.
 */
function makeFinding(partial = {}) {
    const p = partial || {};
    const field = p.field != null ? p.field : null;
    const fields = Array.isArray(p.fields) ? p.fields.slice() : (field ? [field] : []);
    return {
        code: p.code,
        family: p.family,
        severity: p.severity != null ? p.severity : SEVERITY.INFO,
        status: p.status,
        field,
        fields,
        direction: p.direction != null ? p.direction : null,
        read_value: p.read_value !== undefined ? p.read_value : null,
        expected_value: p.expected_value !== undefined ? p.expected_value : null,
        source: { ...emptySource(), ...(p.source || {}) },
        message_it: p.message_it,
    };
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * Verifica le invarianti 1, 2, 3, 5 (e la forma) del contratto su un singolo finding.
 * Le invarianti 6 (code unico) e 7 (nessuna regola lancia) sono garantite da registry ed engine.
 * @returns {{ok: boolean, errors: string[]}}
 */
function validateFinding(f) {
    const errors = [];
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
        return { ok: false, errors: ['finding non è un oggetto'] };
    }

    for (const k of FORBIDDEN_KEYS) {
        if (Object.prototype.hasOwnProperty.call(f, k)) {
            errors.push(`invariante 1: chiave vietata "${k}" (nessun blocco)`);
        }
    }

    if (!isNonEmptyString(f.code)) errors.push('code obbligatorio (stringa)');
    if (!valuesOf(FAMILY).includes(f.family)) errors.push(`family non valida: ${f.family}`);
    if (!valuesOf(SEVERITY).includes(f.severity)) {
        errors.push(`invariante 1: severity non valida (solo info|warn): ${f.severity}`);
    }
    if (!valuesOf(STATUS).includes(f.status)) errors.push(`status non valido: ${f.status}`);
    if (!isNonEmptyString(f.field)) errors.push('field obbligatorio (stringa)');
    if (f.fields !== undefined && f.fields !== null && !Array.isArray(f.fields)) {
        errors.push('fields deve essere un array');
    }
    if (f.direction != null && !valuesOf(DIRECTION).includes(f.direction)) {
        errors.push(`direction non valida: ${f.direction}`);
    }
    if (!isNonEmptyString(f.message_it)) errors.push('message_it obbligatorio');

    const src = f.source;
    if (!src || typeof src !== 'object') {
        errors.push('source obbligatorio');
    } else {
        if (!valuesOf(TEXT_STATUS).includes(src.text_status)) {
            errors.push(`source.text_status non valido: ${src.text_status}`);
        }
        if (f.status === STATUS.VERIFICABILE) {
            if (!isNonEmptyString(src.clause)) {
                errors.push('invariante 2: verificabile richiede source.clause');
            }
            if (src.text_status === TEXT_STATUS.ASSENTE) {
                errors.push('invariante 2: verificabile richiede source.text_status ≠ assente');
            }
            if (isNonEmptyString(src.clause) && isNonEmptyString(f.message_it)
                && !f.message_it.includes(src.clause)) {
                errors.push(`invariante 5: message_it deve citare la clausola "${src.clause}"`);
            }
        }
    }

    if (valuesOf(STATUS).includes(f.status)
        && f.status !== STATUS.VERIFICABILE
        && f.severity !== SEVERITY.INFO) {
        errors.push('invariante 3: un finding non verificabile deve avere severity info');
    }

    return { ok: errors.length === 0, errors };
}

module.exports = {
    FAMILY,
    SEVERITY,
    STATUS,
    DIRECTION,
    TEXT_STATUS,
    MODE,
    ENGINE_CODES,
    makeFinding,
    validateFinding,
};
