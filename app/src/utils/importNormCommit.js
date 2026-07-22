/**
 * Helper commit Import batch PDF → registro norme (Fase 2).
 * Allineato a documentRegistryNorm.service e DocumentForm (norm-lookup).
 */

export const NORM_DOC_TYPE = 'norma';

/** Alias doc_type AI / job hint ? registry canonico `norma`. */
const NORM_DOC_TYPE_ALIASES = new Set(['norma_tecnica', 'norma tecnica']);

export function isNormDocType(docType) {
  const d = String(docType || '').trim().toLowerCase();
  if (d === NORM_DOC_TYPE) return true;
  return NORM_DOC_TYPE_ALIASES.has(d);
}

/**
 * Estrae un codice norma plausibile dal nome file (es. ISO_9606_1_2017.pdf).
 * @param {string} filename
 * @returns {string}
 */
export function guessStandardCodeFromFilename(filename) {
  const base = String(filename || '').replace(/\.pdf$/i, '').trim();
  if (!base) return '';
  // Underscore è \w in JS: \bISO\b non matcha "ISO_9001" — normalizzare prima del hint.
  const forHint = base.replace(/_/g, ' ');
  const normHint = /\b(ISO|IEC|EN|UNI|BS|DIN|AWS|ASME|CEN|AFNOR|ANSI)\b|D\.?\s*Lgs|decreto/i;
  if (!normHint.test(forHint)) return '';
  return forHint.replace(/\s+/g, ' ').trim();
}

/**
 * @param {string} code
 * @returns {number|null}
 */
export function extractEditionYearFromStandardCode(code) {
  const s = String(code || '');
  const colon = s.match(/:(\d{4})\b/);
  if (colon) return parseInt(colon[1], 10);
  const tail = s.match(/(?:^|[\s_])(\d{4})\s*$/);
  if (tail) return parseInt(tail[1], 10);
  return null;
}

/**
 * @param {string} code
 * @returns {string}
 */
export function guessIssuingBodyFromCode(code) {
  const u = String(code || '').toUpperCase().trim();
  if (u.startsWith('UNI')) return 'UNI';
  if (/^BS\s/.test(u) || u.includes(' BS ')) return 'BSI';
  if (/^D\.?\s*LGS|^DLGS/.test(u)) return 'altro';
  if (u.includes('ISO') || u.includes('IEC')) return 'ISO';
  if (u.startsWith('DIN')) return 'DIN';
  if (u.startsWith('AWS')) return 'AWS';
  if (u.startsWith('ASME')) return 'ASME';
  return '';
}

/**
 * @param {object|null} ai
 * @param {{ original_name?: string }|null} file
 * @returns {object}
 */
export function buildInitialNormTypeData(ai, file) {
  const tsd = { ...(ai?.type_specific_data || {}) };
  if (!String(tsd.standard_code || '').trim()) {
    const fromName = guessStandardCodeFromFilename(file?.original_name);
    if (fromName) tsd.standard_code = fromName;
  }
  if (tsd.edition_year == null || tsd.edition_year === '') {
    const y = extractEditionYearFromStandardCode(tsd.standard_code);
    if (y) tsd.edition_year = y;
  }
  if (!String(tsd.issuing_body || '').trim()) {
    const body = guessIssuingBodyFromCode(tsd.standard_code);
    if (body) tsd.issuing_body = body;
  }
  if (!String(tsd.norm_title || '').trim() && ai?.title) {
    tsd.norm_title = String(ai.title).trim();
  }
  return tsd;
}

/**
 * @param {object|null} ai
 * @param {{ original_name?: string }|null} file
 * @param {string} jobDocTypeHint
 */
export function buildCommitFormFromFile(ai, file, jobDocTypeHint = '') {
  const docType = ai?.document_type_guess || ai?.document_type || jobDocTypeHint || '';

  if (!isNormDocType(docType)) {
    return {
      isNorm: false,
      form: {
        title: ai?.title || file?.original_name || '',
        doc_type: docType,
        responsible: ai?.person_name || ai?.responsible || '',
        issue_date: ai?.issue_date || '',
        expiry_date: ai?.expiry_date || '',
        doc_code: ai?.doc_code || ai?.code || '',
        revision: ai?.revision || '',
        notes: '',
      },
      normLookup: { loading: false, result: null },
    };
  }

  const typeData = buildInitialNormTypeData(ai, file);
  const title = ai?.title || typeData.norm_title || file?.original_name || '';

  return {
    isNorm: true,
    form: {
      title,
      doc_type: NORM_DOC_TYPE,
      notes: '',
      typeData,
    },
    normLookup: { loading: false, result: null },
  };
}

/**
 * Applica esito norm-lookup ai campi tipo-specifici (vigore + link catalogo).
 * @param {object} typeData
 * @param {{ status?: string, catalogUrl?: string|null, checkedAt?: string, supersededBy?: string|null }|null} lookupResult
 */
export function applyNormLookupToTypeData(typeData, lookupResult) {
  const next = { ...typeData };
  if (lookupResult?.catalogUrl) {
    next.validity_check_url = lookupResult.catalogUrl;
  }
  if (lookupResult?.checkedAt) {
    next.last_validity_check = lookupResult.checkedAt;
  }
  if (!lookupResult || lookupResult.status === 'unknown') {
    next.validity_status = 'da_verificare';
    return next;
  }
  next.validity_status = lookupResult.status === 'active' ? 'vigente' : 'superata';
  if (lookupResult.supersededBy) {
    next.superseded_by = lookupResult.supersededBy;
  }
  return next;
}

/**
 * @param {object} typeData
 * @param {string} fallbackTitle
 */
export function formatNormCommitTitle(typeData, fallbackTitle) {
  const code = String(typeData?.standard_code || '').trim();
  const normTitle = String(typeData?.norm_title || '').trim();
  if (normTitle && code) {
    return normTitle.toUpperCase().includes(code.toUpperCase())
      ? normTitle
      : `${code} — ${normTitle}`;
  }
  return fallbackTitle || normTitle || code || 'Norma importata';
}

/**
 * Payload API commit per doc_type norma.
 * @param {{ title?: string, notes?: string, typeData?: object }} form
 */
export function buildNormCommitPayload(form) {
  const typeData = form.typeData || {};
  return {
    title: formatNormCommitTitle(typeData, form.title),
    doc_type: NORM_DOC_TYPE,
    type_specific_data: typeData,
    notes: form.notes?.trim() || null,
  };
}
