/**
 * QualificationUploadButton — Upload batch patentini con AI extraction
 * Struttura analoga a NormUploadButton.jsx
 */
import React, { useState, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import "./QualificationUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export default function QualificationUploadButton({ companyId, onUploadComplete }) {
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
      const res = await apiService.uploadQualificationsBatch(selectedFiles, companyId);
      setResults(res.results || []);
      const successes = (res.results || []).filter(r => r.status === "ok").length;
      if (onUploadComplete && successes > 0) onUploadComplete();
    } catch (err) {
      setResults([{ fileName: "tutti i file", status: "error", warnings: [err.message || "Errore upload"] }]);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, companyId, onUploadComplete]);

  const handleDismiss = useCallback(() => {
    setSelectedFiles([]);
    setResults(null);
    setValidationErr(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel  = selectedFiles.length > 0 || hasResults;

  return (
    <div className="qual-upload">
      <button className="qual-upload__btn" onClick={handleClick} disabled={uploading}>
        <span className="qual-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
        Carica patentini (batch)
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        className="qual-upload__input-hidden"
        onChange={handleFileChange}
      />

      {showPanel && (
        <div className="qual-upload__panel">
          {/* Lista file selezionati (pre-upload) */}
          {!hasResults && (
            <>
              <div className="qual-upload__panel-header">
                <span className="qual-upload__panel-title">
                  {selectedFiles.length} file selezionat{selectedFiles.length === 1 ? "o" : "i"}
                </span>
              </div>
              <ul className="qual-upload__file-list">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="qual-upload__file-item">
                    <span className="qual-upload__file-icon">{"\uD83D\uDCC4"}</span>
                    <span className="qual-upload__file-name">{f.name}</span>
                    <span className="qual-upload__file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
              </ul>
              {validationErr && (
                <div className="qual-upload__validation-error">{"\u26A0\uFE0F"} {validationErr}</div>
              )}
              <div className="qual-upload__actions">
                <button
                  className="qual-upload__action-btn qual-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><span className="qual-upload__spinner" />Elaborazione AI...</>
                  ) : "Avvia Upload"}
                </button>
                <button
                  className="qual-upload__action-btn qual-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >Annulla</button>
              </div>
            </>
          )}

          {/* Risultati post-upload */}
          {hasResults && (
            <>
              <div className="qual-upload__panel-header">
                <span className="qual-upload__panel-title">Risultati Upload</span>
              </div>
              <ul className="qual-upload__results">
                {results.map((r, i) => {
                  const isOk  = r.status === "ok";
                  const isDup = r.status === "duplicate";
                  return (
                    <li key={i} className={`qual-upload__result-item qual-upload__result-item--${isOk ? "success" : isDup ? "duplicate" : "error"}`}>
                      {isOk ? (
                        <div className="qual-upload__result-success">
                          <span className="qual-upload__result-icon">{"\u2705"}</span>
                          <div>
                            <strong>{r.person_name || r.fileName}</strong>
                            <div className="qual-upload__result-meta">
                              {r.qualification_type && <span>{r.qualification_type}</span>}
                              {r.qualification_id && <span>ID: {r.qualification_id}</span>}
                            </div>
                            {r.warnings?.length > 0 && (
                              <div className="qual-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="qual-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="qual-upload__result-duplicate">
                          <span className="qual-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Duplicato: qualifica gi\u00e0 presente nel registro.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="qual-upload__result-error">
                          <span className="qual-upload__result-icon">{"\u274C"}</span>
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
              <div className="qual-upload__actions">
                <button className="qual-upload__action-btn qual-upload__action-btn--secondary" onClick={handleDismiss}>
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
