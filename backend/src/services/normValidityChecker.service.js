/**
 * normValidityChecker.service.js
 * Verifica periodica della validit� delle norme caricate, confrontando
 * l'edizione locale con il catalogo UNI pubblico (store.uni.com).
 */

const logger = require('../utils/logger');
const { query } = require('../config/database');

const CATALOG_BASE = 'https://store.uni.com/catalogo';
const FETCH_TIMEOUT_MS = 10000;

/**
 * Interroga il catalogo UNI e confronta l'anno edizione.
 * @param {string} standardCode - es. "ISO_19011_2018"
 * @param {number} editionYear  - anno edizione locale
 * @returns {Promise<{outdated: boolean, latestYear?: number, error?: string}>}
 */
async function checkNormValidity(standardCode, editionYear) {
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

    // Look for 4-digit years (20XX pattern) in product titles/headings
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
      return { outdated: true, latestYear };
    }

    return { outdated: false, latestYear };
  } catch (err) {
    const msg = err.name === 'AbortError' ? 'Timeout connessione catalogo UNI' : err.message;
    logger.warn(`[NormValidityChecker] Errore per ${standardCode}:`, msg);
    return { outdated: false, error: msg };
  }
}

/**
 * Esegue la verifica di validit� per tutte le norme "vigenti" di un'organizzazione.
 * Le norme superate vengono aggiornate a validity_status='superata'.
 * @param {number} organizationId
 */
async function runScheduledValidityCheck(organizationId) {
  logger.info(`[NormValidityChecker] Avvio verifica per org ${organizationId}...`);

  let norms;
  try {
    const result = await query(
      `SELECT id, standard_code, edition_year
       FROM norm_document_sources
       WHERE validity_status = 'vigente'
         AND organization_id = @orgId
         AND standard_code IS NOT NULL`,
      { orgId: organizationId }
    );
    norms = result.recordset || [];
  } catch (err) {
    logger.error('[NormValidityChecker] Errore query norme:', err.message);
    return;
  }

  if (norms.length === 0) {
    logger.info(`[NormValidityChecker] Nessuna norma vigente per org ${organizationId}`);
    return;
  }

  let updatedCount = 0;
  for (const norm of norms) {
    const check = await checkNormValidity(norm.standard_code, norm.edition_year);

    if (check.outdated) {
      try {
        await query(
          `UPDATE norm_document_sources
           SET validity_status = 'superata',
               last_validity_check = GETDATE(),
               validity_check_url = @url,
               updated_at = GETDATE()
           WHERE id = @id`,
          {
            id: norm.id,
            url: `${CATALOG_BASE}?q=${encodeURIComponent(norm.standard_code.replace(/_/g, '+'))}`,
          }
        );
        updatedCount++;
        logger.info(`[NormValidityChecker] ${norm.standard_code}: SUPERATA (locale ${norm.edition_year} ? catalogo ${check.latestYear})`);
      } catch (err) {
        logger.error(`[NormValidityChecker] Errore aggiornamento ${norm.standard_code}:`, err.message);
      }
    } else {
      try {
        await query(
          `UPDATE norm_document_sources
           SET last_validity_check = GETDATE(), updated_at = GETDATE()
           WHERE id = @id`,
          { id: norm.id }
        );
      } catch (err) {
        logger.debug(`[NormValidityChecker] Errore aggiornamento timestamp ${norm.standard_code}:`, err.message);
      }
    }
  }

  logger.info(`[NormValidityChecker] Verifica org ${organizationId} completata: ${norms.length} norme controllate, ${updatedCount} superate`);
}

module.exports = { checkNormValidity, runScheduledValidityCheck };
