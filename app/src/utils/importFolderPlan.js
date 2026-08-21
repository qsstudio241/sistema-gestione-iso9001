/**
 * Piano di carico Import cartella: inventory, etichette path-only, ordine, lotti da 80.
 * Niente LLM. Le regole path ricalcano importScreening (una lista, non le mappe folder).
 */

import { MAX_IMPORT_JOB_FILES, collectImportFiles } from "./importFolderUpload";

/** File nella radice della cartella scelta (niente sottocartella di primo livello). */
export const ROOT_FOLDER_KEY = "__root__";

/**
 * Stesse famiglie di `backend/src/utils/importScreening.js` PATH_RULES,
 * più plurali di cartella (Capitolati) e commessa — obiettivo: commessa prima di Scan.
 * Non copia documentFolderMapping / provisioner / alberi.
 */
const PATH_RULES = [
  { re: /\b(capitolato|capitolati|rfq|richiesta\s+di\s+offerta|ordine)\b/i, docType: "capitolato" },
  { re: /\b(commess)/i, docType: "commessa" },
  { re: /\b(procedur|\bpg[-_\s]?\d)/i, docType: "procedura" },
  { re: /\bmanuale\b/i, docType: "manuale" },
  { re: /\b(istruzion|\biow\b)/i, docType: "istruzione" },
  { re: /\b(modulo|\bmod[-_\s]?\d)/i, docType: "modulo" },
  { re: /\b(wpqr|\bpqr\b|15614)\b/i, docType: "wpqr" },
  { re: /\b(wps\b|15609)\b/i, docType: "wps" },
  { re: /\b(9606|patentino|saldatore)\b/i, docType: "patentino_saldatore" },
  { re: /\b14732\b/i, docType: "qualifica_14732" },
  { re: /\b14731\b/i, docType: "qualifica_14731" },
  { re: /\b(9712|cert[_-]?ndt|\bndt\b)/i, docType: "cert_ndt" },
  { re: /\b(norma|iso[\s_-]?\d{3,5}|uni[\s_-]?\d)/i, docType: "norma" },
];

/** Capitolato e commessa in testa; «altro» / senza tipo in coda. */
const TYPE_PRIORITY = {
  capitolato: 0,
  commessa: 1,
  procedura: 2,
  istruzione: 3,
  modulo: 4,
  manuale: 5,
  wpqr: 6,
  wps: 7,
  patentino_saldatore: 8,
  qualifica_14732: 9,
  qualifica_14731: 10,
  cert_ndt: 11,
  norma: 12,
};

const SHORT_TYPE_LABELS = {
  capitolato: "capitolato",
  commessa: "commessa",
  procedura: "procedura",
  istruzione: "istruzione",
  modulo: "modulo",
  manuale: "manuale",
  wpqr: "wpqr",
  wps: "wps",
  patentino_saldatore: "patentino",
  qualifica_14732: "qualifica 14732",
  qualifica_14731: "qualifica 14731",
  cert_ndt: "certificato NDT",
  norma: "norma",
};

