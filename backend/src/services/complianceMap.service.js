'use strict';

/**
 * complianceMap.service.js — CM-1
 * Mappa multi-tenant requisito↔norma/evidenza/gap (HITL stub).
 * Sempre scoped organization_id + company_id. Nessuna compile Gemini.
 */

const crypto = require('crypto');
const { query } = require('../config/database');
const { assertCompanyInOrganization } = require('./gapAnalysis.service');

const MAP_STATUSES = Object.freeze(['draft', 'in_review', 'approved', 'archived']);
const HITL_STATUSES = Object.freeze(['proposed', 'accepted', 'edited', 'rejected']);
const COVERAGE_VALUES = Object.freeze(['unknown', 'covered', 'partial', 'missing', 'na']);
const REQ_SOURCES = Object.freeze(['ingest', 'manual', 'ai']);
const PROPOSED_BY = Object.freeze(['gemini', 'user', 'compiler']);

const MUTABLE_MAP_STATUSES = new Set(['draft', 'in_review']);

async function appendEvent({ mapId, itemId = null, organizationId, actorUserId, eventType, payload }) {
  await query(
    `INSERT INTO compliance_map_events
       (map_id, item_id, organization_id, actor_user_id, event_type, payload_json)
     VALUES
       (@mapId, @itemId, @organizationId, @actorUserId, @eventType, @payloadJson)`,
    {
      mapId,
      itemId,
      organizationId,
      actorUserId: actorUserId || null,
      eventType,
      payloadJson: payload == null ? null : JSON.stringify(payload),
    }
  );
}

async function loadMapHeader(organizationId, companyId, mapId) {
  const res = await query(
    `SELECT TOP 1 *
     FROM compliance_maps
     WHERE id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId`,
    { mapId, organizationId, companyId }
  );
  return (res.recordset || [])[0] || null;
}

async function listMaps(organizationId, companyId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const res = await query(
    `SELECT id, uuid, organization_id, company_id, commercial_case_id,
            title, source_label, map_version, status,
            created_by, updated_by, created_at, updated_at
     FROM compliance_maps
     WHERE organization_id = @organizationId
       AND company_id = @companyId
     ORDER BY updated_at DESC, id DESC`,
    { organizationId, companyId: scoped.companyId }
  );
  return { companyId: scoped.companyId, maps: res.recordset || [] };
}

async function getMapDetail(organizationId, companyId, mapId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const mid = parseInt(mapId, 10);
  if (!Number.isFinite(mid) || mid <= 0) return { notFound: true };

  const header = await loadMapHeader(organizationId, scoped.companyId, mid);
  if (!header) return { notFound: true };

  const itemsRes = await query(
    `SELECT *
     FROM compliance_map_items
     WHERE map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId
     ORDER BY id ASC`,
    { mapId: mid, organizationId, companyId: scoped.companyId }
  );

  return {
    companyId: scoped.companyId,
    map: header,
    items: itemsRes.recordset || [],
  };
}

async function createMap(organizationId, companyId, body, actorUserId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const title = String(body?.title || '').trim();
  if (!title) {
    return { validationError: 'title obbligatorio' };
  }

  let commercialCaseId = null;
  if (body?.commercial_case_id != null && body.commercial_case_id !== '') {
    const cid = parseInt(body.commercial_case_id, 10);
    if (!Number.isFinite(cid) || cid <= 0) {
      return { validationError: 'commercial_case_id non valido' };
    }
    commercialCaseId = cid;
  }

  const sourceLabel =
    body?.source_label == null || body.source_label === ''
      ? null
      : String(body.source_label).trim().slice(0, 300);

  const uuid = crypto.randomUUID();
  const insert = await query(
    `INSERT INTO compliance_maps
       (uuid, organization_id, company_id, commercial_case_id, title, source_label,
        map_version, status, created_by, updated_by)
     OUTPUT INSERTED.*
     VALUES
       (@uuid, @organizationId, @companyId, @commercialCaseId, @title, @sourceLabel,
        1, N'draft', @actorUserId, @actorUserId)`,
    {
      uuid,
      organizationId,
      companyId: scoped.companyId,
      commercialCaseId,
      title: title.slice(0, 300),
      sourceLabel,
      actorUserId: actorUserId || null,
    }
  );
  const map = (insert.recordset || [])[0];
  if (!map) {
    throw new Error('INSERT compliance_maps senza riga OUTPUT');
  }

  await appendEvent({
    mapId: map.id,
    organizationId,
    actorUserId,
    eventType: 'map_created',
    payload: {
      title: map.title,
      commercial_case_id: map.commercial_case_id,
      source_label: map.source_label,
    },
  });

  return { companyId: scoped.companyId, map };
}

