/**
 * Catalogazione documenti cliente su caso commerciale (VC-2).
 * Specchio FE dei ruoli whitelist in caseDocumentAnalysis.service (BE).
 */

export const DOC_ROLE_OPTIONS = [
  { value: 'order', label: 'Ordine' },
  { value: 'rfq', label: 'RFQ' },
  { value: 'capitolato', label: 'Capitolato' },
  { value: 'quote', label: 'Offerta' },
  { value: 'drawing', label: 'Disegno' },
  { value: 'other', label: 'Altro' },
];

const ROLE_SET = new Set(DOC_ROLE_OPTIONS.map((o) => o.value));

export function isCatalogedDocRole(docRole) {
  const role = String(docRole || '').trim().toLowerCase();
  return role.length > 0 && ROLE_SET.has(role);
}

/** Stessa regola BE: drawing oppure capitolato|order + PDF. */
export function isAnalyzableCatalogAttachment(att) {
  if (!att || !isCatalogedDocRole(att.commercial_doc_role)) return false;
  const role = String(att.commercial_doc_role).trim().toLowerCase();
  const mime = String(att.mime_type || '').toLowerCase();
  if (role === 'drawing') return true;
  if ((role === 'capitolato' || role === 'order') && mime === 'application/pdf') return true;
  return false;
}

export function roleLabel(docRole) {
  const role = String(docRole || '').trim().toLowerCase();
  const found = DOC_ROLE_OPTIONS.find((o) => o.value === role);
  return found ? found.label : role || 'Da catalogare';
}

/**
 * Raggruppa allegati per ruolo catalogo. Chiave '__uncataloged__' = ruolo assente.
 * @returns {{ key: string, label: string, items: object[] }[]}
 */
export function groupAttachmentsByCatalogRole(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  const buckets = new Map();

  for (const att of list) {
    const cataloged = isCatalogedDocRole(att.commercial_doc_role);
    const key = cataloged
      ? String(att.commercial_doc_role).trim().toLowerCase()
      : '__uncataloged__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(att);
  }

  const order = [...DOC_ROLE_OPTIONS.map((o) => o.value), '__uncataloged__'];
  const groups = [];
  for (const key of order) {
    const items = buckets.get(key);
    if (!items || !items.length) continue;
    groups.push({
      key,
      label: key === '__uncataloged__' ? 'Da catalogare' : roleLabel(key),
      items,
    });
  }
  // Ruoli sconosciuti (non in whitelist) → trattati come da catalogare già sopra;
  // se restano chiavi extra, appendi in coda.
  for (const [key, items] of buckets) {
    if (order.includes(key)) continue;
    groups.push({ key, label: roleLabel(key), items });
  }
  return groups;
}

export function listAnalyzableCatalogAttachmentIds(attachments) {
  return (Array.isArray(attachments) ? attachments : [])
    .filter(isAnalyzableCatalogAttachment)
    .map((a) => a.attachment_id)
    .filter((id) => id != null);
}
