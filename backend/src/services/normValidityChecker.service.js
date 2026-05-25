/**
 * normValidityChecker.service.js
 * Verifica periodica della validità delle norme.
 *
 * Fonte di verità: document_registry (doc_type = 'norma').
 * Se esiste una riga collegata in norm_document_sources (document_id = dr.id),
 * viene aggiornata in mirror per retrocompatibilità fino a R5.
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');
const normCatalog = require('./normCatalogLookup.service');

const CATALOG_BASE = 'https://store.uni.com/catalogo';
const FETCH_TIMEOUT_MS = 10000;

/**
 * Fallback UNI: confronto anno edizione su store.uni.com (norme tecniche).
 */
async function checkUniEditionYear(standardCode, editionYear) {
  try {
    const searchTerm = standardCode.replace(/_/g, '+');
    const url = `${CATALOG_BASE}?q=${encodeURIComponent(searchTerm)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'SGQ-NormChecker/1.0' },
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      return { outdated: false, error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const yearPattern = /\b(20\d{2})\b/g;
    const foundYears = new Set();
    let match;
    while ((match = yearPattern.exec(html)) !== null) {
      const y = parseInt(match[1], 10);
      if (y >= 2000 && y <= 2099) foundYears.add(y);
    }

    if (foundYears.size === 0) {
      return { outdated: false, error: 'Nessun anno trovato nella pagina catalogo' };
    }

    const latestYear = Math.max(...foundYears);
    if (editionYear && latestYear > editionYear) {
      return { outdated: true, latestYear, catalogUrl: url };
    }

    return { outdated: false, latestYear, catalogUrl: url };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Timeout connessione catalogo UNI' : err.message;
    return { outdated: false, error: msg };
  }
}

/**
 * Verifica una singola norma tramite catalogo ente / Normattiva / EUR-Lex.
 */
async function checkNormValidity(standardCode, editionYear, issuingBody) {
  const lookup = await normCatalog.lookupNormStatus(standardCode, issuingBody || '');

  if (lookup.status === 'withdrawn' || lookup.status === 'superseded') {
    return {
      outdated: true,
      reason: lookup.status,
      supersededBy: lookup.supersededBy,
      catalogUrl: lookup.catalogUrl,
    };
  }

  if (lookup.status === 'active') {
    return { outdated: false, catalogUrl: lookup.catalogUrl };
  }

  // Sconosciuto: fallback UNI per codici tecnici con anno edizione
  const uniFallback = await checkUniEditionYear(standardCode, editionYear);
  if (uniFallback.outdated) {
    return {
      outdated: true,
      reason: 'edition_superseded',
      latestYear: uniFallback.latestYear,
      catalogUrl: uniFallback.catalogUrl,
    };
  }

  return {
    outdated: false,
    catalogUrl: lookup.catalogUrl || uniFallback.catalogUrl,
    error: lookup.error || uniFallback.error,
  };
}

const VIGENT_STATUSES = ['vigente', 'rilasciato'];

/**
 * Estrae i campi norma dal JSON type_specific_data di una riga document_registry.
 * @param {{ type_specific_data: string|null }} row
 * @returns {{ standard_code: string|null, edition_year: number|null, issuing_body: string|null, validity_status: string|null }}
 */
function parseNormFieldsFromRegistry(row) {
  let tsd = {};
  if (row.type_specific_data) {
    try {
      tsd = JSON.parse(row.type_specific_data);
    } catch (_) {
      // JSON malformato: trattare come vuoto
    }
  }
  return {
    standard_code: tsd.standard_code || null,
    edition_year: tsd.edition_year ? parseInt(tsd.edition_year, 10) : null,
    issuing_body: tsd.issuing_body || null,
    validity_status: tsd.validity_status || null,
  };
}

/**
 * Esegue la verifica di validità per tutte le norme in document_registry
 * con standard_code valorizzato.
 * Aggiorna type_specific_data (merge JSON) e, in mirror, norm_document_sources
 * se la riga è collegata tramite document_id.
 *
 * @returns {Promise<{ checked: number, updated: Array<object> }>}
 */
async function runScheduledValidityCheck(organizationId) {
  logger.info(`[NormValidityChecker] Avvio verifica per org ${organizationId}...`);

  const statusList = VIGENT_STATUSES.map((s) => `'${s}'`).join(', ');

  let norms;
  try {
    const result = await query(
      `SELECT
         dr.id          AS dr_id,
         dr.title       AS dr_title,
         dr.doc_code    AS dr_doc_code,
         dr.type_specific_data,
         nds.id         AS nds_id
       FROM document_registry dr
       LEFT JOIN norm_document_sources nds ON nds.document_id = dr.id
                                           AND nds.organization_id = @orgId
       WHERE dr.doc_type = 'norma'
         AND dr.organization_id = @orgId
         AND JSON_VALUE(dr.type_specific_data, '$.standard_code') IS NOT NULL
         AND (
           JSON_VALUE(dr.type_specific_data, '$.validity_status') IS NULL
           OR JSON_VALUE(dr.type_specific_data, '$.validity_status') IN (${statusList})
         )`,
      { orgId: organizationId }
    );
    norms = result.recordset || [];
  } catch (err) {
    logger.error('[NormValidityChecker] Errore query norme da document_registry:', err.message);
    return { checked: 0, updated: [] };
  }

  if (norms.length === 0) {
    logger.info(`[NormValidityChecker] Nessuna norma da verificare per org ${organizationId}`);
    return { checked: 0, updated: [] };
  }

  const updated = [];
  const nowIso = new Date().toISOString();

  for (const norm of norms) {
    const fields = parseNormFieldsFromRegistry(norm);

    if (!fields.standard_code) {
      continue;
    }

    const check = await checkNormValidity(
      fields.standard_code,
      fields.edition_year,
      fields.issuing_body
    );

    const newValidityStatus = check.outdated ? 'superata' : (fields.validity_status || 'vigente');
    const checkUrl = check.catalogUrl || null;
    const supersededBy = check.outdated ? (check.supersededBy || null) : null;

    // --- Aggiorna document_registry tramite merge JSON_MODIFY ---
    try {
      await query(
        `UPDATE document_registry
         SET type_specific_data = JSON_MODIFY(
               JSON_MODIFY(
                 JSON_MODIFY(
                   JSON_MODIFY(
                     ISNULL(type_specific_data, '{}'),
                     '$.validity_status',    @validityStatus
                   ),
                   '$.last_validity_check', @lastCheck
                 ),
                 '$.validity_check_url',  @checkUrl
               ),
               '$.superseded_by',        @supersededBy
             ),
             updated_at = GETDATE()
         WHERE id = @drId AND organization_id = @orgId`,
        {
          drId: norm.dr_id,
          orgId: organizationId,
          validityStatus: newValidityStatus,
          lastCheck: nowIso,
          checkUrl,
          supersededBy,
        }
      );
    } catch (err) {
      logger.error(
        `[NormValidityChecker] Errore UPDATE document_registry id=${norm.dr_id} (${fields.standard_code}):`,
        err.message
      );
      continue;
    }

    // --- Mirror su norm_document_sources (retrocompatibilità) ---
    if (norm.nds_id) {
      try {
        if (check.outdated) {
          await query(
            `UPDATE norm_document_sources
             SET validity_status    = 'superata',
                 last_validity_check = GETDATE(),
                 validity_check_url  = @url,
                 updated_at          = GETDATE()
             WHERE id = @id AND organization_id = @orgId`,
            { id: norm.nds_id, orgId: organizationId, url: checkUrl }
          );
        } else {
          await query(
            `UPDATE norm_document_sources
             SET last_validity_check = GETDATE(),
                 validity_check_url  = @url,
                 updated_at          = GETDATE()
             WHERE id = @id AND organization_id = @orgId`,
            { id: norm.nds_id, orgId: organizationId, url: checkUrl }
          );
        }
      } catch (err) {
        logger.debug(
          `[NormValidityChecker] Mirror norm_document_sources id=${norm.nds_id} fallito:`,
          err.message
        );
      }
    }

    if (check.outdated) {
      updated.push({
        dr_id: norm.dr_id,
        nds_id: norm.nds_id || null,
        doc_code: norm.dr_doc_code,
        title: norm.dr_title,
        standard_code: fields.standard_code,
        reason: check.reason,
        supersededBy,
        catalogUrl: checkUrl,
      });
      logger.info(`[NormValidityChecker] ${fields.standard_code}: SUPERATA (${check.reason})`);
    }
  }

  logger.info(
    `[NormValidityChecker] Verifica org ${organizationId} completata: ${norms.length} controllate, ${updated.length} superate`
  );

  return { checked: norms.length, updated };
}

module.exports = {
  checkNormValidity,
  checkUniEditionYear,
  parseNormFieldsFromRegistry,
  runScheduledValidityCheck,
};
