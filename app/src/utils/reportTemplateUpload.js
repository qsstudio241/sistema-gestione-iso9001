/** Validazione client upload template Word (.docx) — allineata a multer backend (5 MB) */

import PizZip from "pizzip";

export const MAX_TEMPLATE_BYTES = 5 * 1024 * 1024;

/** Modelli di sistema scaricabili da /templates/ (placeholder + marker) */
export const SYSTEM_TEMPLATE_DOWNLOADS = [
  { label: "ISO 9001", path: "/templates/ISO9001-audit-report.docx", filename: "ISO9001-audit-report.docx" },
  { label: "ISO 14001", path: "/templates/ISO14001-audit-report.docx", filename: "ISO14001-audit-report.docx" },
  { label: "ISO 45001", path: "/templates/ISO45001-audit-report.docx", filename: "ISO45001-audit-report.docx" },
  { label: "ISO 3834-2", path: "/templates/ISO3834-audit-report.docx", filename: "ISO3834-audit-report.docx" },
  { label: "Verbale visita (generico)", path: "/templates/VerbaleVisita-generic.docx", filename: "VerbaleVisita-generic.docx" },
  { label: "Verbale visita QTAFI", path: "/templates/Verbale_di_riunione_QTAFI_VIS001.docx", filename: "Verbale_di_riunione_QTAFI_VIS001.docx" },
];

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

export function validateDuplicateTemplateName(name) {
  const trimmed = name != null ? String(name).trim() : "";
  if (!trimmed) return "Inserisci un nome per il template duplicato.";
  if (trimmed.length > 255) return "Il nome non può superare 255 caratteri.";
  return null;
}

/**
 * Verifica presenza marker OOXML nel document.xml (warning soft, non blocca upload)
 * @returns {Promise<string[]|null>} nomi marker mancanti, null se tutti presenti
 */
export async function checkDocxMarkers(file) {
  if (!file) return null;
  try {
    const buffer = await file.arrayBuffer();
    const zip = new PizZip(buffer);
    const docXml = zip.file("word/document.xml")?.asText() || "";
    const missing = [];
    if (!docXml.includes("CHECKLIST_MARKER")) missing.push("CHECKLIST_MARKER");
    if (!docXml.includes("RILIEVI_MARKER")) missing.push("RILIEVI_MARKER");
    return missing.length ? missing : null;
  } catch {
    return null;
  }
}

export function formatMarkerWarning(missing) {
  if (!missing?.length) return null;
  const list = missing.join(" e ");
  return `Attenzione: nel file mancano i marker ${list}. L'export Word potrebbe non iniettare checklist e rilievi automaticamente.`;
}

/** URL download per riga griglia (sistema = path app, org = backend uploads) */
export function getReportTemplateDownloadUrl(template, apiBaseUrl) {
  if (!template?.file_path) return null;
  const fp = template.file_path;
  if (fp.startsWith("/templates/")) {
    return { url: fp, filename: fp.split("/").pop() || "template.docx" };
  }
  const backendBase = (apiBaseUrl || "").replace(/\/api\/v1\/?$/, "");
  const url = backendBase + (fp.startsWith("/") ? fp : `/${fp}`);
  const filename = fp.split("/").pop() || `${template.name || "template"}.docx`;
  return { url, filename };
}

export function isSystemReportTemplate(template) {
  return !!(template?.is_system || template?.organization_id == null);
}

export function formatTemplateOrigin(template) {
  return isSystemReportTemplate(template) ? "Sistema" : "Studio";
}
