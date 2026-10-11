import { getWeldingProcessSelectOptions } from "../data/weldingProcesses4063";

/**
 * Opzioni select processo (catalogo ISO 4063). Se `current` è un valore salvato
 * fuori catalogo (legacy) viene aggiunto come opzione extra, così non si perde in modifica.
 * @param {string|null|undefined} current
 * @param {{ includeAltro?: boolean }} [opts]
 * @returns {Array<{ value: string, label: string }>}
 */
export function getProcessSelectOptions(current, opts = {}) {
  const options = getWeldingProcessSelectOptions({ includeAltro: opts.includeAltro ?? false });
  const raw = current == null ? "" : String(current).trim();
  if (!raw || options.some((o) => o.value === raw)) return options;
  return [...options, { value: raw, label: `${raw} (non in elenco)` }];
}

/** Etichetta leggibile per tabelle/liste; ricade sul valore grezzo se fuori catalogo. */
export function getProcessLabel(code) {
  if (code == null || code === "") return "";
  const found = getWeldingProcessSelectOptions({ includeAltro: false }).find((o) => o.value === String(code));
  return found ? found.label : String(code);
}
