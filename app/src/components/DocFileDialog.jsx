/**
 * DocFileDialog — Dialog gestione file allegato al documento del registro
 * Sprint 2B: visualizza lista versioni, permette upload nuova revisione
 * Sprint 12-A: "Apri in Word/Excel" (Office URI Scheme + WebDAV) e anteprima browser
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import DocumentPdfViewer from "./DocumentPdfViewer";
import "./DocFileDialog.css";

const BLOCKED_EXT = [".exe",".bat",".cmd",".ps1",".sh",".msi",".vbs",".jar",".com",".scr",".pif",".reg",".dll",".sys"];

function isBlocked(filename) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return BLOCKED_EXT.includes(ext);
}

// Estensioni supportate da "Apri in Office" e "Visualizza nel browser"
const OFFICE_WORD_EXTS  = ['.docx', '.doc', '.docm', '.rtf'];
const OFFICE_EXCEL_EXTS = ['.xlsx', '.xls', '.xlsm'];
const OFFICE_VIEW_EXTS  = [...OFFICE_WORD_EXTS, ...OFFICE_EXCEL_EXTS, '.pptx', '.ppt'];

function getExt(filename) {
  if (!filename) return '';
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

// URL Microsoft Office Online Viewer (gratuito, nessuna dipendenza)
function buildOfficOnlineViewUrl(webdavUrl) {
  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(webdavUrl)}`;
}

function DocFileDialog({ doc, onClose }) {
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [uploading,   setUploading]   = useState(false);
  const [uploadErr,   setUploadErr]   = useState(null);
  // Timestamp di mount: previene ghost-click mobile che chiuderebbe l'overlay
  const openTimeRef = useRef(Date.now());
  const [uploadOk,    setUploadOk]    = useState(null);
  const [version,     setVersion]     = useState("");
  const [fileObj,     setFileObj]     = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Sprint 12-A: stato per apertura/anteprima Office
  const [officeLoading, setOfficeLoading] = useState(false);
  const [officeError,   setOfficeError]   = useState(null);
  const [webdavData,    setWebdavData]    = useState(null); // cache link generato

  const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
  const [pdfViewerAttId, setPdfViewerAttId] = useState(null);
  const [pdfViewerName, setPdfViewerName] = useState(null);

  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFiles();
    setWebdavData(null);
    setOfficeError(null);
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

  function handleFileChange(e) {
    const f = e.target.files[0];
    if (!f) return;
    if (isBlocked(f.name)) {
      setUploadErr(`Formato non consentito per sicurezza: ${f.name.slice(f.name.lastIndexOf("."))}`);
      e.target.value = "";
      return;
    }
    setFileObj(f);
    setUploadErr(null);
    setUploadOk(null);
  }

  async function handleUpload() {
    if (!fileObj) return;
    setUploading(true);
    setUploadErr(null);
    setUploadOk(null);
    try {
      const res = await apiService.uploadDocFile(doc.id, fileObj, version);
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

  // Sprint 12-A: genera link WebDAV e apre Office (editing) o viewer (lettura)
  const handleOpenInOffice = useCallback(async (mode = 'edit') => {
    setOfficeLoading(true);
    setOfficeError(null);
    try {
      // Riusa il link se già generato e non scaduto (cache lato client)
      let link = webdavData;
      if (!link || new Date(link.expires_at) <= new Date()) {
        link = await apiService.getWebdavLink(doc.id);
        setWebdavData(link);
      }

      if (mode === 'edit') {
        // Apertura diretta in Word/Excel desktop via URI Scheme
        if (!link.office_uri) {
          setOfficeError('Formato file non supportato per l\'apertura diretta in Office.');
          return;
        }
        window.location.href = link.office_uri;
      } else {
        // Visualizzazione in-browser via Microsoft Office Online Viewer (gratuito)
        const viewUrl = buildOfficOnlineViewUrl(link.webdav_url);
        window.open(viewUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      setOfficeError(`Errore: ${err.message}`);
    } finally {
      setOfficeLoading(false);
    }
  }, [doc.id, webdavData]);

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
            <h3 className="docfile-title">&#128206; File allegato</h3>
            <p className="docfile-subtitle">{doc.doc_code ? `${doc.doc_code} — ` : ""}{doc.title}</p>
          </div>
          <button className="docfile-close" onClick={onClose}>&#x2715;</button>
        </div>

        {loading && (
          <div className="docfile-loading">
            <div className="docfile-spinner" />
            <span>Caricamento...</span>
          </div>
        )}

        {error && (
          <div className="docfile-error">&#9888;&#65039; {error}</div>
        )}

        {!loading && !error && data && (
          <div className="docfile-body">
            {/* File corrente */}
            {currentFile ? (
              <div className="docfile-current">
                <div className="docfile-current-info">
                  <span className="docfile-icon">&#128196;</span>
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
                      &#128196; Visualizza PDF
                    </button>
                  ) : null}

                  {/* Office: apri in Word/Excel desktop (Sprint 12-A) */}
                  {OFFICE_WORD_EXTS.includes(getExt(currentFile.file_name)) && (
                    <button
                      className="btn-docfile-office btn-docfile-office-word"
                      onClick={() => handleOpenInOffice('edit')}
                      disabled={officeLoading}
                      title="Apri in Word desktop — modifica e salva direttamente"
                    >
                      &#128196; Apri in Word
                    </button>
                  )}
                  {OFFICE_EXCEL_EXTS.includes(getExt(currentFile.file_name)) && (
                    <button
                      className="btn-docfile-office btn-docfile-office-excel"
                      onClick={() => handleOpenInOffice('edit')}
                      disabled={officeLoading}
                      title="Apri in Excel desktop — modifica e salva direttamente"
                    >
                      &#128202; Apri in Excel
                    </button>
                  )}

                  {/* Visualizzazione browser senza Office (Microsoft Office Online Viewer) */}
                  {OFFICE_VIEW_EXTS.includes(getExt(currentFile.file_name)) && (
                    <button
                      className="btn-docfile-office btn-docfile-office-view"
                      onClick={() => handleOpenInOffice('view')}
                      disabled={officeLoading}
                      title="Visualizza nel browser senza Office installato"
                    >
                      &#128065;&#65039; Visualizza
                    </button>
                  )}

                  {officeLoading && (
                    <span className="docfile-office-loading">&#9696; Apertura...</span>
                  )}

                  <a
                    href={apiService.getDocFileDownloadUrl(doc.id)}
                    download
                    className="btn-docfile-download"
                  >
                    &#11015;&#65039; Scarica
                  </a>
                </div>

                {/* Errore apertura Office */}
                {officeError && (
                  <div className="docfile-office-error">
                    &#9888;&#65039; {officeError}
                    <p className="docfile-office-fallback">
                      Usa il pulsante <strong>Scarica</strong>, modifica il file e ricaricalo con "Carica nuova revisione".
                    </p>
                  </div>
                )}

                {/* Info post-apertura Office */}
                {webdavData && !officeError && (
                  <div className="docfile-office-info">
                    &#128274; Link Office attivo — salva in Word/Excel per aggiornare il documento.
                    Scade alle {new Date(webdavData.expires_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}.
                  </div>
                )}
              </div>
            ) : (
              <div className="docfile-empty">
                <span className="docfile-empty-icon">&#128196;</span>
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
                  {showHistory ? "&#9650;" : "&#9660;"} Versioni precedenti ({history.length})
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
                            &#128065;&#65039;
                          </button>
                        )}
                        <a
                          href={apiService.getDocFileDownloadUrl(doc.id, f.id)}
                          download
                          className="btn-docfile-hist-dl"
                        >
                          &#11015;&#65039;
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Upload nuova versione */}
            <div className="docfile-upload-section">
              <h4 className="docfile-upload-title">
                {currentFile ? "&#128260; Carica nuova revisione" : "&#128228; Carica file"}
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

                {uploadErr && <div className="docfile-upload-error">&#9888;&#65039; {uploadErr}</div>}
                {uploadOk  && <div className="docfile-upload-ok">&#9989; {uploadOk}</div>}

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
      </div>
    </div>
  );
}

export default DocFileDialog;
