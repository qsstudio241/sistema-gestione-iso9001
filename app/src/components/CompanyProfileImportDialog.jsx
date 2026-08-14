/**
 * Dialog conferma import Excel profilo azienda (ADR-018 S3b).
 * Riusa il guscio CSS di DeadlineImportDialog (classi did-*).
 * Detect = dry-run: qui si vede la preview; conferma scrive i campi.
 */

import React from "react";
import "./DeadlineImportDialog.css";

function formatPreviewValue(value) {
  if (value === null || value === undefined || value === "") return "\u2014";
  if (value === 1 || value === true || value === "1") return "S\u00ec";
  if (value === 0 || value === false || value === "0") return "No";
  return String(value);
}

function previewEntries(preview, mapping, fieldLabels) {
  const src = preview && typeof preview === "object" ? preview : {};
  return Object.entries(src)
    .filter(([, v]) => v !== null && v !== undefined && v !== "")
    .map(([key, value]) => ({
      key,
      label: (fieldLabels && fieldLabels[key]) || key,
      value: formatPreviewValue(value),
      header: mapping?.[key] || "",
    }));
}

function CompanyProfileImportDialog({
  detection,
  fieldLabels = {},
  onConfirm,
  onClose,
  loading = false,
  title = "Importa profilo da Excel",
}) {
  const rows = previewEntries(detection?.preview, detection?.mapping, fieldLabels);
  const canImport = detection?.canImport !== false && rows.length > 0;
  const level = detection?.confidence || "bassa";
  const badgeClass = level === "alta" ? "did-badge did-badge--high" : "did-badge did-badge--medium";
  const badgeText = level === "alta"
    ? "Rilevamento alta affidabilit\u00e0"
    : level === "media"
      ? "Rilevamento media affidabilit\u00e0"
      : "Rilevamento bassa affidabilit\u00e0";

  return (
    <div className="did-overlay" role="dialog" aria-modal="true" aria-labelledby="cpid-title">
      <div className="did-modal">
        <div className="did-header">
          <h2 id="cpid-title" className="did-header__title">{title}</h2>
          <button className="did-close" onClick={onClose} aria-label="Chiudi" disabled={loading} type="button">
            {"\u00D7"}
          </button>
        </div>

        <div className="did-body">
          <div className="did-file-info">
            <span className="did-file-name">{detection?.fileName || "file.xlsx"}</span>
            <span className={badgeClass}>{badgeText}</span>
          </div>

          <div className="did-stats">
            <span>{rows.length} campi riconosciuti</span>
            {detection?.sheetName ? <span>Foglio: {detection.sheetName}</span> : null}
          </div>

          {detection?.error && (
            <p className="studio-hint">{detection.error}</p>
          )}
          {detection?.warning && (
            <p className="studio-hint">{detection.warning}</p>
          )}

          {rows.length === 0 ? (
            <p className="studio-hint">Nessun campo profilo riconosciuto nel file.</p>
          ) : (
            <div className="did-form" data-testid="cpid-preview">
              {rows.map((row) => (
                <div className="did-field" key={row.key}>
                  <span className="did-label">{row.label}</span>
                  <span>{row.value}</span>
                  {row.header ? (
                    <span className="did-optional">colonna {row.header}</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="did-footer">
          <button className="did-btn did-btn--cancel" onClick={onClose} disabled={loading} type="button">
            Annulla
          </button>
          <button
            className="did-btn did-btn--confirm"
            onClick={() => onConfirm(detection?.preview || {})}
            disabled={loading || !canImport}
            type="button"
          >
            {loading ? "Importazione..." : "Conferma import"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default CompanyProfileImportDialog;
export { previewEntries, formatPreviewValue };
