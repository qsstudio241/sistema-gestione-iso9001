/**
 * MetricsByStandardChip — chip riusabile che mostra i conteggi NC (e opzionalmente
 * OSS/OM) per ciascuna norma selezionata in un audit.
 *
 * ADR-009 Fase 1 — DoD: sidebar audit ISO 9001+14001 mostra
 * "9001: 2 NC · 14001: 1 NC · totale 3".
 *
 * Aggiunge una riga compatta accanto a metadata audit (header/sidebar). Non rompe
 * il caso mono-standard: con una sola norma mostra solo "2 NC" senza prefisso
 * (il totale corrisponde alla singola norma).
 *
 * Props:
 *   selectedStandards — array codici standard (es. ["ISO_9001_2015", "ISO_14001"])
 *   byStandard        — mappa { [normKey]: { totalNC, totalOSS, totalOM, ... } }
 *                       (output di calculateByStandardMetrics o metrics.byStandard)
 *   includeOss        — opzionale: mostra anche OSS accanto a NC (default false)
 *   includeOm         — opzionale: mostra anche OM accanto a NC (default false)
 *   className         — className aggiuntiva sul wrapper (default vuoto)
 */
import { useMemo } from "react";
import { getSelectedStandardEntries } from "../data/standardsRegistry";
import "./MetricsByStandardChip.css";

function formatNormMetrics(metrics, { includeOss, includeOm }) {
  const parts = [`${metrics.totalNC} NC`];
  if (includeOss) parts.push(`${metrics.totalOSS} OSS`);
  if (includeOm) parts.push(`${metrics.totalOM} OM`);
  return parts.join(" · ");
}

function MetricsByStandardChip({
  selectedStandards,
  byStandard,
  includeOss = false,
  includeOm = false,
  className = "",
}) {
  const entries = useMemo(
    () => getSelectedStandardEntries(selectedStandards),
    [selectedStandards],
  );

  // Filtra solo le norme che hanno effettivamente metriche disponibili
  const items = useMemo(
    () =>
      entries
        .map((entry) => ({
          entry,
          metrics: byStandard?.[entry.key] ?? null,
        }))
        .filter(({ metrics }) => metrics && Number.isFinite(metrics.totalQuestions)),
    [entries, byStandard],
  );

  if (items.length === 0) return null;

  // Calcolo totali sommando solo le norme presenti (no doppio conteggio se
  // qualche norma non ha metriche).
  const totals = items.reduce(
    (acc, { metrics }) => ({
      totalNC: acc.totalNC + (metrics.totalNC || 0),
      totalOSS: acc.totalOSS + (metrics.totalOSS || 0),
      totalOM: acc.totalOM + (metrics.totalOM || 0),
    }),
    { totalNC: 0, totalOSS: 0, totalOM: 0 },
  );

  const isMulti = items.length > 1;
  const wrapperClass = `metrics-by-standard-chip ${className}`.trim();

  return (
    <div
      className={wrapperClass}
      role="group"
      aria-label="Conteggio rilievi per norma"
      data-testid="metrics-by-standard-chip"
    >
      {items.map(({ entry, metrics }) => (
        <span
          key={entry.key}
          className="metrics-by-standard-chip__item"
          title={`${entry.label}: ${metrics.totalNC} NC, ${metrics.totalOSS} OSS, ${metrics.totalOM} OM`}
        >
          {isMulti && (
            <span className="metrics-by-standard-chip__label">
              {entry.shortLabel}:
            </span>
          )}{" "}
          <span className="metrics-by-standard-chip__value">
            {formatNormMetrics(metrics, { includeOss, includeOm })}
          </span>
        </span>
      ))}
      {isMulti && (
        <span
          className="metrics-by-standard-chip__total"
          title="Totale rilievi su tutte le norme selezionate"
        >
          totale {formatNormMetrics(totals, { includeOss, includeOm })}
        </span>
      )}
    </div>
  );
}

export default MetricsByStandardChip;
