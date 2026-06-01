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

const HARD_LIMIT = 200 * 1024 * 1024; // 200 MB — backend rejects above this
const WARN_SIZE  =  50 * 1024 * 1024; // 50 MB — soft warning
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
  const dot = file.name.lastIndexOf('.');
  if (dot === -1) return false;
  const ext = file.name.slice(dot).toLowerCase();
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

function DocumentForm({ doc, companies, standards, onSave, onClose, defaultFolderId, defaultCompanyId }) {
  const isEdit = !!doc;

  const [step, setStep] = useState(1);
  const openTimeRef = useRef(Date.now());

  const [form, setForm] = useState({
    doc_type:        doc?.doc_type        || 'procedura',
    doc_code:        doc?.doc_code        || '',
    title:           doc?.title           || '',
    revision:        doc?.revision        || '',
    status:          doc?.status          || 'vigente',
    issue_date:      toDateInput(doc?.issue_date),
    expiry_date:     toDateInput(doc?.expiry_date),
    responsible:     doc?.responsible     || '',
    retention_years: doc?.retention_years || '',
    standard_id:     doc?.standard_id     || '',
    clause_ref:      doc?.clause_ref      || '',
    company_id:      doc?.company_id      || defaultCompanyId || '',
    notes:           doc?.notes           || '',
  });

  // Tipi "documento esterno": norme tecniche — nascondono azienda/codice, mostrano standard_code
  const isNormaType = form.doc_type === 'norma';

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
  const [fileSizeWarning, setFileSizeWarning] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  // ─── AI pre-estrazione ────────────────────────────────────────────
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiExtracted, setAiExtracted] = useState(false);  // banner "dati pre-compilati"
  const [aiExtractError, setAiExtractError] = useState(null);
  const [aiFilledFields, setAiFilledFields] = useState(new Set()); // campi pre-compilati da AI
  const aiAbortRef = useRef(null); // per annullare estrazione precedente se docType cambia

  // ─── Folder selection state ───────────────────────────────────────
  const [folders, setFolders] = useState([]);
  const [foldersLoading, setFoldersLoading] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState(defaultFolderId || null);
  const [suggestedFolderId, setSuggestedFolderId] = useState(null);
  const [folderSuggestionConfidence, setFolderSuggestionConfidence] = useState(null);
  const [userOverrodeFolder, setUserOverrodeFolder] = useState(!!defaultFolderId);

  // ─── Norm status lookup ───────────────────────────────────────────
  // { loading: bool, result: { status, supersededBy, catalogUrl, checkedAt } | null }
  const [normStatus, setNormStatus] = useState({ loading: false, result: null });
  const normLookupTimerRef = useRef(null);

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

  // Verifica automatica stato norma nel catalogo dell'ente (debounce 1.5 s)
  useEffect(() => {
    if (!isNormaType) {
      setNormStatus({ loading: false, result: null });
      return;
    }
    const code = (typeData.standard_code || '').trim();
    if (!code) {
      setNormStatus({ loading: false, result: null });
      return;
    }

    clearTimeout(normLookupTimerRef.current);
    setNormStatus({ loading: true, result: null });

    normLookupTimerRef.current = setTimeout(async () => {
      try {
        const result = await apiService.lookupNormStatus(
          code,
          typeData.issuing_body || '',
          isEdit ? doc?.id : undefined
        );
        setNormStatus({ loading: false, result });
      } catch {
        setNormStatus({ loading: false, result: { status: 'unknown', supersededBy: null, catalogUrl: null } });
      }
    }, 1500);

    return () => clearTimeout(normLookupTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeData.standard_code, typeData.issuing_body, isNormaType]);

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

  // ─── AI pre-estrazione metadati ───────────────────────────────────
  const runAiExtraction = useCallback(async (file, docType) => {
    if (!file || !docType) return;
    // Solo PDF supportati
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf') return;

    // Annulla eventuale estrazione precedente (flag di abort)
    const abortFlag = { cancelled: false };
    aiAbortRef.current = abortFlag;

    setAiExtracting(true);
    setAiExtracted(false);
    setAiExtractError(null);
    setAiFilledFields(new Set());

    try {
      const result = await apiService.preExtractDocumentMetadata(file, docType);
      if (abortFlag.cancelled) return;

      const meta = result?.metadata || {};
      const filledKeys = new Set();

      // Pre-compila il titolo se non già inserito dall'utente
      if (meta.titolo) {
        setForm((f) => {
          if (!f.title.trim()) {
            filledKeys.add('title');
            return { ...f, title: meta.titolo };
          }
          return f;
        });
        filledKeys.add('title');
      }

      // Pre-compila i campi tipo-specifici (tutti i campi extra tranne quelli generici)
      const genericKeys = new Set(['titolo', 'sommario', 'warnings']);
      const typeSpecificEntries = Object.entries(meta).filter(
        ([k, v]) => !genericKeys.has(k) && v !== null && v !== undefined && v !== ''
      );
      if (typeSpecificEntries.length > 0) {
        setTypeData((prev) => {
          const next = { ...prev };
          for (const [k, v] of typeSpecificEntries) {
            if (!prev[k] || prev[k] === '') {
              next[k] = v;
              filledKeys.add(`type_${k}`);
            }
          }
          return next;
        });
      }

      setAiFilledFields(filledKeys);
      if (filledKeys.size > 0) {
        setAiExtracted(true);
      }
    } catch (err) {
      if (abortFlag.cancelled) return;
      const code = err.status;
      // 422 = PDF scansionato/non testuale, 503 = AI non configurata → messaggi discreti
      if (code === 422 || code === 503 || code === 502) {
        setAiExtractError('Estrazione automatica non disponibile — compila manualmente');
      } else {
        setAiExtractError('Estrazione automatica non disponibile — compila manualmente');
      }
    } finally {
      if (!abortFlag.cancelled) setAiExtracting(false);
    }
  }, []);

  // Ri-avvia estrazione se cambia il tipo documento (con file già presente)
  useEffect(() => {
    if (isEdit || !selectedFile) return;
    if (form.doc_type) {
      // Annulla estrazione in corso
      if (aiAbortRef.current) aiAbortRef.current.cancelled = true;
      runAiExtraction(selectedFile, form.doc_type);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.doc_type]);

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
    setFileSizeWarning(null);
    if (!file) return;
    if (file.size > HARD_LIMIT) {
      setFileError(`Il file supera il limite massimo di 200 MB (${formatFileSize(file.size)}).`);
      return;
    }
    if (!isFileAccepted(file)) {
      setFileError(`Formato non supportato. Tipi accettati: PDF, DOCX, DOC, XLSX, XLS, PNG, JPG, GIF, WEBP, TIFF.`);
      return;
    }
    if (file.size > WARN_SIZE) {
      setFileSizeWarning(`File di grandi dimensioni (${formatFileSize(file.size)}) \u2014 l\u2019upload potrebbe richiedere alcuni minuti`);
    }
    setSelectedFile(file);
    // Avvia estrazione AI se tipo documento già selezionato
    if (form.doc_type) {
      if (aiAbortRef.current) aiAbortRef.current.cancelled = true;
      setAiExtracted(false);
      setAiExtractError(null);
      runAiExtraction(file, form.doc_type);
    }
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
    setFileSizeWarning(null);
    if (aiAbortRef.current) aiAbortRef.current.cancelled = true;
    setAiExtracting(false);
    setAiExtracted(false);
    setAiExtractError(null);
    setAiFilledFields(new Set());
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
        type_specific_data: schema
          ? (isNormaType && normStatus.result && normStatus.result.status !== 'unknown'
              ? {
                  ...typeData,
                  validity_status:   normStatus.result.status === 'active' ? 'vigente' : 'superata',
                  last_validity_check: normStatus.result.checkedAt || new Date().toISOString(),
                  validity_check_url:  normStatus.result.catalogUrl   || typeData.validity_check_url || null,
                  superseded_by:       normStatus.result.supersededBy || typeData.superseded_by     || null,
                }
              : typeData)
          : null,
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
    const isAiPrefilled = aiFilledFields.has(`type_${key}`);

    if (type === "select") {
      return (
        <div key={key} className="docform-field">
          <label>{label}{required && <span className="required"> *</span>}</label>
          <select
            value={value}
            onChange={(e) => { handleTypeDataChange(key)(e); setAiFilledFields((p) => { const n = new Set(p); n.delete(`type_${key}`); return n; }); }}
            className={isAiPrefilled ? 'docform-input-ai-prefilled' : ''}
          >
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
            onChange={(e) => { handleTypeDataChange(key)(e); setAiFilledFields((p) => { const n = new Set(p); n.delete(`type_${key}`); return n; }); }}
            placeholder={hint || ""}
            className={isAiPrefilled ? 'docform-input-ai-prefilled' : ''}
          />
        </div>
      );
    }

    if (type === "boolean") {
      const checked = typeData[key] === true || typeData[key] === 'true';
      return (
        <div key={key} className="docform-field">
          <label
            className="docform-multiselect-item"
            style={{ textTransform: 'none', letterSpacing: 'normal', fontSize: '0.88rem', fontWeight: 500 }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => {
                setTypeData((d) => ({ ...d, [key]: e.target.checked }));
                setAiFilledFields((p) => { const n = new Set(p); n.delete(`type_${key}`); return n; });
              }}
              style={{ width: 15, height: 15, cursor: 'pointer' }}
            />
            {label}
            {isAiPrefilled && <span style={{ marginLeft: 6, fontSize: '0.72rem', color: '#2563eb', fontWeight: 600 }}>(AI)</span>}
          </label>
          {hint && <span className="docform-hint">{hint}</span>}
        </div>
      );
    }

    return (
      <div key={key} className="docform-field">
        <label>{label}{required && <span className="required"> *</span>}</label>
        <input
          type={type === "date" ? "date" : type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => { handleTypeDataChange(key)(e); setAiFilledFields((p) => { const n = new Set(p); n.delete(`type_${key}`); return n; }); }}
          placeholder={hint || ""}
          step={type === "number" ? "0.1" : undefined}
          min={type === "number" ? "0" : undefined}
          className={isAiPrefilled ? 'docform-input-ai-prefilled' : ''}
        />
        {hint && type !== "date" && type !== "number" && (
          <span className="docform-hint">{hint}</span>
        )}
      </div>
    );
  };

  // Badge stato norma (vigente / ritirata / sostituita) da catalogo pubblico
  const renderNormStatusBadge = () => {
    if (!isNormaType) return null;
    const code = (typeData.standard_code || '').trim();
    if (!code) return null;

    const { loading, result } = normStatus;

    if (loading) {
      return (
        <div className="norm-status-row">
          <span className="norm-status-badge norm-status-loading">&#9203; Verifica in corso...</span>
        </div>
      );
    }

    if (!result || result.status === 'unknown') {
      if (result) {
        return (
          <div className="norm-status-row">
            <span className="norm-status-badge norm-status-unknown">Stato non disponibile</span>
            {result.catalogUrl && (
              <a href={result.catalogUrl} target="_blank" rel="noopener noreferrer" className="norm-catalog-link">
                Vedi catalogo &#8594;
              </a>
            )}
          </div>
        );
      }
      return null;
    }

    let badgeClass, icon, text;
    if (result.status === 'active') {
      badgeClass = 'norm-status-active';
      icon = '\uD83D\uDFE2';
      text = 'In vigore';
    } else if (result.status === 'withdrawn') {
      badgeClass = 'norm-status-withdrawn';
      icon = '\uD83D\uDD34';
      text = 'Ritirata';
    } else {
      badgeClass = 'norm-status-superseded';
      icon = '\uD83D\uDFE1';
      text = result.supersededBy ? `Sostituita da ${result.supersededBy}` : 'Sostituita';
    }

    return (
      <div className="norm-status-row">
        <span className={`norm-status-badge ${badgeClass}`}>{icon} {text}</span>
        {result.catalogUrl && (
          <a href={result.catalogUrl} target="_blank" rel="noopener noreferrer" className="norm-catalog-link">
            Vedi catalogo &#8594;
          </a>
        )}
      </div>
    );
  };

  // Link verifica catalogo per norme tecniche — richiede standard_code compilato
  const renderNormaVerifyLinks = () => {
    const code = typeData.standard_code || '';
    if (!isNormaType || !code) return null;
    const issuer = (typeData.issuing_body || '').toUpperCase();
    const enc = encodeURIComponent(code);
    const links = [];
    if (issuer.includes('BSI') || issuer.includes('BS ')) {
      links.push({ label: '\uD83D\uDD17 Verifica su BSI Group', href: `https://shop.bsigroup.com/search?q=${enc}` });
    }
    if (issuer.includes('ISO') || (!issuer || issuer.includes('EN ISO') || issuer.includes('CEN'))) {
      links.push({ label: '\uD83D\uDD17 Verifica su ISO.org', href: `https://www.iso.org/search.html?q=${enc}` });
    }
    if (issuer.includes('UNI')) {
      links.push({ label: '\uD83D\uDD17 Verifica su UNI', href: `https://www.uni.com/index.php?option=com_content&view=article&id=1408` });
    }
    if (links.length === 0) {
      links.push({ label: '\uD83D\uDD17 Verifica su ISO.org', href: `https://www.iso.org/search.html?q=${enc}` });
    }
    return (
      <div className="docform-norma-links">
        {links.map((l, i) => (
          <span key={l.label}>
            {i > 0 && ' — '}
            <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a>
          </span>
        ))}
      </div>
    );
  };

  // Campi norma renderizzati inline in step 2 — da escludere dalla sezione collassabile
  const NORMA_INLINE_KEYS = new Set(['issuing_body', 'edition_year', 'scope_summary', 'ics_code', 'is_harmonized']);

  const renderTypeSpecificSection = () => {
    const schema = getSchemaForDocType(form.doc_type);
    if (!schema) return null;

    // Per norma: standard_code è in step 1; i campi primari sono inline in step 2
    const fieldsToRender = isNormaType
      ? schema.fields.filter((f) => f.key !== 'standard_code' && !NORMA_INLINE_KEYS.has(f.key))
      : schema.fields;

    if (fieldsToRender.length === 0) return null;

    const sectionTitle = isNormaType
      ? `Dettagli — ${schema.label}`
      : `Dettagli qualifica — ${schema.label}`;

    return (
      <div className="docform-type-section">
        <button
          type="button"
          className="docform-type-section-toggle"
          onClick={() => setTypeDetailsOpen((o) => !o)}
          aria-expanded={typeDetailsOpen}
        >
          <span className="docform-type-section-icon">{typeDetailsOpen ? "▾" : "▸"}</span>
          {sectionTitle}
        </button>
        {typeDetailsOpen && (
          <div className="docform-type-section-body">
            {/* Banner AI in step 2 (dettagli tipo-specifici) */}
            {aiExtracted && !aiExtracting && (
              <div className="docform-ai-banner docform-ai-banner-compact">
                <span className="docform-ai-banner-icon">&#10003;</span>
                Metadati estratti automaticamente — verifica e correggi se necessario
              </div>
            )}
            {fieldsToRender.map(renderTypeField)}
          </div>
        )}
      </div>
    );
  };

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
              PDF, DOCX, XLSX, immagini — max 200 MB
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
        <div className={`docform-file-preview${aiExtracting ? ' docform-file-preview-analyzing' : ''}`}>
          <span
            className="docform-file-preview-icon"
            style={{ color: getFileTypeColor(selectedFile.name) }}
          >
            {getFileTypeIcon(selectedFile.name)}
          </span>
          <div className="docform-file-preview-info">
            <span className="docform-file-preview-name">{selectedFile.name}</span>
            <span className="docform-file-preview-size">{formatFileSize(selectedFile.size)}</span>
            {aiExtracting && (
              <span className="docform-ai-analyzing">
                <span className="docform-ai-spinner" aria-hidden="true" /> Analisi AI in corso...
              </span>
            )}
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

      {fileSizeWarning && !fileError && (
        <div className="docform-file-size-warning">{fileSizeWarning}</div>
      )}

      {/* Messaggio errore AI (discreto, non bloccante) */}
      {!aiExtracting && aiExtractError && (
        <div className="docform-ai-error">{aiExtractError}</div>
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
          onChange={(e) => {
            handleChange("title")(e);
            // Se l'utente modifica manualmente, rimuovi il bordo AI dal titolo
            setAiFilledFields((prev) => { const next = new Set(prev); next.delete('title'); return next; });
          }}
          className={aiFilledFields.has('title') ? 'docform-input-ai-prefilled' : ''}
          autoFocus={!isEdit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
        />
      </div>

      {/* Codice documento + Azienda — nascosti per tipo norma */}
      {!isNormaType && (
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
      )}

      {/* Codice norma — solo per tipo norma */}
      {isNormaType && (
        <div className="docform-field">
          <label>Codice norma <span className="required">*</span></label>
          <input
            type="text"
            placeholder="es. BS EN ISO 9606-1:2017"
            value={typeData.standard_code || ''}
            onChange={(e) => {
              handleTypeDataChange('standard_code')(e);
              setAiFilledFields((prev) => { const next = new Set(prev); next.delete('type_standard_code'); return next; });
            }}
            className={aiFilledFields.has('type_standard_code') ? 'docform-input-ai-prefilled' : ''}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNext(); } }}
          />
          {renderNormStatusBadge()}
          {renderNormaVerifyLinks()}
        </div>
      )}

      {/* Zona upload file */}
      {renderFileUploadZone()}

      {/* Banner AI estrazione completata */}
      {aiExtracted && !aiExtracting && (
        <div className="docform-ai-banner">
          <span className="docform-ai-banner-icon">&#10003;</span>
          Metadati estratti automaticamente dal file — verifica e correggi se necessario
        </div>
      )}
    </div>
  );

  // ─── Step 2 / Edit render ─────────────────────────────────────────

  const renderStep2orEdit = () => {
    // Helper per recuperare campo tipo-specifico norma da rendere inline
    const normaSchema = isNormaType ? getSchemaForDocType('norma') : null;
    const normaField = (key) => normaSchema?.fields.find((f) => f.key === key);

    return (
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
            {/* Codice norma (solo modifica norma) */}
            {isNormaType && (
              <div className="docform-field">
                <label>Codice norma</label>
                <input
                  type="text"
                  placeholder="es. BS EN ISO 9606-1:2017"
                  value={typeData.standard_code || ''}
                  onChange={(e) => handleTypeDataChange('standard_code')(e)}
                />
                {renderNormStatusBadge()}
                {renderNormaVerifyLinks()}
              </div>
            )}
            {/* Codice documento + Azienda — nascosti per tipo norma */}
            {!isNormaType && (
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
            )}
            <hr className="docform-divider" />
          </>
        )}

        {/* Sezione archiviazione (solo nuovo) */}
        {renderFolderPicker()}

        {/* Ente emittente + Anno edizione — solo norma, in cima ai dettagli, pre-compilati AI */}
        {isNormaType && normaSchema && (
          <div className="docform-row">
            {renderTypeField(normaField('issuing_body'))}
            {renderTypeField(normaField('edition_year'))}
          </div>
        )}

        {/* Revisione + Stato — nascosti per norma (le norme hanno edizioni, non revisioni interne) */}
        {!isNormaType && (
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
        )}

        <div className="docform-row">
          <div className="docform-field">
            {/* Per norma rinominato in "Data pubblicazione" */}
            <label>{isNormaType ? 'Data pubblicazione' : 'Data emissione'}</label>
            <input type="date" value={form.issue_date} onChange={handleChange("issue_date")} />
          </div>
          {/* Data scadenza — nascosta per norma (le norme vengono sostituite, non scadono) */}
          {!isNormaType && (
            <div className="docform-field">
              <label>Data scadenza</label>
              <input type="date" value={form.expiry_date} onChange={handleChange("expiry_date")} />
            </div>
          )}
        </div>

        {/* Responsabile — nascosto per norma (responsabile è l'ente esterno, non una persona interna) */}
        {!isNormaType && (
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
        )}

        {/* Campo di applicazione + Codice ICS + Norma armonizzata + Conservazione — solo norma, inline */}
        {isNormaType && normaSchema && (
          <>
            {renderTypeField(normaField('scope_summary'))}
            <div className="docform-row">
              {renderTypeField(normaField('ics_code'))}
              {renderTypeField(normaField('is_harmonized'))}
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
          </>
        )}

        {/* Norma di riferimento + Paragrafo — nascosti per norma (questo documento IS una norma) */}
        {!isNormaType && (
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
        )}

        <div className="docform-field">
          <label>Note</label>
          <textarea
            rows={3}
            placeholder="Note aggiuntive..."
            value={form.notes}
            onChange={handleChange("notes")}
          />
        </div>

        {/* Sezione collassabile: per norma mostra solo campi secondari (norm_title, supersedes, validity_status, language, technical_committee) */}
        {renderTypeSpecificSection()}
      </div>
    );
  };

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