async function addItem(organizationId, companyId, mapId, body, actorUserId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const mid = parseInt(mapId, 10);
  if (!Number.isFinite(mid) || mid <= 0) return { notFound: true };

  const header = await loadMapHeader(organizationId, scoped.companyId, mid);
  if (!header) return { notFound: true };
  if (!MUTABLE_MAP_STATUSES.has(header.status)) {
    return { conflict: `mappa in stato ${header.status}: non modificabile` };
  }

  const reqText = String(body?.req_text || '').trim();
  if (!reqText) return { validationError: 'req_text obbligatorio' };

  const reqSource = String(body?.req_source || 'manual').toLowerCase();
  if (!REQ_SOURCES.includes(reqSource)) {
    return { validationError: `req_source non valido (${REQ_SOURCES.join('|')})` };
  }

  const proposedBy = String(body?.proposed_by || 'user').toLowerCase();
  if (!PROPOSED_BY.includes(proposedBy)) {
    return { validationError: `proposed_by non valido (${PROPOSED_BY.join('|')})` };
  }

  const hitlStatus = String(body?.hitl_status || 'proposed').toLowerCase();
  if (!HITL_STATUSES.includes(hitlStatus)) {
    return { validationError: `hitl_status non valido (${HITL_STATUSES.join('|')})` };
  }

  const coverage = String(body?.coverage || 'unknown').toLowerCase();
  if (!COVERAGE_VALUES.includes(coverage)) {
    return { validationError: `coverage non valido (${COVERAGE_VALUES.join('|')})` };
  }

  let reqKey = String(body?.req_key || '').trim();
  if (!reqKey) {
    reqKey = `manual-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  }
  reqKey = reqKey.slice(0, 120);

  let normRequirementId = null;
  if (body?.norm_requirement_id != null && body.norm_requirement_id !== '') {
    const nid = parseInt(body.norm_requirement_id, 10);
    if (!Number.isFinite(nid) || nid <= 0) {
      return { validationError: 'norm_requirement_id non valido' };
    }
    normRequirementId = nid;
  }

  const insert = await query(
    `INSERT INTO compliance_map_items
       (map_id, organization_id, company_id, req_key, req_text, req_source,
        norm_requirement_id, standard_code, clause_ref, legislation_ref,
        evidence_document_ids, coverage, gap_note, hitl_status, proposed_by)
     OUTPUT INSERTED.*
     VALUES
       (@mapId, @organizationId, @companyId, @reqKey, @reqText, @reqSource,
        @normRequirementId, @standardCode, @clauseRef, @legislationRef,
        @evidenceDocumentIds, @coverage, @gapNote, @hitlStatus, @proposedBy)`,
    {
      mapId: mid,
      organizationId,
      companyId: scoped.companyId,
      reqKey,
      reqText,
      reqSource,
      normRequirementId,
      standardCode: body?.standard_code ? String(body.standard_code).slice(0, 100) : null,
      clauseRef: body?.clause_ref ? String(body.clause_ref).slice(0, 100) : null,
      legislationRef: body?.legislation_ref ? String(body.legislation_ref).slice(0, 300) : null,
      evidenceDocumentIds:
        body?.evidence_document_ids == null
          ? null
          : typeof body.evidence_document_ids === 'string'
            ? body.evidence_document_ids
            : JSON.stringify(body.evidence_document_ids),
      coverage,
      gapNote: body?.gap_note == null ? null : String(body.gap_note),
      hitlStatus,
      proposedBy,
    }
  );
  const item = (insert.recordset || [])[0];
  if (!item) throw new Error('INSERT compliance_map_items senza riga OUTPUT');

  await query(
    `UPDATE compliance_maps
     SET updated_at = SYSUTCDATETIME(), updated_by = @actorUserId
     WHERE id = @mapId AND organization_id = @organizationId AND company_id = @companyId`,
    {
      mapId: mid,
      organizationId,
      companyId: scoped.companyId,
      actorUserId: actorUserId || null,
    }
  );

  await appendEvent({
    mapId: mid,
    itemId: item.id,
    organizationId,
    actorUserId,
    eventType: 'item_created',
    payload: {
      req_key: item.req_key,
      hitl_status: item.hitl_status,
      coverage: item.coverage,
      proposed_by: item.proposed_by,
    },
  });

  return { companyId: scoped.companyId, item };
}

async function updateItemHitl(organizationId, companyId, mapId, itemId, body, actorUserId) {
  const scoped = await assertCompanyInOrganization(organizationId, companyId);
  if (!scoped) return null;

  const mid = parseInt(mapId, 10);
  const iid = parseInt(itemId, 10);
  if (!Number.isFinite(mid) || mid <= 0 || !Number.isFinite(iid) || iid <= 0) {
    return { notFound: true };
  }

  const header = await loadMapHeader(organizationId, scoped.companyId, mid);
  if (!header) return { notFound: true };
  if (!MUTABLE_MAP_STATUSES.has(header.status)) {
    return { conflict: `mappa in stato ${header.status}: HITL non applicabile` };
  }

  const hitlStatus = String(body?.hitl_status || '').toLowerCase();
  if (!HITL_STATUSES.includes(hitlStatus)) {
    return { validationError: `hitl_status obbligatorio (${HITL_STATUSES.join('|')})` };
  }

  let coverage = null;
  if (body?.coverage != null && body.coverage !== '') {
    coverage = String(body.coverage).toLowerCase();
    if (!COVERAGE_VALUES.includes(coverage)) {
      return { validationError: `coverage non valido (${COVERAGE_VALUES.join('|')})` };
    }
  }

  let normRequirementId;
  let touchNorm = false;
  if (Object.prototype.hasOwnProperty.call(body || {}, 'norm_requirement_id')) {
    touchNorm = true;
    if (body.norm_requirement_id == null || body.norm_requirement_id === '') {
      normRequirementId = null;
    } else {
      const nid = parseInt(body.norm_requirement_id, 10);
      if (!Number.isFinite(nid) || nid <= 0) {
        return { validationError: 'norm_requirement_id non valido' };
      }
      normRequirementId = nid;
    }
  }

  const touchGap = Object.prototype.hasOwnProperty.call(body || {}, 'gap_note');
  const gapNote = touchGap ? (body.gap_note == null ? null : String(body.gap_note)) : undefined;

  const existing = await query(
    `SELECT TOP 1 *
     FROM compliance_map_items
     WHERE id = @itemId
       AND map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId`,
    {
      itemId: iid,
      mapId: mid,
      organizationId,
      companyId: scoped.companyId,
    }
  );
  const prev = (existing.recordset || [])[0];
  if (!prev) return { notFound: true };

  const reviewed = hitlStatus === 'proposed' ? null : actorUserId || null;

  const update = await query(
    `UPDATE compliance_map_items
     SET hitl_status = @hitlStatus,
         coverage = COALESCE(@coverage, coverage),
         gap_note = CASE WHEN @touchGap = 1 THEN @gapNote ELSE gap_note END,
         norm_requirement_id = CASE WHEN @touchNorm = 1 THEN @normRequirementId ELSE norm_requirement_id END,
         reviewed_by = @reviewedBy,
         reviewed_at = CASE WHEN @hitlStatus = N'proposed' THEN NULL ELSE SYSUTCDATETIME() END,
         updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.*
     WHERE id = @itemId
       AND map_id = @mapId
       AND organization_id = @organizationId
       AND company_id = @companyId`,
    {
      hitlStatus,
      coverage,
      touchGap: touchGap ? 1 : 0,
      gapNote: gapNote == null ? null : gapNote,
      touchNorm: touchNorm ? 1 : 0,
      normRequirementId: touchNorm ? normRequirementId : null,
      reviewedBy: reviewed,
      itemId: iid,
      mapId: mid,
      organizationId,
      companyId: scoped.companyId,
    }
  );
  const item = (update.recordset || [])[0];
  if (!item) return { notFound: true };

  await query(
    `UPDATE compliance_maps
     SET updated_at = SYSUTCDATETIME(), updated_by = @actorUserId
     WHERE id = @mapId AND organization_id = @organizationId AND company_id = @companyId`,
    {
      mapId: mid,
      organizationId,
      companyId: scoped.companyId,
      actorUserId: actorUserId || null,
    }
  );

  await appendEvent({
    mapId: mid,
    itemId: iid,
    organizationId,
    actorUserId,
    eventType: `hitl_${hitlStatus}`,
    payload: {
      from: prev.hitl_status,
      to: hitlStatus,
      coverage: item.coverage,
      norm_requirement_id: item.norm_requirement_id,
    },
  });

  return { companyId: scoped.companyId, item };
}

module.exports = {
  MAP_STATUSES,
  HITL_STATUSES,
  COVERAGE_VALUES,
  listMaps,
  getMapDetail,
  createMap,
  addItem,
  updateItemHitl,
};
