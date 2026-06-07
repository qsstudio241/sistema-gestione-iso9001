'use strict';

/**
 * Normalizzazione doc_type e migrazione etichette legacy (Tab Documenti pre-P0).
 * Chiavi canoniche: snake_case da documentTypes.js (app).
 */

/** Etichette UI legacy ? value snake_case */
const LEGACY_DOC_TYPE_MAP = {
    Procedura: 'procedura',
    Modulo: 'modulo',
    'Istruzione Operativa': 'istruzione',
    'Istruzione operativa': 'istruzione',
    Piano: 'piano_qualita',
    Registro: 'modulo',
    Specifica: 'altro',
    Manuale: 'manuale',
};

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function normalizeDocType(raw) {
    if (raw == null) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    if (LEGACY_DOC_TYPE_MAP[trimmed]) return LEGACY_DOC_TYPE_MAP[trimmed];
    return trimmed;
}

/**
 * Normalizza righe doc_type_config; unifica duplicati legacy+canonico (preferisce canonico).
 * @param {Array<{ doc_type: string, prefix?: string|null, auto_number?: boolean, next_number?: number, default_expiry_months?: number|null }>} rows
 * @returns {{ rows: Array, migrated: boolean }}
 */
function normalizeDocTypeConfigRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
        return { rows: [], migrated: false };
    }

    const byType = new Map();
    let migrated = false;

    for (const row of rows) {
        const canonical = normalizeDocType(row.doc_type);
        if (!canonical) continue;
        if (canonical !== row.doc_type) migrated = true;

        const existing = byType.get(canonical);
        if (!existing) {
            byType.set(canonical, {
                ...row,
                doc_type: canonical,
                _wasCanonical: row.doc_type === canonical,
            });
            continue;
        }

        migrated = true;
        const preferCurrent = row.doc_type === canonical;
        const preferExisting = existing._wasCanonical;
        const primary = preferCurrent && !preferExisting ? row : existing;
        const secondary = primary === row ? existing : row;
        byType.set(canonical, {
            doc_type: canonical,
            _wasCanonical: preferCurrent || preferExisting,
            prefix: primary.prefix || secondary.prefix || null,
            auto_number: primary.auto_number != null ? primary.auto_number : secondary.auto_number,
            next_number: Math.max(existing.next_number || 1, row.next_number || 1),
            default_expiry_months: primary.default_expiry_months ?? secondary.default_expiry_months ?? null,
        });
    }

    return {
        rows: [...byType.values()]
            .map(({ _wasCanonical, ...rest }) => rest)
            .sort((a, b) => a.doc_type.localeCompare(b.doc_type)),
        migrated,
    };
}

module.exports = {
    LEGACY_DOC_TYPE_MAP,
    normalizeDocType,
    normalizeDocTypeConfigRows,
};
