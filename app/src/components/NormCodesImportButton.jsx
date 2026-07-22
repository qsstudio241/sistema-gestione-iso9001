/**
 * NormCodesImportButton — Import batch da lista codici norma/legge (senza PDF).
 * Mostrato nella cartella "NORME E LEGGI" del DocumentRegistry (vista Albero).
 */
import React, { useState, useCallback } from "react";
import apiService from "../services/apiService";
import "./NormUploadButton.css";

const PLACEHOLDER = [
  "Un codice per riga, ad esempio:",
  "UNI EN ISO 12944-6:2001",
  "D.Lgs. 81/2008",
  "ISO 9001:2015",
].join("\n");

function countCodes(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean).length;
}

export default function NormCodesImportButton({ folderId, onImportComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [codesText, setCodesText] = useState("");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const handleImport = useCallback(async () => {
    const n = countCodes(codesText);
    if (n === 0) {
      setError("Inserire almeno un codice norma.");
      return;
    }

    setError(null);
    setImporting(true);
    setSummary(null);
    setResults(null);

    try {
      const res = await apiService.importNormCodes(codesText, folderId);
      setSummary(res.summary || null);
      setResults(res.results || []);
      if (onImportComplete && (res.summary?.created || 0) > 0) {
        onImportComplete();
      }
    } catch (err) {
      setError(err.message || "Errore durante l'import");
    } finally {
      setImporting(false);
    }
  }, [codesText, folderId, onImportComplete]);

  const handleDismiss = () => {
    setExpanded(false);
    setCodesText("");
    setSummary(null);
    setResults(null);
    setError(null);
  };

  const hasResults = results && results.length > 0;
  const codeCount = countCodes(codesText);

  return (
    <div className="norm-upload norm-codes-import">
      <button
        type="button"
        className="norm-upload__btn"
        onClick={() => setExpanded((v) => !v)}
        disabled={importing}
        aria-expanded={expanded}
      >
        <span className="norm-upload__icon" role="img" aria-label="catalogo">{"\uD83D\uDCDA"}</span>
        Importa da catalogo (codici)
      </button>

      {expanded && (
        <div className="norm-upload__panel">
          {!hasResults ? (
            <>
              <div className="norm-upload__panel-header">
                <span className="norm-upload__panel-title">Codici norma / legge</span>
              </div>
              <p className="norm-codes-import__hint">
                Incolla un codice per riga. Il sistema interroga i cataloghi online e crea bozze nel registro.
                Il PDF è opzionale e può essere allegato in seguito.
              </p>
              <textarea
                className="norm-codes-import__textarea"
                value={codesText}
                onChange={(e) => setCodesText(e.target.value)}
                placeholder={PLACEHOLDER}
                rows={6}
                disabled={importing}
                spellCheck={false}
              />
              {codeCount > 0 && (
                <div className="norm-codes-import__count">
                  {codeCount} codic{codeCount === 1 ? "e" : "i"} da importare
                </div>
              )}
              {error && (
                <div className="norm-upload__validation-error">{"\u26A0\uFE0F"} {error}</div>
              )}
              <div className="norm-upload__actions">
                <button
                  type="button"
                  className="norm-upload__action-btn norm-upload__action-btn--primary"
                  onClick={handleImport}
                  disabled={importing || codeCount === 0}
                >
                  {importing ? (
                    <>
                      <span className="norm-upload__spinner" />
                      Importazione...
                    </>
                  ) : (
                    "Importa da catalogo"
                  )}
                </button>
                <button
                  type="button"
                  className="norm-upload__action-btn norm-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={importing}
                >
                  Annulla
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="norm-upload__panel-header">
                <span className="norm-upload__panel-title">Riepilogo import</span>
              </div>
              {summary && (
                <div className="norm-codes-import__summary">
                  <span className="norm-codes-import__pill norm-codes-import__pill--ok">
                    {"\u2705"} Creati: {summary.created}
                  </span>
                  <span className="norm-codes-import__pill norm-codes-import__pill--dup">
                    {"\u23ED"} Duplicati: {summary.duplicates}
                  </span>
                  {(summary.warnings || 0) > 0 && (
                    <span className="norm-codes-import__pill norm-codes-import__pill--warn">
                      {"\u26A0\uFE0F"} Avvisi: {summary.warnings}
                    </span>
                  )}
                  <span className="norm-codes-import__pill norm-codes-import__pill--err">
                    {"\u274C"} Errori: {summary.errors}
                  </span>
                </div>
              )}
              <ul className="norm-upload__results">
                {results.map((r, i) => {
                  const isError = r.status === "error";
                  const isDup = r.status === "duplicate";
                  const isWarn = r.status === "created_with_warning";
                  const itemClass = isError || isDup
                    ? "norm-upload__result-item--error"
                    : isWarn
                      ? "norm-upload__result-item--warn"
                      : "norm-upload__result-item--success";

                  return (
                    <li key={i} className={`norm-upload__result-item ${itemClass}`}>
                      <div className={isError || isDup ? "norm-upload__result-error" : "norm-upload__result-success"}>
                        <span className="norm-upload__result-icon">
                          {isError || isDup ? "\u274C" : isWarn ? "\u26A0\uFE0F" : "\u2705"}
                        </span>
                        <div>
                          <strong>{r.code}</strong>
                          {r.validityStatus && (
                            <span className="norm-upload__code-badge">{r.validityStatus}</span>
                          )}
                          {r.message && <p>{r.message}</p>}
                          {r.catalogUrl && (
                            <a
                              href={r.catalogUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="norm-codes-import__link"
                            >
                              Apri catalogo
                            </a>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="norm-upload__actions">
                <button
                  type="button"
                  className="norm-upload__action-btn norm-upload__action-btn--secondary"
                  onClick={handleDismiss}
                >
                  Chiudi
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
