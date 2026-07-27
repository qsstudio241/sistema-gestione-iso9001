'use strict';

/**
 * numericSanitizer.js — normalizza valori "numerici" provenienti da form manuali,
 * revisione ingest AI o OCR in un numero valido o `null`.
 *
 * Bug produzione 27/07/2026 (cliente Mason, qualifiche saldatori ISO 9606-1):
 * `commitQualificationFromFields` scriveva su colonne DECIMAL (thickness_min_mm,
 * thickness_max_mm, pipe_diameter_min_mm/max_mm) il valore grezzo ricevuto dal
 * form di revisione (stringa vuota "" quando il campo non applicabile viene
 * lasciato vuoto, oppure testo come "N.A." proveniente dal PDF originale) senza
 * alcuna conversione. Il driver `mssql` bind-a una stringa JS come NVarChar,
 * causando "Error converting data type nvarchar to numeric" lato SQL Server.
 *
 * Policy per i casi ambigui (documentata qui per non dover riscoprirla):
 * - stringa vuota, whitespace, o token "non applicabile" (N.A., N/D, "-", ecc.)
 *   → null (mai una stringa passata al driver SQL).
 * - simboli di soglia (\u2265, \u2264, ~, <, >) vengono rimossi: interessa solo il valore.
 * - virgola decimale italiana ("3,5") → punto.
 * - range testuale ambiguo su un campo singolo (es. "3-6" scritto per errore in
 *   un campo min OPPURE max) → si usa il PRIMO numero trovato nella stringa.
 *   Non si tenta di indovinare se il range andava spezigneato altrove: il campo
 *   ambiguo resta comunque un numero valido, mai una stringa che rompe la query.
 */

const NOT_APPLICABLE_TOKENS = new Set([
    'n.a.', 'n.a', 'na', 'n/a', 'n.d.', 'n.d', 'nd', 'n/d',
    '-', '--', '/', 'none', 'null', 'nessuno', 'non applicabile', 'non disponibile',
]);

/**
 * @param {number|string|null|undefined} value
 * @returns {number|null}
 */
function toNumericOrNull(value) {
    if (value == null) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }

    let s = value.trim();
    if (s === '') return null;
    if (NOT_APPLICABLE_TOKENS.has(s.toLowerCase())) return null;

    s = s.replace(/[\u2265\u2264\u2248~]/g, '').replace(/^[<>]=?/, '').trim();
    if (s === '') return null;

    const direct = s.replace(',', '.');
    if (/^-?\d+(\.\d+)?$/.test(direct)) {
        const n = Number(direct);
        return Number.isFinite(n) ? n : null;
    }

    const firstNumberMatch = s.match(/-?\d+(?:[.,]\d+)?/);
    if (firstNumberMatch) {
        const n = Number(firstNumberMatch[0].replace(',', '.'));
        return Number.isFinite(n) ? n : null;
    }

    return null;
}

module.exports = { toNumericOrNull };
