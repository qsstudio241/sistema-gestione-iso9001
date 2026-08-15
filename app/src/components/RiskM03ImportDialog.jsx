/**
 * Conferma ingest Excel M03 (ROO-6).
 * Riusa il guscio CSS di DeadlineImportDialog (classi did-*).
 */
import React from "react";
import "./DeadlineImportDialog.css";

function RiskM03ImportDialog({ detection, onConfirm, onClose, loading = false }) {
  const rows = Array.isArray(detection?.rows) ? detection.rows : [];
  const create = detection?.stats?.create || 0;
  const skip = detection?.stats?.skip || 0;
  const canImport = detection?.canImport !== false && create > 0;
  const level = detection?.confidence || "bassa";
  const badgeClass = level === "alta" ? "did-badge did-badge--high" : "did-badge did-badge--medium";
  const badgeText = level === "alta"
    ? "Rilevamento alta affidabilit\u00e0"
    : level === "media"
      ? "Rilevamento media affidabilit\u00e0"
      : "Rilevamento bassa affidabilit\u00e0";

  return (
    <div className="did-overlay" role="dialog" aria-modal="true" aria-labelledby="rm03-title">
      <div className="did-modal">
        <div className="did-header">
          <h2 id="rm03-title" className="did-header__title">Importa analisi M03</h2>
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
            <span>{create} righe da inserire</span>
            {skip > 0 ? <span>{skip} saltate (P/G fuori scala)</span> : null}
            {detection?.sheetName ? <span>Foglio: {detection.sheetName}</span> : null}
          </div>

          {detection?.error && <p className="studio-hint">{detection.error}</p>}
          <p className="studio-hint">{"Inserisce nuove valutazioni. Non sovrascrive le righe gi\u00e0 in griglia."}</p>

          {rows.length === 0 ? (
            <p className="studio-hint">Nessuna riga riconosciuta.</p>
          ) : (
            <div className="did-form" data-testid="rm03-preview" style={{ overflowX: "auto" }}>
              <table className="sgq-datagrid-table">
                <thead>
                  <tr>
                    <th>Riga</th>
                    <th>Elemento</th>
                    <th>P</th>
                    <th>G</th>
                    <th>P res</th>
                    <th>G res</th>
                    <th>Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.excelRow}>
                      <td>{row.excelRow}</td>
                      <td>{row.evaluated_element || row.title || "\u2014"}</td>
                      <td>{row.probability ?? "\u2014"}</td>
                      <td>{row.impact ?? "\u2014"}</td>
                      <td>{row.residual_probability ?? "\u2014"}</td>
                      <td>{row.residual_impact ?? "\u2014"}</td>
                      <td>
                        {row.action === "skip" ? "Saltata" : "Nuova"}
                        {row.issues?.[0] ? ` \u2014 ${row.issues[0]}` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="did-footer">
          <button className="did-btn did-btn--cancel" onClick={onClose} disabled={loading} type="button">
            Annulla
          </button>
          <button
            className="did-btn did-btn--confirm"
            onClick={() => onConfirm(rows)}
            disabled={loading || !canImport}
            type="button"
          >
            {loading ? "Importazione..." : `Conferma ${create} righe`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default RiskM03ImportDialog;
