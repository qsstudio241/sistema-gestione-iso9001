/**
 * WpqrUploadButton - Upload batch WPQR con revisione pre-commit (IG-3)
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import FileDropzone from "./FileDropzone";
import "./WpqrUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function WpqrUploadButton({ companyId, companyName, onUploadComplete }) {
  const companyIdInt = companyId != null ? parseInt(String(companyId), 10) : NaN;
  const isValidCompany = !isNaN(companyIdInt) && companyIdInt > 0;
  const displayName = isValidCompany ? (companyName || `Azienda #${companyIdInt}`) : "";

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [validationErr, setValidationErr] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const inputRef = useRef(null);
  const scopeKey = isValidCompany ? String(companyIdInt) : "";

  useEffect(() => {
    setSelectedFiles([]);
    setUploading(false);
    setResults(null);
    setValidationErr(null);
    setReviewItem(null);
    setReviewBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [scopeKey]);

  const handleFileChange = (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setValidationErr(null);
    setSelectedFiles(list);
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
    const localFile = selectedFiles.find((f) => f.name === item.fileName) || null;
    setReviewItem({ ...item, previewFile: localFile });
  }, [selectedFiles]);

  const handleConfirmReview = useCallback(async (fields) => {
    if (!reviewItem?.staging_id) return;
    setReviewBusy(true);
    try {
      const res = await apiService.confirmIngestStaging(reviewItem.staging_id, fields);
      updateResult(reviewItem.staging_id, {
        status: "confirmed",
        wpqr_id: res.wpqr_id,
        reference_number: res.reference_number,
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

  if (!isValidCompany) {
    return (
      <div className="wpqr-upload">
        <FileDropzone
          variant="compact"
          disabled
          label="Carica WPQR (batch)"
          ariaLabel="Carica WPQR (batch). Seleziona un'azienda nell'Ambito in alto."
          title="Seleziona un'azienda nell'Ambito in alto per caricare i WPQR"
          hint="Seleziona un'azienda in Ambito"
        />
      </div>
    );
  }

  const hasResults = results && results.length > 0;
  const showPanel  = selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter(r => r.status === "pending_review").length;

  return (
    <div className="wpqr-upload">
      <FileDropzone
        variant="compact"
        multiple
        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
        disabled={uploading}
        onFiles={handleFileChange}
        label="Carica WPQR (batch)"
        ariaLabel="Carica WPQR (batch)"
        hint="Trascina i PDF o clicca"
        inputRef={inputRef}
        inputClassName="wpqr-upload__input-hidden"
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
                  ) : "Estrai e rivedi"}
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
                <span className="wpqr-upload__panel-title">
                  Risultati estrazione
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                </span>
              </div>
              <ul className="wpqr-upload__results">
                {results.map((r, i) => {
                  const isPending  = r.status === "pending_review";
                  const isConfirmed = r.status === "confirmed";
                  const isDup      = r.status === "duplicate";
                  const isWrong    = r.status === "wrong_module";
                  const isRejected = r.status === "rejected";
                  return (
                    <li key={i} className={`wpqr-upload__result-item wpqr-upload__result-item--${
                      isConfirmed ? "success" : isPending ? "pending" : isDup ? "duplicate" : isWrong ? "wrong-module" : isRejected ? "rejected" : "error"
                    }`}>
                      {isPending ? (
                        <div className="wpqr-upload__result-pending">
                          <span className="wpqr-upload__result-icon">{"\uD83D\uDD0D"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Campi estratti{"\u2014"} revisione obbligatoria prima del salvataggio.</p>
                            {r.warnings?.length > 0 && (
                              <div className="wpqr-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="wpqr-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                            <button
                              type="button"
                              className="wpqr-upload__action-btn wpqr-upload__action-btn--primary"
                              onClick={() => handleOpenReview(r)}
                            >
                              Rivedi campi
                            </button>
                          </div>
                        </div>
                      ) : isConfirmed ? (
                        <div className="wpqr-upload__result-success">
                          <span className="wpqr-upload__result-icon">{"\u2705"}</span>
                          <div>
                            <strong>{r.reference_number || r.fileName}</strong>
                            <div className="wpqr-upload__result-meta">
                              {r.welding_process && <span>Processo: {r.welding_process}</span>}
                              {r.wpqr_id && <span>ID: {r.wpqr_id}</span>}
                            </div>
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="wpqr-upload__result-duplicate">
                          <span className="wpqr-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Duplicato: WPQR gi{"\u00E0"} presente nel registro.</p>
                          </div>
                        </div>
                      ) : isWrong ? (
                        <div className="wpqr-upload__result-wrong-module">
                          <span className="wpqr-upload__result-icon">{"\u26A0\uFE0F"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p className="wpqr-upload__wrong-module-msg">{r.message}</p>
                          </div>
                        </div>
                      ) : isRejected ? (
                        <div className="wpqr-upload__result-rejected">
                          <span className="wpqr-upload__result-icon">{"\u274C"}</span>
                          <div><strong>{r.fileName}</strong><p>Scartato{"\u2014"} non salvato.</p></div>
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

      <IngestReviewDialog
        open={!!reviewItem}
        docType="wpqr"
        fileName={reviewItem?.fileName}
        stagingId={reviewItem?.staging_id}
        previewFile={reviewItem?.previewFile}
        mimeType={reviewItem?.previewFile?.type || "application/pdf"}
        fields={reviewItem?.fields}
        fieldConfidence={reviewItem?.field_confidence}
        warnings={reviewItem?.warnings}
        onConfirm={handleConfirmReview}
        onReject={handleRejectReview}
        onClose={() => setReviewItem(null)}
        busy={reviewBusy}
      />
    </div>
  );
}
