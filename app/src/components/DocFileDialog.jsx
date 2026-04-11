/**
 * DocFileDialog — Dialog gestione file allegato al documento del registro
 * Sprint 2B: visualizza lista versioni, permette upload nuova revisione
 */

import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import "./DocFileDialog.css";

const BLOCKED_EXT = [".exe",".bat",".cmd",".ps1",".sh",".msi",".vbs",".jar",".com",".scr",".pif",".reg",".dll",".sys"];

function isBlocked(filename) {
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return BLOCKED_EXT.includes(ext);
}

function DocFileDialog({ doc, onClose }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [uploading,setUploading]= useState(false);
  const [uploadErr,setUploadErr]= useState(null);
  const [uploadOk, setUploadOk] = useState(null);
  const [version,  setVersion]  = useState("");
  const [fileObj,  setFileObj]  = useState(null);
  const [showHistory, setShowHistory] = useState(false);
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

  const currentFile = data?.files?.[0];
  const history     = data?.files?.slice(1) || [];

  return (
    <div className="docfile-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
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
                  {currentFile.mime_type === "application/pdf" ? (
                    <a
                      href={apiService.getDocFileDownloadUrl(doc.id, null, true)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-docfile-view"
                    >
                      &#128196; Visualizza PDF
                    </a>
                  ) : null}
                  <a
                    href={apiService.getDocFileDownloadUrl(doc.id)}
                    download
                    className="btn-docfile-download"
                  >
                    &#11015;&#65039; Scarica
                  </a>
                </div>
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
      </div>
    </div>
  );
}

export default DocFileDialog;
