/**
 * normCodesImport.service.js
 * Import batch di norme/leggi da lista codici (senza PDF obbligatorio).
 * Lookup catalogo ? bozza in document_registry con type_specific_data canonico.
 */

'use strict';

const { query } = require('../config/database');
const logger = require('../utils/logger');
const normCatalog = require('./normCatalogLookup.service');
const normattivaConnector = require('./normConnectors/normativaConnector');
const eurLexConnector = require('./normConnectors/eurLexConnector');
const {
  buildNormTypeSpecificData,
  serializeNormTypeSpecificData,
} = require('./documentRegistryNorm.service');

const MAX_CODES_PER_REQUEST = 50;

/**
 * @param {string|string[]|null|undefined} raw
 * @returns {string[]}
 */
function parseCodeLines(raw) {
  if (!raw) return [];
  const lines = Array.isArray(raw) ? raw : String(raw).split(/\r?\n/);
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const code = String(line || '').trim();
    if (!code) continue;
    const key = code.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(code);
  }

  return out;
}

/**
 * @param {string} standardCode
 * @returns {string}
 */
function inferIssuingBody(standardCode) {
  const code = String(standardCode || '').trim();
  if (!code) return 'ISO';

  if (normattivaConnector.isItalianPublicLaw(code, '')) return 'IT';
  if (eurLexConnector.isEuLegislation(code, '')) return 'UE';

  const upper = code.toUpperCase();
  if (/\bBSI\b/.test(upper) || /^BS[\s\-]/.test(upper)) return 'BSI';
  if (/\bUNI\b/.test(upper) || /^UNI[\s\-]/.test(upper)) return 'UNI';
  if (/\bDIN\b/.test(upper)) return 'DIN';
  if (/\bCEN\b/.test(upper) || /\bEN[\s\-]/.test(upper)) return 'EN';
  return 'ISO';
}

/**
 * @param {string} standardCode
 * @returns {number|null}
 */
function parseEditionYearFromCode(standardCode) {
  const code = String(standardCode || '').trim();
  if (!code) return null;

  const colonMatch = code.match(/:(\d{4})\b/);
  if (colonMatch) return parseInt(colonMatch[1], 10);

  const slashMatch = code.match(/\/(\d{4})\b/);
  if (slashMatch) return parseInt(slashMatch[1], 10);

  const years = code.match(/\b(19|20)\d{2}\b/g);
  if (years && years.length > 0) {
    return parseInt(years[years.length - 1], 10);
  }

  return null;
}

/**
 * @param {{ status?: string, supersededBy?: string|null, catalogUrl?: string|null, checkedAt?: string }} lookup
 * @returns {string}
 */
function catalogStatusToValidity(lookup) {
  const status = lookup?.status || 'unknown';
  if (status === 'active') return 'vigente';
  if (status === 'withdrawn' || status === 'superseded') return 'superata';
  return 'vigente';
}

/**
 * @param {number} orgId
 * @param {string} standardCode
 * @returns {Promise<{ id: number, title: string }|null>}
 */
async function findExistingNormByCode(orgId, standardCode) {
  const result = await query(
    `SELECT id, title
     FROM document_registry
     WHERE organization_id = @orgId
       AND doc_type = 'norma'
       AND ISNULL(status, 'rilasciato') <> 'obsoleto'
       AND LOWER(LTRIM(RTRIM(JSON_VALUE(type_specific_data, '$.standard_code')))) = LOWER(LTRIM(@code))`,
    { orgId, code: standardCode }
  );
  return result.recordset[0] || null;
}

/**
 * @param {number} orgId
 * @returns {Promise<number|null>}
 */
async function resolveNormFolderId(orgId, folderId) {
  if (folderId) {
    const explicit = await query(
      `SELECT id FROM document_registry
       WHERE id = @folderId AND organization_id = @orgId AND doc_type = 'folder'`,
      { folderId, orgId }
    );
    if (explicit.recordset.length > 0) return explicit.recordset[0].id;
  }

  const folderResult = await query(
    `SELECT id FROM document_registry
     WHERE folder_code = '2.3'
       AND organization_id = @orgId
       AND is_system_folder = 1`,
    { orgId }
  );
  return folderResult.recordset[0]?.id ?? null;
}

/**
 * @param {number} orgId
 * @param {number} userId
 * @param {string[]} codes
 * @param {{ folderId?: number|null }} [options]
 */
