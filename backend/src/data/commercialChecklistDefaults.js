/**
 * Voci default checklist Riesame requisiti (ISO 9001 §8.2).
 * Core immutabile per ref: la personalizzazione studio estende o varia il testo, non rimuove.
 */

const PRELIMINARY_ITEMS = Object.freeze([
  { ref: 'P1', text: 'Requisiti tecnici del cliente chiaramente identificati' },
  { ref: 'P2', text: 'Norme e standard applicabili identificati' },
  { ref: 'P3', text: 'Capacità produttiva adeguata ai requisiti' },
  { ref: 'P4', text: 'Competenze e qualifiche del personale disponibili' },
  { ref: 'P5', text: 'Attrezzature e strumenti necessari disponibili' },
  { ref: 'P6', text: 'Documentazione di sistema applicabile aggiornata' },
  { ref: 'P7', text: 'Requisiti di consegna e tempistiche realizzabili' },
  { ref: 'P8', text: 'Requisiti legali e cogenti applicabili identificati' },
  { ref: 'P9', text: 'Subforniture necessarie identificate' },
  { ref: 'P10', text: 'Rischi contrattuali valutati' },
]);

const FINAL_ITEMS = Object.freeze([
  { ref: 'F1', text: "Ordine conforme all'offerta inviata" },
  { ref: 'F2', text: "Variazioni rispetto all'offerta documentate" },
  { ref: 'F3', text: "Capacità confermata alla data dell'ordine" },
  { ref: 'F4', text: 'Qualifiche personale ancora valide per la commessa' },
  { ref: 'F5', text: 'Piano qualità/controlli definito' },
  { ref: 'F6', text: 'Responsabile commessa assegnato' },
]);

const CORE_REFS_BY_PHASE = Object.freeze({
  preliminary: Object.freeze(PRELIMINARY_ITEMS.map((i) => i.ref)),
  final: Object.freeze(FINAL_ITEMS.map((i) => i.ref)),
});

function getDefaultItems(phase) {
  if (phase === 'preliminary') return PRELIMINARY_ITEMS;
  if (phase === 'final') return FINAL_ITEMS;
  return [];
}

function isCoreRef(phase, ref) {
  const list = CORE_REFS_BY_PHASE[phase];
  return Array.isArray(list) && list.includes(String(ref));
}

/**
 * Unisce default ISO §8.2 con voci template (varianti testo core + extras).
 * Non omette mai un ref core. Gli extras sono voci template non-core.
 *
 * @param {'preliminary'|'final'} phase
 * @param {Array<{ item_ref?: string, ref?: string, item_text?: string, text?: string, sort_order?: number, is_core?: boolean|number }>} templateItems
 * @returns {Array<{ ref: string, text: string, is_core: boolean, sort_order: number }>}
 */
function mergeTemplateWithDefaults(phase, templateItems) {
  const defaults = getDefaultItems(phase);
  if (!defaults.length) return [];

  const byRef = new Map();
  for (const raw of templateItems || []) {
    const ref = String(raw.item_ref || raw.ref || '').trim();
    if (!ref) continue;
    const text = String(raw.item_text || raw.text || '').trim();
    if (!text) continue;
    byRef.set(ref, {
      ref,
      text: text.substring(0, 500),
      sort_order: Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : 0,
      is_core: !!(raw.is_core === true || raw.is_core === 1 || isCoreRef(phase, ref)),
    });
  }

  const result = [];
  defaults.forEach((d, idx) => {
    const override = byRef.get(d.ref);
    result.push({
      ref: d.ref,
      text: override ? override.text : d.text,
      is_core: true,
      sort_order: override && Number.isFinite(override.sort_order) ? override.sort_order : idx,
    });
    byRef.delete(d.ref);
  });

  const extras = [...byRef.values()]
    .filter((item) => !isCoreRef(phase, item.ref))
    .sort((a, b) => a.sort_order - b.sort_order || a.ref.localeCompare(b.ref));

  extras.forEach((item, i) => {
    result.push({
      ref: item.ref.substring(0, 30),
      text: item.text,
      is_core: false,
      sort_order: Number.isFinite(item.sort_order) ? item.sort_order : defaults.length + i,
    });
  });

  return result;
}

/** Seed completo (entrambe le fasi) per nuovo template studio. */
function buildSeedItemsFromDefaults() {
  const items = [];
  PRELIMINARY_ITEMS.forEach((item, idx) => {
    items.push({
      phase: 'preliminary',
      item_ref: item.ref,
      item_text: item.text,
      sort_order: idx,
      is_core: true,
    });
  });
  FINAL_ITEMS.forEach((item, idx) => {
    items.push({
      phase: 'final',
      item_ref: item.ref,
      item_text: item.text,
      sort_order: idx,
      is_core: true,
    });
  });
  return items;
}

function assertCoreCoverage(items) {
  const byPhase = { preliminary: new Set(), final: new Set() };
  for (const it of items || []) {
    const phase = String(it.phase || '').toLowerCase();
    if (phase !== 'preliminary' && phase !== 'final') continue;
    const ref = String(it.item_ref || it.ref || '').trim();
    if (ref) byPhase[phase].add(ref);
  }
  const missing = [];
  for (const phase of ['preliminary', 'final']) {
    for (const ref of CORE_REFS_BY_PHASE[phase]) {
      if (!byPhase[phase].has(ref)) missing.push(`${phase}:${ref}`);
    }
  }
  return missing;
}

module.exports = {
  PRELIMINARY_ITEMS,
  FINAL_ITEMS,
  CORE_REFS_BY_PHASE,
  getDefaultItems,
  isCoreRef,
  mergeTemplateWithDefaults,
  buildSeedItemsFromDefaults,
  assertCoreCoverage,
};
