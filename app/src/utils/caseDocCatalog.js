/**
 * Catalogazione documenti cliente su caso commerciale (VC-2).
 * Specchio FE dei ruoli whitelist in caseDocumentAnalysis.service (BE).
 * ING-1: suggerimento batch da nome/path (pattern Import PDF path-only, senza LLM).
 * ING-2: matching MIME/path/confidence + gate Analizza (estende ING-1, niente secondo storage).
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

const CONFIDENCE_RANK = Object.freeze({
  high: 0,
  medium: 1,
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
    re: /\b(disegno|drawing|tavola|planimetr|\bdwg\b|\bdxf\b|blueprint)\b/i,
    role: 'drawing',
  },
]);

/**
 * Segmenti di cartella (path Import / webkitRelativePath residuo nel nome) → ruolo.
 * Più stretti delle regole nome: solo cartelle tipiche mole file cliente.
 */
const ROLE_FOLDER_RULES = Object.freeze([
  { re: /^(rfq|richieste|richiesta[\s_-]?offerta)$/i, role: 'rfq' },
  { re: /^(capitolat[oi]|specifiche|specs?)$/i, role: 'capitolato' },
  { re: /^(ordin[ie]|orders?|po|purchase[\s_-]?orders?)$/i, role: 'order' },
  { re: /^(offert[ea]|preventiv[oi]|quotes?)$/i, role: 'quote' },
  { re: /^(disegn[oi]|drawings?|tavole|dwg|cad)$/i, role: 'drawing' },
]);

