'use strict';

/**
 * complianceMapProposeLinks.service.js — CM-3
 * Propone link norma/legge + coverage su items Compliance Map.
 * Gemini + NormBroker; scrive solo hitl_status=proposed — mai auto-confirm.
 * Scope obbligatorio: organization_id + company_id.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const { getMapDetail, COVERAGE_VALUES } = require('./complianceMap.service');
const normBroker = require('./normBroker.service');

const MAX_ITEMS = 40;
const MAX_PROMPT_CHARS = 16000;
const MAX_STANDARDS_IN_PROMPT = 24;
const MUTABLE_MAP_STATUSES = new Set(['draft', 'in_review']);

const SYSTEM_PROMPT =
  'Sei un assistente SGQ (ISO 9001 §8.2). Colleghi requisiti di una Compliance Map ' +
  'a standard/clausole e riferimenti legislativi. Rispondi SOLO con JSON valido, senza markdown. ' +
  'Non confermare nulla: le proposte restano in revisione umana (HITL). ' +
  'Non inventare testo normativo: solo codici e riferimenti plausibili.';

/**
 * @param {Array<object>} items
 * @param {Array<{standard_code:string,clause_count?:number}>} standards
 * @param {object} mapMeta
 * @returns {string}
 */
function buildUserPrompt(items, standards, mapMeta) {
  const payload = {
    map: {
      id: mapMeta.id,
      title: mapMeta.title || null,
      source_label: mapMeta.source_label || null,
    },
    available_standards: standards.slice(0, MAX_STANDARDS_IN_PROMPT).map((s) => ({
      standard_code: s.standard_code,
      clause_count: s.clause_count ?? null,
    })),
    items: items.slice(0, MAX_ITEMS).map((it) => ({
      id: it.id,
      req_key: it.req_key,
      req_text: it.req_text,
      standard_code: it.standard_code || null,
      clause_ref: it.clause_ref || null,
      legislation_ref: it.legislation_ref || null,
      coverage: it.coverage || 'unknown',
    })),
  };
  let json = JSON.stringify(payload);
  if (json.length > MAX_PROMPT_CHARS) {
    json = `${json.slice(0, MAX_PROMPT_CHARS)}\n…[troncato]`;
  }
  return (
    `Mappa e items da collegare:\n${json}\n\n` +
    'Restituisci:\n' +
    '{ "links": [ {\n' +
    '  "item_id": <id numerico item>,\n' +
    '  "standard_code": null o codice (es. ISO_9001_2015),\n' +
    '  "clause_ref": null o clausola (es. 8.2.1),\n' +
    '  "legislation_ref": null o riferimento legislativo,\n' +
    '  "coverage": "unknown|covered|partial|missing|na",\n' +
    '  "gap_note": null o nota gap breve\n' +
    '} ] }\n' +
    'Regole: un link per item_id presente; preferisci available_standards; ' +
    'coverage "unknown" se non chiaro; non includere hitl_status.'
  );
}

/**
 * @param {*} raw
 * @param {Set<number>} allowedIds
 * @returns {object|null}
 */
function normalizeProposedLink(raw, allowedIds) {
  if (!raw || typeof raw !== 'object') return null;
  const itemId = parseInt(raw.item_id, 10);
  if (!Number.isFinite(itemId) || itemId <= 0 || !allowedIds.has(itemId)) return null;

  let coverage = String(raw.coverage || 'unknown').trim().toLowerCase();
  if (!COVERAGE_VALUES.includes(coverage)) coverage = 'unknown';

  const standardCode = raw.standard_code
    ? String(raw.standard_code).trim().slice(0, 100)
    : null;
  const clauseRef = raw.clause_ref ? String(raw.clause_ref).trim().slice(0, 100) : null;
  const legislationRef = raw.legislation_ref
    ? String(raw.legislation_ref).trim().slice(0, 300)
    : null;

  if (!standardCode && !clauseRef && !legislationRef && coverage === 'unknown') {
    return null;
  }

  return {
    item_id: itemId,
    standard_code: standardCode || null,
    clause_ref: clauseRef || null,
    legislation_ref: legislationRef || null,
    coverage,
    gap_note: raw.gap_note == null || raw.gap_note === '' ? null : String(raw.gap_note).slice(0, 2000),
  };
}

/**
 * @param {string} content
 * @param {Set<number>} allowedIds
 * @returns {object[]}
 */
function parseProposedLinks(content, allowedIds) {
  let parsed;
  try {
    parsed = parseJsonWithRepair(content);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.links)
    ? parsed.links
    : Array.isArray(parsed?.items)
      ? parsed.items
      : [];
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const link = normalizeProposedLink(row, allowedIds);
    if (!link) continue;
    if (seen.has(link.item_id)) continue;
    seen.add(link.item_id);
    out.push(link);
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}

/**
 * Lookup catalogo piattaforma (no org scope — norm_requirements è globale).
 * @param {string|null} standardCode
 * @param {string|null} clauseRef
 * @returns {Promise<number|null>}
 */
