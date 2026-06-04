/**
 * documentRegistryNorm.service.js
 * Schema canonico type_specific_data per doc_type=norma nel registro documentale.
 * Contratto unico tra form manuale, upload bulk e job validit? (R1/R3/R6).
 *
 * Allineato a documentTypeSchemas.norma (frontend + backend).
 */

const VALID_VALIDITY_STATUSES = ['vigente', 'superata', 'annullata', 'in_revisione'];

/** Chiavi canonicali scritte in document_registry.type_specific_data */
const NORM_TSD_CANONICAL_KEYS = [
  'standard_code',
  'norm_title',
  'issuing_body',
  'edition_year',
  'supersedes',
  'validity_status',
  'language',
  'scope_summary',
  'ics_code',
  'technical_committee',
  'is_harmonized',
  'last_validity_check',
  'validity_check_url',
  'superseded_by',
];

/**
 * Normalizza validity_status verso lo schema registro.
 * @param {string|null|undefined} raw
 * @returns {string}
 */
/**
 * Estrae codice norma plausibile dal nome file (es. ISO_9606_1_2017.pdf).
 * @param {string} filename
 * @returns {string}
 */
function guessStandardCodeFromFilename(filename) {
  const base = String(filename || '').replace(/\.pdf$/i, '').trim();
  if (!base) return '';
  const forHint = base.replace(/_/g, ' ');
  const normHint = /\b(ISO|IEC|EN|UNI|BS|DIN|AWS|ASME|CEN|AFNOR|ANSI)\b|D\.?\s*Lgs|decreto/i;
  if (!normHint.test(forHint)) return '';
  return forHint.replace(/\s+/g, ' ').trim();
}

function normalizeValidityStatus(raw) {
  const value = raw ? String(raw).trim() : '';
  if (VALID_VALIDITY_STATUSES.includes(value)) return value;
  // "rilasciato" ? status documento, non vigore norma
  if (value === 'rilasciato') return 'vigente';
  return 'vigente';
}

/**
 * Costruisce l'oggetto type_specific_data canonico per una norma.
 * @param {object} raw - metadati da AI, form manuale o upload bulk
 * @returns {object|null} null se standard_code assente
 */
function buildNormTypeSpecificData(raw = {}) {
  const standardCode = raw.standard_code ? String(raw.standard_code).trim() : '';
  if (!standardCode) return null;

  const editionRaw = raw.edition_year;
  const editionYear = editionRaw != null && editionRaw !== ''
    ? parseInt(editionRaw, 10) || null
    : null;

  const scopeRaw = raw.scope_summary ?? raw.abstract ?? null;
  const scopeSummary = scopeRaw != null && String(scopeRaw).trim()
    ? String(scopeRaw).trim().substring(0, 500)
    : null;

  const data = {
    standard_code: standardCode,
    norm_title: raw.norm_title ? String(raw.norm_title).trim() : null,
    issuing_body: raw.issuing_body ? String(raw.issuing_body).trim() : null,
    edition_year: editionYear,
    supersedes: raw.supersedes ? String(raw.supersedes).trim() : null,
    validity_status: normalizeValidityStatus(raw.validity_status),
    language: raw.language ? String(raw.language).trim() : null,
    scope_summary: scopeSummary,
    ics_code: raw.ics_code ? String(raw.ics_code).trim() : null,
    technical_committee: raw.technical_committee ? String(raw.technical_committee).trim() : null,
  };

  if (raw.is_harmonized != null && raw.is_harmonized !== '') {
    data.is_harmonized = Boolean(raw.is_harmonized);
  }

  if (raw.last_validity_check) {
    data.last_validity_check = raw.last_validity_check;
  }
  if (raw.validity_check_url) {
    data.validity_check_url = String(raw.validity_check_url).trim();
  }
  if (raw.superseded_by) {
    data.superseded_by = String(raw.superseded_by).trim();
  }

  return data;
}

/**
 * Serializza type_specific_data per INSERT/UPDATE SQL.
 * @param {object} raw
 * @returns {string|null}
 */
function serializeNormTypeSpecificData(raw = {}) {
  const built = buildNormTypeSpecificData(raw);
  return built ? JSON.stringify(built) : null;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNormFieldMissing(value) {
  return value == null || value === '';
}

/**
 * Parse type_specific_data esistente (stringa JSON o oggetto).
 * @param {string|object|null|undefined} raw
 * @returns {object}
 */
function parseNormTypeSpecificData(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return { ...raw };
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Merge idempotente: copia da source solo i campi canonici assenti in existing.
 * Usato dal backfill R6 (norm_document_sources ? document_registry).
 *
 * @param {string|object|null|undefined} existingRaw - type_specific_data attuale
 * @param {object} sourceRaw - metadati da norm_document_sources o altro
 * @returns {{ merged: object|null, changed: boolean }}
 */
function mergeMissingNormTypeSpecificData(existingRaw, sourceRaw = {}) {
  const existing = parseNormTypeSpecificData(existingRaw);
  const built = buildNormTypeSpecificData(sourceRaw);
  if (!built) {
    return { merged: Object.keys(existing).length ? existing : null, changed: false };
  }

  const merged = { ...existing };
  let changed = false;

  for (const key of NORM_TSD_CANONICAL_KEYS) {
    if (!(key in built) || built[key] == null || built[key] === '') continue;
    if (isNormFieldMissing(merged[key])) {
      merged[key] = built[key];
      changed = true;
    }
  }

  const canonical = buildNormTypeSpecificData(merged);
  return { merged: canonical, changed };
}

module.exports = {
  NORM_TSD_CANONICAL_KEYS,
  VALID_VALIDITY_STATUSES,
  guessStandardCodeFromFilename,
  normalizeValidityStatus,
  buildNormTypeSpecificData,
  serializeNormTypeSpecificData,
  parseNormTypeSpecificData,
  mergeMissingNormTypeSpecificData,
};
