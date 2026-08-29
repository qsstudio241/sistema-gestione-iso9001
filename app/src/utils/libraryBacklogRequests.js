/**
 * Richieste Libreria aggiunte dallo studio (LN-5).
 * Persistenza locale per org — niente secondo SoT DB finché HITL non sceglie storage server.
 * Il backlog piattaforma resta `normeMancantiBacklog.json` / NORME_MANCANTI_BACKLOG.md.
 */

const STORAGE_PREFIX = "sgq_library_requests_v1_";

export function libraryRequestsStorageKey(organizationId) {
  const org = organizationId != null ? String(organizationId) : "unknown";
  return `${STORAGE_PREFIX}${org}`;
}

export function loadLibraryRequests(organizationId) {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(libraryRequestsStorageKey(organizationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLibraryRequests(organizationId, items) {
  if (typeof localStorage === "undefined") return;
  const list = Array.isArray(items) ? items : [];
  localStorage.setItem(
    libraryRequestsStorageKey(organizationId),
    JSON.stringify(list)
  );
}

/**
 * @param {object} draft
 * @returns {object} nuova riga normalizzata
 */
export function normalizeLibraryRequestDraft(draft = {}) {
  const code = String(draft.code || "").trim();
  if (!code) {
    throw new Error("Codice / titolo obbligatorio");
  }
  const status = draft.status || "da_richiedere";
  const allowed = ["da_richiedere", "pdf_ricevuto", "digitalizzata", "parcheggio"];
  return {
    id: draft.id || `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    code,
    impact: String(draft.impact || "").trim() || "—",
    status: allowed.includes(status) ? status : "da_richiedere",
    priority: String(draft.priority || "P2").trim() || "P2",
    notes: String(draft.notes || "").trim(),
    source: "studio",
    created_at: draft.created_at || new Date().toISOString(),
  };
}

export function addLibraryRequest(organizationId, draft) {
  const next = normalizeLibraryRequestDraft(draft);
  const list = loadLibraryRequests(organizationId);
  const merged = [next, ...list];
  saveLibraryRequests(organizationId, merged);
  return next;
}

export function removeLibraryRequest(organizationId, id) {
  const list = loadLibraryRequests(organizationId).filter((r) => r.id !== id);
  saveLibraryRequests(organizationId, list);
  return list;
}

/** Riga Markdown compatibile con NORME_MANCANTI_BACKLOG.md */
export function formatLibraryRequestMarkdownRow(item) {
  const code = item?.code || "";
  const impact = item?.impact || "";
  const status = item?.status || "da_richiedere";
  const priority = item?.priority || "P2";
  const notes = item?.notes || "";
  return `| ${code} | ${impact} | \`${status}\` | ${priority} | ${notes} |`;
}

export function mergeBacklogRows(platformItems, studioItems) {
  const platform = (platformItems || []).map((row) => ({
    ...row,
    source: "piattaforma",
    id: row.id || `plat-${row.code}`,
  }));
  const studio = studioItems || [];
  return [...studio, ...platform];
}
