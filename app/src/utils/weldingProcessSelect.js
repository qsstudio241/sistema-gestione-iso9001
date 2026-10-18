import { getWeldingProcessSelectOptions, normalizeWeldingProcessCode } from "../data/weldingProcesses4063";

/**
 * Codice ISO 4063 canonico per un valore salvato (es. "783-STUD WELDING" -> "783").
 * Non tocca elenchi con più codici ("135, 138") né testi senza codice numerico: restano invariati.
 */
export function canonicalizeProcessValue(value) {
  if (value == null || value === "") return value;
  const raw = String(value).trim();
  const tokens = new Set(raw.match(/\b\d{2,3}\b/g) || []);
  if (tokens.size !== 1) return value;
  return normalizeWeldingProcessCode(raw) || value;
}

/**
 * Opzioni select processo (catalogo ISO 4063). Se `current` è un valore salvato
 * fuori catalogo (legacy) viene aggiunto come opzione extra, così non si perde in modifica.
 * @param {string|null|undefined} current
 * @param {{ includeAltro?: boolean }} [opts]
 * @returns {Array<{ value: string, label: string }>}
 */
export function getProcessSelectOptions(current, opts = {}) {
  const options = getWeldingProcessSelectOptions({ includeAltro: opts.includeAltro ?? false });
  const raw = current == null ? "" : String(canonicalizeProcessValue(current)).trim();
  if (!raw || options.some((o) => o.value === raw)) return options;
  return [...options, { value: raw, label: `${raw} (non in elenco)` }];
}

/**
 * Etichetta per tabelle/liste: solo corrispondenza esatta col catalogo. I valori legacy
 * («783-STUD WELDING») restano grezzi, coerenti col filtro server a match esatto.
 */
export function getProcessLabel(code) {
  if (code == null || code === "") return "";
  const found = getWeldingProcessSelectOptions({ includeAltro: false }).find((o) => o.value === String(code));
  return found ? found.label : String(code);
}
