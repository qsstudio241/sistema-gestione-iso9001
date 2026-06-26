/**
 * Mappatura metadati AI (pre-extract) → campi document_registry.
 * Usato da DocumentForm (nuovo) e DocFileDialog (carica file su esistente).
 */

const GENERIC_META_KEYS = new Set(["titolo", "sommario", "warnings", "summary"]);

function pickString(...values) {
  for (const v of values) {
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  return null;
}

function toDateInput(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.substring(0, 10);
  return null;
}

export function isPdfFile(file) {
  if (!file) return false;
  if (file.type === "application/pdf") return true;
  return file.name?.toLowerCase().endsWith(".pdf");
}

/**
 * @param {{ metadata: object, existingDoc?: object|null, onlyEmpty?: boolean }} opts
 * @returns {{ payload: object, filledKeys: string[], labels: string[] }}
 */
export function buildDocumentUpdateFromAiMetadata({
  metadata = {},
  existingDoc = null,
  onlyEmpty = true,
}) {
  const payload = {};
  const filledKeys = [];
  const labels = [];

  const canSet = (field, current) => {
    if (!onlyEmpty) return true;
    const cur = current ?? existingDoc?.[field];
    if (cur == null) return true;
    if (typeof cur === "string") return cur.trim() === "";
    return false;
  };

  const title = pickString(metadata.titolo, metadata.title);
  if (title && canSet("title", null)) {
    payload.title = title;
    filledKeys.push("title");
    labels.push("Titolo");
  }

  const docCode = pickString(metadata.codice, metadata.doc_code, metadata.codice_documento);
  if (docCode && canSet("doc_code", null)) {
    payload.doc_code = docCode;
    filledKeys.push("doc_code");
    labels.push("Codice");
  }

  const revision = pickString(metadata.revisione, metadata.revision, metadata.rev);
  if (revision && canSet("revision", null)) {
    payload.revision = revision;
    filledKeys.push("revision");
    labels.push("Revisione");
  }

  const issueDate = toDateInput(
    metadata.issue_date || metadata.data_emissione || metadata.data_emissione_iso
  );
  if (issueDate && canSet("issue_date", null)) {
    payload.issue_date = issueDate;
    filledKeys.push("issue_date");
    labels.push("Data emissione");
  }

  const expiryDate = toDateInput(
    metadata.expiry_date || metadata.data_scadenza || metadata.scadenza
  );
  if (expiryDate && canSet("expiry_date", null)) {
    payload.expiry_date = expiryDate;
    filledKeys.push("expiry_date");
    labels.push("Data scadenza");
  }

  const responsible = pickString(metadata.responsible, metadata.responsabile);
  if (responsible && canSet("responsible", null)) {
    payload.responsible = responsible;
    filledKeys.push("responsible");
    labels.push("Responsabile");
  }

  const typeEntries = Object.entries(metadata).filter(
    ([k, v]) => !GENERIC_META_KEYS.has(k)
      && ![
        "codice", "doc_code", "codice_documento", "revisione", "revision", "rev",
        "issue_date", "data_emissione", "data_emissione_iso",
        "expiry_date", "data_scadenza", "scadenza", "responsible", "responsabile", "title",
      ].includes(k)
      && v !== null && v !== undefined && v !== ""
  );

  if (typeEntries.length > 0) {
    let existingTsd = {};
    const raw = existingDoc?.type_specific_data;
    if (raw) {
      try {
        existingTsd = typeof raw === "string" ? JSON.parse(raw) : { ...raw };
      } catch {
        existingTsd = {};
      }
    }
    const nextTsd = { ...existingTsd };
    let tsdChanged = false;
    for (const [k, v] of typeEntries) {
      if (!onlyEmpty || !existingTsd[k]) {
        nextTsd[k] = v;
        tsdChanged = true;
        filledKeys.push(`type_${k}`);
        labels.push(k.replace(/_/g, " "));
      }
    }
    if (tsdChanged) {
      payload.type_specific_data = nextTsd;
    }
  }

  return { payload, filledKeys, labels };
}
