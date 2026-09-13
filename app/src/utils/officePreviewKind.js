/**
 * Quali file Office si possono aprire con i viewer in-app
 * (DocumentDocxViewer / SpreadsheetViewer).
 *
 * Word: solo OOXML (.docx / .docm). Il .doc/.rtf binario non è supportato da docx-preview.
 * Excel: SheetJS legge .xlsx / .xls / .xlsm.
 */

const WORD_PREVIEW_EXTS = [".docx", ".docm"];
const EXCEL_PREVIEW_EXTS = [".xlsx", ".xls", ".xlsm"];

export function getFileExt(fileName) {
  if (!fileName) return "";
  const dot = String(fileName).lastIndexOf(".");
  if (dot === -1) return "";
  return String(fileName).slice(dot).toLowerCase();
}

/**
 * @param {string} [fileName]
 * @param {string} [mimeType]
 * @returns {"word" | "excel" | null}
 */
export function officePreviewKind(fileName, mimeType = "") {
  const ext = getFileExt(fileName);
  if (WORD_PREVIEW_EXTS.includes(ext)) return "word";
  if (EXCEL_PREVIEW_EXTS.includes(ext)) return "excel";

  const mime = String(mimeType || "").toLowerCase();
  if (mime.includes("wordprocessingml")) return "word";
  if (mime.includes("spreadsheetml") || mime.includes("excel")) return "excel";
  return null;
}

export { WORD_PREVIEW_EXTS, EXCEL_PREVIEW_EXTS };
