'use strict';

/**
 * complianceMapCompile.service.js — CM-2
 * Compilatore Compliance Map da caso commerciale.
 * Gemini (aiProviderAdapter) PROPONE items con hitl_status=proposed — mai auto-confirm.
 * Scope obbligatorio: organization_id + company_id.
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const { chat, getActiveProvider } = require('./aiProviderAdapter');
const { parseJsonWithRepair } = require('../utils/jsonRepair');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');
const { createMap, addItem, COVERAGE_VALUES } = require('./complianceMap.service');

const MAX_SOURCE_ROWS = 80;
const MAX_PROPOSED_ITEMS = 40;
const MAX_PROMPT_CHARS = 18000;

const SYSTEM_PROMPT =
  'Sei un assistente SGQ (ISO 9001 §8.2). Dagli estratti di un capitolato/ordine ' +
  'proponi requisiti per una Compliance Map. Rispondi SOLO con JSON valido, senza markdown. ' +
  'Non confermare nulla: le proposte restano in revisione umana (HITL).';

/**
 * @param {Array<object>} extracts
 * @returns {string}
 */
function buildUserPrompt(extracts, caseMeta) {
  const payload = {
    case: {
      id: caseMeta.id,
      title: caseMeta.title || null,
      external_ref: caseMeta.external_ref || null,
    },
    extracts: extracts.slice(0, MAX_SOURCE_ROWS).map((r) => ({
      id: r.id,
      req_type: r.req_type,
      field_key: r.field_key,
      value_text: r.value_text,
      confidence: r.confidence,
    })),
  };
  let json = JSON.stringify(payload);
  if (json.length > MAX_PROMPT_CHARS) {
    json = `${json.slice(0, MAX_PROMPT_CHARS)}\n…[troncato]`;
  }
  return (
    `Contesto caso commerciale ed estratti:\n${json}\n\n` +
    'Restituisci:\n' +
    '{ "items": [ {\n' +
    '  "req_key": "chiave stabile breve (es. legal-iso9001, delivery-date)",\n' +
    '  "req_text": "testo requisito citabile",\n' +
    '  "standard_code": null o codice (es. ISO_9001_2015),\n' +
    '  "clause_ref": null o clausola (es. 8.2.1),\n' +
    '  "legislation_ref": null o riferimento legislativo,\n' +
    '  "coverage": "unknown|covered|partial|missing|na",\n' +
    '  "gap_note": null o nota gap\n' +
    '} ] }\n' +
    `Regole: max ${MAX_PROPOSED_ITEMS} items; solo da estratti; non inventare soglie; ` +
    'coverage di default "unknown" se non chiaro; non includere hitl_status.'
  );
}

/**
 * @param {*} raw
 * @returns {object|null}
 */
function normalizeProposedItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const reqText = String(raw.req_text || '').trim();
  if (!reqText) return null;

  let reqKey = String(raw.req_key || '').trim().slice(0, 120);
  if (!reqKey) {
    reqKey = `gemini-${crypto.randomBytes(4).toString('hex')}`;
  }

  let coverage = String(raw.coverage || 'unknown').trim().toLowerCase();
  if (!COVERAGE_VALUES.includes(coverage)) coverage = 'unknown';

  return {
    req_key: reqKey,
    req_text: reqText,
    standard_code: raw.standard_code ? String(raw.standard_code).slice(0, 100) : null,
    clause_ref: raw.clause_ref ? String(raw.clause_ref).slice(0, 100) : null,
    legislation_ref: raw.legislation_ref ? String(raw.legislation_ref).slice(0, 300) : null,
    coverage,
    gap_note: raw.gap_note == null || raw.gap_note === '' ? null : String(raw.gap_note),
  };
}

/**
 * @param {string} content
 * @returns {object[]}
 */
function parseProposedItems(content) {
  let parsed;
  try {
    parsed = parseJsonWithRepair(content);
  } catch {
    return [];
  }
  const list = Array.isArray(parsed?.items) ? parsed.items : [];
  const out = [];
  const seen = new Set();
  for (const row of list) {
    const item = normalizeProposedItem(row);
    if (!item) continue;
    if (seen.has(item.req_key)) {
      item.req_key = `${item.req_key}-${out.length + 1}`;
    }
    seen.add(item.req_key);
    out.push(item);
    if (out.length >= MAX_PROPOSED_ITEMS) break;
  }
  return out;
}

/**
 * Fallback senza AI: un item proposed per estratto.
 * @param {Array<object>} extracts
 * @returns {object[]}
 */
function seedFromExtracts(extracts) {
  const out = [];
  for (const r of extracts.slice(0, MAX_PROPOSED_ITEMS)) {
    const value = String(r.value_text || '').trim();
    if (!value) continue;
    const field = r.field_key ? String(r.field_key).trim() : '';
    const reqType = r.req_type ? String(r.req_type).trim() : 'note';
    const reqKey = (field || `${reqType}-${r.id || out.length + 1}`).slice(0, 120);
    out.push({
      req_key: reqKey,
      req_text: field ? `${field}: ${value}` : value,
      standard_code: null,
      clause_ref: null,
      legislation_ref: null,
      coverage: 'unknown',
      gap_note: null,
    });
  }
  return out;
}

async function loadCommercialCase(organizationId, companyId, caseId) {
  const res = await query(
    `SELECT TOP 1 id, uuid, organization_id, company_id, title, external_ref, status
     FROM commercial_cases
     WHERE id = @caseId
       AND organization_id = @organizationId
       AND company_id = @companyId`,
    { caseId, organizationId, companyId }
  );
  return (res.recordset || [])[0] || null;
}

