/**
 * commercialChecklistAttachment.service.js — ponte voce checklist ↔ allegato caso (PONTE-1)
 * Nessun secondo magazzino file: solo link a attachments già sul commercial_case.
 */

const { query } = require('../config/database');

function parsePositiveInt(raw) {
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Elenco link per un caso (org-scoped via commercial_cases).
 * @returns {Promise<Array<{id, checklist_item_id, attachment_id, file_name, commercial_doc_role, attachment_uuid, item_ref, phase}>>}
 */
async function listLinksForCase(caseId, organizationId) {
  const r = await query(
    `
    SELECT
      ca.id,
      ca.checklist_item_id,
      ca.attachment_id,
      ca.created_at,
      a.file_name,
      a.commercial_doc_role,
      a.attachment_uuid,
      ccl.item_ref,
      ccl.phase
    FROM commercial_case_checklist_attachments AS ca
    INNER JOIN commercial_case_checklist AS ccl ON ccl.id = ca.checklist_item_id
    INNER JOIN commercial_cases AS cc ON cc.id = ccl.case_id
    INNER JOIN attachments AS a ON a.attachment_id = ca.attachment_id
    WHERE ccl.case_id = @caseId
      AND cc.organization_id = @organizationId
      AND a.commercial_case_id = @caseId
    ORDER BY ccl.phase ASC, ccl.item_ref ASC, ca.id ASC
    `,
    { caseId, organizationId }
  );
  return r.recordset || [];
}

/**
 * Ref delle voci con attachment_required=1 e zero link (fase).
 */
async function listMissingRequiredAttachmentRefs(caseId, phase) {
  const r = await query(
    `
    SELECT ccl.item_ref
    FROM commercial_case_checklist AS ccl
    WHERE ccl.case_id = @caseId
      AND ccl.phase = @phase
      AND ccl.attachment_required = 1
      AND NOT EXISTS (
        SELECT 1
        FROM commercial_case_checklist_attachments AS ca
        WHERE ca.checklist_item_id = ccl.id
      )
    ORDER BY ccl.item_ref ASC
    `,
    { caseId, phase }
  );
  return (r.recordset || []).map((row) => String(row.item_ref));
}

async function assertChecklistItemOnCase(caseId, organizationId, itemId) {
  const r = await query(
    `
    SELECT ccl.id, ccl.case_id, ccl.item_ref, ccl.phase, ccl.attachment_required
    FROM commercial_case_checklist AS ccl
    INNER JOIN commercial_cases AS cc ON cc.id = ccl.case_id
    WHERE ccl.id = @itemId
      AND ccl.case_id = @caseId
      AND cc.organization_id = @organizationId
    `,
    { itemId, caseId, organizationId }
  );
  return (r.recordset || [])[0] || null;
}

async function assertAttachmentOnCase(caseId, attachmentId) {
  const r = await query(
    `
    SELECT attachment_id, file_name, commercial_doc_role, attachment_uuid
    FROM attachments
    WHERE attachment_id = @attachmentId AND commercial_case_id = @caseId
    `,
    { attachmentId, caseId }
  );
  return (r.recordset || [])[0] || null;
}

/**
 * Collega un allegato già sul caso a una voce checklist.
 */
async function linkAttachment({ caseId, organizationId, itemId, attachmentId, userId }) {
  const item = await assertChecklistItemOnCase(caseId, organizationId, itemId);
  if (!item) {
    return { ok: false, status: 404, error: 'Voce checklist non trovata', code: 'NOT_FOUND' };
  }
  const att = await assertAttachmentOnCase(caseId, attachmentId);
  if (!att) {
    return {
      ok: false,
      status: 400,
      error: 'Allegato non appartenente al caso',
      code: 'VALIDATION_ERROR',
    };
  }

  const existing = await query(
    `
    SELECT id FROM commercial_case_checklist_attachments
    WHERE checklist_item_id = @itemId AND attachment_id = @attachmentId
    `,
    { itemId, attachmentId }
  );
  if ((existing.recordset || []).length) {
    return {
      ok: true,
      already: true,
      link: {
        id: existing.recordset[0].id,
        checklist_item_id: itemId,
        attachment_id: attachmentId,
        file_name: att.file_name,
        commercial_doc_role: att.commercial_doc_role,
        attachment_uuid: att.attachment_uuid,
        item_ref: item.item_ref,
        phase: item.phase,
      },
    };
  }

  const ins = await query(
    `
    INSERT INTO commercial_case_checklist_attachments
      (checklist_item_id, attachment_id, created_by)
    OUTPUT INSERTED.id, INSERTED.checklist_item_id, INSERTED.attachment_id, INSERTED.created_at
    VALUES (@itemId, @attachmentId, @userId)
    `,
    { itemId, attachmentId, userId: userId != null ? userId : null }
  );
  const row = (ins.recordset || [])[0];
  if (!row) {
    return { ok: false, status: 500, error: 'Collegamento fallito', code: 'SERVER_ERROR' };
  }
  return {
    ok: true,
    already: false,
    link: {
      id: row.id,
      checklist_item_id: row.checklist_item_id,
      attachment_id: row.attachment_id,
      created_at: row.created_at,
      file_name: att.file_name,
      commercial_doc_role: att.commercial_doc_role,
      attachment_uuid: att.attachment_uuid,
      item_ref: item.item_ref,
      phase: item.phase,
    },
  };
}

async function unlinkAttachment({ caseId, organizationId, itemId, attachmentId }) {
  const item = await assertChecklistItemOnCase(caseId, organizationId, itemId);
  if (!item) {
    return { ok: false, status: 404, error: 'Voce checklist non trovata', code: 'NOT_FOUND' };
  }

  const del = await query(
    `
    DELETE ca
    OUTPUT DELETED.id, DELETED.checklist_item_id, DELETED.attachment_id
    FROM commercial_case_checklist_attachments AS ca
    INNER JOIN commercial_case_checklist AS ccl ON ccl.id = ca.checklist_item_id
    INNER JOIN commercial_cases AS cc ON cc.id = ccl.case_id
    WHERE ca.checklist_item_id = @itemId
      AND ca.attachment_id = @attachmentId
      AND ccl.case_id = @caseId
      AND cc.organization_id = @organizationId
    `,
    { itemId, attachmentId, caseId, organizationId }
  );
  if (!(del.recordset || []).length) {
    return { ok: false, status: 404, error: 'Collegamento non trovato', code: 'NOT_FOUND' };
  }
  return { ok: true, deleted: del.recordset[0] };
}

/**
 * Aggrega link per checklist_item_id (per getCase).
 */
function groupLinksByItemId(links) {
  const map = new Map();
  for (const link of links || []) {
    const key = link.checklist_item_id;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(link);
  }
  return map;
}

module.exports = {
  parsePositiveInt,
  listLinksForCase,
  listMissingRequiredAttachmentRefs,
  linkAttachment,
  unlinkAttachment,
  groupLinksByItemId,
};