/** MIME / estensione senza keyword nel nome → confidence medium. */
const ROLE_MIME_RULES = Object.freeze([
  {
    test: (mime, ext) =>
      mime.startsWith('image/')
      || mime.includes('dwg')
      || mime.includes('dxf')
      || mime === 'application/acad'
      || mime === 'image/vnd.dwg'
      || mime === 'application/dxf'
      || ['dwg', 'dxf', 'png', 'jpg', 'jpeg', 'webp', 'tif', 'tiff', 'bmp'].includes(ext),
    role: 'drawing',
    reason: 'da tipo file',
  },
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

function fileExtension(fileName) {
  const base = String(fileName || '').replace(/\\/g, '/').split('/').pop() || '';
  const dot = base.lastIndexOf('.');
  if (dot < 0) return '';
  return base.slice(dot + 1).toLowerCase();
}

function pathFolderSegments(fileName) {
  const raw = String(fileName || '').replace(/\\/g, '/').trim();
  if (!raw || !raw.includes('/')) return [];
  const parts = raw.split('/').filter(Boolean);
  // Escludi il basename: solo cartelle
  return parts.slice(0, -1);
}

function matchNameRules(fileName) {
  const raw = String(fileName || '').replace(/\\/g, '/').trim();
  if (!raw) return null;
  const relaxed = raw.replace(/[_-]+/g, ' ');
  for (const source of [raw, relaxed]) {
    for (const rule of ROLE_NAME_RULES) {
      if (rule.re.test(source)) {
        return { role: rule.role, reason: 'dal nome', confidence: 'high' };
      }
    }
  }
  return null;
}

function matchFolderRules(fileName) {
  for (const segment of pathFolderSegments(fileName)) {
    const relaxed = segment.replace(/[_-]+/g, ' ').trim();
    for (const source of [segment, relaxed]) {
      for (const rule of ROLE_FOLDER_RULES) {
        if (rule.re.test(source)) {
          return { role: rule.role, reason: 'da cartella', confidence: 'high' };
        }
      }
    }
  }
  return null;
}

function matchMimeRules(fileName, mimeType) {
  const mime = String(mimeType || '').toLowerCase();
  const ext = fileExtension(fileName);
  for (const rule of ROLE_MIME_RULES) {
    if (rule.test(mime, ext)) {
      return { role: rule.role, reason: rule.reason, confidence: 'medium' };
    }
  }
  return null;
}

/**
 * Suggerisce un ruolo catalogo da nome file / path relativo (senza LLM, senza testo).
 * ING-1 API: opts.mimeType. Confidence non esposta per retrocompat test ING-1.
 * @param {string|null|undefined} fileName
 * @param {{ mimeType?: string|null }} [opts]
 * @returns {{ role: string|null, reason: string|null }}
 */
export function suggestCommercialDocRoleFromName(fileName, opts = {}) {
  const full = suggestCommercialDocRole({
    file_name: fileName,
    mime_type: opts.mimeType,
  });
  return { role: full.role, reason: full.reason };
}

/**
 * Matching ING-2: nome → cartella → MIME/estensione, con confidence.
 * @param {{ file_name?: string, original_name?: string, mime_type?: string }|null|undefined} att
 * @returns {{ role: string|null, reason: string|null, confidence: 'high'|'medium'|null }}
 */
export function suggestCommercialDocRole(att) {
  const fileName = att?.file_name || att?.original_name || '';
  const mimeType = att?.mime_type || null;

  const fromName = matchNameRules(fileName);
  if (fromName) return fromName;

  const fromFolder = matchFolderRules(fileName);
  if (fromFolder) return fromFolder;

  const fromMime = matchMimeRules(fileName, mimeType);
  if (fromMime) return fromMime;

  return { role: null, reason: null, confidence: null };
}

function roleSuggestRank(role) {
  if (role && Object.prototype.hasOwnProperty.call(ROLE_SUGGEST_PRIORITY, role)) {
    return ROLE_SUGGEST_PRIORITY[role];
  }
  return 90;
}

function confidenceRank(confidence) {
  if (confidence && Object.prototype.hasOwnProperty.call(CONFIDENCE_RANK, confidence)) {
    return CONFIDENCE_RANK[confidence];
  }
  return 50;
}

/**
 * Costruisce proposte HITL per classificazione batch (ING-1 + ING-2 confidence).
 * Default: solo allegati non ancora catalogati; auto-seleziona solo indizi high.
 *
 * @param {object[]} attachments
 * @param {{ onlyUncataloged?: boolean }} [opts]
 * @returns {Array<{
 *   attachmentId: number|string,
 *   fileName: string,
 *   currentRole: string|null,
 *   suggestedRole: string|null,
 *   reason: string|null,
 *   confidence: 'high'|'medium'|null,
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

    const { role: suggestedRole, reason, confidence } = suggestCommercialDocRole(att);
    const draftRole = suggestedRole || current || '';
    rows.push({
      attachmentId: att.attachment_id,
      fileName: att.file_name || att.original_name || `Allegato #${att.attachment_id}`,
      currentRole: current,
      suggestedRole,
      reason,
      confidence: suggestedRole ? confidence : null,
      // ING-2: conferma bulk più smart — solo indizi forti pre-spuntati
      selected: confidence === 'high',
      draftRole,
    });
  }

  rows.sort((a, b) => {
    const ca = confidenceRank(a.confidence);
    const cb = confidenceRank(b.confidence);
    if (ca !== cb) return ca - cb;
    const ra = a.suggestedRole ? roleSuggestRank(a.suggestedRole) : 80;
    const rb = b.suggestedRole ? roleSuggestRank(b.suggestedRole) : 80;
    if (ra !== rb) return ra - rb;
    return String(a.fileName).localeCompare(String(b.fileName), 'it');
  });
  return rows;
}

/**
 * Applica selezione bulk per confidence (HITL smart).
 * @param {Array<{ confidence?: string|null, suggestedRole?: string|null, draftRole?: string }>} rows
 * @param {'high'|'any'} mode
 * @returns {typeof rows}
 */
export function applyBatchSelectionMode(rows, mode) {
  const list = Array.isArray(rows) ? rows : [];
  if (mode === 'any') {
    return list.map((r) => ({
      ...r,
      selected: Boolean(r.suggestedRole || isCatalogedDocRole(r.draftRole)),
    }));
  }
  // high (default)
  return list.map((r) => ({
    ...r,
    selected: r.confidence === 'high' && Boolean(r.suggestedRole),
  }));
}

export function honestSuggestLabel(suggestedRole, reason, confidence = null) {
  if (!suggestedRole) return 'Nessun indizio dal nome — scegli tu';
  const label = roleLabel(suggestedRole);
  let why = reason || 'dal nome';
  if (reason === 'immagine') why = 'da tipo file';
  const conf =
    confidence === 'high'
      ? 'indizio forte'
      : confidence === 'medium'
        ? 'indizio debole'
        : null;
  return conf
    ? `Probabile: ${label} (${why} · ${conf})`
    : `Probabile: ${label} (${why})`;
}

/**
 * Readiness gate prima di Analizza documenti (VC-2/ING-2).
 * Non blocca se ci sono catalogati analizzabili; soft-warn se restano da catalogare.
 *
 * @param {object[]} attachments
 * @returns {{
 *   canAnalyze: boolean,
 *   analyzableCount: number,
 *   uncatalogedCount: number,
 *   highHintCount: number,
 *   mediumHintCount: number,
 *   softWarnUncataloged: boolean,
 *   blockedReason: string|null,
 *   suggestBatchCta: boolean,
 * }}
 */
export function getCatalogAnalyzeGate(attachments) {
  const list = Array.isArray(attachments) ? attachments : [];
  const analyzableIds = listAnalyzableCatalogAttachmentIds(list);
  const uncataloged = list.filter((a) => !isCatalogedDocRole(a.commercial_doc_role));
  const suggestions = buildBatchRoleSuggestions(uncataloged.length ? uncataloged : list, {
    onlyUncataloged: true,
  });
  const highHintCount = suggestions.filter((s) => s.confidence === 'high').length;
  const mediumHintCount = suggestions.filter((s) => s.confidence === 'medium').length;
  const canAnalyze = analyzableIds.length > 0;

  let blockedReason = null;
  if (!canAnalyze) {
    if (uncataloged.length > 0) {
      blockedReason =
        highHintCount > 0 || mediumHintCount > 0
          ? 'Ci sono indizi di ruolo — conferma con Suggerisci ruoli (batch) o assegna Disegno / Capitolato PDF / Ordine PDF'
          : 'Cataloga almeno un allegato con ruolo Disegno, Capitolato o Ordine (PDF) prima di analizzare';
    } else {
      blockedReason =
        'Nessun allegato catalogato analizzabile (Disegno / Capitolato PDF / Ordine PDF)';
    }
  }

  return {
    canAnalyze,
    analyzableCount: analyzableIds.length,
    uncatalogedCount: uncataloged.length,
    highHintCount,
    mediumHintCount,
    softWarnUncataloged: canAnalyze && uncataloged.length > 0,
    blockedReason,
    suggestBatchCta: !canAnalyze && uncataloged.length > 0,
  };
}
