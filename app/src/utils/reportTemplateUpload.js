/** Validazione client upload template Word (.docx) — allineata a multer backend (5 MB) */

export const MAX_TEMPLATE_BYTES = 5 * 1024 * 1024;

export function stripDocxExtension(filename) {
  if (!filename) return "";
  return filename.replace(/\.docx$/i, "");
}

export function validateDocxFile(file) {
  if (!file) return "Seleziona un file Word (.docx).";
  const name = file.name || "";
  if (!name.toLowerCase().endsWith(".docx")) {
    return "Sono consentiti solo file con estensione .docx.";
  }
  if (file.size > MAX_TEMPLATE_BYTES) {
    return `Il file supera il limite di 5 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`;
  }
  return null;
}
