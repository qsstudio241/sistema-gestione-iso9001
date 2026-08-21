/**
 * ImportJobsPage - Sprint 9: job import PDF batch + revisione testo
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService, { ApiError } from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { useNavigate } from "../contexts/RouterContext";
import { buildIncompleteQueuePath } from "../utils/documentRegistryUrl";
import { DOC_TYPE_OPTIONS } from "../data/documentTypes";
import { getSuggestedFolderLabel } from "../data/documentFolderMapping";
import { getSchemaForDocType } from "../data/documentTypeSchemas";
import {
  buildCommitFormFromFile,
  applyNormLookupToTypeData,
  buildNormCommitPayload,
  isNormDocType,
  buildInitialNormTypeData,
} from "../utils/importNormCommit";
import {
  MAX_IMPORT_JOB_FILES,
  COMPANY_REQUIRED_UPLOAD_TITLE,
  AMBITO_JOB_MISMATCH_TITLE,
  takeImportFiles,
  bindDirectoryPicker,
  isClientCompanyId,
  resolvePrefillCompanyId,
  scopeMatchesJobCompany,
} from "../utils/importFolderUpload";
import {
  buildFolderInventory,
  buildUploadLots,
  estimateLotsText,
  formatImportSize,
  lotDocumentTypeHint,
} from "../utils/importFolderPlan";
import StatusBadge from "../components/StatusBadge";
import "./ImportJobsPage.css";
import "../components/DocumentForm.css";

// Aggiunge l'opzione guida AI in cima alla lista tipi per il form di import
const DOC_TYPE_OPTIONS_IMPORT = [
  { value: "", label: "Tipo documento (opz., guida la AI)" },
  ...DOC_TYPE_OPTIONS,
];

/** Picker cartella: niente company dal job precedente mentre il dettaglio nuovo carica. */
const DETAIL_STALE_TITLE = "Attendi il dettaglio del job selezionato";

const QUALIFICATION_DOC_TYPES = new Set([
  "qualifica",
  "patentino_saldatore",
  "qualifica_14732",
  "qualifica_14731",
  "pes_pav",
  "cert_ndt",
]);

function isQualificationDocType(docType) {
  return QUALIFICATION_DOC_TYPES.has(String(docType || ""));
}

function parseAiJson(val) {
  if (val == null) return null;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return null;
  }
}

function buildRiesameTitle(job, file) {
  const ai = parseAiJson(file?.ai_extraction_json);
  if (ai?.title) return String(ai.title).trim();
  if (job?.title) return String(job.title).trim();
  if (file?.original_name) {
    const base = String(file.original_name).split(/[/\\]/).pop();
    return String(base || file.original_name).replace(/\.pdf$/i, "");
  }
  return "Riesame da import";
}

function textPreview(extractedText, maxLen = 400) {
  const t = String(extractedText || "").trim();
  if (!t) return "— Nessun testo estratto —";
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}

function mapImportErrorMessage(err) {
  if (!(err instanceof ApiError)) {
    return err?.message || "Operazione fallita";
  }
  if (err.code === "ALREADY_LINKED") {
    const caseId = err.data?.case_id;
    return caseId
      ? `Questo file è già collegato al caso Riesame #${caseId}.`
      : (err.message || "File già collegato a un caso Riesame.");
  }
  if (err.code === "NO_ELIGIBLE_FILES" || err.code === "INVALID_FILE_STATUS") {
    return "Il file deve essere in stato estratto o revisionato prima di creare il caso.";
  }
  if (err.code === "VALIDATION_ERROR") {
    return err.message || "Dati non validi. Controlla titolo e cliente.";
  }
  if (err.code === "COMPANY_REQUIRED_FOR_UPLOAD") {
    return err.message || COMPANY_REQUIRED_UPLOAD_TITLE;
  }
  return err.message || "Creazione caso Riesame fallita";
}

/**
 * Pannello visualizzazione estrazione AI.
 * Se il tipo documento ha uno schema, mostra prima i campi tipo-specifici
 * in formato leggibile, poi il JSON grezzo collassabile.
 */
