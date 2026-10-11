/**
 * QualificationUploadButton — Upload batch qualifiche con revisione pre-commit (IG-3).
 * Il tipo documento è riconosciuto per file dal backend (regole, OCR, AI). Nessun default silenzioso:
 * se il tipo non è chiaro il file resta «da scegliere» (conferma disabilitata) finché l'operatore
 * non lo sceglie; cambiare il tipo rielabora quel file con `doc_type` esplicito (override).
 */
import React, { useState, useRef, useCallback, useEffect } from "react";
import apiService from "../services/apiService";
import IngestReviewDialog from "./IngestReviewDialog";
import FileDropzone from "./FileDropzone";
import StatusBadge from "./StatusBadge";
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

/**
 * Riepilogo avvisi norma (VQ-9) sui risultati che hanno gia' un esito `verification`
 * (dall'estrazione, dalla revisione o dalla conferma). Nessuna chiamata: se nessun risultato
 * ha l'esito, ritorna `null` e il riepilogo non compare.
 */
export function summarizeNormVerification(results) {
  const withResult = (results || []).filter((r) => r?.verification?.summary);
  if (withResult.length === 0) return null;
  let warn = 0;
  let filesWithWarn = 0;
  for (const r of withResult) {
    const n = Number(r.verification.summary.warn) || 0;
    warn += n;
    if (n > 0) filesWithWarn += 1;
  }
  return { warn, filesWithWarn, files: withResult.length };
}

function docTypeLabel(value) {
  return DOC_TYPE_OPTIONS.find((o) => o.value === value)?.label || value;
}

/** Il file attende la scelta del tipo: tipo non chiaro (bassa confidenza / «altro») non confermato dall'operatore. */
export function needsTypeChoice(r) {
  if (!r) return false;
  if (r.status === "type_unresolved") return true;
  if (r.classification_source === "override") return false;
  return Boolean(r.classification?.needs_choice);
}

