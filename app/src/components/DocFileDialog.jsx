/**
 * DocFileDialog - Dialog gestione file allegato al documento del registro
 * Visualizza lista versioni, permette upload nuova revisione, anteprima browser
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import DocumentPdfViewer from "./DocumentPdfViewer";
import DocumentDocxViewer from "./DocumentDocxViewer";
import "./DocFileDialog.css";

/** React non interpreta &#nnnn; nelle stringhe JS: serve il carattere Unicode reale. */
function e(dec) {
  return String.fromCodePoint(dec);
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const BLOCKED_EXT = [".exe",".bat",".cmd",".ps1",".sh",".msi",".vbs",".jar",".com",".scr",".pif",".reg",".dll",".sys"];

function isBlocked(filename) {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) return false;
  const ext = filename.slice(dot).toLowerCase();
  return BLOCKED_EXT.includes(ext);
}

const OFFICE_WORD_EXTS  = ['.docx', '.doc', '.docm', '.rtf'];
const OFFICE_EXCEL_EXTS = ['.xlsx', '.xls', '.xlsm'];

function getExt(filename) {
  if (!filename) return '';
  const dot = filename.lastIndexOf('.');
  if (dot === -1) return '';
  return filename.slice(dot).toLowerCase();
}

function DocFileDialog({ doc, onClose }) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadPct,   setUploadPct]   = useState(0);
  const [uploadErr,   setUploadErr]   = useState(null);
  // Timestamp di mount: previene ghost-click mobile che chiuderebbe l'overlay
  const openTimeRef = useRef(Date.now());
  const [uploadOk,    setUploadOk]    = useState(null);
  const [version,     setVersion]     = useState("");
  const [fileObj,     setFileObj]     = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Sprint 12-B: stato per rilascio revisione
  const [releasing,      setReleasing]      = useState(false);
  const [releaseError,   setReleaseError]   = useState(null);

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerAttId, setPdfViewerAttId] = useState(null);
  const [pdfViewerName, setPdfViewerName] = useState(null);
  // Sprint 12-B: viewer .docx browser-side (sola lettura, no Word desktop richiesto)
  const [docxViewerOpen, setDocxViewerOpen] = useState(false);
  const [docxViewerAttId, setDocxViewerAttId] = useState(null);
  const [docxViewerName, setDocxViewerName] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFiles();
  }, [doc.id]);

  async function loadFiles() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getDocFiles(doc.id);
      setData(res);
      setVersion(res.document?.revision || "");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(ev) {
    const f = ev.target.files[0];
    if (!f) return;
    if (isBlocked(f.name)) {
      const ext = getExt(f.name) || f.name;
      setUploadErr(`Formato non consentito per sicurezza: ${ext}`);
      ev.target.value = "";
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      setUploadErr(`Il file supera il limite di 50 MB (${(f.size / 1024 / 1024).toFixed(1)} MB)`);
      ev.target.value = "";
      return;
    }
    setFileObj(f);
    setUploadErr(null);
    setUploadOk(null);
  }

  async function handleUpload() {
    if (!fileObj) return;
    setUploading(true);
    setUploadPct(0);
    setUploadErr(null);
    setUploadOk(null);

    try {
      const formData = new FormData();
      formData.append('file', fileObj);
      if (version) formData.append('version', version);

      const token = apiService.getToken?.() || localStorage.getItem('sgq_auth_token');
      const url = `${apiService.baseUrl}/documents/${doc.id}/file`;

      const res = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) setUploadPct(Math.round((ev.loaded / ev.total) * 100));
        };
        xhr.onload = () => {
          let body;
          try { body = JSON.parse(xhr.responseText); } catch { body = {}; }
          if (xhr.status >= 200 && xhr.status < 300) resolve(body);
          else reject(new Error(body.error || `Upload fallito (${xhr.status})`));
        };
        xhr.onerror = () => reject(new Error('Errore di rete durante il caricamento'));
        xhr.send(formData);
      });

      setUploadPct(100);
      setUploadOk(`File "${res.file_name}" (${res.file_size_label}) caricato con successo.`);
      setFileObj(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFiles();
    } catch (err) {
      setUploadErr(err.message);
    } finally {
      setUploading(false);
    }
  }

  // Sprint 12-B: rilascia revisione (bozza → rilasciato)
  const handleReleaseRevision = useCallback(async () => {
    setReleasing(true);
    setReleaseError(null);
    try {
      const result = await apiService.releaseRevision(doc.id);
      await loadFiles();
      // Aggiorna il doc parent se possibile (ricarica lista esterna)
      if (doc.onStatusChange) doc.onStatusChange(doc.id, 'rilasciato', result.revision);
    } catch (err) {
      setReleaseError(`Errore rilascio: ${err.message}`);
    } finally {
      setReleasing(false);
    }
  }, [doc.id, loadFiles]);

  const currentFile = data?.files?.[0];
  const history     = data?.files?.slice(1) || [];

  return (
    <div className="docfile-overlay" onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      if (Date.now() - openTimeRef.current < 350) return;
      onClose();
    }}>
      <div className="docfile-modal">
        {/* Header */}
        <div className="docfile-header">
          <div>
            <h3 className="docfile-title">{e(128206)} File allegato</h3>
            <p className="docfile-subtitle">{doc.doc_code ? `${doc.doc_code} - ` : ""}{doc.title}</p>
          </div>
          <button type="button" className="docfile-close" onClick={onClose} aria-label="Chiudi">{String.fromCodePoint(0x2715)}</button>
        </div>

        {loading && (
          <div className="docfile-loading">
            <div className="docfile-spinner" />
            <span>Caricamento...</span>
          </div>
        )}

        {error && (
          <div className="docfile-error">{e(9888)}{"\uFE0F"} {error}</div>
        )}

        {!loading && !error && data && (
          <div className="docfile-body">
            {/* File corrente */}
            {currentFile ? (
              <div className="docfile-current">
                <div className="docfile-current-info">
                  <span className="docfile-icon">{e(128196)}</span>
                  <div className="docfile-meta">
                    <span className="docfile-name">{currentFile.file_name}</span>
                    <div className="docfile-details">
                      {currentFile.version && <span className="docfile-badge">Rev. {currentFile.version}</span>}
                      {currentFile.file_size_label && <span className="docfile-size">{currentFile.file_size_label}</span>}
                      {currentFile.uploaded_at && (
                        <span className="docfile-date">
                          {new Date(currentFile.uploaded_at).toLocaleDateString("it-IT")}
                        </span>
                      )}
                      {currentFile.uploaded_by && <span className="docfile-by">da {currentFile.uploaded_by}</span>}
                    </div>
                  </div>
                </div>
                <div className="docfile-actions">
                  {/* PDF: visualizzazione inline nel browser */}
                  {currentFile.mime_type === "application/pdf" ? (
                    <button
                      className="btn-docfile-view"
                      onClick={() => {
                        setPdfViewerAttId(currentFile.id);
                        setPdfViewerName(currentFile.file_name);
                        setPdfViewerOpen(true);
                      }}
                    >
                      {e(128196)} Visualizza PDF
                    </button>
                  ) : null}

                  {/* Visualizzazione browser nativa Word: docx-preview (sola lettura) */}
                  {OFFICE_WORD_EXTS.includes(getExt(currentFile.file_name)) && (
                    <button
                      className="btn-docfile-office btn-docfile-office-view"
                      onClick={() => {
                        setDocxViewerAttId(currentFile.id);
                        setDocxViewerName(currentFile.file_name);
                        setDocxViewerOpen(true);
                      }}
                      title="Visualizza nel browser - solo lettura, no Word richiesto"
                    >
                      {e(128065)}{"\uFE0F"} Visualizza
                    </button>
                  )}
                  {/* Excel: niente viewer browser, fallback Office Online Viewer */}
                  {OFFICE_EXCEL_EXTS.includes(getExt(currentFile.file_name)) && (
                    <button
                      className="btn-docfile-office btn-docfile-office-view"
                      onClick={() => {
                        const url = apiService.getDocFileDownloadUrl(doc.id, currentFile.id, false);
                        const viewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(url)}`;
                        window.open(viewUrl, '_blank', 'noopener,noreferrer');
                      }}
                      title="Visualizza nel browser"
                    >
                      {e(128065)}{"\uFE0F"} Visualizza
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn-docfile-download"
                    onClick={() => apiService.downloadDocFile(doc.id, null, currentFile.file_name).catch((err) => setError(err.message))}
                  >
                    {e(11015)}{"\uFE0F"} Scarica
                  </button>
                </div>

                {/* Pulsante RILASCIA REVISIONE (solo per bozze) */}
                {doc.status === 'bozza' && (
                  <div className="docfile-release-section">
                    <button
                      className="btn-docfile-release"
                      onClick={handleReleaseRevision}
                      disabled={releasing}
                      title="Incrementa il numero di revisione e porta il documento in stato Rilasciato"
                    >
                      {releasing ? "Rilascio in corso..." : `${e(127881)} Rilascia revisione`}
                    </button>
                    {releaseError && (
                      <div className="docfile-office-error">{e(9888)}{"\uFE0F"} {releaseError}</div>
                    )}
                  </div>
                )}

              </div>
            ) : (
              <div className="docfile-empty">
                <span className="docfile-empty-icon">{e(128196)}</span>
                <p>Nessun file allegato ancora.</p>
                <p className="docfile-empty-hint">Carica la prima versione usando il form qui sotto.</p>
              </div>
            )}

            {/* Storico versioni */}
            {history.length > 0 && (
              <div className="docfile-history-section">
                <button
                  className="docfile-history-toggle"
                  onClick={() => setShowHistory(v => !v)}
                >
                  {showHistory ? e(9650) : e(9660)} Versioni precedenti ({history.length})
                </button>
                {showHistory && (
                  <ul className="docfile-history-list">
                    {history.map(f => (
                      <li key={f.id} className="docfile-history-item">
                        <span className="docfile-history-name">{f.file_name}</span>
                        {f.version && <span className="docfile-badge-sm">Rev. {f.version}</span>}
                        {f.file_size_label && <span className="docfile-history-size">{f.file_size_label}</span>}
                        <span className="docfile-history-date">
                          {new Date(f.uploaded_at).toLocaleDateString("it-IT")}
                        </span>
                        {f.mime_type === 'application/pdf' && (
                          <button
                            className="btn-docfile-hist-view"
                            title="Visualizza PDF"
                            onClick={() => {
                              setPdfViewerAttId(f.id);
                              setPdfViewerName(f.file_name);
                              setPdfViewerOpen(true);
                            }}
                          >
                            {e(128065)}{"\uFE0F"}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-docfile-hist-dl"
                          title="Scarica"
                          onClick={() => apiService.downloadDocFile(doc.id, f.id, f.file_name).catch((err) => setError(err.message))}
                        >
                          {e(11015)}{"\uFE0F"}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Upload nuova versione */}
            <div className="docfile-upload-section">
              <h4 className="docfile-upload-title">
                {currentFile ? `${e(128260)} Carica nuova revisione` : `${e(128228)} Carica file`}
              </h4>

              <div className="docfile-upload-form">
                <div className="docfile-upload-row">
                  <label className="docfile-label">File</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="docfile-file-input"
                  />
                </div>
                <div className="docfile-upload-row">
                  <label className="docfile-label">Revisione (opzionale)</label>
                  <input
                    type="text"
                    placeholder="es. Rev. 3 oppure 2.0"
                    value={version}
                    onChange={e => setVersion(e.target.value)}
                    className="docfile-version-input"
                    maxLength={20}
                  />
                </div>

                {fileObj && (
                  <div className="docfile-selected">
                    File selezionato: <strong>{fileObj.name}</strong>
                    {" "}({(fileObj.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}

                {uploading && (
                  <div className="docfile-progress-wrap">
                    <div className="docfile-progress-bar">
                      <div className="docfile-progress-fill" style={{ width: `${uploadPct}%` }} />
                    </div>
                    <span className="docfile-progress-label">{uploadPct}%</span>
                  </div>
                )}

                {uploadErr && <div className="docfile-upload-error">{e(9888)}{"\uFE0F"} {uploadErr}</div>}
                {uploadOk  && <div className="docfile-upload-ok">{e(9989)} {uploadOk}</div>}

                <button
                  className="btn-docfile-upload"
                  onClick={handleUpload}
                  disabled={!fileObj || uploading}
                >
                  {uploading ? "Caricamento in corso..." : "Carica file"}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* PDF Viewer overlay */}
        {pdfViewerOpen && (
          <DocumentPdfViewer
            docId={doc.id}
            attachmentId={pdfViewerAttId}
            fileName={pdfViewerName}
            onClose={() => setPdfViewerOpen(false)}
          />
        )}
        {/* Word .docx Viewer overlay (sola lettura, browser-side) */}
        {docxViewerOpen && (
          <DocumentDocxViewer
            docId={doc.id}
            attachmentId={docxViewerAttId}
            fileName={docxViewerName}
            onClose={() => setDocxViewerOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

export default DocFileDialog;
