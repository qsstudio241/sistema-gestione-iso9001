/**
 * Conferma ingest Excel analisi rischi (ROO-6c).
 * Stesso guscio di qualifiche/WPQR: file a sinistra, mapping a destra.
 */
import React, { useEffect, useState } from "react";
import IngestDialogShell from "./IngestDialogShell";
import IngestSourcePreview from "./IngestSourcePreview";
import "./DeadlineImportDialog.css";
import "./RiskM03ImportDialog.css";

const MAP_FIELDS = [
  { key: "evaluated_element", label: "Elemento / unità" },
  { key: "title_risk", label: "Colonna rischi (titolo)" },
  { key: "title_opportunity", label: "Colonna opportunità (titolo)" },
  { key: "context_text", label: "Contesto" },
  { key: "interested_parties_text", label: "Parti interessate" },
  { key: "current_actions", label: "Azioni attuali / situazione" },
  { key: "further_actions", label: "Ulteriori azioni" },
  { key: "probability", label: "P (probabilità)" },
  { key: "impact", label: "G (gravità)" },
  { key: "peso", label: "Peso qualitativo (P e G)" },
  { key: "residual_probability", label: "P residuo" },
  { key: "residual_impact", label: "G residuo" },
  { key: "peso_residuo", label: "Peso residuo" },
  { key: "responsible", label: "Responsabile" },
  { key: "review_date", label: "Tempistica / entro" },
  { key: "effectiveness_note", label: "Aggiornamento / stato" },
];

