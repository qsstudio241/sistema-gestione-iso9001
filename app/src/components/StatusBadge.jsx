/**
 * StatusBadge  -  Componente badge di stato unificato
 *
 * Copre: stato documento, audit, NC, qualità  norma, progetto, utente, licenza.
 * Retrocompatibile: le classi CSS esistenti continuano a funzionare.
 */

import React from "react";
import "./StatusBadge.css";

const STATUS_CONFIGS = {
  document: {
    vigente:         { label: "Vigente",         color: "green"  },
    rilasciato:      { label: "Rilasciato",      color: "green"  },
    bozza:           { label: "Bozza",           color: "blue"   },
    in_revisione:    { label: "In revisione",    color: "blue"   },
    in_approvazione: { label: "In approvazione", color: "yellow" },
    obsoleto:        { label: "Obsoleto",        color: "grey"   },
  },
  audit: {
    draft:       { label: "Bozza",      color: "grey"   },
    in_progress: { label: "In corso",   color: "blue"   },
    suspended:   { label: "Sospeso",    color: "yellow" },
    completed:   { label: "Completato", color: "green"  },
    approved:    { label: "Approvato",  color: "teal"   },
    archived:    { label: "Archiviato", color: "slate"  },
  },
  nc: {
    open:        { label: "Aperta",     color: "red"    },
    in_progress: { label: "In corso",   color: "orange" },
    resolved:    { label: "Risolta",    color: "green"  },
    verified:    { label: "Verificata", color: "blue"   },
    closed:      { label: "Chiusa",     color: "purple" },
  },
  norm_quality: {
    good:     { label: "Buona",      color: "green"  },
    partial:  { label: "Parziale",   color: "yellow" },
    ocr_poor: { label: "OCR scarso", color: "red"    },
    poor:     { label: "OCR scarso", color: "red"    },
  },
  project: {
    offerta:     { label: "Offerta",     color: "blue"   },
    aperta:      { label: "Aperta",      color: "green"  },
    chiusa:      { label: "Chiusa",      color: "grey"   },
    sospesa:     { label: "Sospesa",     color: "yellow" },
    attivo:      { label: "Attivo",      color: "green"  },
    sospeso:     { label: "Sospeso",     color: "yellow" },
    completato:  { label: "Completato",  color: "teal"   },
    annullato:   { label: "Annullato",   color: "grey"   },
  },
  user: {
    active:   { label: "Attivo",       color: "green"  },
    inactive: { label: "Disattivato",  color: "red"    },
    orphan:   { label: "Incompleto",   color: "yellow" },
  },
  license: {
    active:   { label: "Attivo",      color: "green" },
    inactive: { label: "Non attivo",  color: "grey"  },
  },
  norm_catalog: {
    active:     { label: "In vigore",            color: "green"  },
    withdrawn:  { label: "Ritirata",             color: "red"    },
    superseded: { label: "Sostituita",           color: "yellow" },
    unknown:    { label: "Stato non disponibile", color: "grey"  },
    loading:    { label: "Verifica in corso\u2026", color: "grey" },
  },
};

export default function StatusBadge({
  status,
  type = "document",
  label: customLabel,
  size = "default",
  className = "",
}) {
  const typeConfig = STATUS_CONFIGS[type] || STATUS_CONFIGS.document;
  const cfg = typeConfig[status];

  if (!cfg && !customLabel) return null;

  const colorClass = cfg ? `sgq-badge--${cfg.color}` : "sgq-badge--grey";
  const displayLabel = customLabel || cfg?.label || status;
  const sizeClass = size !== "default" ? `sgq-badge--${size}` : "";

  return (
    <span
      className={`sgq-badge ${colorClass} ${sizeClass} ${className}`.trim()}
      data-status={status}
      data-type={type}
    >
      {displayLabel}
    </span>
  );
}

StatusBadge.TYPES = Object.keys(STATUS_CONFIGS);
StatusBadge.getStatuses = (type) => Object.keys(STATUS_CONFIGS[type] || {});
