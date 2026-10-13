/**
 * File protetti di /uploads (certificati qualifiche, WPQR, materiali).
 *
 * Il backend non serve più `/uploads/*` in pubblico: il valore salvato nei record
 * (`/uploads/...`) si risolve solo tramite `GET /api/v1/files/content?path=...`
 * con header Authorization. `<a href>`, `<iframe src>` e `window.open` non
 * inviano l'header: si scarica il file con fetch e si usa un blob URL.
 */

const UPLOADS_PREFIX = "/uploads/";

const EXT_BY_MIME = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
};

/** true se il valore è un percorso interno `/uploads/...` (o `uploads/...`). */
export function isUploadsPath(fileUrl) {
  if (fileUrl == null) return false;
  const s = String(fileUrl).trim();
  return s.startsWith(UPLOADS_PREFIX) || s.startsWith("uploads/");
}

/**
 * URL dell'endpoint protetto per un percorso `/uploads/...`; null se non è un
 * percorso interno (il chiamante non deve mai aprire direttamente `/uploads`).
 * @param {string|null|undefined} fileUrl
 * @param {string} apiBaseUrl tipicamente `apiService.baseUrl` (.../api/v1)
 */
export function buildProtectedFileUrl(fileUrl, apiBaseUrl) {
  if (!isUploadsPath(fileUrl)) return null;
  const s = String(fileUrl).trim();
  const normalized = s.startsWith("/") ? s : `/${s}`;
  const base = String(apiBaseUrl || "").replace(/\/+$/, "");
  return `${base}/files/content?path=${encodeURIComponent(normalized)}`;
}

/**
 * Nome file per il download: solo tipo + id (mai nome persona/originale).
 * @param {string} kind es. "qualifica", "wpqr", "materiale"
 * @param {string|number} id
 * @param {string} [mimeType]
 */
export function protectedFileName(kind, id, mimeType) {
  const base = `${String(kind || "documento").replace(/[^a-z0-9-]/gi, "")}-${String(id ?? "").replace(/[^a-z0-9-]/gi, "")}`.replace(/-$/, "");
  const ext = EXT_BY_MIME[String(mimeType || "").split(";")[0].trim().toLowerCase()] || "";
  return `${base}${ext}`;
}

/** Aggiunge l'estensione dedotta dal MIME solo se il nome non ne ha già una. */
export function fileNameWithExt(name, mimeType) {
  const n = String(name || "documento");
  if (/\.[a-z0-9]{2,5}$/i.test(n)) return n;
  const ext = EXT_BY_MIME[String(mimeType || "").split(";")[0].trim().toLowerCase()] || "";
  return `${n}${ext}`;
}

/** Messaggio per l'utente in base allo stato HTTP del download. */
export function protectedFileErrorMessage(status) {
  if (status === 401) return "Sessione scaduta: accedi di nuovo per aprire il file.";
  if (status === 403) return "Non hai i permessi per aprire questo file.";
  if (status === 404) return "File non trovato: potrebbe essere stato rimosso.";
  if (status === 0) return "Connessione assente: riprova.";
  return "Impossibile aprire il file. Riprova tra poco.";
}
