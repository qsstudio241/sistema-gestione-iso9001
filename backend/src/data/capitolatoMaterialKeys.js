/**
 * Chiavi capitolato ISO-3 (certificati EN 10204 + materiali base/apporto).
 * Fonte: docs/reference/MATERIAL-COMPLIANCE-NORME-SINTESI.md
 * Persistenza: field_key libero su commercial_case_extracted_requirements (mig. 116).
 * Queste norme NON vanno in import-norms-from-markdown.js (non sono SGQ a clausole 4–10).
 */

'use strict';

/** @typedef {{ key: string, req_type: string, example: string }} CapitolatoFieldKey */

/** Chiavi canoniche da usare in field_key (elenco estendibile, non chiuso al parser). */
const CAPITOLATO_MATERIAL_FIELD_KEYS = [
    { key: 'inspection_document_type', req_type: 'spec', example: 'certificato 3.1 EN 10204, ISO 10474 3.2' },
    { key: 'material_role', req_type: 'spec', example: 'acciaio di base, materiale d\'apporto, filo, elettrodo' },
    { key: 'material_standard', req_type: 'spec', example: 'EN 10025-2, EN 10219-1, ISO 14341' },
    { key: 'steel_designation', req_type: 'spec', example: 'S355J2, S420KT-40' },
    { key: 'filler_designation', req_type: 'spec', example: 'G 42 4 M21 3Si1, ISO 2560 E 42 5 B' },
    { key: 'product_form', req_type: 'spec', example: 'lamiera, tubo, profilato, filo, elettrodo, flusso' },
    { key: 'delivery_condition', req_type: 'spec', example: 'normalizzato, QT, as rolled' },
    { key: 'heat_treatment_required', req_type: 'spec', example: 'PWHT, vacuum degassed' },
    { key: 'ndt_required', req_type: 'spec', example: 'UT, PT, MT sul prodotto' },
    { key: 'original_mill_cert_required', req_type: 'spec', example: 'niente copia intermediario' },
    { key: 'intermediary_allowed', req_type: 'spec', example: 'centro servizi sì/no' },
    { key: 'qms_required', req_type: 'legal', example: 'ISO 9001 del fabbricante' },
    { key: 'quantity', req_type: 'delivery', example: 'ISO 404 §4.1 quantità' },
    { key: 'dimensions', req_type: 'spec', example: 'spessore, Ø, lunghezza' },
    { key: 'tolerances', req_type: 'spec', example: 'ISO 404 §4.1 tolleranze' },
];

const CAPITOLATO_MATERIAL_FIELD_KEY_SET = new Set(
    CAPITOLATO_MATERIAL_FIELD_KEYS.map((row) => row.key),
);

/** Alias AI → chiave canonica. Chiavi sconosciute restano com'è (field_key è libero). */
const FIELD_KEY_ALIASES = {
    certificato_3_1: 'inspection_document_type',
    certificato_31: 'inspection_document_type',
    certificato_3_2: 'inspection_document_type',
    tipo_certificato: 'inspection_document_type',
    tipo_documento: 'inspection_document_type',
    mtc: 'inspection_document_type',
    mill_test: 'inspection_document_type',
    mill_test_certificate: 'inspection_document_type',
    inspection_certificate: 'inspection_document_type',
    abnahmeprufzeugnis: 'inspection_document_type',
    en_10204: 'inspection_document_type',
    materiale_base: 'material_role',
    materiale_di_base: 'material_role',
    materiale_apporto: 'material_role',
    materiale_d_apporto: 'material_role',
    filo: 'material_role',
    elettrodo: 'material_role',
    filler: 'material_role',
    consumabile: 'material_role',
    consumabili: 'material_role',
    filler_metal: 'material_role',
    grado: 'steel_designation',
    steel_grade: 'steel_designation',
    acciaio: 'steel_designation',
    designazione_acciaio: 'steel_designation',
    filler_material: 'filler_designation',
    designazione_filo: 'filler_designation',
    designazione_elettrodo: 'filler_designation',
    designazione_apporto: 'filler_designation',
    forma: 'product_form',
    forma_prodotto: 'product_form',
    ndt: 'ndt_required',
    cnd: 'ndt_required',
    pwht: 'heat_treatment_required',
    trattamento_termico: 'heat_treatment_required',
    originale_mulino: 'original_mill_cert_required',
    intermediario: 'intermediary_allowed',
    iso_9001_fabbricante: 'qms_required',
};

