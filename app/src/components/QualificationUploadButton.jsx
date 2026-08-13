/**
 * QualificationUploadButton — Upload batch qualifiche con revisione pre-commit (IG-3).
 * Il tipo documento va scelto esplicitamente (nessun default silenzioso patentino):
 * evita di estrarre un PDF NDT come ISO 9606 perché si era sulla tab NDT.
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import "./QualificationUploadButton.css";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

const DOC_TYPE_OPTIONS = [
  { value: "patentino_saldatore", label: "Patentino saldatore (ISO 9606-1)" },
  { value: "qualifica_14732", label: "Qualifica operatore saldatura (ISO 14732)" },
  { value: "cert_ndt", label: "Certificato NDT (ISO 9712)" },
];

/** Mappa tab Qualifiche → doc_type ingest suggerito (mai applicato in automatico). */
export function suggestedDocTypeFromTab(tabKey) {
  switch (String(tabKey || "")) {
    case "ndt":
      return "cert_ndt";
    case "iso14732":
      return "qualifica_14732";
    case "iso9606_1":
    case "iso9606_2":
      return "patentino_saldatore";
    default:
      return "";
  }
}

function docTypeLabel(value) {
  return DOC_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

export default function QualificationUploadButton({
  companyId,
  companyName,
  onUploadComplete,
  /** Tab attiva in QualificationsPage (es. "ndt") — solo suggerimento UI */
  activeTab = "",
}) {
  const companyIdInt = companyId != null ? parseInt(String(companyId), 10) : NaN;
  const isValidCompany = !isNaN(companyIdInt) && companyIdInt > 0;
  const displayName = companyName || `Azienda #${companyIdInt}`;
  const suggested = suggestedDocTypeFromTab(activeTab);

  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [validationErr, setValidationErr] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  // Vuoto = obbligo di selezione esplicita (mai default patentino)
  const [docType, setDocType] = useState("");
  const inputRef = useRef(null);

  // Se cambia tab mentre il pannello è aperto senza file/risultati, aggiorna solo il suggerimento
  // (non forza il valore: la scelta resta dell'operatore).
  useEffect(() => {
    if (panelOpen && selectedFiles.length === 0 && !results) {
      setValidationErr(null);
    }
  }, [activeTab, panelOpen, selectedFiles.length, results]);

  const handleOpenPanel = () => {
    setPanelOpen(true);
    setValidationErr(null);
    setResults(null);
  };

  const handleChooseFiles = () => {
    if (!docType) {
      setValidationErr("Seleziona prima il tipo di qualifica che stai per caricare.");
      return;
    }
    setValidationErr(null);
    inputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setValidationErr(null);
    setSelectedFiles(files);
    setResults(null);
    setPanelOpen(true);
  };

  const handleUpload = useCallback(async () => {
    if (!docType) {
      setValidationErr("Seleziona il tipo di qualifica prima di estrarre (es. Certificato NDT se carichi UT/MT/PT/RT).");
      return;
    }
    if (selectedFiles.length === 0) {
      setValidationErr("Seleziona almeno un file PDF o immagine.");
      return;
    }
    const oversized = selectedFiles.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setValidationErr(`File troppo grandi (limite 50 MB): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    setValidationErr(null);
    setUploading(true);
    setResults(null);
    try {
      const res = await apiService.uploadQualificationsBatch(selectedFiles, companyIdInt, docType);
      setResults(res.results || []);
    } catch (err) {
      setResults([{ fileName: "tutti i file", status: "error", warnings: [err.message || "Errore upload"] }]);
    } finally {
      setUploading(false);
    }
  }, [selectedFiles, companyIdInt, docType]);

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
    setPanelOpen(false);
    setSelectedFiles([]);
    setResults(null);
    setValidationErr(null);
    setReviewItem(null);
    setDocType("");
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel = panelOpen || selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter((r) => r.status === "pending_review").length;
  const canExtract = Boolean(docType) && selectedFiles.length > 0 && !uploading;

  if (!isValidCompany) {
    return (
      <div className="qual-upload">
        <button
          type="button"
          className="qual-upload__btn"
          disabled
          title="Seleziona un'azienda nell'Ambito in alto per caricare le qualifiche"
          aria-label="Carica qualifiche (batch). Seleziona un'azienda nell'Ambito in alto."
        >
          <span className="qual-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
          Carica qualifiche (batch)
        </button>
      </div>
    );
  }

  return (
    <div className="qual-upload">
      <button className="qual-upload__btn" onClick={handleOpenPanel} disabled={uploading}>
        <span className="qual-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
        Carica qualifiche (batch)
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
              <div className={`qual-upload__doc-type${!docType ? " qual-upload__doc-type--required" : ""}`}>
                <label htmlFor="qual-upload-doctype">
                  Tipo qualifica da caricare <span className="qual-upload__required-mark">*</span>
                </label>
                <select
                  id="qual-upload-doctype"
                  value={docType}
                  onChange={(e) => {
                    setDocType(e.target.value);
                    setValidationErr(null);
                  }}
                  disabled={uploading}
                  required
                  aria-required="true"
                >
                  <option value="">— Seleziona il tipo (obbligatorio) —</option>
                  {DOC_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <span className="qual-upload__doc-type-hint">
                  Obbligatorio: scegli il tipo prima dei file. Un PDF NDT (UT/MT/PT/RT) va come
                  {" "}
                  <strong>Certificato NDT</strong>
                  , non come patentino saldatore.
                  {suggested ? (
                    <>
                      {" "}
                      Tab attiva suggerisce:
                      {" "}
                      <button
                        type="button"
                        className="qual-upload__suggest-btn"
                        onClick={() => {
                          setDocType(suggested);
                          setValidationErr(null);
                        }}
                        disabled={uploading || docType === suggested}
                      >
                        {docTypeLabel(suggested)}
                      </button>
                    </>
                  ) : null}
                </span>
              </div>

              <div className="qual-upload__panel-header">
                <span className="qual-upload__panel-title">
                  {selectedFiles.length > 0
                    ? `${selectedFiles.length} file selezionat${selectedFiles.length === 1 ? "o" : "i"}`
                    : "Nessun file ancora"}
                </span>
              </div>

              {selectedFiles.length > 0 && (
                <ul className="qual-upload__file-list">
                  {selectedFiles.map((f, i) => (
                    <li key={i} className="qual-upload__file-item">
                      <span className="qual-upload__file-icon">{"\uD83D\uDCC4"}</span>
                      <span className="qual-upload__file-name">{f.name}</span>
                      <span className="qual-upload__file-size">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                    </li>
                  ))}
                </ul>
              )}

              {validationErr && (
                <div className="qual-upload__validation-error">{"\u26A0\uFE0F"} {validationErr}</div>
              )}

              <div className="qual-upload__actions">
                <button
                  type="button"
                  className="qual-upload__action-btn qual-upload__action-btn--secondary"
                  onClick={handleChooseFiles}
                  disabled={uploading || !docType}
                  title={!docType ? "Seleziona prima il tipo di qualifica" : "Scegli PDF o immagini"}
                >
                  {selectedFiles.length > 0 ? "Cambia file…" : "Scegli file…"}
                </button>
                <button
                  type="button"
                  className="qual-upload__action-btn qual-upload__action-btn--primary"
                  onClick={handleUpload}
                  disabled={!canExtract}
                  title={!docType ? "Seleziona prima il tipo" : selectedFiles.length === 0 ? "Scegli almeno un file" : "Avvia estrazione"}
                >
                  {uploading ? (
                    <><span className="qual-upload__spinner" />Elaborazione AI...</>
                  ) : "Estrai e rivedi"}
                </button>
                <button
                  type="button"
                  className="qual-upload__action-btn qual-upload__action-btn--secondary"
                  onClick={handleDismiss}
                  disabled={uploading}
                >
                  Annulla
                </button>
              </div>
            </>
          )}

          {hasResults && (
            <>
              <div className="qual-upload__panel-header">
                <span className="qual-upload__panel-title">
                  Risultati estrazione
                  {docType && (
                    <span className="qual-upload__result-doctype"> · {docTypeLabel(docType)}</span>
                  )}
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                </span>
              </div>
              <ul className="qual-upload__results">
                {results.map((r, i) => {
                  const isPending = r.status === "pending_review";
                  const isConfirmed = r.status === "confirmed";
                  const isDup = r.status === "duplicate";
                  const isRejected = r.status === "rejected";
                  return (
                    <li key={i} className={`qual-upload__result-item qual-upload__result-item--${
                      isConfirmed ? "success" : isPending ? "pending" : isDup ? "duplicate" : isRejected ? "rejected" : "error"
                    }`}
                    >
                      {isPending ? (
                        <div className="qual-upload__result-pending">
                          <span className="qual-upload__result-icon">{"\uD83D\uDD0D"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p>Campi estratti{"\u2014"} revisione obbligatoria prima del salvataggio.</p>
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
                            <p>Duplicato: qualifica gi{"\u00E0"} presente nel registro.</p>
                          </div>
                        </div>
                      ) : isRejected ? (
                        <div className="qual-upload__result-rejected">
                          <span className="qual-upload__result-icon">{"\u274C"}</span>
                          <div><strong>{r.fileName}</strong><p>Scartato{"\u2014"} non salvato.</p></div>
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
                <button type="button" className="qual-upload__action-btn qual-upload__action-btn--secondary" onClick={handleDismiss}>
                  Chiudi
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <IngestReviewDialog
        open={!!reviewItem}
        docType={docType}
        fileName={reviewItem?.fileName}
        stagingId={reviewItem?.staging_id}
        previewFile={reviewItem?.previewFile}
        mimeType={reviewItem?.previewFile?.type || "application/pdf"}
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