async function loadCaseExtracts(organizationId, caseId) {
  const res = await query(
    `SELECT r.id, r.req_type, r.field_key, r.value_text, r.confidence, r.review_status
     FROM commercial_case_extracted_requirements r
     INNER JOIN commercial_case_drawing_extractions e ON e.id = r.extraction_id
     INNER JOIN commercial_cases c ON c.id = e.case_id
     WHERE c.id = @caseId
       AND c.organization_id = @organizationId
       AND e.status = N'done'
       AND r.review_status IN (N'extracted', N'confirmed', N'edited')
       AND r.value_text IS NOT NULL
     ORDER BY r.req_type ASC, r.confidence DESC, r.id ASC`,
    { caseId, organizationId }
  );
  return res.recordset || [];
}

/**
 * Propone items via Gemini; se provider assente → seed compiler (HITL comunque proposed).
 * @returns {{ items: object[], proposedBy: 'gemini'|'compiler', provider: string|null, aiError: string|null }}
 */
async function proposeItems(extracts, caseMeta) {
  const provider = getActiveProvider();
  if (!provider) {
    return {
      items: seedFromExtracts(extracts),
      proposedBy: 'compiler',
      provider: null,
      aiError: null,
    };
  }

  try {
    const result = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(extracts, caseMeta) },
      ],
      { responseFormat: 'json', temperature: 0.2, maxTokens: 4096 }
    );
    const items = parseProposedItems(result?.content || '');
    if (items.length === 0) {
      logger.warn('[ComplianceMapCompile] AI senza items utili — fallback seed');
      return {
        items: seedFromExtracts(extracts),
        proposedBy: 'compiler',
        provider,
        aiError: 'empty_ai_items',
      };
    }
    return { items, proposedBy: 'gemini', provider, aiError: null };
  } catch (err) {
    logger.warn('[ComplianceMapCompile] AI fallita, fallback seed:', err.message);
    return {
      items: seedFromExtracts(extracts),
      proposedBy: 'compiler',
      provider,
      aiError: err.message || 'ai_error',
    };
  }
}

/**
 * Compila una nuova mappa draft da caso commerciale: items solo proposed (HITL).
 *
 * @param {number} organizationId
 * @param {number} companyId
 * @param {{ commercial_case_id: number, title?: string, source_label?: string }} body
 * @param {number|null} actorUserId
 */
async function compileFromCommercialCase(organizationId, companyId, body, actorUserId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const caseId = parseInt(body?.commercial_case_id, 10);
  if (!Number.isFinite(caseId) || caseId <= 0) {
    return { validationError: 'commercial_case_id obbligatorio' };
  }

  const caseRow = await loadCommercialCase(organizationId, scoped.companyId, caseId);
  if (!caseRow) {
    return { notFound: true, entity: 'commercial_case' };
  }

  const extracts = await loadCaseExtracts(organizationId, caseId);
  if (extracts.length === 0) {
    return {
      validationError:
        'Nessun estratto utile sul caso: eseguire prima analisi documenti (caseDocumentAnalysis)',
    };
  }

  const proposal = await proposeItems(extracts, caseRow);
  if (!proposal.items.length) {
    return { validationError: 'Compilatore senza items proponibili dagli estratti' };
  }

  const title =
    String(body?.title || '').trim() ||
    `Compliance Map — ${caseRow.title || `caso ${caseId}`}`.slice(0, 300);
  const sourceLabel =
    body?.source_label == null || body.source_label === ''
      ? `commercial_case:${caseId}`
      : String(body.source_label).trim().slice(0, 300);

  const created = await createMap(
    organizationId,
    scoped.companyId,
    {
      title,
      source_label: sourceLabel,
      commercial_case_id: caseId,
    },
    actorUserId
  );
  if (!created || created.validationError) {
    return created || { validationError: 'creazione mappa fallita' };
  }

  const items = [];
  for (const proposed of proposal.items) {
    // HITL: forzatura proposed — mai accepted/edited/rejected in compile
    const added = await addItem(
      organizationId,
      scoped.companyId,
      created.map.id,
      {
        req_key: proposed.req_key,
        req_text: proposed.req_text,
        req_source: proposal.proposedBy === 'gemini' ? 'ai' : 'ingest',
        proposed_by: proposal.proposedBy,
        hitl_status: 'proposed',
        coverage: proposed.coverage || 'unknown',
        standard_code: proposed.standard_code,
        clause_ref: proposed.clause_ref,
        legislation_ref: proposed.legislation_ref,
        gap_note: proposed.gap_note,
      },
      actorUserId
    );
    if (added?.item) items.push(added.item);
  }

  await query(
    `INSERT INTO compliance_map_events
       (map_id, item_id, organization_id, actor_user_id, event_type, payload_json)
     VALUES
       (@mapId, NULL, @organizationId, @actorUserId, N'compile_proposed', @payloadJson)`,
    {
      mapId: created.map.id,
      organizationId,
      actorUserId: actorUserId || null,
      payloadJson: JSON.stringify({
        commercial_case_id: caseId,
        extract_count: extracts.length,
        item_count: items.length,
        proposed_by: proposal.proposedBy,
        provider: proposal.provider,
        ai_error: proposal.aiError,
      }),
    }
  );

  return {
    companyId: scoped.companyId,
    map: created.map,
    items,
    meta: {
      commercial_case_id: caseId,
      extract_count: extracts.length,
      proposed_by: proposal.proposedBy,
      provider: proposal.provider,
      ai_error: proposal.aiError,
      hitl: 'proposed_only',
    },
  };
}

module.exports = {
  compileFromCommercialCase,
  parseProposedItems,
  normalizeProposedItem,
  seedFromExtracts,
  MAX_PROPOSED_ITEMS,
};