/**
 * Label canoniche per identified_standards (capitolato).
 * ISO 404: non confondere con ISO 4043.
 */
const CAPITOLATO_MATERIAL_STANDARDS = [
    { label: 'EN 10204', re: /\b(?:UNI\s+)?EN\s*10204\b/i },
    { label: 'EN 10168', re: /\b(?:UNI\s+)?EN\s*10168\b/i },
    { label: 'ISO 10474', re: /\bISO\s*10474\b/i },
    { label: 'ISO 404', re: /\bISO\s*404(?!\d)/i },
    { label: 'ISO 6929', re: /\bISO\s*6929\b/i },
    { label: 'EN 10025-2', re: /\b(?:UNI\s+)?(?:BS\s+)?EN\s*10025\s*[-–]?\s*2\b/i },
    { label: 'ISO 14341', re: /\bISO\s*14341\b/i },
];

function slugFieldKey(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/['’]/g, ' ')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * @param {string|null|undefined} raw
 * @returns {string|null}
 */
function canonicalizeFieldKey(raw) {
    if (raw == null) return null;
    const trimmed = String(raw).trim();
    if (!trimmed) return null;
    if (CAPITOLATO_MATERIAL_FIELD_KEY_SET.has(trimmed)) return trimmed;
    const slug = slugFieldKey(trimmed);
    if (CAPITOLATO_MATERIAL_FIELD_KEY_SET.has(slug)) return slug;
    if (FIELD_KEY_ALIASES[slug]) return FIELD_KEY_ALIASES[slug];
    return trimmed.substring(0, 100);
}

/**
 * @param {string} text
 * @returns {string[]}
 */
function detectCapitolatoMaterialStandards(text) {
    const src = String(text || '');
    if (!src.trim()) return [];
    const found = [];
    for (const row of CAPITOLATO_MATERIAL_STANDARDS) {
        if (row.re.test(src)) found.push(row.label);
        row.re.lastIndex = 0;
    }
    return found;
}

/**
 * Unisce le norme rilevate nel testo a quelle già estratte dall'AI, senza duplicati.
 * @param {unknown} existing
 * @param {string} text
 * @returns {string[]}
 */
function mergeIdentifiedStandards(existing, text) {
    const fromAi = Array.isArray(existing)
        ? existing.map((s) => String(s || '').trim()).filter(Boolean)
        : [];
    const detected = detectCapitolatoMaterialStandards(text);
    const seen = new Set(fromAi.map((s) => s.toLowerCase()));
    const out = [...fromAi];
    for (const label of detected) {
        if (!seen.has(label.toLowerCase())) {
            seen.add(label.toLowerCase());
            out.push(label);
        }
    }
    return out;
}

function formatFieldKeysForPrompt() {
    return CAPITOLATO_MATERIAL_FIELD_KEYS.map(
        (row) => `- ${row.key} (${row.req_type}): ${row.example}`,
    ).join('\n');
}

const MATERIAL_CERTIFICATE_REVIEW_HINT =
    'Se il capitolato cita certificati di controllo o acciaio/consumabili, ' +
    'identified_standards DEVE includere le norme presenti nel testo tra: ' +
    'EN 10204, EN 10168, ISO 10474, ISO 404, ISO 6929, EN 10025-2, ISO 14341 ' +
    '(oltre a ISO 9001 / ISO 3834 se citate).\n' +
    'Distingui materiale di BASE (lamiera, profilo, tubo) e materiale d\'APPORTO ' +
    '(filo, elettrodo, flusso). Tipo documento di controllo solo 2.1 | 2.2 | 3.1 | 3.2 ' +
    '(EN 10204; 3.1.B storico → 3.1). Il certificato è prova, non requisito: non inventare soglie ReH/chimica.\n' +
    'Su ogni identified_requirement materiale/certificato aggiungi "field_key" scegliendo tra: ' +
    CAPITOLATO_MATERIAL_FIELD_KEYS.map((r) => r.key).join(', ') + '.';

module.exports = {
    CAPITOLATO_MATERIAL_FIELD_KEYS,
    CAPITOLATO_MATERIAL_FIELD_KEY_SET,
    CAPITOLATO_MATERIAL_STANDARDS,
    FIELD_KEY_ALIASES,
    MATERIAL_CERTIFICATE_REVIEW_HINT,
    canonicalizeFieldKey,
    detectCapitolatoMaterialStandards,
    mergeIdentifiedStandards,
    formatFieldKeysForPrompt,
};
