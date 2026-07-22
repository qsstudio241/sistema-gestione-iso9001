const logger = require('../utils/logger');

/**
 * Carica il profilo organizzazione/studio per arricchire i prompt AI.
 * @param {number} organizationId
 * @returns {Promise<object|null>}
 */
async function loadOrganizationProfile(organizationId) {
  if (!organizationId) return null;
  try {
    const { query } = require('../config/database');
    const result = await query(
      `SELECT organization_id, organization_code, organization_name,
              vat_number, audit_report_prefix, ai_context_notes
       FROM dbo.organizations
       WHERE organization_id = @orgId AND is_active = 1`,
      { orgId: organizationId }
    );
    return (result.recordset || [])[0] || null;
  } catch (err) {
    logger.warn('[AI_ORG_CONTEXT] loadOrganizationProfile failed:', err.message);
    return null;
  }
}

/**
 * Blocco testuale da appendere al system prompt (Livello 1 — studio).
 * @param {object|null} profile
 * @returns {string}
 */
function buildOrganizationContextBlock(profile) {
  if (!profile) return '';

  const lines = ['\n\n--- CONTESTO STUDIO / ORGANIZZAZIONE ---'];
  if (profile.organization_name) {
    lines.push(`Studio: ${profile.organization_name}`);
  }
  if (profile.organization_code) {
    lines.push(`Codice organizzazione: ${profile.organization_code}`);
  }
  if (profile.vat_number) {
    lines.push(`P.IVA studio: ${profile.vat_number}`);
  }
  if (profile.audit_report_prefix) {
    lines.push(`Prefisso numerazione audit: ${profile.audit_report_prefix}`);
  }
  if (profile.ai_context_notes && String(profile.ai_context_notes).trim()) {
    lines.push(`Note operative dello studio:\n${String(profile.ai_context_notes).trim()}`);
  }
  lines.push('--- FINE CONTESTO STUDIO ---');
  lines.push(
    'Considera sempre questo profilo studio nelle risposte: tono professionale da consulente/auditor ISO, dati limitati al tenant corrente.'
  );

  return lines.join('\n');
}

/**
 * @param {string} basePrompt
 * @param {number} organizationId
 * @returns {Promise<string>}
 */
async function enrichSystemPromptWithOrganization(basePrompt, organizationId) {
  const profile = await loadOrganizationProfile(organizationId);
  const block = buildOrganizationContextBlock(profile);
  if (!block) return basePrompt;
  return `${basePrompt}${block}`;
}

module.exports = {
  loadOrganizationProfile,
  buildOrganizationContextBlock,
  enrichSystemPromptWithOrganization,
};
