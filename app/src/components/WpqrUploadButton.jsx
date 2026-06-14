/**
 * WpqrUploadButton ù Upload batch WPQR da PDF con AI extraction
 * Pattern identico a QualificationUploadButton.jsx, adattato per WPQR.
 */
import React, { useState, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import "./WpqrUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export default function WpqrUploadButton({ companyId, companyName, onUploadComplete }) {
  const companyIdInt = companyId != null ? parseInt(String(companyId), 10) : NaN;
  const isValidCompany = !isNaN(companyIdInt) && companyIdInt > 0;

  if (!isValidCompany) {
    return (
      <div className="wpqr-upload__no-company">
        {"\u26A0\uFE0F"} Seleziona un&apos;azienda specifica per caricare i WPQR
      </div>
    );
  }

  const displayName = companyName || `Azienda #${companyIdInt}`;
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [validationErr, setValidationErr] = useState(null);
  const inputRef = useRef(null);

  const handleClick = () => inputRef.current?.click();

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setValidationErr(null);
    setSelectedFiles(files);
    setResults(null);
  };

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    const oversized = selectedFiles.filter(f => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setValidationErr(`File troppo grandi (limite 50 MB): ${oversized.map(f => f.name).join(", ")}`);
      return;
    }
    setValidationErr(null);
    setUploading(true);
    setResults(null);
    try {
      const res = await apiService.uploadWpqrBatch(selectedFiles, companyIdInt);
      setResults(res.results || []);
      const successes = (res.results || []).filter(r => r.status === "ok").length;
      if (onUploadComplete && successes > 0) onUploadComplete();
    } catch (err) {
      setResults([{ fileName: "tutti i file", status: "error", warnings: [err.message || "Errore upload"] }]);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, companyIdInt, onUploadComplete]);

  const handleDismiss = useCallback(() => {
    setSelectedFiles([]);
    setResults(null);
    setValidationErr(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel  = selectedFiles.length > 0 || hasResults;

  return (
    <div className="wpqr-upload">
      <button className="wpqr-upload__btn" onClick={handleClick} disabled={uploading}>
        <span className="wpqr-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
        Carica WPQR (batch)
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
        className="wpqr-upload__input-hidden"
        onChange={handleFileChange}
      />

      {showPanel && (
        <div className="wpqr-upload__panel">
          <div className="wpqr-upload__company-context">
            <span className="wpqr-upload__company-label">Azienda:</span>
            <strong className="wpqr-upload__company-name">{displayName}</strong>
          </div>

          {!hasResults && (
            <>
              <div className="wpqr-upload__panel-header">
                <span className="wpqr-upload__panel-title">
                  {selectedFiles.length} file selezionat{selectedFiles.length === 1 ? "o" : "i"}
                </span>
              </div>
              <ul className="wpqr-upload__file-list">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="wpqr-upload__file-item">
                    <span className="wpqr-upload__file-icon">{"\uD83D\uDCC4"}</span>
                    <span className="wpqr-upload__file-name">{f.name}</span>
                    <span className="wpqr-upload__file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
              </ul>
              {validationErr && (
                <div className="wpqr-upload__validation-error">{"\u26A0\uFE0F"} {validationErr}</div>
              )}
              <div className="wpqr-upload__actions">
                <button
                  className="wpqr-upload__action-btn wpqr-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><span className="wpqr-upload__spinner" />Elaborazione AI...</>
                  ) : "Avvia Upload"}
                </button>
                <button
                  className="wpqr-upload__action-btn wpqr-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >Annulla</button>
              </div>
            </>
          )}

          {hasResults && (
            <>
              <div className="wpqr-upload__panel-header">
                <span className="wpqr-upload__panel-title">Risultati Upload WPQR</span>
              </div>
              <ul className="wpqr-upload__results">
                {results.map((r, i) => {
                  const isOk       = r.status === "ok";
                  const isDup      = r.status === "duplicate";
                  const isWrong    = r.status === "wrong_module";
                  return (
                    <li key={i} className={`wpqr-upload__result-item wpqr-upload__result-item--${isOk ? "success" : isDup ? "duplicate" : isWrong ? "wrong-module" : "error"}`}>
                      {isOk ? (
                        <div className="wpqr-upload__result-success">
                          <span className="wpqr-upload__result-icon">{"\u2705"}</span>
                          <div>
                            <strong>{r.reference_number || r.fileName}</strong>
                            <div className="wpqr-upload__result-meta">
                              {r.welding_process && <span>Processo: {r.welding_process}</span>}
                              {r.thickness_min != null && r.thickness_max != null && (
                                <span>Spessore: {r.thickness_min}ù{r.thickness_max} mm</span>
                              )}
                              {r.wpqr_id && <span>ID: {r.wpqr_id}</span>}
                            </div>
                            {r.warnings?.length > 0 && (
                              <div className="wpqr-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="wpqr-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="wpqr-upload__result-duplicate">
                          <span className="wpqr-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Duplicato: WPQR gi\u00e0 presente nel registro.</p>
                          </div>
                        </div>
                      ) : isWrong ? (
                        <div className="wpqr-upload__result-wrong-module">
                          <span className="wpqr-upload__result-icon">{"\u26A0\uFE0F"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p className="wpqr-upload__wrong-module-msg">{r.message}</p>
                            {r.suggested_module && (
                              <a className="wpqr-upload__wrong-module-link" href={r.suggested_module}>
                                Vai al modulo corretto {"\u2192"}
                              </a>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="wpqr-upload__result-error">
                          <span className="wpqr-upload__result-icon">{"\u274C"}</span>
                          <div>
                            <strong>{r.fileName || `File ${i + 1}`}</strong>
                            <p>{r.error || (r.warnings?.[0]) || "Errore sconosciuto"}</p>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="wpqr-upload__actions">
                <button className="wpqr-upload__action-btn wpqr-upload__action-btn--secondary" onClick={handleDismiss}>
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
