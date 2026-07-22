/**
 * ingestReferencePattern.service.js — Livello B (ADR-017)
 * Pattern anonimi cross-tenant da correzioni ingest, senza PII.
 */

'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Campi ammessi per aggregazione federata (no nomi, certificati, note). */
const REFERENCE_PATTERN_ALLOWLIST = new Set([
  'standard_code',
  'edition_year',
  'issuing_body',
  'norm_title',
  'material_group',
  'welding_process',
  'iso_4063_position',
  'product_type',
  'joint_type',
  'filler_material',
  'base_material',
  'base_material_group',
  'qualification_designation',
  'wpqr_number',
  'reference_number',
  'validity_status',
]);

const MAX_PATTERN_LEN = 500;
const MIN_FROM_LEN = 2;

/**
 * @param {string} value
 * @returns {string|null}
 */
function normalizePatternValue(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s || s.length < MIN_FROM_LEN) return null;
  if (s.length > MAX_PATTERN_LEN) return s.substring(0, MAX_PATTERN_LEN);
  return s;
}

/**
 * @param {string} fieldKey
 * @param {unknown} value
 * @returns {boolean}
 */
function isSafeReferenceValue(fieldKey, value) {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/@/.test(s)) return false;
  if (/\b\d{11,16}\b/.test(s)) return false;
  if (fieldKey === 'norm_title' && s.length > 300) return false;
  return true;
}

/**
 * Estrae pattern upsertabili da field_diffs.
 * @param {object} fieldDiffs
 * @returns {Array<{ field_key: string, from_pattern: string, to_pattern: string }>}
 */
function extractPatternsFromDiffs(fieldDiffs = {}) {
  const out = [];
  for (const [key, diff] of Object.entries(fieldDiffs || {})) {
    if (!REFERENCE_PATTERN_ALLOWLIST.has(key)) continue;
    const from = normalizePatternValue(diff?.ai);
    const to = normalizePatternValue(diff?.human);
    if (!from || !to || from === to) continue;
    if (!isSafeReferenceValue(key, from) || !isSafeReferenceValue(key, to)) continue;
    out.push({ field_key: key, from_pattern: from, to_pattern: to });
  }
  return out;
}

/**
 * @param {string} docType
 * @param {object} fieldDiffs
 */
async function upsertPatternsFromFeedback(docType, fieldDiffs) {
  if (!docType) return { upserted: 0 };

  const patterns = extractPatternsFromDiffs(fieldDiffs);
  let upserted = 0;

  for (const p of patterns) {
    try {
      await query(`
        MERGE dbo.ingest_reference_patterns AS tgt
        USING (SELECT @docType AS doc_type, @fieldKey AS field_key,
                      @fromPattern AS from_pattern, @toPattern AS to_pattern) AS src
        ON tgt.doc_type = src.doc_type
           AND tgt.field_key = src.field_key
           AND tgt.from_pattern = src.from_pattern
           AND tgt.to_pattern = src.to_pattern
        WHEN MATCHED THEN
          UPDATE SET hit_count = tgt.hit_count + 1, last_seen_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
          INSERT (doc_type, field_key, from_pattern, to_pattern, hit_count, last_seen_at, created_at)
          VALUES (src.doc_type, src.field_key, src.from_pattern, src.to_pattern, 1, SYSUTCDATETIME(), SYSUTCDATETIME());
      `, {
        docType,
        fieldKey: p.field_key,
        fromPattern: p.from_pattern,
        toPattern: p.to_pattern,
      });
      upserted += 1;
    } catch (err) {
      logger.warn('[ingestReferencePattern] upsert skip', { docType, field: p.field_key, error: err.message });
    }
  }

  return { upserted };
}

/**
 * Pattern più frequenti per doc_type (Livello B).
 * @param {string} docType
 * @param {number} [limit]
 */
async function getTopReferencePatterns(docType, limit = 5) {
  if (!docType) return [];

  try {
    const result = await query(`
      SELECT TOP (@limit)
        field_key, from_pattern, to_pattern, hit_count
      FROM dbo.ingest_reference_patterns
      WHERE doc_type = @docType
      ORDER BY hit_count DESC, last_seen_at DESC
    `, { docType, limit: Math.min(limit, 10) });

    return result.recordset || [];
  } catch (err) {
    if (/Invalid object name/i.test(err.message)) {
      logger.debug('[ingestReferencePattern] tabella assente (mig. 120 non eseguita)');
      return [];
    }
    throw err;
  }
}

/**
 * @param {Array} patterns
 * @returns {string}
 */
function formatReferencePatternsPromptSection(patterns) {
  if (!patterns || patterns.length === 0) return '';

  const lines = patterns.map((p, i) =>
    `${i + 1}. Campo "${p.field_key}": se vedi formato simile a "${p.from_pattern}", preferisci "${p.to_pattern}" (confermato ${p.hit_count}× in piattaforma).`
  );

  return `

Pattern di riferimento settore (compliance — non copiare valori assenti nel documento corrente):
${lines.join('\n')}`;
}

module.exports = {
  REFERENCE_PATTERN_ALLOWLIST,
  extractPatternsFromDiffs,
  upsertPatternsFromFeedback,
  getTopReferencePatterns,
  formatReferencePatternsPromptSection,
  normalizePatternValue,
};
