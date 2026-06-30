/**
 * QualificationUploadButton — Upload batch patentini con revisione pre-commit (IG-3)
 */
import React, { useState, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import "./QualificationUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function QualificationUploadButton({ companyId, companyName, onUploadComplete }) {
  const companyIdInt = companyId != null ? parseInt(String(companyId), 10) : NaN;
  const isValidCompany = !isNaN(companyIdInt) && companyIdInt > 0;

  if (!isValidCompany) {
    return (
      <div className="qual-upload__no-company">
        {"\u26A0\uFE0F"} Seleziona un&apos;azienda specifica per caricare i patentini
      </div>
    );
  }

  const displayName = companyName || `Azienda #${companyIdInt}`;
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [validationErr, setValidationErr] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
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
      const res = await apiService.uploadQualificationsBatch(selectedFiles, companyIdInt);
      setResults(res.results || []);
    } catch (err) {
      setResults([{ fileName: "tutti i file", status: "error", warnings: [err.message || "Errore upload"] }]);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, companyIdInt]);

  const updateResult = useCallback((stagingId, patch) => {
    setResults((prev) => (prev || []).map((r) => (
      r.staging_id === stagingId ? { ...r, ...patch } : r
    )));
  }, []);

  const handleOpenReview = useCallback((item) => {
    setReviewItem(item);
  }, []);

  const handleConfirmReview = useCallback(async (fields) => {
    if (!reviewItem?.staging_id) return;
    setReviewBusy(true);
    try {
      const res = await apiService.confirmIngestStaging(reviewItem.staging_id, fields);
      updateResult(reviewItem.staging_id, {
        status: "confirmed",
        qualification_id: res.qualification_id,
        person_name: res.person_name,
        qualification_type: res.qualification_type,
        warnings: res.warnings || reviewItem.warnings,
      });
      setReviewItem(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      const msg = err?.data?.error || err.message || "Conferma fallita";
      window.alert(msg);
    } finally {
      setReviewBusy(false);
    }
  }, [reviewItem, onUploadComplete, updateResult]);

  const handleRejectReview = useCallback(async () => {
    if (!reviewItem?.staging_id) return;
    setReviewBusy(true);
    try {
      await apiService.rejectIngestStaging(reviewItem.staging_id);
      updateResult(reviewItem.staging_id, { status: "rejected" });
      setReviewItem(null);
    } catch (err) {
      window.alert(err.message || "Scarto fallito");
    } finally {
      setReviewBusy(false);
    }
  }, [reviewItem, updateResult]);

  const handleDismiss = useCallback(() => {
    setSelectedFiles([]);
    setResults(null);
    setValidationErr(null);
    setReviewItem(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel  = selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter(r => r.status === "pending_review").length;

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
        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
        className="qual-upload__input-hidden"
        onChange={handleFileChange}
      />

      {showPanel && (
        <div className="qual-upload__panel">
          <div className="qual-upload__company-context">
            <span className="qual-upload__company-label">Azienda:</span>
            <strong className="qual-upload__company-name">{displayName}</strong>
          </div>

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
                  ) : "Estrai e rivedi"}
                </button>
                <button
                  className="qual-upload__action-btn qual-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >Annulla</button>
              </div>
            </>
          )}

          {hasResults && (
            <>
              <div className="qual-upload__panel-header">
                <span className="qual-upload__panel-title">
                  Risultati estrazione
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                </span>
              </div>
              <ul className="qual-upload__results">
                {results.map((r, i) => {
                  const isPending   = r.status === "pending_review";
                  const isConfirmed = r.status === "confirmed";
                  const isDup       = r.status === "duplicate";
                  const isRejected  = r.status === "rejected";
                  return (
                    <li key={i} className={`qual-upload__result-item qual-upload__result-item--${
                      isConfirmed ? "success" : isPending ? "pending" : isDup ? "duplicate" : isRejected ? "rejected" : "error"
                    }`}>
                      {isPending ? (
                        <div className="qual-upload__result-pending">
                          <span className="qual-upload__result-icon">{"\uD83D\uDD0D"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Campi estratti — revisione obbligatoria prima del salvataggio.</p>
                            {r.warnings?.length > 0 && (
                              <div className="qual-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="qual-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                            <button
                              type="button"
                              className="qual-upload__action-btn qual-upload__action-btn--primary"
                              onClick={() => handleOpenReview(r)}
                            >
                              Rivedi campi
                            </button>
                          </div>
                        </div>
                      ) : isConfirmed ? (
                        <div className="qual-upload__result-success">
                          <span className="qual-upload__result-icon">{"\u2705"}</span>
                          <div>
                            <strong>{r.person_name || r.fileName}</strong>
                            <div className="qual-upload__result-meta">
                              {r.qualification_type && <span>{r.qualification_type}</span>}
                              {r.qualification_id && <span>ID: {r.qualification_id}</span>}
                            </div>
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="qual-upload__result-duplicate">
                          <span className="qual-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Duplicato: qualifica già presente nel registro.</p>
                          </div>
                        </div>
                      ) : isRejected ? (
                        <div className="qual-upload__result-rejected">
                          <span className="qual-upload__result-icon">{"\u274C"}</span>
                          <div><strong>{r.fileName}</strong><p>Scartato — non salvato.</p></div>
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

      <IngestReviewDialog
        open={!!reviewItem}
        docType="patentino_saldatore"
        fileName={reviewItem?.fileName}
        fields={reviewItem?.fields}
        fieldConfidence={reviewItem?.field_confidence}
        warnings={reviewItem?.warnings}
        qualificationType={reviewItem?.qualification_type}
        onConfirm={handleConfirmReview}
        onReject={handleRejectReview}
        onClose={() => setReviewItem(null)}
        busy={reviewBusy}
      />
    </div>
  );
}
