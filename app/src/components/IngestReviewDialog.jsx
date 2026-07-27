/**
 * IngestReviewDialog — revisione campi estratti pre-commit (IG-3)
 */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import { getApplicableWelderFields } from "../data/weldingQualificationRules9606";
import { repairTextEncoding } from "../utils/textEncodingRepair";
import useIngestReviewSplit from "../hooks/useIngestReviewSplit";
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

/**
 * Un campo è "confermato dall'AI" (mostrato readonly, minimo intervento umano)
 * solo se la confidenza della pipeline è alta E c'è un valore non vuoto.
 * Altrimenti (media/bassa/assente) l'operatore deve vederlo subito editabile.
 */
function isFieldConfirmedByAi(confidence, value) {
  if (confidence !== "high") return false;
  if (value == null || value === "") return false;
  if (Array.isArray(value) && value.length === 0) return false;
  return true;
}

function optionLabelFor(field, rawValue) {
  if (!Array.isArray(field?.options)) return rawValue;
  const opt = field.options.find((o) => String(o.value) === String(rawValue));
  return opt ? opt.label : rawValue;
}

function formatReadonlyDisplay(field, value) {
  if (value == null || value === "") return "\u2014";
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value.map((v) => repairTextEncoding(String(optionLabelFor(field, v)))).join(", ");
  }
  if (typeof value === "boolean") return value ? "Sì" : "No";
  if (field?.type === "select") return repairTextEncoding(String(optionLabelFor(field, value)));
  return repairTextEncoding(String(value));
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
  // Campi confermati dall'AI (alta confidenza) che l'operatore ha scelto di modificare a mano.
  const [editingFields, setEditingFields] = useState(() => new Set());
  const layoutRef = useRef(null);
  const { gridTemplateColumns, startResize, ratio } = useIngestReviewSplit(layoutRef);

  useEffect(() => {
    if (open) {
      const cleaned = {};
      for (const [k, v] of Object.entries(fields || {})) {
        cleaned[k] = typeof v === "string" ? repairTextEncoding(v) : v;
      }
      setForm(cleaned);
      setExpanded(false);
      setEditingFields(new Set());
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

  const isWelderQualification = (schema?.id || docType) === "patentino_saldatore";
  // Diametro tubo (Tabella 7 ISO 9606-1): pertinente solo se il prodotto testato
  // e' un tubo — vedi getApplicableWelderFields per la motivazione normativa.
  const applicableFields = isWelderQualification
    ? getApplicableWelderFields({ productType: form.product_type })
    : null;

  useEffect(() => {
    if (!applicableFields || applicableFields.pipeDiameterApplicable) return;
    setForm((prev) => {
      if (prev.pipe_diameter_mm == null || prev.pipe_diameter_mm === "") return prev;
      return { ...prev, pipe_diameter_mm: "" };
    });
  }, [applicableFields, fields]);

  if (!open) return null;

  const schemaFields = schema?.fields || [];
  const title = schema?.label || docType;

  function isFieldNotApplicable(field) {
    return field.key === "pipe_diameter_mm" && applicableFields != null && !applicableFields.pipeDiameterApplicable;
  }

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleEditField(key) {
    setEditingFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
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
    // Difesa in profondità (client-side): un campo non applicabile non deve mai
    // essere inviato, anche se residuo da un'estrazione AI precedente — il
    // sanitizer backend (numericSanitizer.js) resta comunque la seconda linea.
    if (applicableFields && !applicableFields.pipeDiameterApplicable) {
      payload.pipe_diameter_mm = null;
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
              ? "Documento e campi a schermo intero: trascina il divisore centrale per dare più spazio al PDF o ai campi."
              : "Confronta il documento a sinistra con i campi estratti a destra. Trascina il divisore per ridimensionare le aree."}
          </p>
        </header>

        <div
          ref={layoutRef}
          className="ingest-review__layout"
          style={{ gridTemplateColumns }}
        >
          <aside className="ingest-review__preview-pane">
            <IngestSourcePreview
              stagingId={stagingId}
              fileName={fileName}
              mimeType={mimeType}
              previewFile={previewFile}
              tall={expanded}
            />
          </aside>

          <div
            className="ingest-review__resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Ridimensiona anteprima e campi"
            aria-valuenow={Math.round(ratio * 100)}
            aria-valuemin={28}
            aria-valuemax={72}
            onMouseDown={startResize}
          />

          <div className="ingest-review__form-pane">
            {warnings.length > 0 && (
              <div className="ingest-review__warnings">
                {warnings.map((w, i) => (
                  <div key={i} className="ingest-review__warning">{"\u26A0\uFE0F"} {w}</div>
                ))}
              </div>
            )}

            <div className="ingest-review__fields">
              {schemaFields.map((field) => {
                const notApplicable = isFieldNotApplicable(field);
                const confidence = fieldConfidence[field.key];
                const confirmedByAi = isFieldConfirmedByAi(confidence, form[field.key]);
                const manuallyEditing = editingFields.has(field.key);
                const showEditable = !notApplicable && (!confirmedByAi || manuallyEditing);
                const attentionLevel = notApplicable ? "not-applicable" : confirmedByAi ? "confirmed" : (confidence || "low");

                return (
                  <div
                    key={field.key}
                    className={`ingest-review__field ingest-review__field--${attentionLevel}`}
                  >
                    <label className="ingest-review__field-label" htmlFor={`ingest-field-${field.key}`}>
                      {field.label}
                      {field.required && <span className="ingest-review__required">*</span>}
                      {!notApplicable && <ConfidenceBadge level={confidence} />}
                    </label>

                    {notApplicable ? (
                      <div className="ingest-review__readonly ingest-review__readonly--na">
                        <span className="ingest-review__readonly-value">
                          Non applicabile — prodotto: Piastra
                        </span>
                      </div>
                    ) : showEditable ? (
                      <>
                        <FieldInput field={field} value={form[field.key]} onChange={handleChange} />
                        {confirmedByAi && manuallyEditing && (
                          <button
                            type="button"
                            className="ingest-review__cancel-edit-btn"
                            onClick={() => toggleEditField(field.key)}
                          >
                            Annulla modifica (torna al valore confermato dall'AI)
                          </button>
                        )}
                      </>
                    ) : (
                      <div className="ingest-review__readonly">
                        <span className="ingest-review__readonly-value">
                          {"\u2713"} {formatReadonlyDisplay(field, form[field.key])}
                        </span>
                        <button
                          type="button"
                          className="ingest-review__edit-btn"
                          onClick={() => toggleEditField(field.key)}
                        >
                          Modifica
                        </button>
                      </div>
                    )}

                    {!notApplicable && field.hint && <span className="ingest-review__hint">{repairTextEncoding(field.hint)}</span>}
                  </div>
                );
              })}
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

export { ConfidenceBadge, formatFieldValue, isFieldConfirmedByAi, formatReadonlyDisplay };