function typeBadgeKey(r) {
  if (r.classification_source === "override") return "override";
  if (needsTypeChoice(r)) return "low";
  return r.classification_confidence === "high" ? "high" : "medium";
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
  const inputRef = useRef(null);
  const scopeKey = isValidCompany ? String(companyIdInt) : "";

  // Cambio Ambito: azzera file/staging/pannello (non attribuire un batch azienda A ad azienda B).
  useEffect(() => {
    setPanelOpen(false);
    setSelectedFiles([]);
    setUploading(false);
    setResults(null);
    setValidationErr(null);
    setReviewItem(null);
    setReviewBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [scopeKey]);

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

  const startUpload = useCallback(async (list) => {
    const oversized = list.filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      setValidationErr(`File troppo grandi (limite 50 MB): ${oversized.map((f) => f.name).join(", ")}`);
      return;
    }
    setValidationErr(null);
    setSelectedFiles(list);
    setPanelOpen(true);
    setUploading(true);
    setResults(null);
    try {
      const res = await apiService.uploadQualificationsBatch(list, companyIdInt);
      setResults((res.results || []).map((r) => ({
        ...r,
        _file: list.find((f) => f.name === r.fileName) || null,
      })));
    } catch (err) {
      setResults([{ fileName: "tutti i file", status: "error", warnings: [err.message || "Errore upload"] }]);
    } finally {
      setUploading(false);
    }
  }, [companyIdInt]);

  const handleFileChange = (files) => {
    const list = Array.from(files || []);
    if (list.length === 0) return;
    startUpload(list);
  };

  const handleOverrideType = useCallback(async (index, item, newDocType) => {
    const file = item._file || selectedFiles.find((f) => f.name === item.fileName) || null;
    if (!newDocType || !file) return;
    setResults((prev) => (prev || []).map((r, i) => (i === index ? { ...r, _busy: true, _overrideError: null } : r)));
    try {
      const res = await apiService.uploadQualificationsBatch([file], companyIdInt, newDocType);
      const next = (res.results || [])[0] || { fileName: item.fileName, status: "error", warnings: ["Nessun risultato"] };
      if (item.staging_id && next.status !== "error") {
        // Il vecchio staging (tipo sbagliato) non deve restare in coda: best-effort, non blocca l'override.
        apiService.rejectIngestStaging(item.staging_id).catch(() => {});
      }
      setResults((prev) => (prev || []).map((r, i) => (i === index ? { ...next, _file: file } : r)));
    } catch (err) {
      setResults((prev) => (prev || []).map((r, i) => (
        i === index ? { ...r, _busy: false, _overrideError: err.message || "Rielaborazione fallita" } : r
      )));
    }
  }, [selectedFiles, companyIdInt]);

  const updateResult = useCallback((stagingId, patch) => {
    setResults((prev) => (prev || []).map((r) => (
      r.staging_id === stagingId ? { ...r, ...patch } : r
    )));
  }, []);

  const handleVerificationChange = useCallback((stagingId, verification) => {
    if (stagingId == null || !verification) return;
    setResults((prev) => (prev || []).map((r) => (
      r.staging_id === stagingId && r.verification !== verification ? { ...r, verification } : r
    )));
    setReviewItem((prev) => (
      prev?.staging_id === stagingId && prev.verification !== verification
        ? { ...prev, verification }
        : prev
    ));
  }, []);

  const handleOpenReview = useCallback((item) => {
    const localFile = item._file || selectedFiles.find((f) => f.name === item.fileName) || null;
    setReviewItem({ ...item, previewFile: localFile });
  }, [selectedFiles]);

  const handleConfirmReview = useCallback(async (fields) => {
    if (!reviewItem?.staging_id) return;
    setReviewBusy(true);
    try {
      const res = await apiService.confirmIngestStaging(reviewItem.staging_id, fields);
      const stagingId = reviewItem.staging_id;
      // Confirm non restituisce verification; reviewItem e' lo snapshot all'apertura.
      // Fonte: stato corrente (onVerificationChange → results), non res/reviewItem.
      setResults((prev) => (prev || []).map((r) => {
        if (r.staging_id !== stagingId) return r;
        return {
          ...r,
          status: "confirmed",
          qualification_id: res.qualification_id,
          person_name: res.person_name,
          qualification_type: res.qualification_type,
          warnings: res.warnings || r.warnings,
          verification: res.verification || r.verification || null,
        };
      }));
      setReviewItem(null);
      if (onUploadComplete) onUploadComplete();
    } catch (err) {
      const msg = err?.data?.error || err.message || "Conferma fallita";
      window.alert(msg);
    } finally {
      setReviewBusy(false);
    }
  }, [reviewItem, onUploadComplete]);

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
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const hasResults = results && results.length > 0;
  const showPanel = panelOpen || selectedFiles.length > 0 || hasResults;
  const pendingCount = (results || []).filter((r) => r.status === "pending_review").length;
  const unresolvedCount = (results || []).filter(needsTypeChoice).length;

  const renderTypeChooser = (r, i) => {
    const choiceNeeded = needsTypeChoice(r);
    const currentValue = choiceNeeded ? "" : (r.doc_type || r.detected_doc_type || "");
    const reasons = (r.classification?.reasons || []).slice(0, 2).join(" \u00B7 ");
    return (
      <div className="qual-upload__type-row" data-testid="qual-upload-type-row">
        <StatusBadge
          type="doc_type_confidence"
          status={typeBadgeKey(r)}
          size="small"
        />
        <select
          className="qual-upload__type-select"
          aria-label={`Tipo qualifica di ${r.fileName}`}
          data-testid="qual-upload-type-select"
          value={currentValue}
          disabled={r._busy || uploading}
          onChange={(e) => handleOverrideType(i, r, e.target.value)}
        >
          {choiceNeeded && <option value="">{"\u2014 Scegli il tipo \u2014"}</option>}
          {DOC_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}{o.value === suggested ? " (suggerito dalla scheda attiva)" : ""}
            </option>
          ))}
        </select>
        {r._busy && <span className="qual-upload__type-busy">Rielaborazione...</span>}
        {reasons && <span className="qual-upload__type-reasons">{reasons}</span>}
        {r._overrideError && <span className="qual-upload__type-error">{r._overrideError}</span>}
      </div>
    );
  };
  const verifySummary = summarizeNormVerification(results);

  if (!isValidCompany) {
    return (
      <div className="qual-upload">
        <FileDropzone
          variant="compact"
          disabled
          label="Carica qualifiche (batch)"
          ariaLabel="Carica qualifiche (batch). Seleziona un'azienda nell'Ambito in alto."
          title="Seleziona un'azienda nell'Ambito in alto per caricare le qualifiche"
          hint="Seleziona un'azienda in Ambito"
        />
      </div>
    );
  }

  return (
    <div className="qual-upload">
      <button className="qual-upload__btn" onClick={handleOpenPanel} disabled={uploading}>
        <span className="qual-upload__icon" role="img" aria-label="upload">{"\u2795"}</span>
        Carica qualifiche (batch)
      </button>

      {showPanel && (
        <div className="qual-upload__panel">
          <div className="qual-upload__company-context">
            <span className="qual-upload__company-label">Azienda:</span>
            <strong className="qual-upload__company-name">{displayName}</strong>
          </div>

          {!hasResults && (
            <>
              <p className="qual-upload__auto-hint">
                Il tipo di ogni file (patentino saldatore, operatore 14732, certificato NDT) viene riconosciuto in automatico:
                potrai correggerlo nella revisione.
              </p>

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

              {uploading && (
                <div className="qual-upload__progress" role="status" data-testid="qual-upload-progress">
                  <span className="qual-upload__spinner qual-upload__spinner--dark" />
                  Riconoscimento del tipo ed estrazione in corso...
                </div>
              )}

              <FileDropzone
                variant="zone"
                multiple
                accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                disabled={uploading}
                onFiles={handleFileChange}
                label="Trascina qui i file o clicca per selezionare"
                hint={"PDF o immagini \u2014 max 50 MB. L'elaborazione parte subito."}
                title="Scegli PDF o immagini: l'elaborazione parte subito"
                inputRef={inputRef}
                inputClassName="qual-upload__input-hidden"
              />

              <div className="qual-upload__actions">
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
                  {pendingCount > 0 && (
                    <span className="ingest-review__pending-badge">{pendingCount} da rivedere</span>
                  )}
                  {unresolvedCount > 0 && (
                    <span className="qual-upload__choose-badge" data-testid="qual-upload-unresolved-count">
                      {unresolvedCount} da scegliere
                    </span>
                  )}
                </span>
              </div>
              {verifySummary && (
                <p className="qual-upload__result-meta" data-testid="qual-upload-verify-summary">
                  {verifySummary.warn > 0
                    ? `Verifica norma: ${verifySummary.warn} ${verifySummary.warn === 1 ? "avviso" : "avvisi"} in ${verifySummary.filesWithWarn} su ${verifySummary.files} file verificati`
                    : `Verifica norma: nessun avviso su ${verifySummary.files} ${verifySummary.files === 1 ? "file verificato" : "file verificati"}`}
                  {" \u2014 gli avvisi non impediscono il salvataggio."}
                </p>
              )}
              <ul className="qual-upload__results">
                {results.map((r, i) => {
                  const isPending = r.status === "pending_review";
                  const isUnresolved = r.status === "type_unresolved";
                  const choiceNeeded = needsTypeChoice(r);
                  const isConfirmed = r.status === "confirmed";
                  const isDup = r.status === "duplicate";
                  const isWrong = r.status === "wrong_module";
                  const isRejected = r.status === "rejected";
                  return (
                    <li key={i} className={`qual-upload__result-item qual-upload__result-item--${
                      isConfirmed ? "success" : isPending ? "pending" : isUnresolved ? "unresolved" : isDup ? "duplicate" : isWrong ? "wrong-module" : isRejected ? "rejected" : "error"
                    }`}
                    >
                      {isPending || isUnresolved ? (
                        <div className="qual-upload__result-pending">
                          <span className="qual-upload__result-icon">{isUnresolved ? "\u2753" : "\uD83D\uDD0D"}</span>
                          <div className="qual-upload__result-body">
                            <strong>{r.fileName}</strong>
                            {renderTypeChooser(r, i)}
                            <p>
                              {isUnresolved
                                ? "Tipo non riconosciuto con certezza: scegli il tipo per estrarre i campi."
                                : <>Campi estratti{"\u2014"} revisione obbligatoria prima del salvataggio.</>}
                            </p>
                            {r.warnings?.length > 0 && (
                              <div className="qual-upload__warnings">
                                {r.warnings.map((w, wi) => <div key={wi} className="qual-upload__warning">{"\u26A0\uFE0F"} {w}</div>)}
                              </div>
                            )}
                            <button
                              type="button"
                              className="qual-upload__action-btn qual-upload__action-btn--primary"
                              onClick={() => handleOpenReview(r)}
                              disabled={choiceNeeded || r._busy}
                              title={choiceNeeded
                                ? "Scegli prima il tipo di qualifica per questo file"
                                : r._busy ? "Rielaborazione in corso" : "Rivedi i campi estratti e conferma"}
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
                      ) : isWrong ? (
                        <div className="qual-upload__result-wrong-module">
                          <span className="qual-upload__result-icon">{"\u26A0\uFE0F"}</span>
                          <div>
                            <strong>{r.fileName}</strong>
                            <p className="qual-upload__wrong-module-msg">
                              {r.message || r.error || "Documento non compatibile con il tipo scelto."}
                            </p>
                            {r.classification ? renderTypeChooser(r, i) : null}
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
                            <p>{r.error || r.message || (r.warnings?.[0]) || "Errore sconosciuto"}</p>
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
        docType={reviewItem?.doc_type || reviewItem?.detected_doc_type || ""}
        fileName={reviewItem?.fileName}
        stagingId={reviewItem?.staging_id}
        previewFile={reviewItem?.previewFile}
        mimeType={reviewItem?.previewFile?.type || "application/pdf"}
        fields={reviewItem?.fields}
        fieldConfidence={reviewItem?.field_confidence}
        warnings={reviewItem?.warnings}
        qualificationType={reviewItem?.qualification_type}
        verification={reviewItem?.verification}
        onVerificationChange={(v) => handleVerificationChange(reviewItem?.staging_id, v)}
        onConfirm={handleConfirmReview}
        onReject={handleRejectReview}
        onClose={() => setReviewItem(null)}
        busy={reviewBusy}
      />
    </div>
  );
}
