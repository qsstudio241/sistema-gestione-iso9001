/** Limite allineato a multer in importJobs.routes.js */
export const MAX_IMPORT_JOB_FILES = 80;

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

function isPdfFile(file) {
  const name = String(file?.name || file?.webkitRelativePath || "");
  return /\.pdf$/i.test(name);
}

/**
 * Filtra PDF e taglia al limite per job.
 * @param {FileList|File[]|null|undefined} fileList
 * @returns {{ files: File[], skippedNonPdf: number, truncated: boolean }}
 */
export function takeImportFiles(fileList) {
  const all = Array.from(fileList || []);
  const pdfs = all.filter(isPdfFile);
  const skippedNonPdf = all.length - pdfs.length;
  const truncated = pdfs.length > MAX_IMPORT_JOB_FILES;
  return {
    files: pdfs.slice(0, MAX_IMPORT_JOB_FILES),
    skippedNonPdf,
    truncated,
  };
}
