/**
 * Catalogazione documenti cliente su caso commerciale (VC-2).
 * Specchio FE dei ruoli whitelist in caseDocumentAnalysis.service (BE).
 * ING-1: suggerimento batch da nome/path (pattern Import PDF path-only, senza LLM).
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

/** Priorità display / riordino suggerimenti (ordine operativo, non alfabetico). */
const ROLE_SUGGEST_PRIORITY = Object.freeze({
  order: 0,
  rfq: 1,
  capitolato: 2,
  quote: 3,
  drawing: 4,
  other: 5,
});

/**
 * Euristiche path/nome → ruolo catalogo VC-2.
 * Allineate allo spirito di importFolderPlan PATH_RULES, ma mappate ai soli ruoli whitelist.
 * Prima regola che matcha vince.
 */
const ROLE_NAME_RULES = Object.freeze([
  { re: /\b(rfq|richiesta\s+di\s+offerta|richiesta\s+offerta)\b/i, role: 'rfq' },
  { re: /\b(capitolato|capitolati|spec(?:ifica)?\s+tecnic)/i, role: 'capitolato' },
  {
    re: /\b(ordine|order|purchase[\s_-]?order|\bpo[\s_-]?\d|\bord[\s_-]?\d)/i,
    role: 'order',
  },
  {
    re: /\b(offerta|preventivo|quot(?:e|ation)|proposal)\b/i,
    role: 'quote',
  },
  {
    re: /\b(disegno|drawing|tavola|planimetr|dwg|dxf|blueprint)\b/i,
    role: 'drawing',
  },
  { re: /\.(dwg|dxf|png|jpe?g|webp|tiff?)$/i, role: 'drawing' },
]);

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

/**
 * Suggerisce un ruolo catalogo da nome file / path relativo (senza LLM, senza testo).
 * @param {string|null|undefined} fileName
 * @param {{ mimeType?: string|null }} [opts]
 * @returns {{ role: string|null, reason: string|null }}
 */
export function suggestCommercialDocRoleFromName(fileName, opts = {}) {
  const raw = String(fileName || '').replace(/\\/g, '/').trim();
  if (!raw) return { role: null, reason: null };
  const relaxed = raw.replace(/[_-]+/g, ' ');
  for (const source of [raw, relaxed]) {
    for (const rule of ROLE_NAME_RULES) {
      if (rule.re.test(source)) {
        return { role: rule.role, reason: 'dal nome' };
      }
    }
  }
  const mime = String(opts.mimeType || '').toLowerCase();
  if (mime.startsWith('image/')) {
    return { role: 'drawing', reason: 'immagine' };
  }
  return { role: null, reason: null };
}

function roleSuggestRank(role) {
  if (role && Object.prototype.hasOwnProperty.call(ROLE_SUGGEST_PRIORITY, role)) {
    return ROLE_SUGGEST_PRIORITY[role];
  }
  return 90;
}

/**
 * Costruisce proposte HITL per classificazione batch (ING-1).
 * Default: solo allegati non ancora catalogati; riordino per priorità ruolo suggerito.
 *
 * @param {object[]} attachments
 * @param {{ onlyUncataloged?: boolean }} [opts]
 * @returns {Array<{
 *   attachmentId: number|string,
 *   fileName: string,
 *   currentRole: string|null,
 *   suggestedRole: string|null,
 *   reason: string|null,
 *   selected: boolean,
 *   draftRole: string,
 * }>}
 */
export function buildBatchRoleSuggestions(attachments, opts = {}) {
  const onlyUncataloged = opts.onlyUncataloged !== false;
  const list = Array.isArray(attachments) ? attachments : [];
  const rows = [];

  for (const att of list) {
    if (!att || att.attachment_id == null) continue;
    const current = isCatalogedDocRole(att.commercial_doc_role)
      ? String(att.commercial_doc_role).trim().toLowerCase()
      : null;
    if (onlyUncataloged && current) continue;

    const { role: suggestedRole, reason } = suggestCommercialDocRoleFromName(
      att.file_name || att.original_name,
      { mimeType: att.mime_type },
    );
    const draftRole = suggestedRole || current || '';
    rows.push({
      attachmentId: att.attachment_id,
      fileName: att.file_name || att.original_name || `Allegato #${att.attachment_id}`,
      currentRole: current,
      suggestedRole,
      reason,
      selected: Boolean(suggestedRole),
      draftRole,
    });
  }

  rows.sort((a, b) => {
    const ra = a.suggestedRole ? roleSuggestRank(a.suggestedRole) : 80;
    const rb = b.suggestedRole ? roleSuggestRank(b.suggestedRole) : 80;
    if (ra !== rb) return ra - rb;
    return String(a.fileName).localeCompare(String(b.fileName), 'it');
  });
  return rows;
}

export function honestSuggestLabel(suggestedRole, reason) {
  if (!suggestedRole) return 'Nessun indizio dal nome — scegli tu';
  const label = roleLabel(suggestedRole);
  const why = reason === 'immagine' ? 'da tipo file' : reason || 'dal nome';
  return `Probabile: ${label} (${why})`;
}