async function lookupNormRequirementId(standardCode, clauseRef) {
  if (!standardCode || !clauseRef) return null;
  const res = await query(
    `SELECT TOP 1 id
     FROM norm_requirements
     WHERE standard_code = @standardCode
       AND clause_ref = @clauseRef
       AND is_current = 1
     ORDER BY id ASC`,
    { standardCode, clauseRef }
  );
  const id = (res.recordset || [])[0]?.id;
  return Number.isFinite(id) ? id : null;
}

/**
 * Arricchisce una proposta con esito NormBroker + id catalogo.
 * Non inventa testo clausola.
 * @param {object} link
 * @param {number} organizationId
 */
async function enrichWithNormBroker(link, organizationId) {
  const enriched = {
    ...link,
    norm_requirement_id: null,
    norm_text_available: null,
    norm_source: null,
    absent_message: null,
  };

  if (link.standard_code && link.clause_ref) {
    try {
      const resolved = await normBroker.resolveClauseText(link.standard_code, link.clause_ref, {
        organizationId,
      });
      enriched.norm_text_available = !!resolved.textAvailable;
      enriched.norm_source = resolved.hit?.source || null;
      if (!resolved.textAvailable) {
        enriched.absent_message = resolved.absentMessage || null;
        if (!enriched.gap_note && resolved.absentMessage) {
          enriched.gap_note = resolved.absentMessage;
        }
      }
    } catch (err) {
      logger.warn(
        `[ComplianceMapProposeLinks] NormBroker fallito ${link.standard_code} ${link.clause_ref}:`,
        err.message
      );
      enriched.norm_text_available = false;
    }
    enriched.norm_requirement_id = await lookupNormRequirementId(
      link.standard_code,
      link.clause_ref
    );
  }

  return enriched;
}

/**
 * Fallback senza AI: searchClauses su parole chiave del req_text.
 * @param {Array<object>} items
 * @returns {Promise<object[]>}
 */
async function seedLinksFromBroker(items) {
  const out = [];
  for (const it of items.slice(0, MAX_ITEMS)) {
    const text = String(it.req_text || '').trim();
    if (!text) continue;
    const keyword = text
      .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 4)
      .slice(0, 6)
      .join(' ');
    if (!keyword) continue;

    let hits = [];
    try {
      // eslint-disable-next-line no-await-in-loop
      hits = await normBroker.searchClauses(keyword);
    } catch (err) {
      logger.warn('[ComplianceMapProposeLinks] searchClauses fallita:', err.message);
      continue;
    }
    const hit = Array.isArray(hits) && hits.length ? hits[0] : null;
    if (!hit?.standard_code || !hit?.clause_ref) continue;

    out.push({
      item_id: it.id,
      standard_code: String(hit.standard_code).slice(0, 100),
      clause_ref: String(hit.clause_ref).slice(0, 100),
      legislation_ref: null,
      coverage: 'unknown',
      gap_note: null,
    });
  }
  return out;
}

/**
 * @param {Array<object>} items
 * @param {object} mapMeta
 * @returns {Promise<{ links: object[], proposedBy: 'gemini'|'compiler', provider: string|null, aiError: string|null }>}
 */
async function proposeLinkBatch(items, mapMeta, organizationId) {
  const allowedIds = new Set(items.map((i) => i.id));
  const provider = getActiveProvider();

  if (!provider) {
    const seeded = await seedLinksFromBroker(items);
    return { links: seeded, proposedBy: 'compiler', provider: null, aiError: null };
  }

  let standards = [];
  try {
    standards = await normBroker.listAvailableStandards();
  } catch (err) {
    logger.warn('[ComplianceMapProposeLinks] listAvailableStandards fallita:', err.message);
  }

  try {
    const result = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(items, standards || [], mapMeta) },
      ],
      { responseFormat: 'json', temperature: 0.2, maxTokens: 4096 }
    );
    const links = parseProposedLinks(result?.content || '', allowedIds);
    if (links.length === 0) {
      logger.warn('[ComplianceMapProposeLinks] AI senza link utili — fallback broker');
      const seeded = await seedLinksFromBroker(items);
      return {
        links: seeded,
        proposedBy: 'compiler',
        provider,
        aiError: 'empty_ai_links',
      };
    }
    return { links, proposedBy: 'gemini', provider, aiError: null };
  } catch (err) {
    logger.warn('[ComplianceMapProposeLinks] AI fallita, fallback broker:', err.message);
    const seeded = await seedLinksFromBroker(items);
    return {
      links: seeded,
      proposedBy: 'compiler',
      provider,
      aiError: err.message || 'ai_error',
    };
  }
}

/**
 * Applica link proposto su un item ancora proposed (HITL).
 * @returns {Promise<object|null>}
 */
