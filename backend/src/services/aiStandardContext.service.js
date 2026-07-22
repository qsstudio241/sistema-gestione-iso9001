/**
 * aiStandardContext.service.js — contesto norma attiva per assistente AI (slice 1 ADR-010)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Varianti codice norma accettate in norm_chunks / norm_requirements */
const STANDARD_ID_CODE_VARIANTS = {
  1: ['ISO_9001', 'ISO_9001_2015'],
  2: ['ISO_14001', 'ISO_14001_2015'],
  3: ['ISO_45001', 'ISO_45001_2018'],
  6: ['ISO_3834', 'ISO_3834_2', 'ISO_3834_2_2021'],
  7: ['RDP_MSN'],
};

/**
 * Carica profilo norma da tabella standards (master data, no org scope).
 * @param {number} standardId
 * @returns {Promise<object|null>}
 */
async function loadStandardProfile(standardId) {
  if (!standardId) return null;
  try {
    const result = await query(
      `SELECT standard_id, standard_code, standard_name, standard_full_name, version, category
       FROM standards
       WHERE standard_id = @id AND is_active = 1`,
      { id: standardId }
    );
    return (result.recordset || [])[0] || null;
  } catch (err) {
    logger.warn('[AI_STANDARD] loadStandardProfile failed:', err.message);
    return null;
  }
}

/**
 * Codici norma da usare per filtrare norm_chunks.
 * @param {object|null} standard - riga standards
 * @returns {string[]}
 */
function resolveStandardCodesForFilter(standard) {
  if (!standard) return [];
  const variants = STANDARD_ID_CODE_VARIANTS[standard.standard_id] || [];
  const codes = new Set();
  if (standard.standard_code) codes.add(standard.standard_code);
  for (const code of variants) codes.add(code);
  return [...codes];
}

/**
 * Blocco testuale per arricchire il system prompt con la norma attiva.
 * @param {object|null} standard
 * @returns {string}
 */
function buildStandardContextBlock(standard) {
  if (!standard) return '';
  const lines = ['\n\n--- NORMA ATTIVA ---'];
  const label = standard.standard_full_name || standard.standard_name || standard.standard_code;
  lines.push(`Norma: ${label}`);
  if (standard.standard_code) lines.push(`Codice: ${standard.standard_code}`);
  if (standard.version) lines.push(`Versione: ${standard.version}`);
  lines.push('--- FINE NORMA ATTIVA ---');
  lines.push(
    'Le domande dell\'utente si riferiscono a questa norma. '
    + 'Filtra audit, NC, documenti e riferimenti di conseguenza; '
    + 'se un dato non è legato a questa norma, non presentarlo come pertinente.'
  );
  return lines.join('\n');
}

module.exports = {
  loadStandardProfile,
  resolveStandardCodesForFilter,
  buildStandardContextBlock,
  STANDARD_ID_CODE_VARIANTS,
};
