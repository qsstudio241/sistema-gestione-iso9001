const logger = require('../utils/logger');

let localConnector = null;
let publicLawConnector = null;

function getLocalConnector() {
  if (!localConnector) localConnector = require('./normConnectors/localStoreConnector');
  return localConnector;
}

/**
 * Connettore secondario (publicLaw / normativaConnector) — opzionale.
 * Restituisce null se non configurato o non applicabile allo standard richiesto.
 */
function getPublicLawConnector() {
  if (!publicLawConnector) {
    try {
      publicLawConnector = require('./normConnectors/normativaConnector');
    } catch {
      publicLawConnector = null;
    }
  }
  return publicLawConnector;
}

/**
 * Registra accesso a norma da fonte non locale.
 * Inserisce in norm_access_log (graceful: se tabella non esiste, loga warn e continua).
 */
async function logNormAccess(organizationId, standardCode, source) {
  try {
    const { query } = require('../config/database');
    await query(
      `INSERT INTO norm_access_log (organization_id, standard_code, source, created_at)
       VALUES (@orgId, @stdCode, @source, GETDATE())`,
      { orgId: organizationId || 0, stdCode: standardCode, source }
    );
  } catch (err) {
    logger.warn('[NormBroker] norm_access_log insert failed (table may not exist yet):', err.message);
  }
}

/**
 * Search for a clause in a specific standard — cascata 2 step:
 *   1. localStoreConnector
 *   2. publicLaw connector (se configurato e applicabile)
 *   3. null + log
 *
 * @param {string} standardCode - e.g. 'ISO_9001_2015'
 * @param {string} clauseRef - e.g. '8.4.2'
 * @param {{ organizationId?: number }} [opts]
 * @returns {Promise<{text, title, fullRef, source} | null>}
 */
async function getClauseText(standardCode, clauseRef, opts = {}) {
  const organizationId = opts.organizationId || 0;

  // Step 1 — local DB
  const local = await getLocalConnector().getClauseText(standardCode, clauseRef);
  if (local) return { ...local, source: 'local_db' };

  // Step 2 — publicLaw connector (se configurato)
  const plc = getPublicLawConnector();
  if (plc && typeof plc.getClauseText === 'function') {
    try {
      const remote = await plc.getClauseText(standardCode, clauseRef);
      if (remote) {
        const hit = { ...remote, source: 'public_law' };
        await logNormAccess(organizationId, standardCode, 'public_law');
        return hit;
      }
    } catch (err) {
      logger.warn('[NormBroker] publicLaw connector error:', err.message);
    }
  }

  logger.info(`[NormBroker] Clause ${standardCode} ref=${clauseRef} not found in any source`);
  return null;
}

/** Codice stabile per API / UI quando il testo normativo non è in archivio. */
const NORM_ABSENT_CODE = 'NORM_TEXT_ABSENT';

function formatNormRef(standardCode, clauseRef) {
  const std = String(standardCode || '').trim()
    ? String(standardCode).replace(/_/g, ' ')
    : 'norma richiesta';
  if (clauseRef && String(clauseRef).trim()) {
    return `${std} §${String(clauseRef).trim()}`;
  }
  return std;
}

/**
 * Messaggio prodotto stabile (italiano, UTF-8) quando manca il testo normativo.
 * Non inventa clausole; indica il percorso operativo (Registro / ingest / studio).
 *
 * @param {{ standardCode?: string, clauseRef?: string, kind?: 'clause'|'standard' }} [opts]
 * @returns {string}
 */
function buildNormAbsentMessage(opts = {}) {
  const { standardCode, clauseRef, kind } = opts;
  const ref = formatNormRef(standardCode, kind === 'standard' ? null : clauseRef);
  const subject = kind === 'standard'
    ? `Lo standard ${ref} non è presente nell'archivio locale.`
    : `Il testo di ${ref} non è presente nell'archivio locale.`;
  return (
    `${subject} Non valuto a caso e non invento clausole. ` +
    'Percorso: Registro Documenti, cartella NORME E LEGGI, poi Carica norme (ingest PDF), ' +
    'oppure chiedi allo studio il PDF ufficiale da digitalizzare.'
  );
}

/**
 * Contratto unico: hit + flag + messaggio onesto (mai testo normativo inventato).
 *
 * @param {string} standardCode
 * @param {string} clauseRef
 * @param {{ organizationId?: number }} [opts]
 * @returns {Promise<{
 *   hit: object|null,
 *   textAvailable: boolean,
 *   absentMessage: string|null,
 *   code: string|null
 * }>}
 */
async function resolveClauseText(standardCode, clauseRef, opts = {}) {
  let hit = null;
  try {
    hit = await getClauseText(standardCode, clauseRef, opts);
  } catch (err) {
    logger.warn(`[NormBroker] resolveClauseText failed for ${standardCode} ${clauseRef}:`, err.message);
    hit = null;
  }
  const textAvailable = !!(hit && hit.text && String(hit.text).trim());
  if (textAvailable) {
    return { hit, textAvailable: true, absentMessage: null, code: null };
  }
  return {
    hit: null,
    textAvailable: false,
    absentMessage: buildNormAbsentMessage({ standardCode, clauseRef, kind: 'clause' }),
    code: NORM_ABSENT_CODE,
  };
}

/**
 * Standard intero assente (nessuna clausola in archivio).
 * @param {string} standardCode
 * @returns {{ textAvailable: false, absentMessage: string, code: string, standardCode: string }}
 */
function resolveStandardAbsent(standardCode) {
  return {
    textAvailable: false,
    absentMessage: buildNormAbsentMessage({ standardCode, kind: 'standard' }),
    code: NORM_ABSENT_CODE,
    standardCode: standardCode || null,
  };
}

/**
 * Get all clauses for a standard.
 * @param {string} standardCode
 * @param {{ organizationId?: number }} [opts]
 * @returns {Promise<Array<{clause_ref, clause_title, requirement_text}>>}
 */
async function getFullNorm(standardCode, opts = {}) {
  return getLocalConnector().getFullNorm(standardCode);
}

/**
 * Search clauses by keyword across all standards or a specific one.
 * @param {string} keyword
 * @param {string} [standardCode] - optional filter
 * @returns {Promise<Array<{standard_code, clause_ref, clause_title, requirement_text}>>}
 */
async function searchClauses(keyword, standardCode) {
  return getLocalConnector().searchClauses(keyword, standardCode);
}

/**
 * List all available standards in the local store.
 * @returns {Promise<Array<{standard_code, clause_count}>>}
 */
async function listAvailableStandards() {
  return getLocalConnector().listAvailableStandards();
}

module.exports = {
  getClauseText,
  getFullNorm,
  searchClauses,
  listAvailableStandards,
  logNormAccess,
  buildNormAbsentMessage,
  resolveClauseText,
  resolveStandardAbsent,
  NORM_ABSENT_CODE,
};