async function applyProposedLink(organizationId, companyId, mapId, link, actorUserId, proposedBy) {
  const update = await query(
    `UPDATE compliance_map_items
     SET standard_code = @standardCode,
         clause_ref = @clauseRef,
         legislation_ref = @legislationRef,
         coverage = @coverage,
         gap_note = @gapNote,
         norm_requirement_id = @normRequirementId,
         hitl_status = N'proposed',
         proposed_by = @proposedBy,
         reviewed_by = NULL,
         reviewed_at = NULL,
         updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.*
     WHERE id = @itemId
       AND map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId
       AND hitl_status = N'proposed'`,
    {
      standardCode: link.standard_code,
      clauseRef: link.clause_ref,
      legislationRef: link.legislation_ref,
      coverage: link.coverage || 'unknown',
      gapNote: link.gap_note,
      normRequirementId: link.norm_requirement_id || null,
      proposedBy,
      itemId: link.item_id,
      mapId,
      organizationId,
      companyId,
    }
  );
  const item = (update.recordset || [])[0] || null;
  if (!item) return null;

  await query(
    `INSERT INTO compliance_map_events
       (map_id, item_id, organization_id, actor_user_id, event_type, payload_json)
     VALUES
       (@mapId, @itemId, @organizationId, @actorUserId, N'links_proposed', @payloadJson)`,
    {
      mapId,
      itemId: link.item_id,
      organizationId,
      actorUserId: actorUserId || null,
      payloadJson: JSON.stringify({
        standard_code: link.standard_code,
        clause_ref: link.clause_ref,
        legislation_ref: link.legislation_ref,
        coverage: link.coverage,
        norm_requirement_id: link.norm_requirement_id || null,
        norm_text_available: link.norm_text_available,
        proposed_by: proposedBy,
      }),
    }
  );

  return item;
}

/**
 * Propone link norma/legge + coverage sugli items proposed di una mappa.
 *
 * @param {number} organizationId
 * @param {number} companyId
 * @param {number|string} mapId
 * @param {{ item_ids?: number[] }} body
 * @param {number|null} actorUserId
 */
async function proposeLinksForMap(organizationId, companyId, mapId, body, actorUserId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const detail = await getMapDetail(organizationId, scoped.companyId, mapId);
  if (!detail) return null;
  if (detail.notFound) return { notFound: true };

  const header = detail.map;
  if (!MUTABLE_MAP_STATUSES.has(header.status)) {
    return { conflict: `mappa in stato ${header.status}: propose-links non applicabile` };
  }

  let candidates = (detail.items || []).filter((it) => it.hitl_status === 'proposed');
  if (Array.isArray(body?.item_ids) && body.item_ids.length) {
    const want = new Set(
      body.item_ids.map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n) && n > 0)
    );
    candidates = candidates.filter((it) => want.has(it.id));
  }

  if (candidates.length === 0) {
    return {
      validationError:
        'Nessun item proposed da collegare (solo hitl_status=proposed; accettati/rifiutati esclusi)',
    };
  }

  const batch = await proposeLinkBatch(candidates, header, organizationId);
  if (!batch.links.length) {
    return {
      validationError: 'Nessun link proponibile (AI e fallback NormBroker vuoti)',
    };
  }

  const updated = [];
  const enrichMeta = [];
  for (const rawLink of batch.links) {
    // eslint-disable-next-line no-await-in-loop
    const enriched = await enrichWithNormBroker(rawLink, organizationId);
    // eslint-disable-next-line no-await-in-loop
    const item = await applyProposedLink(
      organizationId,
      scoped.companyId,
      header.id,
      enriched,
      actorUserId,
      batch.proposedBy
    );
    if (item) {
      updated.push(item);
      enrichMeta.push({
        item_id: enriched.item_id,
        norm_text_available: enriched.norm_text_available,
        norm_requirement_id: enriched.norm_requirement_id,
      });
    }
  }

  await query(
    `UPDATE compliance_maps
     SET updated_at = SYSUTCDATETIME(), updated_by = @actorUserId
     WHERE id = @mapId AND organization_id = @organizationId AND company_id = @companyId`,
    {
      mapId: header.id,
      organizationId,
      companyId: scoped.companyId,
      actorUserId: actorUserId || null,
    }
  );

  await query(
    `INSERT INTO compliance_map_events
       (map_id, item_id, organization_id, actor_user_id, event_type, payload_json)
     VALUES
       (@mapId, NULL, @organizationId, @actorUserId, N'links_proposed_batch', @payloadJson)`,
    {
      mapId: header.id,
      organizationId,
      actorUserId: actorUserId || null,
      payloadJson: JSON.stringify({
        candidate_count: candidates.length,
        updated_count: updated.length,
        proposed_by: batch.proposedBy,
        provider: batch.provider,
        ai_error: batch.aiError,
        hitl: 'proposed_only',
      }),
    }
  );

  return {
    companyId: scoped.companyId,
    map: header,
    items: updated,
    meta: {
      candidate_count: candidates.length,
      updated_count: updated.length,
      proposed_by: batch.proposedBy,
      provider: batch.provider,
      ai_error: batch.aiError,
      hitl: 'proposed_only',
      enrich: enrichMeta,
    },
  };
}

module.exports = {
  proposeLinksForMap,
  parseProposedLinks,
  normalizeProposedLink,
  seedLinksFromBroker,
  enrichWithNormBroker,
  buildUserPrompt,
  MAX_ITEMS,
};
