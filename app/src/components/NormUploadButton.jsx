/**
 * NormUploadButton — Upload multiplo PDF norme con estrazione AI metadati
 * Mostrato nella cartella "NORME E LEGGI" del DocumentRegistry (vista Albero).
 */
import React, { useState, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import "./NormUploadButton.css";

const QUALITY_LABELS = {
  good: { label: "Buona", className: "norm-quality--good" },
  partial: { label: "Parziale", className: "norm-quality--partial" },
  ocr_poor: { label: "OCR scarso", className: "norm-quality--poor" },
};

export default function NormUploadButton({ folderId, onUploadComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const inputRef = useRef(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setSelectedFiles(files);
    setResults(null);
  };

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setResults(null);

    try {
      const res = await apiService.uploadNorms(selectedFiles);
      setResults(res.results || res.data || []);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      setResults([{ error: err.message || "Errore upload", fileName: "tutti i file" }]);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, onUploadComplete]);

  const handleDismiss = () => {
    setSelectedFiles([]);
    setResults(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const hasResults = results && results.length > 0;
  const showPanel = selectedFiles.length > 0 || hasResults;

  return (
    <div className="norm-upload">
      <button className="norm-upload__btn" onClick={handleClick} disabled={uploading}>
        <span className="norm-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
        Carica Norme
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept=".pdf"
        className="norm-upload__input-hidden"
        onChange={handleFileChange}
      />

      {showPanel && (
        <div className="norm-upload__panel">
          {/* Lista file selezionati (pre-upload) */}
          {!hasResults && (
            <>
              <div className="norm-upload__panel-header">
                <span className="norm-upload__panel-title">
                  {selectedFiles.length} PDF selezionat{selectedFiles.length === 1 ? "o" : "i"}
                </span>
              </div>
              <ul className="norm-upload__file-list">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="norm-upload__file-item">
                    <span className="norm-upload__file-icon">{"\uD83D\uDCC4"}</span>
                    <span className="norm-upload__file-name">{f.name}</span>
                    <span className="norm-upload__file-size">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </li>
                ))}
              </ul>
              <div className="norm-upload__actions">
                <button
                  className="norm-upload__action-btn norm-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <>
                      <span className="norm-upload__spinner" />
                      Elaborazione AI...
                    </>
                  ) : (
                    "Avvia Upload"
                  )}
                </button>
                <button
                  className="norm-upload__action-btn norm-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >
                  Annulla
                </button>
              </div>
            </>
          )}

          {/* Risultati post-upload */}
          {hasResults && (
            <>
              <div className="norm-upload__panel-header">
                <span className="norm-upload__panel-title">Risultati Upload</span>
              </div>
              <ul className="norm-upload__results">
                {results.map((r, i) => (
                  <li key={i} className={`norm-upload__result-item ${r.error ? "norm-upload__result-item--error" : "norm-upload__result-item--success"}`}>
                    {r.error ? (
                      <div className="norm-upload__result-error">
                        <span className="norm-upload__result-icon">{"\u274C"}</span>
                        <div>
                          <strong>{r.fileName || `File ${i + 1}`}</strong>
                          <p>{r.error}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="norm-upload__result-success">
                        <span className="norm-upload__result-icon">{"\u2705"}</span>
                        <div className="norm-upload__result-meta">
                          <strong className="norm-upload__norm-title">
                            {r.norm_title || r.title || r.fileName || `File ${i + 1}`}
                          </strong>
                          {r.standard_code && (
                            <span className="norm-upload__code-badge">{r.standard_code}</span>
                          )}
                          <div className="norm-upload__meta-row">
                            {r.edition_year && <span>Anno: {r.edition_year}</span>}
                            {r.issuing_body && <span>Ente: {r.issuing_body}</span>}
                            {r.text_quality && (
                              <span className={`norm-quality-badge ${QUALITY_LABELS[r.text_quality]?.className || ""}`}>
                                {QUALITY_LABELS[r.text_quality]?.label || r.text_quality}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <div className="norm-upload__actions">
                <button
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