export function relativeImportPath(file) {
  return String(file?.webkitRelativePath || file?.name || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

/**
 * Indizio solo dal path (cartella o nome file). Nessun testo, nessun LLM.
 * @param {unknown} pathStr
 * @returns {string|null}
 */
export function guessTypeFromPath(pathStr) {
  const hay = String(pathStr || "").replace(/\\/g, "/");
  if (!hay.trim()) return null;
  const relaxed = hay.replace(/[_-]+/g, " ");
  for (const source of [hay, relaxed]) {
    for (const rule of PATH_RULES) {
      if (rule.re.test(source)) return rule.docType;
    }
  }
  return null;
}

export function honestPathLabel(docType) {
  if (!docType) return "Da classificare";
  const short = SHORT_TYPE_LABELS[docType] || docType;
  return `Probabile: ${short} (dal nome)`;
}

/**
 * Primo segmento comune = cartella scelta nel picker Chrome.
 * @param {Array<{ webkitRelativePath?: string, name?: string }>} files
 * @returns {string}
 */
export function detectPickedRoot(files) {
  const firsts = (files || [])
    .map((f) => relativeImportPath(f).split("/").filter(Boolean)[0] || "")
    .filter(Boolean);
  if (!firsts.length) return "";
  const root = firsts[0];
  return firsts.every((s) => s === root) ? root : "";
}

/**
 * Cartella di primo livello sotto la radice scelta.
 * Documenti/Capitolati/a.pdf → Capitolati; Documenti/a.pdf → radice.
 * @param {{ webkitRelativePath?: string, name?: string }} file
 * @param {string} [pickedRoot]
 * @returns {string}
 */
export function firstLevelFolderName(file, pickedRoot = "") {
  const parts = relativeImportPath(file).split("/").filter(Boolean);
  if (pickedRoot && parts[0] === pickedRoot) {
    return parts.length >= 3 ? parts[1] : "";
  }
  return parts.length >= 2 ? parts[0] : "";
}

function folderDisplayName(key, pickedRoot) {
  if (key) return key;
  return pickedRoot || "(nella cartella)";
}

function guessFolderType(displayName, folderFiles) {
  const fromName = guessTypeFromPath(displayName);
  if (fromName) return fromName;
  for (const file of folderFiles.slice(0, 8)) {
    const t = guessTypeFromPath(relativeImportPath(file));
    if (t) return t;
  }
  return null;
}

function typeRank(docType) {
  if (docType && Object.prototype.hasOwnProperty.call(TYPE_PRIORITY, docType)) {
    return TYPE_PRIORITY[docType];
  }
  return 100;
}

export function compareFoldersForUpload(a, b) {
  const d = typeRank(a?.guessedType) - typeRank(b?.guessedType);
  if (d !== 0) return d;
  return String(a?.name || "").localeCompare(String(b?.name || ""), "it");
}

function sumBytes(files) {
  return (files || []).reduce((s, f) => s + (Number(f?.size) || 0), 0);
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatImportSize(bytes) {
  const n = Number(bytes) || 0;
  const mb = n / (1024 * 1024);
  if (mb < 0.05) return `${Math.max(n > 0 ? 1 : 0, Math.round(n / 1024))} KB`;
  if (mb < 10) return `${mb.toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(mb)} MB`;
}

/**
 * @param {number} lotCount
 * @param {number} [chunkSize]
 * @returns {string}
 */
export function estimateLotsText(lotCount, chunkSize = MAX_IMPORT_JOB_FILES) {
  const n = Number(lotCount) || 0;
  if (n <= 0) return "Nessun file da caricare.";
  const lotWord = n === 1 ? "lotto" : "lotti";
  return `Servono ${n} ${lotWord} da ${chunkSize}. Tempo orientativo: ${humanTimeRange(n, n * 2)} (1–2 min a lotto).`;
}

function humanTimeRange(minMin, maxMin) {
  if (maxMin <= 2) return "circa 1–2 minuti";
  if (maxMin < 60) return `circa ${minMin}–${maxMin} minuti`;
  const minH = Math.max(1, Math.round(minMin / 60));
  const maxH = Math.max(minH, Math.round(maxMin / 60));
  if (minH === maxH) return `circa ${minH} ${minH === 1 ? "ora" : "ore"}`;
  return `circa ${minH}–${maxH} ore`;
}

/**
 * Inventario browser: file, size, cartelle di primo livello, etichette path-only.
 * @param {FileList|File[]|null|undefined} fileList
 */
export function buildFolderInventory(fileList) {
  const { files, skippedJunk } = collectImportFiles(fileList);
  const pickedRoot = detectPickedRoot(files);
  const byFolder = new Map();
  for (const file of files) {
    const name = firstLevelFolderName(file, pickedRoot);
    const key = name || ROOT_FOLDER_KEY;
    if (!byFolder.has(key)) byFolder.set(key, []);
    byFolder.get(key).push(file);
  }
  const folders = [...byFolder.entries()].map(([key, folderFiles]) => {
    const displayName = folderDisplayName(key === ROOT_FOLDER_KEY ? "" : key, pickedRoot);
    const guessedType = guessFolderType(displayName, folderFiles);
    return {
      key,
      name: displayName,
      fileCount: folderFiles.length,
      totalBytes: sumBytes(folderFiles),
      guessedType,
      label: honestPathLabel(guessedType),
      files: folderFiles,
    };
  });
  folders.sort(compareFoldersForUpload);
  return {
    pickedRoot,
    files,
    skippedJunk,
    totalBytes: sumBytes(files),
    folders,
  };
}

/**
 * Spezza i file di una cartella in chunk da `chunkSize` (tetto job).
 * @param {File[]} files
 * @param {number} [chunkSize]
 * @returns {File[][]}
 */
export function chunkFiles(files, chunkSize = MAX_IMPORT_JOB_FILES) {
  const size = Number(chunkSize) > 0 ? Number(chunkSize) : MAX_IMPORT_JOB_FILES;
  const list = Array.from(files || []);
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

/**
 * @param {string} rootName
 * @param {{ guessedType?: string|null, folderName: string, folderIndex: number, folderTotal: number, globalIndex: number, globalTotal: number }} lot
 */
export function buildLotTitle(rootName, lot) {
  const root = String(rootName || "Documenti").trim() || "Documenti";
  if (lot?.guessedType && lot.folderTotal > 1) {
    return `${root} / ${lot.folderName} (${lot.folderIndex}/${lot.folderTotal})`;
  }
  if (lot?.guessedType) {
    return `${root} / ${lot.folderName}`;
  }
  return `${root} ${lot.globalIndex}/${lot.globalTotal}`;
}

/**
 * Lotti da caricare: cartelle selezionate, già ordinate (capitolato/commessa prima).
 * @param {{ pickedRoot?: string, folders?: Array }} inventory
 * @param {Set<string>|string[]|null|undefined} selectedKeys
 * @param {number} [chunkSize]
 */
export function buildUploadLots(inventory, selectedKeys, chunkSize = MAX_IMPORT_JOB_FILES) {
  const selected = selectedKeys instanceof Set
    ? selectedKeys
    : new Set(Array.from(selectedKeys || []));
  const folders = (inventory?.folders || []).filter((f) => selected.has(f.key));
  const lots = [];
  for (const folder of folders) {
    const chunks = chunkFiles(folder.files, chunkSize);
    chunks.forEach((chunk, i) => {
      lots.push({
        files: chunk,
        folderKey: folder.key,
        folderName: folder.name,
        guessedType: folder.guessedType,
        folderIndex: i + 1,
        folderTotal: chunks.length,
      });
    });
  }
  const rootName = inventory?.pickedRoot || "Documenti";
  lots.forEach((lot, i) => {
    lot.globalIndex = i + 1;
    lot.globalTotal = lots.length;
    lot.title = buildLotTitle(rootName, lot);
    lot.progressLabel = `Lotto ${lot.globalIndex}/${lot.globalTotal} — ${lot.folderName}`;
  });
  return lots;
}

/**
 * Hint job solo se è un tipo registro (commessa non è un document_type).
 * @param {string|null|undefined} guessedType
 * @returns {string|undefined}
 */
export function lotDocumentTypeHint(guessedType) {
  if (!guessedType || guessedType === "commessa" || guessedType === "altro") return undefined;
  return guessedType;
}