function RiskM03ImportDialog({
  detection,
  previewFile = null,
  onConfirm,
  onClose,
  onRemap,
  onRaiseScale,
  loading = false,
  remapping = false,
  canRaiseScale = false,
}) {
  const [sheetName, setSheetName] = useState(detection?.sheetName || "");
  const [mapping, setMapping] = useState(detection?.mapping || {});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setSheetName(detection?.sheetName || "");
    setMapping(detection?.mapping || {});
    setDirty(false);
  }, [detection?.fileName]);

  useEffect(() => {
    if (!remapping) setDirty(false);
  }, [detection?.stats, detection?.rows, remapping]);

  const sheets = Array.isArray(detection?.sheets) ? detection.sheets : [];
  const activeSheet = sheets.find((s) => s.name === sheetName) || sheets[0];
  const columns = activeSheet?.columns || detection?.columns || [];
  const rows = Array.isArray(detection?.rows) ? detection.rows : [];
  const create = detection?.stats?.create || 0;
  const skip = detection?.stats?.skip || 0;
  const canImport = detection?.canImport !== false && create > 0 && !dirty && !remapping;
  const level = detection?.confidence || "bassa";
  const badgeClass = level === "alta" ? "did-badge did-badge--high" : "did-badge did-badge--medium";
  const badgeText = level === "alta"
    ? "Rilevamento alta affidabilità"
    : level === "media"
      ? "Rilevamento media affidabilità"
      : "Rilevamento bassa affidabilità";
  const fileName = detection?.fileName || "file.xlsx";

  function changeSheet(nextName) {
    if (!nextName || nextName === sheetName) return;
    const next = sheets.find((s) => s.name === nextName);
    const nextMapping = next?.suggestedMapping || mapping;
    setSheetName(nextName);
    setMapping(nextMapping);
    setDirty(true);
    onRemap?.(nextName, nextMapping);
  }

  function changeField(field, letter) {
    const next = { ...mapping };
    if (!letter) delete next[field];
    else next[field] = letter;
    setMapping(next);
    setDirty(true);
    onRemap?.(sheetName, next);
  }

  return (
    <IngestDialogShell
      overlayClassName="rm03-import__overlay"
      dialogClassName="rm03-import__dialog"
      ariaLabelledBy="rm03-title"
      titleSlot={<h2 id="rm03-title" className="rm03-import__title">Importa analisi Excel</h2>}
      headerExtra={(expanded) => (
        <>
          <p className="rm03-import__file">
            File: <strong>{fileName}</strong>
            {" "}
            <span className={badgeClass}>{badgeText}</span>
          </p>
          <p className="rm03-import__hint">
            {expanded
              ? "File e campi a schermo intero: trascina il divisore per dare più spazio al foglio o al mapping."
              : "Confronta il file a sinistra con le colonne e l'anteprima a destra. Trascina il divisore per ridimensionare."}
          </p>
        </>
      )}
      renderPreview={(expanded) => (
        <IngestSourcePreview
          fileName={fileName}
          mimeType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          previewFile={previewFile}
          tall={expanded}
          sheetName={sheetName}
          onSheetNameChange={changeSheet}
        />
      )}
      contentClassName="rm03-import__form-pane"
      renderContent={() => (
        <>
          <div className="did-stats">
            <span>{create} righe da inserire</span>
            {skip > 0 ? <span>{skip} saltate (P/G fuori scala o incomplete)</span> : null}
            {detection?.sheetName ? <span>Foglio: {detection.sheetName}</span> : null}
          </div>

          {detection?.error && <p className="studio-hint">{detection.error}</p>}
          {(detection?.warnings || []).map((w) => (
            <p key={w} className="studio-hint">{w}</p>
          ))}
          {canRaiseScale && detection?.observedPgMax > (detection?.pgMax || 3) && (
            <p className="studio-hint">
              <button
                type="button"
                className="did-btn did-btn--confirm"
                disabled={loading || remapping}
                onClick={() => onRaiseScale?.(detection.observedPgMax)}
              >
                Imposta scala 1–{detection.observedPgMax} e ricalcola
              </button>
            </p>
          )}
          <p className="studio-hint">
            Associa le colonne del file ai campi SGQ. Se rischi e opportunità sono due colonne, una riga Excel può generare due valutazioni. Inserisce nuove righe, non sovrascrive la griglia.
          </p>

          {sheets.length > 1 && (
            <div className="did-field">
              <label className="did-label" htmlFor="rm03-sheet">Foglio Excel</label>
              <select
                id="rm03-sheet"
                className="did-select"
                value={sheetName}
                disabled={loading || remapping}
                onChange={(e) => changeSheet(e.target.value)}
              >
                {sheets.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="did-map-grid" data-testid="rm03-mapping">
            {MAP_FIELDS.map((field) => (
              <div className="did-field" key={field.key}>
                <label className="did-label" htmlFor={`rm03-map-${field.key}`}>{field.label}</label>
                <select
                  id={`rm03-map-${field.key}`}
                  className="did-select"
                  value={mapping[field.key] || ""}
                  disabled={loading || remapping}
                  onChange={(e) => changeField(field.key, e.target.value)}
                >
                  <option value="">— non usare —</option>
                  {columns.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.key} — {col.header}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {rows.length === 0 ? (
            <p className="studio-hint">Nessuna riga riconosciuta. Controlla foglio e mapping.</p>
          ) : (
            <div className="did-form" data-testid="rm03-preview" style={{ overflowX: "auto" }}>
              <table className="sgq-datagrid-table">
                <thead>
                  <tr>
                    <th>Riga</th>
                    <th>Tipo</th>
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
                    <tr key={`${row.excelRow}-${row.splitIndex || 0}-${row.nature}`}>
                      <td>{row.excelRow}</td>
                      <td>{row.nature === "opportunity" ? "Opportunità" : "Rischio"}</td>
                      <td>{row.title || row.evaluated_element || "\u2014"}</td>
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
        </>
      )}
      footer={(
        <>
          <button className="did-btn did-btn--cancel" onClick={onClose} disabled={loading} type="button">
            Annulla
          </button>
          <button
            className="did-btn did-btn--confirm"
            onClick={() => onConfirm(rows)}
            disabled={loading || remapping || !canImport}
            type="button"
          >
            {loading ? "Importazione..." : remapping || dirty ? "Aggiornamento anteprima..." : `Conferma ${create} righe`}
          </button>
        </>
      )}
    />
  );
}

export default RiskM03ImportDialog;
