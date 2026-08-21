/** Limite allineato a multer in importJobs.routes.js */
export const MAX_IMPORT_JOB_FILES = 80;

/** Title / messaggio gate: upload e screening richiedono un'azienda cliente sul job. */
export const COMPANY_REQUIRED_UPLOAD_TITLE =
  "Scegli un'azienda sul job (non Tutto lo studio)";

/**
 * True solo per un id azienda cliente numerico.
 * "" (Tutto lo studio) e "studio" (Patrimonio) non valgono — lezione PR #428.
 * @param {unknown} value
 * @returns {boolean}
 */
export function isClientCompanyId(value) {
  if (value == null || value === "") return false;
  if (String(value) === "studio") return false;
  const n = parseInt(value, 10);
  return Number.isFinite(n) && n > 0 && String(n) === String(value).trim();
}

/**
 * Prefill create-job dal CompanyScope header: solo azienda cliente.
 * Non usa l'id omonimo patrimonio (il context lo normalizza già a "studio").
 * @param {unknown} scopeCompanyId
 * @returns {string}
 */
export function resolvePrefillCompanyId(scopeCompanyId) {
  return isClientCompanyId(scopeCompanyId) ? String(parseInt(scopeCompanyId, 10)) : "";
}

const JUNK_FILE_RE = /^(thumbs\.db|desktop\.ini|\.ds_store)$/i;

/**
 * Ultimo segmento del path relativo salvato in original_name.
 * @param {unknown} stored
 * @returns {string}
 */
export function basenameImportRelativePath(stored) {
  if (stored == null) return "";
  const s = String(stored).replace(/\\/g, "/").trim();
  if (!s) return "";
  const i = s.lastIndexOf("/");
  return i >= 0 ? s.slice(i + 1) : s;
}

function isJunkOsFile(file) {
  const name = String(file?.name || "").split(/[/\\]/).pop() || "";
  return JUNK_FILE_RE.test(name);
}

/**
 * React non garantisce l'attributo non-standard webkitdirectory via JSX.
 * @param {HTMLInputElement|null} el
 */
export function bindDirectoryPicker(el) {
  if (!el) return;
  el.setAttribute("webkitdirectory", "");
  el.setAttribute("directory", "");
  el.multiple = true;
}

/**
 * Tiene tutti i tipi di file (docx, xlsx, dwg, immagini, PDF…).
 * Salta solo spazzatura OS. Taglia al limite per job.
 * @param {FileList|File[]|null|undefined} fileList
 * @returns {{ files: File[], skippedJunk: number, truncated: boolean }}
 */
export function takeImportFiles(fileList) {
  const all = Array.from(fileList || []);
  const usable = all.filter((f) => f && (f.name || f.webkitRelativePath) && !isJunkOsFile(f));
  const skippedJunk = all.length - usable.length;
  const truncated = usable.length > MAX_IMPORT_JOB_FILES;
  return {
    files: usable.slice(0, MAX_IMPORT_JOB_FILES),
    skippedJunk,
    truncated,
  };
}
