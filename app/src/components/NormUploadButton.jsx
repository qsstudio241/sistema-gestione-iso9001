/**
 * NormUploadButton — Upload batch norme con pipeline unificata + revisione pre-commit (IG-N)
 */
import React, { useState, useRef, useCallback } from "react";
import apiService, { NORM_BATCH_TIMEOUT_MESSAGE } from "../services/apiService";
import {
  normalizeNormUploadResults,
  countNormUploadSuccesses,
  resultsFromNormBatchPayload,
  folderCapNoticeFromPayload,
} from "../utils/normUploadResults";
import IngestReviewDialog from "./IngestReviewDialog";
import StatusBadge from "./StatusBadge";
import AiDisclaimer from "./AiDisclaimer";
import FileDropzone from "./FileDropzone";
import "./NormUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

function messageFromNormBatchError(err, fallback) {
  if (err?.code === "TIMEOUT" || err?.status === 408 || /timeout/i.test(err?.message || "")) {
    return NORM_BATCH_TIMEOUT_MESSAGE;
  }
  return err?.message || fallback;
}

export default function NormUploadButton({ folderId, onUploadComplete }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [validationErr, setValidationErr] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [folderCapNotice, setFolderCapNotice] = useState(null);
  const inputRef = useRef(null);
  const canIngestFolder = folderId != null && folderId !== "";

  const handleFileChange = (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    setValidationErr(null);
    setSelectedFiles(list);
    setResults(null);
  };

  const updateResult = useCallback((stagingId, patch) => {
    setResults((prev) => (prev || []).map((r) => (
      r.staging_id === stagingId ? { ...r, ...patch } : r
    )));
  }, []);

  const applyNormalizedResults = useCallback((normalized) => {
    setResults(normalized);
    if (onUploadComplete && countNormUploadSuccesses(normalized) > 0) {
      onUploadComplete();
    }
  }, [onUploadComplete]);

  const applyBatchPayload = useCallback((payload) => {
    const recovered = resultsFromNormBatchPayload(payload);
    if (recovered) {
      applyNormalizedResults(normalizeNormUploadResults(recovered));
    }
    setFolderCapNotice(folderCapNoticeFromPayload(payload));
  }, [applyNormalizedResults]);

  const handleIngestFolder = useCallback(async () => {
    if (!canIngestFolder) return;
    setValidationErr(null);
    setUploading(true);
    setSelectedFiles([]);
    setResults(null);
    setFolderCapNotice(null);
    try {
      const res = await apiService.ingestNormsFromFolder(folderId);
      applyBatchPayload(res);
    } catch (err) {
      if (resultsFromNormBatchPayload(err.data)) {
        applyBatchPayload(err.data);
      } else {
        setResults([{
          status: "error",
          fileName: "cartella",
          error: messageFromNormBatchError(err, "Errore ingest dalla cartella"),
        }]);
      }
    } finally {
      setUploading(false);
    }
  }, [canIngestFolder, folderId, applyBatchPayload]);

  const handleUpload = useCallback(async () => {
    if (selectedFiles.length === 0) return;
    const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setValidationErr(`File troppo grandi (limite 50 MB): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    setValidationErr(null);
    setUploading(true);
    setResults(null);
    setFolderCapNotice(null);
    try {
      const res = await apiService.uploadNorms(selectedFiles, folderId);
      applyBatchPayload(res);
    } catch (err) {
      if (resultsFromNormBatchPayload(err.data)) {
        applyBatchPayload(err.data);
      } else {
        setResults([{
          status: "error",
          fileName: "tutti i file",
          error: messageFromNormBatchError(err, "Errore upload"),
        }]);
      }
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, folderId, applyBatchPayload]);

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
        documentId: res.document_id,
        standard_code: res.standard_code,
        norm_title: res.norm_title,
        validity_status: res.validity_status,
        warnings: res.warnings || reviewItem.warnings,
      });
      setReviewItem(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      window.alert(err?.data?.error || err.message || "Conferma fallita");
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
    setFolderCapNotice(null);
    setReviewItem(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel = selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter((r) => r.status === "pending_review").length;

  const reviewWarnings = [
    ...(reviewItem?.warnings || []),
    ...(reviewItem?.catalog_lookup?.warning ? [reviewItem.catalog_lookup.warning] : []),
  ];

  return (
    <div className="norm-upload">
      <div className="norm-upload__triggers">
        <FileDropzone
          variant="compact"
          multiple
          accept=".pdf,application/pdf"
          disabled={uploading}
          onFiles={handleFileChange}
          label="Carica norme (batch)"
          ariaLabel="Carica norme (batch)"
          hint="Trascina i PDF o clicca"
          inputRef={inputRef}
          inputClassName="norm-upload__input-hidden"
        />
        <button
          type="button"
          className="norm-upload__btn"
          onClick={handleIngestFolder}
          disabled={uploading || !canIngestFolder}
          title={canIngestFolder
            ? "Estrae i campi dai PDF gi\u00e0 in questa cartella, senza ricaricare dal PC"
            : "Apri la cartella NORME E LEGGI"}
        >
          <span className="norm-upload__icon" role="img" aria-label="ingest">{"\u26A1"}</span>
          Ingest dalla cartella
        </button>
      </div>

      {showPanel && (
        <div className="norm-upload__panel">
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
                    <span className="norm-upload__file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                  </li>
                ))}
              </ul>
              {validationErr && (
                <div className="norm-upload__validation-error">{"\u26A0\uFE0F"} {validationErr}</div>
              )}
              <div className="norm-upload__actions">
                <button
                  className="norm-upload__action-btn norm-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <><span className="norm-upload__spinner" />Estrazione AI...</>
                  ) : "Estrai e rivedi"}
                </button>
                <button
                  className="norm-upload__action-btn norm-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >Annulla</button>
              </div>
            </>
          )}

          {hasResults && (
            <>
              <div className="norm-upload__panel-header">
                <span className="norm-upload__panel-title">
                  Risultati estrazione
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                </span>
              </div>
              {folderCapNotice && (
                <div className="norm-upload__size-warning" role="status">{folderCapNotice}</div>
              )}
              <ul className="norm-upload__results">
                {results.map((r, i) => {
                  const isPending = r.status === "pending_review";
                  const isConfirmed = r.status === "confirmed";
                  const isDup = r.status === "duplicate";
                  const isRejected = r.status === "rejected";
                  return (
                    <li
                      key={i}
                      className={`norm-upload__result-item norm-upload__result-item--${
                        isConfirmed ? "success" : isPending ? "pending" : isDup ? "duplicate" : isRejected ? "rejected" : "error"
                      }`}
                    >
                      {isPending ? (
                        <div className="norm-upload__result-pending">
                          <span className="norm-upload__result-icon">{"\uD83D\uDD0D"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Campi estratti — revisione obbligatoria prima del salvataggio.</p>
                            {r.standard_code && (
                              <span className="norm-upload__code-badge">{r.standard_code}</span>
                            )}
                            {r.warnings?.length > 0 && (
                              <div className="norm-upload__warnings">
                                {r.warnings.map((w, wi) => (
                                  <div key={wi} className="norm-upload__warning">{"\u26A0\uFE0F"} {w}</div>
                                ))}
                              </div>
                            )}
                            <button
                              type="button"
                              className="norm-upload__action-btn norm-upload__action-btn--primary"
                              onClick={() => handleOpenReview(r)}
                            >
                              Rivedi campi
                            </button>
                          </div>
                        </div>
                      ) : isConfirmed ? (
                        <div className="norm-upload__result-success">
                          <span className="norm-upload__result-icon">{"\u2705"}</span>
                          <div className="norm-upload__result-meta">
                            <strong className="norm-upload__norm-title">
                              {r.norm_title || r.fileName}
                            </strong>
                            {r.standard_code && (
                              <span className="norm-upload__code-badge">{r.standard_code}</span>
                            )}
                            <div className="norm-upload__meta-row">
                              {r.edition_year && <span>Anno: {r.edition_year}</span>}
                              {r.issuing_body && <span>Ente: {r.issuing_body}</span>}
                              {r.text_quality && (
                                <StatusBadge type="norm_quality" status={r.text_quality} size="small" />
                              )}
                              {r.validity_status && (
                                <span className="norm-upload__catalog-ok">
                                  Vigore: {r.validity_status === "da_verificare" ? "da verificare" : r.validity_status}
                                </span>
                              )}
                              {r.catalog_lookup_status === "active" && (
                                <span className="norm-upload__catalog-ok">Catalogo: vigente</span>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : isDup ? (
                        <div className="norm-upload__result-duplicate">
                          <span className="norm-upload__result-icon">{"\uD83D\uDD04"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>
                              {(r.warnings && r.warnings[0])
                                || r.error
                                || `Duplicato: norma già presente (${r.standard_code || "codice sconosciuto"}).`}
                            </p>
                          </div>
                        </div>
                      ) : isRejected ? (
                        <div className="norm-upload__result-rejected">
                          <span className="norm-upload__result-icon">{"\u274C"}</span>
                          <div><strong>{r.fileName}</strong><p>Scartato — non salvato.</p></div>
                        </div>
                      ) : (
                        <div className="norm-upload__result-error">
                          <span className="norm-upload__result-icon">{"\u274C"}</span>
                          <div>
                            <strong>{r.fileName || `File ${i + 1}`}</strong>
                            <p>{r.error || "Errore elaborazione"}</p>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <AiDisclaimer style={{ marginTop: "0.5rem" }} />
              <div className="norm-upload__actions">
                <button
                  className="norm-upload__action-btn norm-upload__action-btn--secondary"
                  onClick={handleDismiss}
                >Chiudi</button>
              </div>
            </>
          )}
        </div>
      )}

      <IngestReviewDialog
        open={!!reviewItem}
        docType="norma"
        fileName={reviewItem?.fileName}
        stagingId={reviewItem?.staging_id}
        previewFile={reviewItem?.previewFile}
        mimeType={reviewItem?.previewFile?.type || "application/pdf"}
        fields={reviewItem?.fields}
        fieldConfidence={reviewItem?.field_confidence}
        warnings={reviewWarnings}
        onConfirm={handleConfirmReview}
        onReject={handleRejectReview}
        onClose={() => setReviewItem(null)}
        busy={reviewBusy}
      />
    </div>
  );
}
