/**
 * Filtri unificati sulle card KPI (banner) della tab Analisi.
 * Stesso pattern di qualificationsSituazione.js: le card sono l'unica fonte
 * per lo stato; niente tendina "Tutti gli stati" né checkbox "mostra chiusi".
 *
 * Totale = valutazioni attive (esclusi i chiusi, default lista).
 * Chiusi = card dedicata. Alta priorità = soglia P×G, sempre sul working set.
 */

export const RISK_STAT_ITEMS = [
  { key: "total", label: "Totale", cls: "" },
  { key: "open", label: "Aperti", cls: "stat-open" },
  { key: "in_treatment", label: "In trattamento", cls: "stat-treat" },
  { key: "mitigated", label: "Mitigati", cls: "stat-miti" },
  { key: "closed", label: "Chiusi", cls: "stat-closed" },
  { key: "high_priority", label: "Alta priorità", cls: "stat-high" },
];

export function toggleRiskStatFilter(current, next) {
  if (!next || next === "total") return "total";
  return current === next ? "total" : next;
}

export function countForRiskStat(stats, key) {
  if (!stats) return 0;
  if (key === "total") {
    const total = Number(stats.total) || 0;
    const closed = Number(stats.closed) || 0;
    return Math.max(0, total - closed);
  }
  const n = Number(stats[key]);
  return Number.isFinite(n) ? n : 0;
}

export function titleForRiskStat(key, label) {
  if (key === "total") return "Mostra tutte le valutazioni attive";
  return `Filtra: ${label}`;
}
