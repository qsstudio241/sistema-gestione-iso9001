/**
 * IngestReviewDialog — revisione campi estratti pre-commit (IG-3)
 */
import React, { useState, useEffect, useMemo } from "react";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import { repairTextEncoding } from "../utils/textEncodingRepair";
import IngestSourcePreview from "./IngestSourcePreview";
import "./IngestReviewDialog.css";

const CONFIDENCE_LABELS = {
  high: { label: "Alta", className: "ingest-review__confidence--high" },
  medium: { label: "Media", className: "ingest-review__confidence--medium" },
  low: { label: "Bassa", className: "ingest-review__confidence--low" },
};

function formatFieldValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (Array.isArray(value)) return value.map((v) => repairTextEncoding(String(v))).join(", ");
  return repairTextEncoding(String(value));
}

function ConfidenceBadge({ level }) {
  const meta = CONFIDENCE_LABELS[level] || { label: "N/D", className: "ingest-review__confidence--unknown" };
  return <span className={`ingest-review__confidence ${meta.className}`}>{meta.label}</span>;
}

function FieldInput({ field, value, onChange }) {
  const common = {
    id: `ingest-field-${field.key}`,
    className: "ingest-review__input",
    value: value ?? "",
    onChange: (e) => onChange(field.key, e.target.value),
  };

  if (field.type === "select" && Array.isArray(field.options)) {
    return (
      <select {...common}>
        <option value="">— Seleziona —</option>
        {field.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (field.type === "number") {
    return <input {...common} type="number" step="any" />;
  }

  if (field.type === "date") {
    return <input {...common} type="date" />;
  }

  return <input {...common} type="text" />;
}

export default function IngestReviewDialog({
  open,
  docType,
  fileName,
  stagingId = null,
  previewFile = null,
  mimeType = "application/pdf",
  fields = {},
  fieldConfidence = {},
  warnings = [],
  qualificationType,
  onConfirm,
  onReject,
  onClose,
  busy = false,
}) {
  const schema = useMemo(() => getSchemaForDocType(docType), [docType]);
  const [form, setForm] = useState({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (open) {
      const cleaned = {};
      for (const [k, v] of Object.entries(fields || {})) {
        cleaned[k] = typeof v === "string" ? repairTextEncoding(v) : v;
      }
      setForm(cleaned);
      setExpanded(false);
    }
  }, [open, fields]);

  useEffect(() => {
    if (!open || !expanded) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, expanded]);

  if (!open) return null;

  const schemaFields = schema?.fields || [];
  const title = schema?.label || docType;

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleConfirm() {
    const payload = { ...form };
    for (const field of schemaFields) {
      if (field.type === "number" && payload[field.key] !== "" && payload[field.key] != null) {
        payload[field.key] = Number(payload[field.key]);
      }
      if (field.type === "boolean") {
        payload[field.key] = payload[field.key] === true || payload[field.key] === "true" || payload[field.key] === "1";
      }
    }
    await onConfirm(payload);
  }

  return (
    <div
      className={`ingest-review__overlay ${expanded ? "ingest-review__overlay--expanded" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ingest-review-title"
    >
      <div className={`ingest-review__dialog ${expanded ? "ingest-review__dialog--expanded" : ""}`}>
        <header className="ingest-review__header">
          <div className="ingest-review__header-top">
            <h2 id="ingest-review-title">Revisione {title}</h2>
            <button
              type="button"
              className="ingest-review__expand-btn"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? "Riduci" : "Ingrandisci affiancato"}
            </button>
          </div>
          <p className="ingest-review__file">File: <strong>{fileName}</strong></p>
          {qualificationType && (
            <p className="ingest-review__meta">Tipo rilevato: {qualificationType}</p>
          )}
          <p className="ingest-review__meta ingest-review__meta--hint">
            {expanded
              ? "Documento e campi a schermo intero: confronta e correggi senza chiudere la modale."
              : "Confronta il documento a sinistra con i campi estratti a destra prima di confermare."}
          </p>
        </header>

        <div className="ingest-review__layout">
          <aside className="ingest-review__preview-pane">
            <IngestSourcePreview
              stagingId={stagingId}
              fileName={fileName}
              mimeType={mimeType}
              previewFile={previewFile}
              tall={expanded}
            />
          </aside>

          <div className="ingest-review__form-pane">
            {warnings.length > 0 && (
              <div className="ingest-review__warnings">
                {warnings.map((w, i) => (
                  <div key={i} className="ingest-review__warning">{"\u26A0\uFE0F"} {w}</div>
                ))}
              </div>
            )}

            <div className="ingest-review__fields">
              {schemaFields.map((field) => (
                <label key={field.key} className="ingest-review__field" htmlFor={`ingest-field-${field.key}`}>
                  <span className="ingest-review__field-label">
                    {field.label}
                    {field.required && <span className="ingest-review__required">*</span>}
                    <ConfidenceBadge level={fieldConfidence[field.key]} />
                  </span>
                  <FieldInput field={field} value={form[field.key]} onChange={handleChange} />
                  {field.hint && <span className="ingest-review__hint">{repairTextEncoding(field.hint)}</span>}
                </label>
              ))}
            </div>
          </div>
        </div>

        <footer className="ingest-review__actions">
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--primary"
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? "Salvataggio..." : "Conferma e salva"}
          </button>
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--danger"
            onClick={onReject}
            disabled={busy}
          >
            Scarta
          </button>
          <button
            type="button"
            className="ingest-review__btn ingest-review__btn--secondary"
            onClick={onClose}
            disabled={busy}
          >
            Chiudi
          </button>
        </footer>
      </div>
    </div>
  );
}

export { ConfidenceBadge, formatFieldValue };
