/**
 * STANDARDS_REGISTRY — Source of Truth per gli standard supportati
 *
 * ADR-009 Fase 1: registro centralizzato che sostituisce le mappe locali
 * (es. STANDARDS_CONFIG in AuditAccordionLayout.jsx, STANDARD_TO_SUBSID in
 * AuditClosePanel.jsx) con un unico modulo dati.
 *
 * Test di scalabilità (criterio di accettazione ADR-009):
 * aggiungere un nuovo standard ISO (es. ISO 27001) deve richiedere SOLO:
 *   1. INSERT in `standards` (DB) + seed domande
 *   2. UNA riga qui in STANDARDS_REGISTRY
 *   3. (opz.) un template Word in app/public/templates/
 * E nient'altro nei componenti UI / sync / export.
 *
 * Campi:
 *   key             — chiave interna canonica usata nella checklist (es. "ISO_9001")
 *   standardId      — id numerico in tabella DB `standards`
 *   codes           — tutti i codici accettati da selectedStandards/audit_standards
 *                     (incluse varianti anno: ["ISO_9001", "ISO_9001_2015"])
 *   label           — testo mostrato nell'accordion checklist
 *   shortLabel      — etichetta breve (chip metriche, sidebar)
 *   icon            — emoji icona nella UI
 *   subsId          — id sotto-sezione accordion (univoco, lowercase, senza spazi)
 *   kind            — tassonomia ADR-009:
 *                     'iso_hls'     — standard ISO con High Level Structure (9001/14001/45001)
 *                                     integrabili come SGI
 *                     'iso_process' — standard ISO di processo (3834-2)
 *                                     non integrabili con HLS
 *                     'rdp'         — rapporto specialistico (RDP Mason, futuri VT/MT/PT)
 *                                     singoli, non integrabili
 *                     'custom'      — checklist personalizzata (norma virtuale CUSTOM_<id>)
 *   templateExport  — nome file template Word in /public/templates/ (futuro)
 *   requiresPhotos  — true se richiede foto obbligatorie (RDP, futuri VT/MT/PT)
 */

export const STANDARDS_REGISTRY = {
  ISO_9001: {
    key: "ISO_9001",
    standardId: 1,
    codes: ["ISO_9001", "ISO_9001_2015"],
    label: "ISO 9001:2015 - Qualit\u00e0",
    shortLabel: "9001",
    icon: "\uD83D\uDCCB",
    subsId: "iso-9001",
    kind: "iso_hls",
    templateExport: "ISO9001-audit-report.docx",
    requiresPhotos: false,
  },
  ISO_14001: {
    key: "ISO_14001",
    standardId: 2,
    codes: ["ISO_14001", "ISO_14001_2015"],
    label: "ISO 14001:2015 - Ambiente",
    shortLabel: "14001",
    icon: "\uD83C\uDF31",
    subsId: "iso-14001",
    kind: "iso_hls",
    templateExport: "iso14001-report.docx",
    requiresPhotos: false,
  },
  ISO_45001: {
    key: "ISO_45001",
    standardId: 3,
    codes: ["ISO_45001", "ISO_45001_2018"],
    label: "ISO 45001:2018 - Salute e Sicurezza",
    shortLabel: "45001",
    icon: "\uD83E\uDDBA",
    subsId: "iso-45001",
    kind: "iso_hls",
    templateExport: "iso45001-report.docx",
    requiresPhotos: false,
  },
  ISO_3834_2: {
    key: "ISO_3834_2",
    standardId: 6,
    codes: ["ISO_3834", "ISO_3834_2", "ISO_3834_2_2021"],
    label: "ISO 3834 - Saldatura",
    shortLabel: "3834",
    icon: "\uD83D\uDD27",
    subsId: "iso-3834",
    kind: "iso_process",
    templateExport: "iso3834-report.docx",
    requiresPhotos: false,
  },
  RDP_MSN: {
    key: "RDP_MSN",
    standardId: 7,
    codes: ["RDP_MSN"],
    label: "RDP - Rapporto di Prova",
    shortLabel: "RDP",
    icon: "\uD83D\uDCCA",
    subsId: "rdp-msn",
    kind: "rdp",
    templateExport: "rdp-mason-report.docx",
    requiresPhotos: true,
  },
};

