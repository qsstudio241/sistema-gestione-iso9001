/**
 * Mirror FE — proposte citate fonti pubbliche (CTX-3).
 * Fonte canonica: backend/src/data/aiContextEnrichment.js.
 * HITL: conflict → defaultSelected false (no overwrite silenzioso).
 */

export const ANAGRAFICA_ENRICH_FIELDS = Object.freeze([
  "name",
  "vat_number",
  "address",
  "sector",
]);

export const FIELD_LABELS = Object.freeze({
  name: "Nome",
  vat_number: "P.IVA",
  address: "Indirizzo",
  sector: "Settore",
});

export function normalizeStr(value) {
  return String(value == null ? "" : value).trim();
}

export function valuesDiffer(a, b) {
  return normalizeStr(a).toLowerCase() !== normalizeStr(b).toLowerCase();
}

export function buildPublicSourceUrl({ vat_number, legal_name, name } = {}) {
  const vat = normalizeStr(vat_number).replace(/\D/g, "");
  if (vat) {
    return `https://www.registroimprese.it/ricerca-libera?q=${encodeURIComponent(vat)}`;
  }
  const q = normalizeStr(legal_name || name);
  if (q) {
    return `https://www.registroimprese.it/ricerca-libera?q=${encodeURIComponent(q)}`;
  }
  return "https://www.registroimprese.it/";
}

export function formatCandidateAddress(candidate = {}) {
  if (!candidate || typeof candidate !== "object") return "";
  if (normalizeStr(candidate.address)) return normalizeStr(candidate.address);
  const cityLine = [candidate.cap, candidate.city].filter((x) => normalizeStr(x)).join(" ");
  return [candidate.street, cityLine, candidate.province]
    .map((x) => normalizeStr(x))
    .filter(Boolean)
    .join(", ");
}

export function mapCandidateToAnagrafica(candidate = {}) {
  return {
    name: normalizeStr(candidate.legal_name || candidate.name),
    vat_number: normalizeStr(candidate.vat_number),
    address: formatCandidateAddress(candidate),
    sector: normalizeStr(candidate.sector || candidate.ateco_primary_desc),
  };
}

/**
 * @returns {{ proposals: object[], source: string, source_url: string }}
 */
export function buildCitedProposals(current = {}, candidate = {}, meta = {}) {
  const mapped = mapCandidateToAnagrafica(candidate);
  const source = normalizeStr(meta.source || candidate.source) || "registro";
  const source_url =
    normalizeStr(meta.source_url || candidate.source_url) ||
    buildPublicSourceUrl({
      vat_number: mapped.vat_number || current.vat_number,
      legal_name: mapped.name || current.name,
      name: mapped.name || current.name,
    });

  const proposals = [];
  for (const field of ANAGRAFICA_ENRICH_FIELDS) {
    const proposed = mapped[field];
    if (!proposed) continue;
    const cur = normalizeStr(current[field]);
    if (cur && !valuesDiffer(cur, proposed)) continue;
    const conflict = !!cur && valuesDiffer(cur, proposed);
    proposals.push({
      field,
      label: FIELD_LABELS[field] || field,
      current: cur || null,
      proposed,
      source,
      source_url,
      conflict,
      defaultSelected: !conflict,
    });
  }

  return { proposals, source, source_url };
}

export function applySelectedProposals(current = {}, proposals = [], selectedFields = []) {
  const next = { ...current };
  const selected = new Set(
    (Array.isArray(selectedFields) ? selectedFields : [])
      .map((k) => normalizeStr(k))
      .filter(Boolean)
  );
  for (const p of proposals || []) {
    if (!p || !selected.has(p.field)) continue;
    if (!normalizeStr(p.proposed)) continue;
    next[p.field] = p.proposed;
  }
  return next;
}

/** Compat legacy CompanyRegistrySearch.toAnagrafica (name/vat/address). */
export function toAnagraficaCompat(row) {
  const mapped = mapCandidateToAnagrafica(row);
  return {
    name: mapped.name,
    vat_number: mapped.vat_number,
    address: mapped.address,
  };
}
