'use strict';

/**
 * complianceMapChat.service.js — CM-5
 * Blocco prompt + citazioni da mappa **approvata** (HITL confermati).
 * Non mescola NC live / Second Brain: solo items accepted|edited.
 */

const { query } = require('../config/database');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');

/** Solo HITL confermati — mai proposed/rejected in chat o export citabile. */
const CONFIRMED_HITL = Object.freeze(['accepted', 'edited']);

const MAX_ITEMS_IN_PROMPT = 40;
const MAX_REQ_TEXT_CHARS = 220;

function isConfirmedHitl(status) {
  return CONFIRMED_HITL.includes(String(status || '').toLowerCase());
}

function truncateText(text, max = MAX_REQ_TEXT_CHARS) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function clauseLabel(item) {
  const parts = [item.standard_code, item.clause_ref].filter(Boolean);
  const base = parts.join(' ').trim();
  if (item.legislation_ref) {
    return base ? `${base} · ${item.legislation_ref}` : String(item.legislation_ref);
  }
  return base || null;
}

/**
 * Ultima mappa status=approved per azienda + items HITL confermati.
 * @returns {Promise<null|{companyId, map, items}>}
 */
async function loadApprovedMapForChat(organizationId, companyId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const mapRes = await query(
    `SELECT TOP 1 id, uuid, organization_id, company_id, commercial_case_id,
            title, source_label, map_version, status,
            created_by, updated_by, created_at, updated_at
     FROM compliance_maps
     WHERE organization_id = @organizationId
       AND company_id = @companyId
       AND status = N'approved'
     ORDER BY updated_at DESC, id DESC`,
    { organizationId, companyId: scoped.companyId }
  );
  const map = (mapRes.recordset || [])[0] || null;
  if (!map) {
    return { companyId: scoped.companyId, map: null, items: [] };
  }

  const itemsRes = await query(
    `SELECT id, map_id, req_key, req_text, req_source,
            norm_requirement_id, standard_code, clause_ref, legislation_ref,
            coverage, gap_note, hitl_status
     FROM compliance_map_items
     WHERE map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId
       AND hitl_status IN (N'accepted', N'edited')
     ORDER BY id ASC`,
    { mapId: map.id, organizationId, companyId: scoped.companyId }
  );

  return {
    companyId: scoped.companyId,
    map,
    items: itemsRes.recordset || [],
  };
}

/**
 * Export citabile: items confermati di una mappa specifica (scoped).
 * Non include proposed/rejected. Mappa non deve essere approved (utile in revisione).
 */
async function loadMapExport(organizationId, companyId, mapId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const mid = parseInt(mapId, 10);
  if (!Number.isFinite(mid) || mid <= 0) return { notFound: true };

  const mapRes = await query(
    `SELECT TOP 1 id, uuid, organization_id, company_id, commercial_case_id,
            title, source_label, map_version, status, updated_at
     FROM compliance_maps
     WHERE id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId`,
    { mapId: mid, organizationId, companyId: scoped.companyId }
  );
  const map = (mapRes.recordset || [])[0] || null;
  if (!map) return { notFound: true };

  const itemsRes = await query(
    `SELECT id, map_id, req_key, req_text, req_source,
            norm_requirement_id, standard_code, clause_ref, legislation_ref,
            coverage, gap_note, hitl_status, evidence_document_ids
     FROM compliance_map_items
     WHERE map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId
       AND hitl_status IN (N'accepted', N'edited')
     ORDER BY id ASC`,
    { mapId: mid, organizationId, companyId: scoped.companyId }
  );

  return {
    companyId: scoped.companyId,
    map,
    items: itemsRes.recordset || [],
  };
}

/**
 * Blocco system prompt. Vuoto se nessuna mappa approved o nessun item confermato.
 */
function formatComplianceMapPromptBlock(snapshot) {
  if (!snapshot || !snapshot.map || !Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    return '';
  }
  const confirmed = snapshot.items.filter((row) => isConfirmedHitl(row.hitl_status));
  if (confirmed.length === 0) return '';

  const map = snapshot.map;
  const lines = [
    '',
    '',
    '--- MAPPA CONFORMITÀ (approvata, HITL confermati — non NC live) ---',
    `Mappa: ${map.title || `id=${map.id}`} (map_id=${map.id}, v${map.map_version ?? '?'})`,
    `Stato mappa: ${map.status}`,
  ];
  if (map.source_label) lines.push(`Fonte: ${map.source_label}`);
  lines.push(
    'Cita SOLO questi nodi (node_id = id item). Non inventare clausole. Non usare NC aperte come evidenza di copertura.'
  );

  const slice = confirmed.slice(0, MAX_ITEMS_IN_PROMPT);
  for (const item of slice) {
    const clause = clauseLabel(item) || '—';
    const cov = item.coverage || 'unknown';
    const req = truncateText(item.req_text);
    const key = item.req_key || '—';
    lines.push(
      `- node_id=${item.id} | req_key=${key} | clausola=${clause} | coverage=${cov} | HITL=${item.hitl_status}` +
        (req ? ` | ${req}` : '')
    );
  }
  if (confirmed.length > MAX_ITEMS_IN_PROMPT) {
    lines.push(`(+${confirmed.length - MAX_ITEMS_IN_PROMPT} altri nodi confermati omessi per lunghezza)`);
  }
  lines.push('--- FINE MAPPA CONFORMITÀ ---');
  return lines.join('\n');
}