async function importNormCodes(orgId, userId, codes, options = {}) {
  const parsedCodes = parseCodeLines(codes);
  if (parsedCodes.length === 0) {
    return {
      summary: { total: 0, created: 0, duplicates: 0, errors: 0 },
      results: [],
    };
  }

  if (parsedCodes.length > MAX_CODES_PER_REQUEST) {
    const err = new Error(`Massimo ${MAX_CODES_PER_REQUEST} codici per richiesta`);
    err.code = 'TOO_MANY_CODES';
    throw err;
  }

  const normFolderId = await resolveNormFolderId(orgId, options.folderId);
  if (!normFolderId) {
    const err = new Error('Cartella "NORME E LEGGI" (folder_code 2.3) non trovata');
    err.code = 'NORM_FOLDER_NOT_FOUND';
    throw err;
  }

  const results = [];
  let created = 0;
  let duplicates = 0;
  let errors = 0;

  for (const code of parsedCodes) {
    const entry = {
      code,
      status: 'error',
      documentId: null,
      existingDocumentId: null,
      lookupStatus: null,
      validityStatus: null,
      catalogUrl: null,
      message: null,
    };

    try {
      const existing = await findExistingNormByCode(orgId, code);
      if (existing) {
        entry.status = 'duplicate';
        entry.existingDocumentId = existing.id;
        entry.message = `Codice già presente: "${existing.title}" (id ${existing.id})`;
        duplicates += 1;
        results.push(entry);
        continue;
      }

      const issuingBody = inferIssuingBody(code);
      const lookup = await normCatalog.lookupNormStatus(code, issuingBody);
      entry.lookupStatus = lookup.status || 'unknown';
      entry.catalogUrl = lookup.catalogUrl || null;

      const validityStatus = catalogStatusToValidity(lookup);
      entry.validityStatus = validityStatus;

      const editionYear = parseEditionYearFromCode(code);
      const typeSpecificData = serializeNormTypeSpecificData({
        standard_code: code,
        issuing_body: issuingBody,
        edition_year: editionYear,
        validity_status: validityStatus,
        last_validity_check: lookup.checkedAt || new Date().toISOString(),
        validity_check_url: lookup.catalogUrl || null,
        superseded_by: lookup.supersededBy || null,
      });

      if (!typeSpecificData) {
        entry.message = 'Codice non valido';
        errors += 1;
        results.push(entry);
        continue;
      }

      const docResult = await query(
        `INSERT INTO document_registry (
           organization_id, parent_id, title, doc_type, status,
           is_system_folder, issue_date, type_specific_data,
           created_by, created_at, updated_at
         )
         OUTPUT INSERTED.id
         VALUES (
           @orgId, @parentId, @title, 'norma', 'bozza',
           0,
           CASE WHEN @editionYear IS NOT NULL
                THEN DATEFROMPARTS(@editionYear, 1, 1)
                ELSE NULL END,
           @typeSpecificData,
           @userId, GETDATE(), GETDATE()
         )`,
        {
          orgId,
          parentId: normFolderId,
          title: code.substring(0, 255),
          editionYear,
          typeSpecificData,
          userId,
        }
      );

      const documentId = docResult.recordset[0].id;
      entry.status = lookup.status === 'unknown' ? 'created_with_warning' : 'created';
      entry.documentId = documentId;
      if (lookup.status === 'unknown') {
        entry.message = 'Creato; verifica catalogo non disponibile (controllare manualmente o attendere job settimanale)';
      }
      created += 1;
      results.push(entry);

      logger.info('[NormCodesImport] Norma creata da codice', {
        organization_id: orgId,
        documentId,
        code,
        lookupStatus: lookup.status,
        validityStatus,
      });
    } catch (err) {
      entry.message = err.message || 'Errore interno';
      errors += 1;
      results.push(entry);
      logger.warn('[NormCodesImport] Errore su codice', { code, error: err.message });
    }
  }

  return {
    summary: {
      total: parsedCodes.length,
      created,
      duplicates,
      errors,
      warnings: results.filter((r) => r.status === 'created_with_warning').length,
    },
    results,
  };
}

module.exports = {
  MAX_CODES_PER_REQUEST,
  parseCodeLines,
  inferIssuingBody,
  parseEditionYearFromCode,
  catalogStatusToValidity,
  findExistingNormByCode,
  importNormCodes,
};