function AiExtractionPanel({ file, jobDocTypeHint }) {
  const [rawOpen, setRawOpen] = useState(false);
  const ai = parseAiJson(file.ai_extraction_json);
  if (!ai) return null;

  const docType = ai.document_type_guess || jobDocTypeHint || "";
  const schema = getSchemaForDocType(docType);
  const typeData = ai.type_specific_data || {};

  // Etichetta leggibile per posizioni saldatura (array)
  const formatValue = (fieldDef, val) => {
    if (val == null || val === "") return "—";
    if (Array.isArray(val)) {
      if (val.length === 0) return "—";
      if (fieldDef?.options) {
        return val
          .map((v) => fieldDef.options.find((o) => o.value === v)?.label || v)
          .join(", ");
      }
      return val.join(", ");
    }
    if (fieldDef?.options) {
      return fieldDef.options.find((o) => o.value === String(val))?.label || String(val);
    }
    return String(val);
  };

  return (
    <div className="ai-extraction-panel">
      <div className="ai-extraction-head">
        Estrazione AI
        {file.ai_model && <span className="ai-model">{file.ai_model}</span>}
        {file.ai_extraction_at && (
          <span className="ai-at">
            {new Date(file.ai_extraction_at).toLocaleString("it-IT")}
          </span>
        )}
        {ai.extraction_confidence != null && (
          <span className="ai-conf">Attendibilità: {ai.extraction_confidence}%</span>
        )}
      </div>

      {/* Campi base generici */}
      <div className="ai-fields-grid">
        {ai.title && <div className="ai-field"><span className="ai-field-key">Titolo</span><span className="ai-field-val">{ai.title}</span></div>}
        {ai.summary && <div className="ai-field ai-field-full"><span className="ai-field-key">Sommario</span><span className="ai-field-val">{ai.summary}</span></div>}
        {ai.document_type_guess && <div className="ai-field"><span className="ai-field-key">Tipo rilevato</span><span className="ai-field-val">{ai.document_type_guess}</span></div>}
      </div>

      {/* Campi tipo-specifici (se schema disponibile) */}
      {schema && Object.keys(typeData).length > 0 && (
        <div className="ai-type-specific">
          <div className="ai-type-specific-title">{schema.label} — campi estratti</div>
          <div className="ai-fields-grid">
            {schema.fields.map((fieldDef) => {
              const val = typeData[fieldDef.key];
              if (val == null || val === "" || (Array.isArray(val) && val.length === 0)) return null;
              return (
                <div
                  key={fieldDef.key}
                  className={fieldDef.type === "textarea" ? "ai-field ai-field-full" : "ai-field"}
                >
                  <span className="ai-field-key">{fieldDef.label}</span>
                  <span className="ai-field-val">{formatValue(fieldDef, val)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Eventuali warnings */}
      {Array.isArray(ai.warnings) && ai.warnings.length > 0 && (
        <div className="ai-warnings">
          {ai.warnings.map((w, i) => <div key={i} className="ai-warning-item">⚠ {w}</div>)}
        </div>
      )}

      {/* JSON grezzo collassabile */}
      <button
        type="button"
        className="ai-raw-toggle"
        onClick={() => setRawOpen((o) => !o)}
      >
        {rawOpen ? "▾ Nascondi JSON grezzo" : "▸ Mostra JSON grezzo"}
      </button>
      {rawOpen && (
        <pre className="ai-json">{JSON.stringify(ai, null, 2)}</pre>
      )}
    </div>
  );
}

function CommitNormStatusBadge({ normLookup, standardCode }) {
  if (!standardCode?.trim()) return null;
  const { loading, result } = normLookup || {};

  if (loading) {
    return (
      <div className="norm-status-row">
        <span className="norm-status-badge norm-status-loading">Verifica catalogo in corso…</span>
      </div>
    );
  }

  if (!result || result.status === "unknown") {
    if (!result?.catalogUrl) return null;
    return (
      <div className="norm-status-row">
        <StatusBadge type="norm_catalog" status="unknown" size="small" />
        <a href={result.catalogUrl} target="_blank" rel="noopener noreferrer" className="norm-catalog-link">
          Vedi catalogo →
        </a>
      </div>
    );
  }

  const supersededLabel = result.supersededBy
    ? `Sostituita da ${result.supersededBy}`
    : undefined;

  return (
    <div className="norm-status-row">
      <StatusBadge type="norm_catalog" status={result.status} label={supersededLabel} size="small" />
      {result.catalogUrl && (
        <a href={result.catalogUrl} target="_blank" rel="noopener noreferrer" className="norm-catalog-link">
          Vedi catalogo →
        </a>
      )}
    </div>
  );
}

/**
 * Menu "Altre azioni" per le azioni secondarie di un file.
 * Raggruppa in un overflow apribile/chiudibile (chiusura a click fuori)
 * le azioni meno frequenti, lasciando in evidenza solo le azioni primarie.
 */
function FileActionsMenu({ actions }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="file-actions-menu" ref={menuRef}>
      <button
        type="button"
        className="btn-small file-actions-more"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Altre azioni {open ? "\u25B4" : "\u25BE"}
      </button>
      {open && (
        <div className="file-actions-dropdown" role="menu">
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              role="menuitem"
              className="file-actions-item"
              title={a.title}
              disabled={a.disabled}
              onClick={() => {
                setOpen(false);
                a.onClick();
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportFolderPlanPanel({
  plan,
  selectedKeys,
  upload,
  busy,
  onToggle,
  onConfirm,
  onCancelPlan,
  onStopLots,
  confirmAllowed = true,
  confirmGateTitle = "",
}) {
  const lots = buildUploadLots(plan, selectedKeys);
  const selectedCount = plan.folders.filter((f) => selectedKeys.has(f.key)).length;
  const canConfirm = selectedCount > 0 && !busy && !upload && confirmAllowed;
  const uploading = busy && !!upload && !upload.cancelled;

  return (
    <section className="import-folder-plan" aria-label="Piano di carico cartella">
      <h3 className="import-folder-plan-title">
        Piano di carico
        {plan.pickedRoot ? ` — ${plan.pickedRoot}` : ""}
      </h3>
      <div className="import-folder-plan-stats" role="group" aria-label="Riepilogo piano di carico">
        <span>
          <strong>{plan.files.length}</strong> file
        </span>
        <span>
          <strong>{formatImportSize(plan.totalBytes)}</strong>
        </span>
        {plan.skippedJunk > 0 && (
          <span className="import-folder-plan-muted">
            {plan.skippedJunk} file di sistema ignorati
          </span>
        )}
      </div>
      <p className="import-folder-plan-estimate">{estimateLotsText(lots.length)}</p>
      {upload && (
        <p className="import-jobs-warning" aria-live="polite">
          {upload.cancelled
            ? `Interrotto. ${upload.label || ""}`
            : upload.label}
        </p>
      )}
      <table className="import-folder-plan-table">
        <thead>
          <tr>
            <th scope="col">Carica</th>
            <th scope="col">Cartella</th>
            <th scope="col">File</th>
            <th scope="col">Size</th>
            <th scope="col">Indizio</th>
          </tr>
        </thead>
        <tbody>
          {plan.folders.map((folder) => (
            <tr key={folder.key}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedKeys.has(folder.key)}
                  onChange={() => onToggle(folder.key)}
                  disabled={uploading}
                  aria-label={`Includi ${folder.name}`}
                />
              </td>
              <td>{folder.name}</td>
              <td>{folder.fileCount}</td>
              <td>{formatImportSize(folder.totalBytes)}</td>
              <td>{folder.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="import-folder-plan-actions">
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={!canConfirm}
          title={
            !confirmAllowed
              ? confirmGateTitle
              : selectedCount === 0
                ? "Seleziona almeno una cartella"
                : uploading
                  ? "Caricamento in corso"
                  : "Carica i lotti delle cartelle spuntate, 80 file per job"
          }
        >
          Carica i lotti selezionati
        </button>
        {uploading ? (
          <button
            type="button"
            className="btn-secondary"
            onClick={onStopLots}
            title="Ferma i lotti successivi. Quelli già caricati restano."
          >
            Annulla
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancelPlan}
            disabled={busy}
            title="Chiude il piano. Nessun file viene caricato."
          >
            Annulla piano
          </button>
        )}
      </div>
    </section>
  );
}

export default function ImportJobsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { companyId: scopeCompanyId } = useCompanyScope();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const [jobs, setJobs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [folderNotice, setFolderNotice] = useState(null);
  const [newTitle, setNewTitle] = useState("");
  const [docTypeHint, setDocTypeHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [commitDialog, setCommitDialog] = useState(null); // { file, isNorm, form, normLookup }
  const [commitResult, setCommitResult] = useState(null); // { fileId, registryId }
  const [qualifCommitResult, setQualifCommitResult] = useState({}); // { [fileId]: { qualification_id, error } }
  const [riesameDialog, setRiesameDialog] = useState(null); // { file, form }
  const [companies, setCompanies] = useState([]);
  const [folderPlan, setFolderPlan] = useState(null);
  const [folderPlanSelected, setFolderPlanSelected] = useState(() => new Set());
  const [folderPlanCompanyId, setFolderPlanCompanyId] = useState(null);
  const [folderUpload, setFolderUpload] = useState(null);
  const folderUploadCancelRef = useRef(false);
  const folderUploadRef = useRef(null);
  const folderInputRef = useRef(null);
  const selectedIdRef = useRef(selectedId);
  folderUploadRef.current = folderUpload;
  selectedIdRef.current = selectedId;

  const bindFolderInput = useCallback((el) => {
    folderInputRef.current = el;
    bindDirectoryPicker(el);
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getImportJobs();
      setJobs(res.data || []);
    } catch (e) {
      setError(e.message || "Errore caricamento job");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (id) => {
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const res = await apiService.getImportJob(id);
      if (Number(selectedIdRef.current) !== Number(id)) return;
      setDetail(res.data || null);
    } catch (e) {
      if (Number(selectedIdRef.current) !== Number(id)) return;
      setError(e.message || "Errore dettaglio job");
    }
  }, []);

  const loadCompanies = useCallback(async () => {
    try {
      const params = user?.auditor_org_id ? { auditor_org_id: user.auditor_org_id } : {};
      const res = await apiService.getCompanies(params);
      const list = Array.isArray(res) ? res : res?.data || [];
      setCompanies(list);
    } catch {
      setCompanies([]);
    }
  }, [user?.auditor_org_id]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const jobParam = params.get('job');
    if (jobParam) {
      const id = parseInt(jobParam, 10);
      if (Number.isFinite(id) && id > 0) {
        setSelectedId(id);
      }
    }
  }, []);

  useEffect(() => {
    const upload = folderUploadRef.current;
    if (!(upload && !upload.cancelled)) {
      setDetail((prev) => (prev?.job?.id === selectedId ? prev : null));
    }
    loadDetail(selectedId);
  }, [selectedId, loadDetail]);

  // Piano orfano: al cambio job (lista / create / delete) il piano sparisce.
  // Durante i lotti il confirm aggiorna selectedId — non resettare (ref upload attivo).
  useEffect(() => {
    const upload = folderUploadRef.current;
    if (upload && !upload.cancelled) return;
    setFolderPlan(null);
    setFolderPlanSelected(new Set());
    setFolderPlanCompanyId(null);
    setFolderUpload(null);
  }, [selectedId]);

  // Piano orfano: al cambio Ambito il piano catturato non vale più (azienda A vs B / studio).
  // Durante i lotti non resettare — i job in volo restano sulla company del confirm.
  useEffect(() => {
    const upload = folderUploadRef.current;
    if (upload && !upload.cancelled) return;
    if (folderPlan == null && folderPlanCompanyId == null) return;
    if (scopeMatchesJobCompany(scopeCompanyId, folderPlanCompanyId)) return;
    setFolderPlan(null);
    setFolderPlanSelected(new Set());
    setFolderPlanCompanyId(null);
    setFolderUpload(null);
  }, [scopeCompanyId, folderPlan, folderPlanCompanyId]);

  // Dopo codice norma (AI o filename): norm-lookup → prefill vigore e link catalogo
  useEffect(() => {
    if (!commitDialog?.isNorm) return undefined;
    const code = (commitDialog.form?.typeData?.standard_code || "").trim();
    const issuingBody = commitDialog.form?.typeData?.issuing_body || "";
    if (!code) {
      setCommitDialog((d) => (d ? { ...d, normLookup: { loading: false, result: null } } : d));
      return undefined;
    }

    const timer = setTimeout(async () => {
      setCommitDialog((d) => (d ? { ...d, normLookup: { loading: true, result: null } } : d));
      const result = await apiService.lookupNormStatus(code, issuingBody);
      setCommitDialog((d) => {
        if (!d) return d;
        return {
          ...d,
          normLookup: { loading: false, result },
          form: {
            ...d.form,
            typeData: applyNormLookupToTypeData(d.form.typeData, result),
          },
        };
      });
    }, 1500);

    return () => clearTimeout(timer);
  }, [
    commitDialog?.isNorm,
    commitDialog?.form?.typeData?.standard_code,
    commitDialog?.form?.typeData?.issuing_body,
  ]);

  async function handleCreate() {
    const scopeId = resolvePrefillCompanyId(scopeCompanyId);
    if (!isClientCompanyId(scopeId)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiService.createImportJob({
        title: newTitle || undefined,
        document_type_hint: docTypeHint || undefined,
        company_id: parseInt(scopeId, 10),
      });
      const id = res.data?.id;
      setNewTitle("");
      setDocTypeHint("");
      await loadList();
      if (id) setSelectedId(id);
    } catch (e) {
      setError(e.message || "Creazione job fallita");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPickedFiles(fileList, inputEl) {
    if (!selectedId || !fileList?.length) return;
    if (!isClientCompanyId(scopeCompanyId)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      if (inputEl) inputEl.value = "";
      return;
    }
    if (!isClientCompanyId(detail?.job?.company_id)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      if (inputEl) inputEl.value = "";
      return;
    }
    if (!scopeMatchesJobCompany(scopeCompanyId, detail.job.company_id)) {
      setError(AMBITO_JOB_MISMATCH_TITLE);
      if (inputEl) inputEl.value = "";
      return;
    }
    const existingCount = (detail?.files || []).length;
    if (existingCount > 0) {
      const ok = window.confirm(
        `Il job ha già ${existingCount} file. Aggiungere altri file a questo job?`
      );
      if (!ok) {
        if (inputEl) inputEl.value = "";
        return;
      }
    }
    const { files, skippedJunk, truncated } = takeImportFiles(fileList);
    if (!files.length) {
      setError("Nessun file selezionato nella cartella.");
      if (inputEl) inputEl.value = "";
      return;
    }
    setBusy(true);
    setError(null);
    setFolderNotice(null);
    try {
      await apiService.uploadImportJobFiles(selectedId, files);
      if (inputEl) inputEl.value = "";
      const notes = [];
      if (truncated) {
        notes.push(`Caricati i primi ${MAX_IMPORT_JOB_FILES} file (limite per job).`);
      }
      if (skippedJunk) {
        notes.push(`${skippedJunk} file di sistema ignorati (Thumbs.db / .DS_Store).`);
      }
      setFolderNotice(notes.length ? notes.join(" ") : null);
      await loadList();
      await loadDetail(selectedId);
    } catch (err) {
      setError(err.message || "Upload fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleFiles(e) {
    await uploadPickedFiles(e.target.files, e.target);
  }

  function resetFolderInput() {
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function handleFolderPicked(e) {
    const fileList = e.target.files;
    if (!selectedId || !fileList?.length) {
      resetFolderInput();
      return;
    }
    if (folderUploadRef.current && !folderUploadRef.current.cancelled) {
      resetFolderInput();
      return;
    }
    const scopeId = resolvePrefillCompanyId(scopeCompanyId);
    if (Number(detail?.job?.id) !== Number(selectedId)) {
      setError(DETAIL_STALE_TITLE);
      setFolderPlan(null);
      setFolderPlanSelected(new Set());
      setFolderPlanCompanyId(null);
      resetFolderInput();
      return;
    }
    if (!isClientCompanyId(scopeId) || !isClientCompanyId(detail?.job?.company_id)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      setFolderPlan(null);
      setFolderPlanSelected(new Set());
      setFolderPlanCompanyId(null);
      resetFolderInput();
      return;
    }
    if (!scopeMatchesJobCompany(scopeId, detail.job.company_id)) {
      setError(AMBITO_JOB_MISMATCH_TITLE);
      setFolderPlan(null);
      setFolderPlanSelected(new Set());
      setFolderPlanCompanyId(null);
      resetFolderInput();
      return;
    }
    const inventory = buildFolderInventory(fileList);
    resetFolderInput();
    if (!inventory.files.length) {
      setError("Nessun file selezionato nella cartella.");
      setFolderPlan(null);
      setFolderPlanSelected(new Set());
      setFolderPlanCompanyId(null);
      return;
    }
    setError(null);
    setFolderNotice(null);
    setFolderUpload(null);
    folderUploadCancelRef.current = false;
    setFolderPlan(inventory);
    setFolderPlanCompanyId(parseInt(scopeId, 10));
    setFolderPlanSelected(new Set(inventory.folders.map((f) => f.key)));
  }

  function handleCancelFolderPlan() {
    folderUploadCancelRef.current = true;
    setFolderPlan(null);
    setFolderPlanSelected(new Set());
    setFolderPlanCompanyId(null);
    setFolderUpload(null);
    resetFolderInput();
  }

  function handleStopFolderLots() {
    folderUploadCancelRef.current = true;
  }

  function toggleFolderPlanKey(key) {
    setFolderPlanSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleConfirmFolderPlan() {
    if (!folderPlan) return;
    if (!isClientCompanyId(scopeCompanyId) || !isClientCompanyId(folderPlanCompanyId)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      return;
    }
    if (!scopeMatchesJobCompany(scopeCompanyId, folderPlanCompanyId)) {
      setError(AMBITO_JOB_MISMATCH_TITLE);
      return;
    }
    const lots = buildUploadLots(folderPlan, folderPlanSelected);
    if (!lots.length) {
      setError("Seleziona almeno una cartella.");
      return;
    }
    folderUploadCancelRef.current = false;
    setBusy(true);
    setError(null);
    setFolderNotice(null);
    const companyId = parseInt(folderPlanCompanyId, 10);
    let uploaded = 0;
    try {
      for (let i = 0; i < lots.length; i += 1) {
        if (folderUploadCancelRef.current) {
          setFolderUpload({
            current: uploaded,
            total: lots.length,
            label: lots[i].progressLabel,
            cancelled: true,
          });
          setFolderNotice(
            `Caricamento interrotto dopo ${uploaded} ${uploaded === 1 ? "lotto" : "lotti"}. I file già caricati restano.`
          );
          break;
        }
        const lot = lots[i];
        setFolderUpload({
          current: i + 1,
          total: lots.length,
          label: lot.progressLabel,
          cancelled: false,
        });
        // Sempre create: un job vuoto riusato non ha titolo pianificato né document_type_hint
        // (niente PATCH job; screening capitolato-first dipende da hint sul primo lotto).
        const res = await apiService.createImportJob({
          title: lot.title,
          document_type_hint: lotDocumentTypeHint(lot.guessedType),
          company_id: companyId,
        });
        const jobId = res.data?.id;
        if (!jobId) throw new Error("Creazione job fallita");
        await apiService.uploadImportJobFiles(jobId, lot.files);
        uploaded += 1;
        setSelectedId(jobId);
        await loadList();
        await loadDetail(jobId);
      }
      if (!folderUploadCancelRef.current) {
        setFolderNotice(
          `Caricati ${uploaded} ${uploaded === 1 ? "lotto" : "lotti"}.`
        );
        setFolderPlan(null);
        setFolderPlanSelected(new Set());
        setFolderPlanCompanyId(null);
        setFolderUpload(null);
        folderUploadRef.current = null;
      }
    } catch (err) {
      setError(err.message || "Upload fallito");
      // Lotti terminati: niente folderUpload "in corso" se busy torna false,
      // altrimenti l'effect su selectedId non azzera il piano al cambio job.
      folderUploadRef.current = null;
      setFolderUpload(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleProcess() {
    if (!selectedId) return;
    if (!isClientCompanyId(detail?.job?.company_id)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiService.processImportJob(selectedId);
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Elaborazione fallita");
    } finally {
      setBusy(false);
    }
  }

  async function handleScreenAndPlace() {
    if (!selectedId) return;
    if (!isClientCompanyId(detail?.job?.company_id)) {
      setError(COMPANY_REQUIRED_UPLOAD_TITLE);
      return;
    }
    setBusy(true);
    setError(null);
    setFolderNotice(null);
    try {
      const res = await apiService.screenAndPlaceImportJob(selectedId);
      const placed = res?.data?.placed ?? 0;
      const screened = res?.data?.screened ?? 0;
      setFolderNotice(
        `Screening: ${screened} file letti, ${placed} posati in scaffale. I tipi incerti restano in coda.`
      );
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Screening fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkReviewed(fileId) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.patchImportJobFile(selectedId, fileId, { status: "reviewed" });
      await loadList();
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Aggiornamento fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleAiExtract(fileId) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.postImportJobFileAiExtract(selectedId, fileId);
      await loadDetail(selectedId);
    } catch (e) {
      const msg = e?.data?.error || e.message || "Analisi AI fallita";
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveText(fileId, text) {
    if (!selectedId) return;
    setBusy(true);
    setError(null);
    try {
      await apiService.patchImportJobFile(selectedId, fileId, { extracted_text: text });
      await loadDetail(selectedId);
    } catch (e) {
      setError(e.message || "Salvataggio testo fallito");
    } finally {
      setBusy(false);
    }
  }

  function handleOpenCommit(file) {
    const ai = parseAiJson(file.ai_extraction_json) || {};
    const jobHint = detail?.job?.document_type_hint || "";
    const built = buildCommitFormFromFile(ai, file, jobHint);
    setCommitDialog({ file, ...built });
    setCommitResult(null);
  }

  async function handleCommitToQualification(file) {
    if (!selectedId) return;
    const jobCompanyId = detail?.job?.company_id;
    if (!jobCompanyId) {
      setError("Commit a Qualifica bloccato: il job non ha un'azienda associata.");
      return;
    }
    setBusy(true);
    try {
      const res = await apiService.commitImportJobFileToQualification(selectedId, file.id, {
        company_id: jobCompanyId,
      });
      const qualId = res?.data?.qualification_id ?? res?.qualification_id;
      setQualifCommitResult(prev => ({ ...prev, [file.id]: { qualification_id: qualId } }));
    } catch (e) {
      setQualifCommitResult(prev => ({ ...prev, [file.id]: { error: e.message } }));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenRiesame(file) {
    if (file?.commercial_case_id) {
      navigate(`/contract-reviews/${file.commercial_case_id}`);
      return;
    }
    const el = document.getElementById(`txt-${file.id}`);
    const extractedText = el ? el.value : (file.extracted_text || "");
    const job = detail?.job;
    const defaultCompanyId =
      job?.company_id != null ? String(job.company_id) : "";
    setRiesameDialog({
      file,
      form: {
        title: buildRiesameTitle(job, file),
        company_id: defaultCompanyId,
        external_ref: "",
        textPreview: textPreview(extractedText),
      },
    });
    if (!companies.length) {
      await loadCompanies();
    }
  }

  async function handleRiesameConfirm() {
    if (!riesameDialog || !selectedId) return;
    if (!riesameDialog.form.title?.trim()) {
      setError("Il titolo del caso è obbligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        job_id: selectedId,
        file_ids: [riesameDialog.file.id],
        title: riesameDialog.form.title.trim(),
      };
      if (riesameDialog.form.company_id) {
        payload.company_id = parseInt(riesameDialog.form.company_id, 10);
      }
      const extRef = (riesameDialog.form.external_ref || "").trim();
      if (extRef) payload.external_ref = extRef;

      const res = await apiService.importContractCaseFromJob(payload);
      const caseId = res?.case_id ?? res?.data?.case_id;
      setRiesameDialog(null);
      if (caseId) {
        navigate(`/contract-reviews/${caseId}`);
      } else {
        setError("Caso creato ma ID non restituito dall'API.");
      }
    } catch (e) {
      const msg = mapImportErrorMessage(e);
      setError(msg);
      if (e instanceof ApiError && e.code === "ALREADY_LINKED" && e.data?.case_id) {
        const open = window.confirm(
          `${msg}\n\nAprire il caso Riesame esistente (#${e.data.case_id})?`,
        );
        if (open) {
          setRiesameDialog(null);
          navigate(`/contract-reviews/${e.data.case_id}`);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  function handleCommitDocTypeChange(nextType) {
    if (!commitDialog) return;
    const ai = parseAiJson(commitDialog.file.ai_extraction_json) || {};
    if (isNormDocType(nextType)) {
      const typeData = buildInitialNormTypeData(ai, commitDialog.file);
      setCommitDialog((d) => ({
        ...d,
        isNorm: true,
        normLookup: { loading: false, result: null },
        form: {
          title: ai.title || typeData.norm_title || commitDialog.file.original_name?.split(/[/\\]/).pop() || "",
          doc_type: "norma",
          notes: d.form.notes || "",
          typeData,
        },
      }));
    } else {
      setCommitDialog((d) => ({
        ...d,
        isNorm: false,
        normLookup: { loading: false, result: null },
        form: {
          title: ai.title || commitDialog.file.original_name?.split(/[/\\]/).pop() || "",
          doc_type: nextType,
          responsible: ai.person_name || ai.responsible || "",
          issue_date: ai.issue_date || "",
          expiry_date: ai.expiry_date || "",
          doc_code: ai.doc_code || ai.code || "",
          revision: ai.revision || "",
          notes: d.form.notes || "",
        },
      }));
    }
  }

  function patchCommitTypeData(patch) {
    setCommitDialog((d) => {
      if (!d) return d;
      return {
        ...d,
        form: {
          ...d.form,
          typeData: { ...d.form.typeData, ...patch },
        },
      };
    });
  }

  async function handleCommitConfirm() {
    if (!commitDialog || !selectedId) return;
    if (commitDialog.isNorm) {
      const code = (commitDialog.form.typeData?.standard_code || "").trim();
      if (!code) {
        setError("Il codice norma è obbligatorio.");
        return;
      }
      if (!commitDialog.form.title?.trim()) {
        setError("Il titolo è obbligatorio.");
        return;
      }
    } else if (!commitDialog.form.title?.trim()) {
      setError("Il titolo è obbligatorio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = commitDialog.isNorm
        ? buildNormCommitPayload(commitDialog.form)
        : commitDialog.form;
      const res = await apiService.commitImportJobFileToRegistry(
        selectedId,
        commitDialog.file.id,
        payload
      );
      const regId = res.data?.registry_document_id;
      setCommitResult({ fileId: commitDialog.file.id, registryId: regId });
      setCommitDialog(null);
      await loadDetail(selectedId);
    } catch (e) {
      setError(e?.data?.error || e.message || "Commit fallito");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteJob(id) {
    if (!window.confirm(
      "Annullare il caricamento? Si eliminano il job e i file non ancora posati. I file già posati nello scaffale restano."
    )) return;
    setBusy(true);
    try {
      await apiService.deleteImportJob(id);
      if (selectedId === id) setSelectedId(null);
      await loadList();
    } catch (e) {
      setError(e.message || "Eliminazione fallita");
    } finally {
      setBusy(false);
    }
  }

  const detailMatchesSelection =
    selectedId != null && Number(detail?.job?.id) === Number(selectedId);
  const scopeIsClient = isClientCompanyId(scopeCompanyId);
  const jobHasCompany = detailMatchesSelection && isClientCompanyId(detail.job.company_id);
  const canUploadForJob =
    jobHasCompany && scopeMatchesJobCompany(scopeCompanyId, detail.job.company_id);
  const canProcessForJob = jobHasCompany;
  const uploadGateTitle = !detailMatchesSelection
    ? DETAIL_STALE_TITLE
    : !scopeIsClient || !jobHasCompany
      ? COMPANY_REQUIRED_UPLOAD_TITLE
      : canUploadForJob
        ? ""
        : AMBITO_JOB_MISMATCH_TITLE;
  const processGateTitle = !detailMatchesSelection
    ? DETAIL_STALE_TITLE
    : COMPANY_REQUIRED_UPLOAD_TITLE;

  if (!isAdmin) {
    return (
      <div className="import-jobs-page">
        <p className="import-jobs-denied">Accesso riservato agli amministratori.</p>
      </div>
    );
  }

  return (
    <div className="import-jobs-page">
      <h1>Import batch PDF</h1>
      <p className="import-jobs-intro">
        Flusso operativo: <strong>Ambito (azienda cliente) → tipo documento → file → estrazione → revisione → AI → registro</strong>.
        Scegli un&apos;azienda cliente in Ambito (in alto). Con Tutto lo studio o Patrimonio non si crea un job e non si caricano file.
        Una cartella non parte subito: vedi il piano (file, MB, lotti da {MAX_IMPORT_JOB_FILES}) e confermi.
        Sbagli il carico? <strong>Annulla caricamento</strong> elimina il job e i file non posati. Quelli già nello scaffale restano.
      </p>
      {error && <p className="import-jobs-error">{error}</p>}

      <div className="import-jobs-grid">
        <section className="import-jobs-col">
          <h2>Job</h2>
          <div className="import-jobs-new">
            <input
              type="text"
              placeholder="Titolo (opzionale)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <select
              className="import-jobs-select"
              value={docTypeHint}
              onChange={(e) => setDocTypeHint(e.target.value)}
            >
              {DOC_TYPE_OPTIONS_IMPORT.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreate}
              disabled={busy || !scopeIsClient}
              title={!scopeIsClient ? COMPANY_REQUIRED_UPLOAD_TITLE : ""}
            >
              + Nuovo job
            </button>
            {!scopeIsClient && (
              <p className="import-jobs-field-hint">
                {COMPANY_REQUIRED_UPLOAD_TITLE}
              </p>
            )}
          </div>
          {loading ? (
            <p>Caricamento…</p>
          ) : (
            <ul className="import-jobs-list">
              {jobs.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    className={selectedId === j.id ? "job-row active" : "job-row"}
                    onClick={() => setSelectedId(j.id)}
                  >
                    <span className="job-title">{j.title}</span>
                    <span className="job-meta">
                      #{j.id} - {j.status} - {j.file_count ?? 0} file
                      {j.company_name ? ` - ${j.company_name}` : ""}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn-del"
                    title="Annulla caricamento: elimina il job e i file non posati. I file già nello scaffale restano."
                    onClick={() => handleDeleteJob(j.id)}
                    disabled={busy}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="import-jobs-col import-jobs-detail">
          {!selectedId ? (
            <p>Seleziona un job o creane uno nuovo.</p>
          ) : (
            <>
              {detailMatchesSelection ? (
                <>
              <h2>Job #{detail.job.id}</h2>
              <p className="job-detail-status">
                Stato: <strong>{detail.job.status}</strong>
                {detail.job.document_type_hint && (
                  <> - tipo suggerito: {detail.job.document_type_hint}</>
                )}
                {detail.job.company_id && (
                  <> - azienda: {detail.job.company_name || `#${detail.job.company_id}`}</>
                )}
              </p>
              {!isClientCompanyId(detail.job.company_id) && (
                <p className="import-jobs-warning">
                  Questo job non ha un&apos;azienda cliente: carica, estrai e screening restano visibili ma bloccati.
                  Scegli un&apos;azienda cliente in Ambito (in alto) e crea un nuovo job.
                </p>
              )}
              {isClientCompanyId(detail.job.company_id) &&
                scopeIsClient &&
                !scopeMatchesJobCompany(scopeCompanyId, detail.job.company_id) && (
                <p className="import-jobs-warning">
                  {AMBITO_JOB_MISMATCH_TITLE}
                </p>
              )}
                </>
              ) : (
                <p>Caricamento dettaglio…</p>
              )}
              <div className="import-jobs-actions">
                <label
                  className={canUploadForJob ? "btn-file" : "btn-file is-disabled"}
                  title={
                    canUploadForJob
                      ? "Carica uno o più PDF"
                      : uploadGateTitle
                  }
                >
                  Carica PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    onChange={handleFiles}
                    disabled={busy || !canUploadForJob}
                  />
                </label>
                <label
                  className={canUploadForJob ? "btn-file" : "btn-file is-disabled"}
                  title={
                    canUploadForJob
                      ? "Scegli la cartella: prima vedi il piano, poi confermi i lotti"
                      : uploadGateTitle
                  }
                >
                  Carica cartella
                  <input
                    type="file"
                    multiple
                    ref={bindFolderInput}
                    onChange={handleFolderPicked}
                    disabled={busy || !canUploadForJob}
                  />
                </label>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleProcess}
                  disabled={busy || !canProcessForJob}
                  title={
                    canProcessForJob
                      ? "Estrae il testo da PDF, Word ed Excel"
                      : processGateTitle
                  }
                >
                  Estrai testo
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleScreenAndPlace}
                  disabled={busy || !canProcessForJob}
                  title={
                    canProcessForJob
                      ? "Classifica i file e li posa nello scaffale se il tipo è chiaro"
                      : processGateTitle
                  }
                >
                  Screening e posa
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    if (!detailMatchesSelection) return;
                    handleDeleteJob(detail.job.id);
                  }}
                  disabled={busy || !detailMatchesSelection}
                  title={
                    detailMatchesSelection
                      ? "Elimina il job e i file non posati. I file già nello scaffale restano."
                      : DETAIL_STALE_TITLE
                  }
                >
                  Annulla caricamento
                </button>
              </div>
              <p className="import-jobs-folder-hint">
                La cartella prende tutti i file (Word, Excel, disegni, PDF, …) e tiene i nomi delle sottocartelle.
                Dopo la scelta vedi il piano: confermi, poi i lotti da {MAX_IMPORT_JOB_FILES} file (limite server, non alzato).
                Capitolati e commesse partono prima di Scan. Dal testo di PDF, Word ed Excel si leggono prima 30 righe.
                Disegni e foto si classificano da nome e cartella (senza OCR).
              </p>
              {folderNotice && (
                <p className="import-jobs-warning">
                  {folderNotice}{" "}
                  <button
                    type="button"
                    className="btn-small"
                    onClick={() =>
                      navigate(
                        buildIncompleteQueuePath({ companyId: detail?.job?.company_id })
                      )
                    }
                  >
                    Apri coda da completare
                  </button>
                </p>
              )}
              {folderPlan && (
                <ImportFolderPlanPanel
                  plan={folderPlan}
                  selectedKeys={folderPlanSelected}
                  upload={folderUpload}
                  busy={busy}
                  confirmAllowed={scopeMatchesJobCompany(scopeCompanyId, folderPlanCompanyId)}
                  confirmGateTitle={
                    !isClientCompanyId(scopeCompanyId)
                      ? COMPANY_REQUIRED_UPLOAD_TITLE
                      : AMBITO_JOB_MISMATCH_TITLE
                  }
                  onToggle={toggleFolderPlanKey}
                  onConfirm={handleConfirmFolderPlan}
                  onCancelPlan={handleCancelFolderPlan}
                  onStopLots={handleStopFolderLots}
                />
              )}
              {detailMatchesSelection ? (
                <>
              <h3>File ({(detail.files || []).length})</h3>
              <ul className="import-files-list">
                {(detail.files || []).map((f) => {
                  const aiData = parseAiJson(f.ai_extraction_json);
                  const canSaveText =
                    (f.status === "extracted" || f.status === "uploaded") && f.status !== "reviewed";
                  const canMarkReviewed = f.status === "extracted";
                  const canAi = f.status === "extracted" || f.status === "reviewed";
                  const canRiesame =
                    (f.status === "extracted" || f.status === "reviewed") && !f.commercial_case_id;
                  const canCommit =
                    f.status === "reviewed" || (f.status === "extracted" && !!aiData);
                  const isQualif =
                    isQualificationDocType(detail.job.document_type_hint) ||
                    isQualificationDocType(aiData?.document_type_guess);
                  const qualifResult = qualifCommitResult[f.id];

                  const aiAction = canAi
                    ? {
                        key: "ai",
                        label: "Analisi AI strutturata",
                        className: "btn-small btn-ai",
                        title: "Richiede OPENAI_API_KEY sul backend",
                        disabled: busy,
                        onClick: () => handleAiExtract(f.id),
                      }
                    : null;
                  const registryAction = canCommit
                    ? {
                        key: "commit-registry",
                        label: "Commit al Registry",
                        className: "btn-small btn-commit",
                        title: "Crea un record nel registro documenti da questo file",
                        disabled: busy,
                        onClick: () => handleOpenCommit(f),
                      }
                    : null;
                  const qualifAction = canCommit
                    ? {
                        key: "commit-qualif",
                        label: qualifResult?.qualification_id
                          ? `\u2713 Qualifica #${qualifResult.qualification_id}`
                          : "Commit a Qualifica",
                        className: "btn-small btn-commit-qualif",
                        title: detail.job.company_id
                          ? "Crea una qualifica personale da questo file, subito attiva nel registro"
                          : "Seleziona l'azienda creando un nuovo job prima del commit qualifica",
                        disabled: busy || !!qualifResult?.qualification_id || !detail.job.company_id,
                        onClick: () => handleCommitToQualification(f),
                      }
                    : null;
                  const saveTextAction = canSaveText
                    ? {
                        key: "save-text",
                        label: "Salva testo",
                        className: "btn-small",
                        title: "Salva il testo estratto modificato",
                        disabled: busy,
                        onClick: () => {
                          const el = document.getElementById(`txt-${f.id}`);
                          const val = el ? el.value : f.extracted_text;
                          handleSaveText(f.id, val);
                        },
                      }
                    : null;
                  const markReviewedAction = canMarkReviewed
                    ? {
                        key: "mark-reviewed",
                        label: "Segna revisionato",
                        className: "btn-small primary",
                        title: "Marca il file come revisionato",
                        disabled: busy,
                        onClick: () => handleMarkReviewed(f.id),
                      }
                    : null;
                  const riesameAction = canRiesame
                    ? {
                        key: "riesame",
                        label: "Crea caso Riesame",
                        className: "btn-small btn-riesame",
                        title: "Crea un caso Riesame requisiti contratto da questo PDF",
                        disabled: busy,
                        onClick: () => handleOpenRiesame(f),
                      }
                    : null;

                  // Azioni in evidenza: AI + commit pertinente allo stato/tipo file.
                  const pertinentCommit = isQualif ? qualifAction : registryAction;
                  const otherCommit = isQualif ? registryAction : qualifAction;
                  const primaryActions = [aiAction, pertinentCommit].filter(Boolean);
                  // Azioni secondarie raggruppate sotto "Altre azioni" (overflow).
                  const secondaryActions = [
                    saveTextAction,
                    markReviewedAction,
                    riesameAction,
                    otherCommit,
                  ].filter(Boolean);

                  return (
                  <li key={f.id} className="import-file-card">
                    <div className="file-head">
                      <strong>{f.original_name}</strong>
                      <span className="file-status">{f.status}</span>
                      {f.confidence_score != null && (
                        <span className="file-conf">Attendibilità: {f.confidence_score}%</span>
                      )}
                    </div>
                    {aiData?.screening && (
                      <p className="import-jobs-folder-hint">
                        Screening: {aiData.document_type_guess || "—"}
                        {aiData.screening.folder_code ? ` → ${aiData.screening.folder_code}` : ""}
                        {` (${aiData.screening.confidence})`}
                        {aiData.screening.placed ? " — posato" : ""}
                      </p>
                    )}
                    {f.error_message && (
                      <p className="file-err">{f.error_message}</p>
                    )}
                    {(f.status === "extracted" || f.status === "reviewed") && (
                      <textarea
                        key={`${f.id}-${f.status}-${(f.extracted_text || "").length}`}
                        className="file-text"
                        rows={8}
                        defaultValue={f.extracted_text || ""}
                        id={`txt-${f.id}`}
                      />
                    )}
                    <div className="file-actions">
                      {primaryActions.map((a) => (
                        <button
                          key={a.key}
                          type="button"
                          className={a.className}
                          disabled={a.disabled}
                          title={a.title}
                          onClick={a.onClick}
                        >
                          {a.label}
                        </button>
                      ))}
                      <FileActionsMenu actions={secondaryActions} />
                      {qualifResult?.error && (
                        <span className="file-commit-err" title={qualifResult.error}>{"\u26A0\uFE0F"} Errore qualifica</span>
                      )}
                      {f.commercial_case_id && (
                        <button
                          type="button"
                          className="file-riesame-badge"
                          onClick={() => navigate(`/contract-reviews/${f.commercial_case_id}`)}
                        >
                          Caso Riesame #{f.commercial_case_id}
                        </button>
                      )}
                      {f.status === "committed" && (
                        <span className="file-committed-badge">
                          {"\u2713"} In Registry{commitResult?.fileId === f.id && commitResult.registryId
                            ? ` #${commitResult.registryId}` : ""}
                        </span>
                      )}
                    </div>
                    {f.ai_extraction_error && (
                      <p className="file-err ai-err">AI: {f.ai_extraction_error}</p>
                    )}
                    {parseAiJson(f.ai_extraction_json) && (
                      <AiExtractionPanel
                        file={f}
                        jobDocTypeHint={detail.job.document_type_hint || ""}
                      />
                    )}
                  </li>
                  );
                })}
              </ul>
                </>
              ) : null}
            </>
          )}
        </section>
      </div>

      {/* Sprint 10 — Dialog commit al registry (Fase 2: norme con type_specific_data) */}
      {commitDialog && (
        <div className="commit-dialog-overlay" onClick={() => setCommitDialog(null)}>
          <div className="commit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Commit al Registry documenti</h3>
            <p className="commit-dialog-file">File: <strong>{commitDialog.file.original_name}</strong></p>
            <div className="commit-form">
              <label>Titolo documento *
                <input
                  type="text"
                  value={commitDialog.form.title}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, title: e.target.value } }))}
                />
              </label>
              <label>Tipo documento
                <select
                  value={commitDialog.form.doc_type}
                  onChange={(e) => handleCommitDocTypeChange(e.target.value)}
                >
                  {DOC_TYPE_OPTIONS_IMPORT.map((o) => (
                    <option key={o.value || "none"} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              {getSuggestedFolderLabel(commitDialog.form.doc_type) && (
                <p className="commit-dialog-norm-hint">
                  Scaffale azienda previsto:{" "}
                  <strong>{getSuggestedFolderLabel(commitDialog.form.doc_type)}</strong>
                </p>
              )}

              {commitDialog.isNorm ? (
                <>
                  <p className="commit-dialog-norm-hint">
                    Campi come in <strong>Carica norme</strong>. Dopo il codice norma parte la verifica sul catalogo dell&apos;ente.
                  </p>
                  <label>Codice norma *
                    <input
                      type="text"
                      required
                      placeholder="es. BS EN ISO 9606-1:2017"
                      value={commitDialog.form.typeData?.standard_code || ""}
                      onChange={(e) => patchCommitTypeData({ standard_code: e.target.value })}
                    />
                  </label>
                  <CommitNormStatusBadge
                    normLookup={commitDialog.normLookup}
                    standardCode={commitDialog.form.typeData?.standard_code}
                  />
                  <label>Ente emittente
                    <select
                      value={commitDialog.form.typeData?.issuing_body || ""}
                      onChange={(e) => patchCommitTypeData({ issuing_body: e.target.value })}
                    >
                      <option value="">— Seleziona —</option>
                      {(getSchemaForDocType("norma")?.fields?.find((f) => f.key === "issuing_body")?.options || []).map(
                        (o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        )
                      )}
                    </select>
                  </label>
                  <label>Anno edizione
                    <input
                      type="number"
                      min="1900"
                      max="2100"
                      value={commitDialog.form.typeData?.edition_year ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        patchCommitTypeData({ edition_year: v === "" ? "" : parseInt(v, 10) || "" });
                      }}
                    />
                  </label>
                  <label>Titolo ufficiale norma
                    <input
                      type="text"
                      value={commitDialog.form.typeData?.norm_title || ""}
                      onChange={(e) => patchCommitTypeData({ norm_title: e.target.value })}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>Codice doc.
                    <input
                      type="text"
                      value={commitDialog.form.doc_code || ""}
                      onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, doc_code: e.target.value } }))}
                    />
                  </label>
                  <label>Revisione
                    <input
                      type="text"
                      value={commitDialog.form.revision || ""}
                      onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, revision: e.target.value } }))}
                    />
                  </label>
                  <label>Responsabile
                    <input
                      type="text"
                      value={commitDialog.form.responsible || ""}
                      onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, responsible: e.target.value } }))}
                    />
                  </label>
                  <label>Data emissione
                    <input
                      type="date"
                      value={commitDialog.form.issue_date || ""}
                      onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, issue_date: e.target.value } }))}
                    />
                  </label>
                  <label>Scadenza
                    <input
                      type="date"
                      value={commitDialog.form.expiry_date || ""}
                      onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, expiry_date: e.target.value } }))}
                    />
                  </label>
                </>
              )}

              <label>Note
                <textarea
                  rows={3}
                  value={commitDialog.form.notes || ""}
                  onChange={(e) => setCommitDialog((d) => ({ ...d, form: { ...d.form, notes: e.target.value } }))}
                />
              </label>
            </div>
            <p className="commit-dialog-hint">
              Il documento verrà creato come bozza AI (<em>ai_draft</em>) nel Registro Documenti.
              Potrai validarlo dalla pagina Documenti.
            </p>
            <div className="commit-dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setCommitDialog(null)} disabled={busy}>
                Annulla
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleCommitConfirm}
                disabled={
                  busy
                  || !commitDialog.form.title?.trim()
                  || (commitDialog.isNorm && !(commitDialog.form.typeData?.standard_code || "").trim())
                }
              >
                {busy ? "Salvataggio…" : "Conferma e salva nel Registry"}
              </button>
            </div>
          </div>
        </div>
      )}

      {riesameDialog && (
        <div className="commit-dialog-overlay" onClick={() => setRiesameDialog(null)}>
          <div className="commit-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>Crea caso Riesame requisiti</h3>
            <p className="commit-dialog-file">
              File: <strong>{riesameDialog.file.original_name}</strong>
            </p>
            <div className="commit-form">
              <label>Titolo caso *
                <input
                  type="text"
                  value={riesameDialog.form.title}
                  onChange={(e) =>
                    setRiesameDialog((d) => ({
                      ...d,
                      form: { ...d.form, title: e.target.value },
                    }))
                  }
                />
              </label>
              <label>Cliente (opzionale)
                <select
                  value={riesameDialog.form.company_id}
                  onChange={(e) =>
                    setRiesameDialog((d) => ({
                      ...d,
                      form: { ...d.form, company_id: e.target.value },
                    }))
                  }
                >
                  <option value="">— Nessun cliente —</option>
                  {companies.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name || `ID ${c.id}`}
                    </option>
                  ))}
                </select>
              </label>
              <label>Riferimento esterno (opzionale)
                <input
                  type="text"
                  placeholder="es. RFQ-2026-042"
                  value={riesameDialog.form.external_ref}
                  onChange={(e) =>
                    setRiesameDialog((d) => ({
                      ...d,
                      form: { ...d.form, external_ref: e.target.value },
                    }))
                  }
                />
              </label>
              <label>Anteprima testo estratto
                <textarea
                  className="riesame-text-preview"
                  rows={5}
                  readOnly
                  value={riesameDialog.form.textPreview}
                />
              </label>
            </div>
            <p className="commit-dialog-hint">
              Verrà creato un caso in bozza (<em>DRAFT</em>) con checklist preliminare
              e allegato PDF collegato. Potrai completare il riesame dalla pagina Riesame requisiti.
            </p>
            <div className="commit-dialog-actions">
              <button type="button" className="btn-secondary" onClick={() => setRiesameDialog(null)} disabled={busy}>
                Annulla
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleRiesameConfirm}
                disabled={busy || !riesameDialog.form.title?.trim()}
              >
                {busy ? "Creazione…" : "Conferma e crea caso"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