/**
 * Citazioni strutturate per la risposta Assistente (merge con RAG).
 */
function buildComplianceMapCitations(snapshot) {
  if (!snapshot || !snapshot.map || !Array.isArray(snapshot.items)) return [];
  const mapId = snapshot.map.id;
  const out = [];
  for (const item of snapshot.items) {
    if (!isConfirmedHitl(item.hitl_status)) continue;
    const clause = clauseLabel(item);
    const key = item.req_key || `item-${item.id}`;
    const label = clause
      ? `Mappa #${mapId}: ${key} (${clause})`
      : `Mappa #${mapId}: ${key}`;
    out.push({
      entityType: 'compliance_map_item',
      entityId: String(item.id),
      label,
      score: 1,
      mapId: String(mapId),
      clauseRef: clause || null,
      reqKey: key,
    });
  }
  return out;
}

/**
 * Payload export JSON (FE scarica file).
 */
function buildExportPayload(snapshot) {
  if (!snapshot || !snapshot.map) return null;
  const items = (snapshot.items || []).filter((row) => isConfirmedHitl(row.hitl_status));
  return {
    exportedAt: new Date().toISOString(),
    policy: {
      hitl: CONFIRMED_HITL.slice(),
      note: 'Solo items accepted|edited; proposed/rejected esclusi',
    },
    map: {
      id: snapshot.map.id,
      uuid: snapshot.map.uuid,
      title: snapshot.map.title,
      source_label: snapshot.map.source_label,
      map_version: snapshot.map.map_version,
      status: snapshot.map.status,
      company_id: snapshot.map.company_id,
      organization_id: snapshot.map.organization_id,
      updated_at: snapshot.map.updated_at,
    },
    items: items.map((item) => ({
      node_id: item.id,
      req_key: item.req_key,
      req_text: item.req_text,
      standard_code: item.standard_code,
      clause_ref: item.clause_ref,
      legislation_ref: item.legislation_ref,
      coverage: item.coverage,
      gap_note: item.gap_note,
      hitl_status: item.hitl_status,
      norm_requirement_id: item.norm_requirement_id,
      evidence_document_ids: item.evidence_document_ids,
    })),
    itemCount: items.length,
  };
}

/**
 * Markdown leggibile per download .md
 */
function buildExportMarkdown(snapshot) {
  const payload = buildExportPayload(snapshot);
  if (!payload) return '';
  const m = payload.map;
  const lines = [
    `# Mappa conformità — ${m.title || `id ${m.id}`}`,
    '',
    `- map_id: ${m.id}`,
    `- versione: ${m.map_version ?? '—'}`,
    `- stato: ${m.status}`,
    `- esportato: ${payload.exportedAt}`,
    `- policy HITL: solo ${CONFIRMED_HITL.join('|')}`,
    '',
    '## Nodi confermati',
    '',
  ];
  if (payload.items.length === 0) {
    lines.push('_Nessun item accepted/edited._');
  } else {
    for (const item of payload.items) {
      const clause = [item.standard_code, item.clause_ref].filter(Boolean).join(' ') || '—';
      lines.push(`### node_id=${item.node_id} · ${item.req_key || '—'}`);
      lines.push(`- clausola: ${clause}${item.legislation_ref ? ` · ${item.legislation_ref}` : ''}`);
      lines.push(`- coverage: ${item.coverage || '—'}`);
      lines.push(`- HITL: ${item.hitl_status}`);
      if (item.req_text) lines.push(`- requisito: ${item.req_text}`);
      if (item.gap_note) lines.push(`- gap: ${item.gap_note}`);
      lines.push('');
    }
  }
  return lines.join('\n');
}

module.exports = {
  CONFIRMED_HITL,
  MAX_ITEMS_IN_PROMPT,
  isConfirmedHitl,
  loadApprovedMapForChat,
  loadMapExport,
  formatComplianceMapPromptBlock,
  buildComplianceMapCitations,
  buildExportPayload,
  buildExportMarkdown,
  clauseLabel,
  truncateText,
};
