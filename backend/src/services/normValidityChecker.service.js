/**
 * normValidityChecker.service.js
 * Verifica periodica della validità delle norme caricate (fonti AI + cataloghi pubblici).
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
 * Esegue la verifica di validità per tutte le norme vigenti di un'organizzazione.
 * @returns {Promise<{ checked: number, updated: Array<object> }>}
 */
async function runScheduledValidityCheck(organizationId) {
  logger.info(`[NormValidityChecker] Avvio verifica per org ${organizationId}...`);

  let norms;
  try {
    const statusList = VIGENT_STATUSES.map((s) => `'${s}'`).join(', ');
    const result = await query(
      `SELECT id, standard_code, edition_year, issuing_body, norm_title, document_id
       FROM norm_document_sources
       WHERE organization_id = @orgId
         AND standard_code IS NOT NULL
         AND (validity_status IS NULL OR validity_status IN (${statusList}))`,
      { orgId: organizationId }
    );
    norms = result.recordset || [];
  } catch (err) {
    logger.error('[NormValidityChecker] Errore query norme:', err.message);
    return { checked: 0, updated: [] };
  }

  if (norms.length === 0) {
    logger.info(`[NormValidityChecker] Nessuna norma vigente per org ${organizationId}`);
    return { checked: 0, updated: [] };
  }

  const updated = [];

  for (const norm of norms) {
    const check = await checkNormValidity(
      norm.standard_code,
      norm.edition_year,
      norm.issuing_body
    );

    if (check.outdated) {
      try {
        await query(
          `UPDATE norm_document_sources
           SET validity_status = 'superata',
               last_validity_check = GETDATE(),
               validity_check_url = @url,
               updated_at = GETDATE()
           WHERE id = @id AND organization_id = @orgId`,
          {
            id: norm.id,
            orgId: organizationId,
            url: check.catalogUrl || null,
          }
        );
        updated.push({
          id: norm.id,
          document_id: norm.document_id,
          standard_code: norm.standard_code,
          norm_title: norm.norm_title,
          reason: check.reason,
          supersededBy: check.supersededBy || null,
          catalogUrl: check.catalogUrl || null,
        });
        logger.info(`[NormValidityChecker] ${norm.standard_code}: SUPERATA (${check.reason})`);
      } catch (err) {
        logger.error(`[NormValidityChecker] Errore aggiornamento ${norm.standard_code}:`, err.message);
      }
    } else {
      try {
        await query(
          `UPDATE norm_document_sources
           SET last_validity_check = GETDATE(),
               validity_check_url = @url,
               updated_at = GETDATE()
           WHERE id = @id AND organization_id = @orgId`,
          {
            id: norm.id,
            orgId: organizationId,
            url: check.catalogUrl || null,
          }
        );
      } catch (err) {
        logger.debug(`[NormValidityChecker] Errore timestamp ${norm.standard_code}:`, err.message);
      }
    }
  }

  logger.info(
    `[NormValidityChecker] Verifica org ${organizationId} completata: ${norms.length} controllate, ${updated.length} superate`
  );

  return { checked: norms.length, updated };
}

module.exports = { checkNormValidity, checkUniEditionYear, runScheduledValidityCheck };
