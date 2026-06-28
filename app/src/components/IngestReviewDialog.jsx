/**
 * IngestReviewDialog — revisione campi estratti pre-commit (IG-3)
 */
import React, { useState, useEffect, useMemo } from "react";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import "./IngestReviewDialog.css";

const CONFIDENCE_LABELS = {
  high: { label: "Alta", className: "ingest-review__confidence--high" },
  medium: { label: "Media", className: "ingest-review__confidence--medium" },
  low: { label: "Bassa", className: "ingest-review__confidence--low" },
};

function formatFieldValue(value) {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (Array.isArray(value)) return value.join(", ");
  return String(value);
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

  useEffect(() => {
    if (open) {
      setForm({ ...fields });
    }
  }, [open, fields]);

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
    <div className="ingest-review__overlay" role="dialog" aria-modal="true" aria-labelledby="ingest-review-title">
      <div className="ingest-review__dialog">
        <header className="ingest-review__header">
          <h2 id="ingest-review-title">Revisione {title}</h2>
          <p className="ingest-review__file">File: <strong>{fileName}</strong></p>
          {qualificationType && (
            <p className="ingest-review__meta">Tipo rilevato: {qualificationType}</p>
          )}
        </header>

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
              {field.hint && <span className="ingest-review__hint">{field.hint}</span>}
            </label>
          ))}
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
