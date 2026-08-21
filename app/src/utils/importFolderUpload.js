/** Limite allineato a multer in importJobs.routes.js */
export const MAX_IMPORT_JOB_FILES = 80;

/** Title / messaggio gate: create e upload richiedono un'azienda cliente in Ambito. */
export const COMPANY_REQUIRED_UPLOAD_TITLE =
  "Scegli un'azienda cliente in Ambito (in alto). Con Tutto lo studio o Patrimonio non si crea un job e non si caricano file.";

/** Upload su job esistente: Ambito deve coincidere con l'azienda del job. */
export const AMBITO_JOB_MISMATCH_TITLE =
  "Ambito diverso dall'azienda di questo job";

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
 * Ambito header e company del job sono la stessa azienda cliente.
 * @param {unknown} scopeCompanyId
 * @param {unknown} jobCompanyId
 * @returns {boolean}
 */
export function scopeMatchesJobCompany(scopeCompanyId, jobCompanyId) {
  if (!isClientCompanyId(scopeCompanyId) || !isClientCompanyId(jobCompanyId)) return false;
  return String(parseInt(scopeCompanyId, 10)) === String(parseInt(jobCompanyId, 10));
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
 * Tutti i file utilizzabili (niente junk OS), senza tagliare al tetto 80.
 * Per il piano di carico cartella: l'utente conferma, poi i lotti spezzano a 80.
 * @param {FileList|File[]|null|undefined} fileList
 * @returns {{ files: File[], skippedJunk: number }}
 */
export function collectImportFiles(fileList) {
  const all = Array.from(fileList || []);
  const files = all.filter((f) => f && (f.name || f.webkitRelativePath) && !isJunkOsFile(f));
  return {
    files,
    skippedJunk: all.length - files.length,
  };
}

/**
 * Tiene tutti i tipi di file (docx, xlsx, dwg, immagini, PDF…).
 * Salta solo spazzatura OS. Taglia al limite per job (upload singolo / PDF).
 * @param {FileList|File[]|null|undefined} fileList
 * @returns {{ files: File[], skippedJunk: number, truncated: boolean }}
 */
export function takeImportFiles(fileList) {
  const { files, skippedJunk } = collectImportFiles(fileList);
  const truncated = files.length > MAX_IMPORT_JOB_FILES;
  return {
    files: files.slice(0, MAX_IMPORT_JOB_FILES),
    skippedJunk,
    truncated,
  };
}
