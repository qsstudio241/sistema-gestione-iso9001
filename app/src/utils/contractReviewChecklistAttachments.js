/**
 * Helper puri ponte checklist ↔ allegati (PONTE-1 layout A).
 */

export function isAttachmentRequiredFlag(value) {
  return value === true || value === 1 || value === '1';
}

export function hasLinkedAttachments(item) {
  const links = item?.linked_attachments;
  return Array.isArray(links) && links.length > 0;
}

/**
 * Normalizza una riga checklist da API → state FE.
 * Deve conservare i campi ponte (attachment_required, linked_attachments):
 * senza di essi badge / soft warn / Scollega restano vuoti dopo loadDetail.
 */
export function normalizeChecklistRow(row = {}) {
  const requiredRaw = row.attachment_required ?? row.attachmentRequired;
  const linksRaw = row.linked_attachments ?? row.linkedAttachments;
  return {
    id: row.id,
    phase: row.phase,
    item_ref: row.item_ref ?? row.itemRef,
    item_text: row.item_text ?? row.itemText,
    answer: row.answer,
    notes: row.notes ?? '',
    attachment_required: requiredRaw === true || requiredRaw === 1 || requiredRaw === '1' ? 1 : 0,
    linked_attachments: Array.isArray(linksRaw) ? linksRaw : [],
  };
}

/** Soft gate: badge ambra se required e senza file collegato. */
export function missingRequiredAttachment(item) {
  return isAttachmentRequiredFlag(item?.attachment_required) && !hasLinkedAttachments(item);
}

/** Elenco ref voci required senza allegato (export soft warning / gate UI). */
export function listMissingRequiredAttachmentRefs(checklist = []) {
  return (checklist || [])
    .filter((item) => missingRequiredAttachment(item))
    .map((item) => String(item.item_ref || item.ref || '').trim())
    .filter(Boolean);
}

export function catalogRoleLabel(role, options = []) {
  const key = String(role || '').trim().toLowerCase();
  const hit = (options || []).find((o) => o.value === key);
  return hit ? hit.label : key || '';
}
