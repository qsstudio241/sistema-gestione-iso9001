/**
 * DocumentForm - Modale per creazione e modifica documenti SGQ
 * Sprint 1 UX:
 *   - Nuovo documento: wizard 2 passi (essenziali → dettagli)
 *   - Modifica: form completo in una sola schermata
 *
 * Sprint unified-upload:
 *   - Step 1: drag & drop file opzionale
 *   - Step 2: selezione cartella destinazione con suggerimento AI
 *   - Save: creazione documento + upload file + posizionamento albero
 *
 * Fix BUG-001: footer spostato fuori dal tag <form> per evitare
 * submit involontaria al click di "Avanti →" in alcuni browser.
 * La submit ora è gestita esplicitamente tramite onClick.
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import { DOC_TYPE_OPTIONS, DOC_STATUS_OPTIONS } from "../data/documentTypes";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import { getSuggestedFolderCode } from "../data/documentFolderMapping";
import "./DocumentForm.css";

const DOC_TYPES = DOC_TYPE_OPTIONS;
const DOC_STATUSES = DOC_STATUS_OPTIONS;

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ACCEPTED_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-excel': '.xls',
  'image/png': '.png',
  'image/jpeg': '.jpg/.jpeg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/tiff': '.tiff',
};
const ACCEPTED_EXTENSIONS = ['.pdf','.docx','.doc','.xlsx','.xls','.png','.jpg','.jpeg','.gif','.webp','.tiff'];
const ACCEPT_STRING = Object.keys(ACCEPTED_TYPES).join(',') + ',' + ACCEPTED_EXTENSIONS.join(',');

function getFileTypeColor(filename) {
  if (!filename) return '#6b7280';
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') return '#dc2626';
  if (['.docx', '.doc'].includes(ext)) return '#2563eb';
  if (['.xlsx', '.xls'].includes(ext)) return '#16a34a';
  if (['.png','.jpg','.jpeg','.gif','.webp','.tiff'].includes(ext)) return '#9333ea';
  return '#6b7280';
}

function getFileTypeIcon(filename) {
  if (!filename) return '\u{1F4C4}';
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  if (ext === '.pdf') return '\u{1F4D5}';
  if (['.docx', '.doc'].includes(ext)) return '\u{1F4DD}';
  if (['.xlsx', '.xls'].includes(ext)) return '\u{1F4CA}';
  if (['.png','.jpg','.jpeg','.gif','.webp','.tiff'].includes(ext)) return '\u{1F5BC}\uFE0F';
  return '\u{1F4C4}';
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function isFileAccepted(file) {
  if (ACCEPTED_TYPES[file.type]) return true;
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext);
}

function toDateInput(val) {
  if (!val) return "";
  return val.substring(0, 10);
}

// ─── Indicatore step ──────────────────────────────────────────────────────────

function StepIndicator({ step }) {
  return (
    <div className="wizard-steps">
      <div className={`wizard-step ${step >= 1 ? "step-active" : ""}`}>
        <span className="step-dot">1</span>
        <span className="step-label">Identificazione</span>
      </div>
      <div className="step-connector" />
      <div className={`wizard-step ${step >= 2 ? "step-active" : ""}`}>
        <span className="step-dot">2</span>
        <span className="step-label">Dettagli</span>
      </div>
    </div>
  );
}

// ─── Componente principale ────────────────────────────────────────────────────

function DocumentForm({ doc, companies, standards, onSave, onClose, defaultFolderId }) {
  const isEdit = !!doc;
  const [step, setStep] = useState(1);
  const openTimeRef = useRef(Date.now());

  const [form, setForm] = useState({
    doc_type:        doc?.doc_type        || "procedura",
    doc_code:        doc?.doc_code        || "",
    title:           doc?.title           || "",
    revision:        doc?.revision        || "",
    status:          doc?.status          || "vigente",
    issue_date:      toDateInput(doc?.issue_date),
    expiry_date:     toDateInput(doc?.expiry_date),
    responsible:     doc?.responsible     || "",
    retention_years: doc?.retention_years || "",
    standard_id:     doc?.standard_id     || "",
    clause_ref:      doc?.clause_ref      || "",
    company_id:      doc?.company_id      || "",
    notes:           doc?.notes           || "",
  });

  // Dati tipo-specifici
  const [typeData, setTypeData] = useState(() => {
    if (doc?.type_specific_data) {
      try {
        return typeof doc.type_specific_data === "string"
          ? JSON.parse(doc.type_specific_data)
          : doc.type_specific_data;
      } catch { return {}; }
    }
    return {};
  });
  const [typeDetailsOpen, setTypeDetailsOpen] = useState(true);
  const docTypePrevRef = useRef(form.doc_type);

  // ─── File upload state ────────────────────────────────────────────
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ─── Folder selection state ───────────────────────────────────────
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId || null);
  const [suggestedFolderId, setSuggestedFolderId] = useState(null);
  const [folderSuggestionConfidence, setFolderSuggestionConfidence] = useState(null);
  const [userOverrodeFolder, setUserOverrodeFolder] = useState(!!defaultFolderId);

  // ─── Save state ───────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // Reset dati tipo-specifici quando il tipo cambia
  useEffect(() => {
    if (docTypePrevRef.current === form.doc_type) return;
    docTypePrevRef.current = form.doc_type;
    setTypeData({});
    setTypeDetailsOpen(true);
  }, [form.doc_type]);

  // Carica cartelle disponibili (al mount e al cambio tipo)
  useEffect(() => {
    if (isEdit) return;
    loadFolders();
  }, [isEdit]);

  // Aggiorna suggerimento cartella quando cambia il tipo documento
  useEffect(() => {
    if (isEdit || userOverrodeFolder) return;
    loadFolderSuggestion(form.doc_type);
  }, [form.doc_type, isEdit, userOverrodeFolder]);

  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") handleCloseAttempt(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [uploading]);

  const loadFolders = useCallback(async () => {
    setFoldersLoading(true);
    try {
      const res = await apiService.getDocuments({ doc_type: 'folder', limit: 500 });
      const list = res?.data || res?.documents || res || [];
      setFolders(Array.isArray(list) ? list : []);
    } catch {
      setFolders([]);
    } finally {
      setFoldersLoading(false);
    }
  }, []);

  const loadFolderSuggestion = useCallback(async (docType) => {
    if (!docType) return;
    try {
      const suggestion = await apiService.getFolderSuggestion(docType);
      if (suggestion?.folder_id) {
        setSuggestedFolderId(suggestion.folder_id);
        setFolderSuggestionConfidence(suggestion.confidence || 'medium');
        if (!userOverrodeFolder) {
          setSelectedFolderId(suggestion.folder_id);
        }
      } else {
        setSuggestedFolderId(null);
        setFolderSuggestionConfidence(null);
        if (!userOverrodeFolder) {
          setSelectedFolderId(defaultFolderId || null);
        }
      }
    } catch {
      setSuggestedFolderId(null);
      setFolderSuggestionConfidence(null);
    }
  }, [userOverrodeFolder, defaultFolderId]);

  // ─── Handlers generali ────────────────────────────────────────────

  const handleChange = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleTypeDataChange = (key) => (e) =>
    setTypeData((d) => ({ ...d, [key]: e.target.value }));

  const handleTypeDataMultiChange = (key, value) =>
    setTypeData((d) => {
      const prev = Array.isArray(d[key]) ? d[key] : [];
      const next = prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value];
      return { ...d, [key]: next };
    });

  // ─── File handlers ────────────────────────────────────────────────

  const validateAndSetFile = (file) => {
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File troppo grande (${formatFileSize(file.size)}). Massimo consentito: 50 MB.`);
      return;
    }
    if (!isFileAccepted(file)) {
      setFileError(`Formato non supportato. Tipi accettati: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG, GIF, WEBP, TIFF.`);
      return;
    }
    setSelectedFile(file);
  };

  const handleFileBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) validateAndSetFile(f);
    e.target.value = "";
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) validateAndSetFile(f);
  };

  // ─── Folder handler ───────────────────────────────────────────────

  const handleFolderChange = (e) => {
    const val = e.target.value;
    setSelectedFolderId(val ? parseInt(val) : null);
    setUserOverrodeFolder(true);
  };

  // ─── Navigation ───────────────────────────────────────────────────

  const step1Valid = form.title.trim().length > 0;

  const handleNext = () => {
    if (!step1Valid) { setError("Il titolo è obbligatorio."); return; }
    setError(null);
    setStep(2);
  };

  const handleBack = () => { setError(null); setStep(1); };

  const handleCloseAttempt = () => {
    if (uploading) {
      setConfirmClose(true);
      return;
    }
    onClose();
  };

  const handleForceClose = () => {
    setConfirmClose(false);
    onClose();
  };

  // ─── Salvataggio (creazione + upload) ─────────────────────────────

  const handleSave = async () => {
    if (!form.title.trim()) { setError("Il titolo è obbligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      const schema = getSchemaForDocType(form.doc_type);
      const payload = {
        ...form,
        retention_years: form.retention_years ? parseInt(form.retention_years) : null,
        standard_id:     form.standard_id     ? parseInt(form.standard_id)     : null,
        company_id:      form.company_id      ? parseInt(form.company_id)      : null,
        issue_date:      form.issue_date      || null,
        expiry_date:     form.expiry_date     || null,
        doc_code:        form.doc_code.trim() || null,
        revision:        form.revision.trim() || null,
        responsible:     form.responsible.trim() || null,
        clause_ref:      form.clause_ref.trim() || null,
        notes:           form.notes.trim()    || null,
        type_specific_data: schema ? typeData : null,
        parent_id:       (!isEdit && selectedFolderId) ? selectedFolderId : undefined,
      };

      let newDocId;
      if (isEdit) {
        await apiService.updateDocument(doc.id, payload);
        newDocId = doc.id;
      } else {
        const res = await apiService.createDocument(payload);
        newDocId = res?.data?.id || res?.id;
      }

      // Upload file se presente (solo creazione nuovo)
      if (selectedFile && newDocId && !isEdit) {
        setUploading(true);
        setUploadProgress(10);
        try {
          const progressInterval = setInterval(() => {
            setUploadProgress((p) => Math.min(p + 8, 90));
          }, 300);

          await apiService.uploadDocFile(newDocId, selectedFile, '1');
          clearInterval(progressInterval);
          setUploadProgress(100);
        } catch (uploadErr) {
          setUploading(false);
          setUploadProgress(0);
          setError(
            `Documento creato con successo, ma il file non è stato allegato: ${uploadErr.message || 'errore di rete'}. ` +
            `Puoi allegare il file dall'elenco documenti.`
          );
          setSaving(false);
          setTimeout(() => onSave(), 3000);
          return;
        } finally {
          setUploading(false);
        }
      }

      onSave();
    } catch (err) {
      setError(err.message || "Errore durante il salvataggio.");
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ─── Sezioni form ──────────────────────────────────────────────────────────

  const renderTypeField = (fieldDef) => {
    const { key, label, type, required, options, hint } = fieldDef;
    const value = typeData[key] ?? "";

    if (type === "select") {
      return (
        <div key={key} className="docform-field">
          <label>{label}{required && <span className="required"> *</span>}</label>
          <select value={value} onChange={handleTypeDataChange(key)}>
            <option value="">— Seleziona —</option>
            {(options || []).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {hint && <span className="docform-hint">{hint}</span>}
        </div>
      );
    }

    if (type === "multiselect") {
      const selected = Array.isArray(typeData[key]) ? typeData[key] : [];
      return (
        <div key={key} className="docform-field">
          <label>{label}</label>
          <div className="docform-multiselect">
            {(options || []).map((o) => (
              <label key={o.value} className="docform-multiselect-item">
                <input
                  type="checkbox"
                  checked={selected.includes(o.value)}
                  onChange={() => handleTypeDataMultiChange(key, o.value)}
                />
                {o.label}
              </label>
            ))}
          </div>
          {hint && <span className="docform-hint">{hint}</span>}
        </div>
      );
    }

    if (type === "textarea") {
      return (
        <div key={key} className="docform-field">
          <label>{label}</label>
          <textarea
            rows={3}
            value={value}
            onChange={handleTypeDataChange(key)}
            placeholder={hint || ""}
          />
        </div>
      );
    }

    return (
      <div key={key} className="docform-field">
        <label>{label}{required && <span className="required"> *</span>}</label>
        <input
          type={type === "date" ? "date" : type === "number" ? "number" : "text"}
          value={value}
          onChange={handleTypeDataChange(key)}
          placeholder={hint || ""}
          step={type === "number" ? "0.1" : undefined}
          min={type === "number" ? "0" : undefined}
        />
        {hint && type !== "date" && type !== "number" && (
          <span className="docform-hint">{hint}</span>
        )}
      </div>
    );
  };

  const renderTypeSpecificSection = () => {
    const schema = getSchemaForDocType(form.doc_type);
    if (!schema) return null;
    return (
      <div className="docform-type-section">
        <button
          type="button"
          className="docform-type-section-toggle"
          onClick={() => setTypeDetailsOpen((o) => !o)}
          aria-expanded={typeDetailsOpen}
        >
          <span className="docform-type-section-icon">{typeDetailsOpen ? "▾" : "▸"}</span>
          Dettagli qualifica — {schema.label}
        </button>
        {typeDetailsOpen && (
          <div className="docform-type-section-body">
            {schema.fields.map(renderTypeField)}
          </div>
        )}
      </div>
    );
  };

  // ─── Upload zone (Step 1) ─────────────────────────────────────────

  const renderFileUploadZone = () => (
    <div className="docform-field">
      <label>File allegato <span className="docform-hint-inline">(opzionale)</span></label>

      {!selectedFile ? (
        <>
          <div
            className={`docform-dropzone ${dragOver ? 'docform-dropzone-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleFileBrowse}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleFileBrowse(); }}
          >
            <span className="docform-dropzone-icon">{'\u{1F4C2}'}</span>
            <span className="docform-dropzone-text">
              Trascina qui il file o <strong>clicca per selezionare</strong>
            </span>
            <span className="docform-dropzone-hint">
              PDF, DOCX, XLSX, immagini — max 50 MB
            </span>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInputChange}
            accept={ACCEPT_STRING}
            style={{ display: 'none' }}
          />
          {selectedFile === null && !form.doc_type && (
            <span className="docform-file-suggestion">
              Suggerimento: seleziona il tipo documento per ottenere metadati automatici
            </span>
          )}
        </>
      ) : (
        <div className="docform-file-preview">
          <span
            className="docform-file-preview-icon"
            style={{ color: getFileTypeColor(selectedFile.name) }}
          >
            {getFileTypeIcon(selectedFile.name)}
          </span>
          <div className="docform-file-preview-info">
            <span className="docform-file-preview-name">{selectedFile.name}</span>
            <span className="docform-file-preview-size">{formatFileSize(selectedFile.size)}</span>
          </div>
          <button
            type="button"
            className="docform-file-remove"
            onClick={handleRemoveFile}
            aria-label="Rimuovi file"
            title="Rimuovi file"
          >
            ✕
          </button>
        </div>
      )}

      {fileError && (
        <div className="docform-file-error">{fileError}</div>
      )}
    </div>
  );

  // ─── Folder picker (Step 2) ───────────────────────────────────────

  const renderFolderPicker = () => {
    if (isEdit) return null;
    return (
      <div className="docform-archive-section">
        <div className="docform-archive-header">
          <span className="docform-archive-icon">{'\u{1F4C1}'}</span>
          <span className="docform-archive-title">Archiviazione</span>
        </div>
        <div className="docform-field">
          <label>
            Cartella di destinazione
            {suggestedFolderId && selectedFolderId === suggestedFolderId && folderSuggestionConfidence === 'high' && (
              <span className="docform-badge-suggested">Suggerito</span>
            )}
          </label>
          {foldersLoading ? (
            <div className="docform-folder-loading">Caricamento cartelle...</div>
          ) : folders.length === 0 ? (
            <div className="docform-folder-empty">Nessuna cartella disponibile</div>
          ) : (
            <select
              value={selectedFolderId || ''}
              onChange={handleFolderChange}
              className="docform-folder-select"
            >
              <option value="">— Nessuna (root) —</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.doc_code ? `${f.doc_code} - ` : ''}{f.title}
                  {f.id === suggestedFolderId ? ' ★' : ''}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    );
  };

  // ─── Step 1 render ────────────────────────────────────────────────

  const renderStep1 = () => (
    <div className="docform-step-content">
      <div className="docform-field">
        <label>Tipo documento <span className="required">*</span></label>
        <div className="doc-type-grid">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`doc-type-chip ${form.doc_type === t.value ? "doc-type-chip-active" : ""}`}
              onClick={() => setForm((f) => ({ ...f, doc_type: t.value }))}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="docform-field">
        <label>Titolo <span className="required">*</span></label>
        <input
          type="text"
          placeholder="es. Procedura Controllo Qualità Saldature"
          value={form.title}
          onChange={handleChange("title")}
          autoFocus={!isEdit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
        />
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Codice documento</label>
          <input
            type="text"
            placeholder="es. PG-01, WPS-141-001"
            value={form.doc_code}
            onChange={handleChange("doc_code")}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
          />
        </div>
        {companies.length > 0 && (
          <div className="docform-field">
            <label>Azienda</label>
            <select value={form.company_id} onChange={handleChange("company_id")}>
              <option value="">- Documento di studio -</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Zona upload file */}
      {renderFileUploadZone()}
    </div>
  );

  // ─── Step 2 / Edit render ─────────────────────────────────────────

  const renderStep2orEdit = () => (
    <div className="docform-step-content">
      {isEdit && (
        <>
          <div className="docform-field">
            <label>Tipo documento</label>
            <select value={form.doc_type} onChange={handleChange("doc_type")}>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="docform-field">
            <label>Titolo <span className="required">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={handleChange("title")}
              autoFocus
            />
          </div>
          <div className="docform-row">
            <div className="docform-field">
              <label>Codice documento</label>
              <input type="text" value={form.doc_code} onChange={handleChange("doc_code")} />
            </div>
            {companies.length > 0 && (
              <div className="docform-field">
                <label>Azienda</label>
                <select value={form.company_id} onChange={handleChange("company_id")}>
                  <option value="">- Documento di studio -</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <hr className="docform-divider" />
        </>
      )}

      {/* Sezione archiviazione (solo nuovo) */}
      {renderFolderPicker()}

      <div className="docform-row">
        <div className="docform-field docform-field-sm">
          <label>Revisione</label>
          <input
            type="text"
            placeholder="es. Rev.2"
            value={form.revision}
            onChange={handleChange("revision")}
          />
        </div>
        <div className="docform-field">
          <label>Stato</label>
          <select value={form.status} onChange={handleChange("status")}>
            {DOC_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Data emissione</label>
          <input type="date" value={form.issue_date} onChange={handleChange("issue_date")} />
        </div>
        <div className="docform-field">
          <label>Data scadenza</label>
          <input type="date" value={form.expiry_date} onChange={handleChange("expiry_date")} />
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Responsabile</label>
          <input
            type="text"
            placeholder="Nome / funzione"
            value={form.responsible}
            onChange={handleChange("responsible")}
          />
        </div>
        <div className="docform-field docform-field-xs">
          <label>Conservazione (anni)</label>
          <input
            type="number"
            min="1"
            max="99"
            placeholder="10"
            value={form.retention_years}
            onChange={handleChange("retention_years")}
          />
        </div>
      </div>

      <div className="docform-row">
        <div className="docform-field">
          <label>Norma di riferimento</label>
          <select value={form.standard_id} onChange={handleChange("standard_id")}>
            <option value="">- Nessuna -</option>
            {standards.map((s) => (
              <option key={s.standard_id} value={s.standard_id}>
                {s.standard_code} - {s.standard_name}
              </option>
            ))}
          </select>
        </div>
        <div className="docform-field docform-field-sm">
          <label>Paragrafo</label>
          <input
            type="text"
            placeholder="es. 7.5"
            value={form.clause_ref}
            onChange={handleChange("clause_ref")}
            disabled={!form.standard_id}
          />
        </div>
      </div>

      <div className="docform-field">
        <label>Note</label>
        <textarea
          rows={3}
          placeholder="Note aggiuntive..."
          value={form.notes}
          onChange={handleChange("notes")}
        />
      </div>

      {renderTypeSpecificSection()}
    </div>
  );

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="docform-overlay" onClick={(e) => {
      if (e.target !== e.currentTarget) return;
      if (Date.now() - openTimeRef.current < 350) return;
      handleCloseAttempt();
    }}>
      <div className="docform-modal">

        {/* Header */}
        <div className="docform-header">
          <h3>{isEdit ? `Modifica - ${doc.title}` : "Nuovo documento"}</h3>
          <button className="docform-close" type="button" onClick={handleCloseAttempt} aria-label="Chiudi">✕</button>
        </div>

        {/* Indicatore wizard (solo nuovo) */}
        {!isEdit && <StepIndicator step={step} />}

        {/* Corpo */}
        <div className="docform-body">
          {!isEdit
            ? (step === 1 ? renderStep1() : renderStep2orEdit())
            : renderStep2orEdit()
          }

          {/* Progress upload */}
          {uploading && (
            <div className="docform-upload-progress">
              <div className="docform-upload-progress-bar">
                <div
                  className="docform-upload-progress-fill"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <span className="docform-upload-progress-text">
                Caricamento file... {uploadProgress}%
              </span>
            </div>
          )}

          {/* Errore */}
          {error && <div className="docform-error">{error}</div>}
        </div>

        {/* Conferma chiusura durante upload */}
        {confirmClose && (
          <div className="docform-confirm-overlay">
            <div className="docform-confirm-box">
              <p>Upload in corso. Sei sicuro di voler chiudere?</p>
              <div className="docform-confirm-actions">
                <button type="button" className="btn-cancel" onClick={() => setConfirmClose(false)}>Annulla</button>
                <button type="button" className="btn-save" onClick={handleForceClose}>Chiudi comunque</button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="docform-footer">
          {!isEdit && step === 1 && (
            <>
              <button type="button" className="btn-cancel" onClick={handleCloseAttempt}>Annulla</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleNext}
                disabled={!step1Valid}
              >
                Avanti →
              </button>
            </>
          )}
          {!isEdit && step === 2 && (
            <>
              <button type="button" className="btn-cancel" onClick={handleBack}>← Indietro</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSave}
                disabled={saving || uploading}
              >
                {saving ? (uploading ? "Caricamento file..." : "Salvataggio...") : "Crea documento"}
              </button>
            </>
          )}
          {isEdit && (
            <>
              <button type="button" className="btn-cancel" onClick={handleCloseAttempt} disabled={saving}>Annulla</button>
              <button
                type="button"
                className="btn-save"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}

export default DocumentForm;
