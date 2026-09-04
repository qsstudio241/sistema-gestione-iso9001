/**
 * WpsUploadButton - Upload batch WPS con revisione pre-commit (IG-3)
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import FileDropzone from "./FileDropzone";
import "./WpsUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export default function WpsUploadButton({ companyId, companyName, onUploadComplete }) {
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
      const res = await apiService.uploadWpsBatch(selectedFiles, companyIdInt);
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
        wps_id: res.wps_id,
        wps_code: res.wps_code,
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
      <div className="wps-upload">
        <button
          type="button"
          className="wps-upload__btn"
          disabled
          title="Seleziona un'azienda nell'Ambito in alto per caricare i WPS"
          aria-label="Seleziona PDF WPS. Seleziona un'azienda nell'Ambito in alto."
        >
          <span className="wps-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
          Seleziona PDF WPS
        </button>
      </div>
    );
  }

  const hasResults = results && results.length > 0;
  const showPanel  = selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter(r => r.status === "pending_review").length;

  return (
    <div className="wps-upload">
      <FileDropzone
        variant="compact"
        multiple
        accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
        disabled={uploading}
        onFiles={handleFileChange}
        label="Seleziona PDF WPS"
        ariaLabel="Seleziona PDF WPS"
        hint="Trascina i PDF o clicca"
        inputRef={inputRef}
        inputClassName="wps-upload__input-hidden"
      />

      {showPanel && (
        <div className="wps-upload__panel">
          <div className="wps-upload__company-context">
            <span className="wps-upload__company-label">Azienda:</span>
            <strong className="wps-upload__company-name">{displayName}</strong>
          </div>

          {!hasResults && (
            <>
              <div className="wps-upload__panel-header">
                <span className="wps-upload__panel-title">
                  {selectedFiles.length} file selezionat{selectedFiles.length === 1 ? "o" : "i"}
                </span>
              </div>
              <ul className="wps-upload__file-list">
                {selectedFiles.map((f, i) => (
                  <li key={i} className="wps-upload__file-item">
                    <span className="wps-upload__file-icon">{"\uD83D\uDCC4"}</span>
                    <span className="wps-upload__file-name">{f.name}</span>
                    <span className="wps-upload__file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
              </ul>
              {validationErr && (
                <div className="wps-upload__validation-error">{"\u26A0\uFE0F"} {validationErr}</div>
              )}
              <div className="wps-upload__actions">
                <button
                  className="wps-upload__action-btn wps-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><span className="wps-upload__spinner" />Elaborazione AI...</>
                  ) : "Estrai e rivedi"}
                </button>
                <button
                  className="wps-upload__action-btn wps-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >Annulla</button>
              </div>
            </>
          )}

          {hasResults && (
            <>
              <div className="wps-upload__panel-header">
                <span className="wps-upload__panel-title">
                  Risultati estrazione
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                </span>
              </div>
              <ul className="wps-upload__results">
                {results.map((r, i) => {
                  const isPending  = r.status === "pending_review";
                  const isConfirmed = r.status === "confirmed";
                  const isDup      = r.status === "duplicate";
                  const isWrong    = r.status === "wrong_module";
                  const isRejected = r.status === "rejected";
                  return (
                    <li key={i} className={`wps-upload__result-item wps-upload__result-item--${
                      isConfirmed ? "success" : isPending ? "pending" : isDup ? "duplicate" : isWrong ? "wrong-module" : isRejected ? "rejected" : "error"
                    }`}>
                      {isPending ? (
                        <div className="wps-upload__result-pending">
                          <span className="wps-upload__result-icon">{"\uD83D\uDD0D"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Campi estratti{"\u2014"} revisione obbligatoria prima del salvataggio.</p>
                            {r.warnings?.length > 0 && (
                              <div className="wps-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="wps-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                            <button
                              type="button"
                              className="wps-upload__action-btn wps-upload__action-btn--primary"
                              onClick={() => handleOpenReview(r)}
                            >
                              Rivedi campi
                            </button>
                          </div>
                        </div>
                      ) : isConfirmed ? (
                        <div className="wps-upload__result-success">
                          <span className="wps-upload__result-icon">{"\u2705"}</span>
                          <div>
                            <strong>{r.wps_code || r.fileName}</strong>
                            <div className="wps-upload__result-meta">
                              {r.welding_process && <span>Processo: {r.welding_process}</span>}
                              {r.wps_id && <span>ID: {r.wps_id}</span>}
                            </div>
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="wps-upload__result-duplicate">
                          <span className="wps-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Duplicato: WPS gi{"\u00E0"} presente nel registro.</p>
                          </div>
                        </div>
                      ) : isWrong ? (
                        <div className="wps-upload__result-wrong-module">
                          <span className="wps-upload__result-icon">{"\u26A0\uFE0F"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p className="wps-upload__wrong-module-msg">{r.message}</p>
                          </div>
                        </div>
                      ) : isRejected ? (
                        <div className="wps-upload__result-rejected">
                          <span className="wps-upload__result-icon">{"\u274C"}</span>
                          <div><strong>{r.fileName}</strong><p>Scartato{"\u2014"} non salvato.</p></div>
                        </div>
                      ) : (
                        <div className="wps-upload__result-error">
                          <span className="wps-upload__result-icon">{"\u274C"}</span>
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
              <div className="wps-upload__actions">
                <button className="wps-upload__action-btn wps-upload__action-btn--secondary" onClick={handleDismiss}>
                  Chiudi
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <IngestReviewDialog
        open={!!reviewItem}
        docType="wps"
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