/**
 * Lista ordinata degli standard registrati (utile per render in UI).
 * L'ordine di iterazione segue l'ordine di dichiarazione in STANDARDS_REGISTRY.
 */
export const STANDARDS_LIST = Object.values(STANDARDS_REGISTRY);

/**
 * Mappa key → codes accettati.
 * Esempio: { ISO_9001: ["ISO_9001", "ISO_9001_2015"], ... }
 */
export const STANDARD_INIT_MAP = Object.fromEntries(
  STANDARDS_LIST.map(({ key, codes }) => [key, codes]),
);

/**
 * Mappa codice (qualsiasi variante accettata) → key canonica.
 * Esempio: { ISO_9001_2015: "ISO_9001", ISO_9001: "ISO_9001", ISO_14001_2015: "ISO_14001", ... }
 *
 * Utile per normalizzare input arbitrari da `selectedStandards`.
 */
export const CODE_TO_KEY = Object.fromEntries(
  STANDARDS_LIST.flatMap(({ key, codes }) => codes.map((code) => [code, key])),
);

/**
 * Mappa codice (qualsiasi variante) → subsId accordion.
 * Sostituisce STANDARD_TO_SUBSID locale in AuditClosePanel.jsx.
 * Esempio: { ISO_9001: "iso-9001", ISO_9001_2015: "iso-9001", ... }
 */
export const STANDARD_TO_SUBSID = Object.fromEntries(
  STANDARDS_LIST.flatMap(({ subsId, codes, key }) => [
    [key, subsId],
    ...codes.map((code) => [code, subsId]),
  ]),
);

/**
 * Restituisce la entry registry per una key canonica.
 * @param {string} key - es. "ISO_9001"
 * @returns {object|null}
 */
export function getStandardByKey(key) {
  return STANDARDS_REGISTRY[key] ?? null;
}

/**
 * Restituisce la entry registry per un codice qualsiasi (incluse varianti anno).
 * @param {string} code - es. "ISO_9001_2015" o "ISO_9001"
 * @returns {object|null}
 */
export function getStandardByCode(code) {
  if (!code) return null;
  const key = CODE_TO_KEY[code];
  return key ? STANDARDS_REGISTRY[key] : null;
}

/**
 * Filtra il registry restituendo le entry corrispondenti a `selectedStandards`.
 * Mantiene l'ordine canonico di STANDARDS_LIST (non l'ordine di selezione).
 * Utile per render UI dove l'ordine deve essere stabile.
 *
 * @param {string[]} selectedStandards - array di codici (es. ["ISO_9001_2015", "ISO_14001"])
 * @returns {object[]} entry registry (key, codes, label, ...) ordinate
 */
export function getSelectedStandardEntries(selectedStandards) {
  if (!Array.isArray(selectedStandards) || selectedStandards.length === 0) return [];
  const selectedKeys = new Set(
    selectedStandards.map((code) => CODE_TO_KEY[code]).filter(Boolean),
  );
  return STANDARDS_LIST.filter(({ key }) => selectedKeys.has(key));
}

/**
 * Verifica se un audit ha più di una norma con `kind` differente.
 * Utile per Fase 2 (flag isIntegratedSystem disponibile solo se TUTTE le norme sono iso_hls).
 *
 * @param {string[]} selectedStandards
 * @returns {boolean} true se tutte le norme selezionate hanno kind === 'iso_hls'
 */
export function isAllHls(selectedStandards) {
  const entries = getSelectedStandardEntries(selectedStandards);
  if (entries.length === 0) return false;
  return entries.every(({ kind }) => kind === "iso_hls");
}
