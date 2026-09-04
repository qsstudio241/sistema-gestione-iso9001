/**
 * Report Templates Admin — catalogo template Word (audit ISO + scheda NC)
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "./SgqDataGrid";
import FileDropzone from "./FileDropzone";
import {
  validateDocxFile,
  stripDocxExtension,
  checkDocxMarkers,
  checkNcDocxMarkers,
  checkCndDocxMarkers,
  formatMarkerWarning,
  formatNcMarkerWarning,
  formatCndMarkerWarning,
  CND_METHOD_KEYS,
  normalizeCndMethodKey,
  validateDuplicateTemplateName,
  getReportTemplateDownloadUrl,
  isSystemReportTemplate,
  formatTemplateOrigin,
} from "../utils/reportTemplateUpload";
import "./ReportTemplatesAdminPage.css";

const STANDARD_LABELS = {
  1: "ISO 9001",
  2: "ISO 14001",
  3: "ISO 45001",
  6: "ISO 3834-2",
  7: "Audit sistema 3834",
};

const GRID_COLUMNS = [
  { id: "name", label: "Nome", sortable: true, width: "1fr" },
  { id: "origin", label: "Origine", sortable: true, width: "100px" },
  { id: "standard_key", label: "Chiave norma", sortable: true, width: "140px" },
  { id: "actions", label: "Azioni", sortable: false, width: "220px", cellClassName: "rt-cell-actions" },
];

const ReportTemplatesAdminPage = ({ onBack }) => {
  const [pageTab, setPageTab] = useState("audit");
  const [templates, setTemplates] = useState([]);
  const [ncTemplates, setNcTemplates] = useState([]);
  const [cndTemplates, setCndTemplates] = useState([]);
  const [standards, setStandards] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [ncAssignment, setNcAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(null);
  const [savingNc, setSavingNc] = useState(false);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadMethod, setUploadMethod] = useState("VT");
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [markerWarning, setMarkerWarning] = useState(null);
  const fileInputRef = useRef(null);

  const [duplicateSource, setDuplicateSource] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);

  const activeScope = pageTab === "nc" ? "nc" : pageTab === "cnd" ? "cnd" : "audit";
  const currentTemplates = pageTab === "nc" ? ncTemplates : pageTab === "cnd" ? cndTemplates : templates;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const settled = await Promise.allSettled([
        apiService.getReportTemplates("audit"),
        apiService.getReportTemplates("nc"),
        apiService.getReportTemplates("cnd"),
        apiService.getStandards(),
        apiService.getReportTemplateStandardAssignments(),
        apiService.getNcReportTemplateAssignment(),
      ]);

      const pick = (result) => (result.status === "fulfilled" ? result.value : null);
      const rejectMsg = (result) =>
        result.status === "rejected" ? (result.reason?.message || "Errore di rete") : null;

      const tplRes = pick(settled[0]);
      const ncTplRes = pick(settled[1]);
      const cndTplRes = pick(settled[2]);
      const stdRes = pick(settled[3]);
      const assignRes = pick(settled[4]);
      const ncAssignRes = pick(settled[5]);

      const criticalError =
        rejectMsg(settled[0]) || rejectMsg(settled[3]) || rejectMsg(settled[4]);
      if (criticalError) {
        setLoadError(criticalError);
      }

      const tplList = tplRes?.data ?? [];
      const ncTplList = ncTplRes?.data ?? [];
      const cndTplList = cndTplRes?.data ?? [];
      const stdList = (stdRes?.data ?? []).filter((s) =>
        [1, 2, 3, 6, 7].includes(s.standard_id),
      );
      const assignMap = {};
      (assignRes?.data ?? []).forEach((a) => {
        if (a.standard_id != null) assignMap[a.standard_id] = a.report_template_id;
      });
      setTemplates(Array.isArray(tplList) ? tplList : []);
      setNcTemplates(Array.isArray(ncTplList) ? ncTplList : []);
      setCndTemplates(Array.isArray(cndTplList) ? cndTplList : []);
      setStandards(stdList);
      setAssignments(assignMap);
      setNcAssignment(ncAssignRes?.data?.report_template_id ?? null);
    } catch (err) {
      console.error("Errore caricamento template:", err);
      setLoadError(err.message || "Impossibile caricare i template. Riprova tra poco.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const refreshTemplates = async (scope = activeScope) => {
    const tplRes = await apiService.getReportTemplates(scope);
    const list = Array.isArray(tplRes?.data) ? tplRes.data : [];
    if (scope === "nc") setNcTemplates(list);
    else if (scope === "cnd") setCndTemplates(list);
    else setTemplates(list);
  };

  const gridRows = useMemo(
    () =>
      currentTemplates.map((t) => ({
        ...t,
        origin: formatTemplateOrigin(t),
      })),
    [currentTemplates],
  );

  const resetUploadForm = () => {
    setUploadFile(null);
    setUploadName("");
    setUploadMethod("VT");
    setMarkerWarning(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileChange = async (files) => {
    const file = files?.[0];
    setUploadFeedback(null);
    setMarkerWarning(null);
    if (!file) {
      setUploadFile(null);
      return;
    }
    const validationErr = validateDocxFile(file);
    if (validationErr) {
      setUploadFile(null);
      setUploadFeedback({ type: "error", message: validationErr });
      return;
    }
    setUploadFile(file);
    if (!uploadName.trim()) {
      setUploadName(stripDocxExtension(file.name));
    }
    if (activeScope === "nc") {
      const missing = await checkNcDocxMarkers(file);
      const warn = formatNcMarkerWarning(missing);
      if (warn) setMarkerWarning(warn);
    } else if (activeScope === "cnd") {
      const missing = await checkCndDocxMarkers(file, uploadMethod);
      const warn = formatCndMarkerWarning(missing, uploadMethod);
      if (warn) setMarkerWarning(warn);
    } else {
      const missing = await checkDocxMarkers(file);
      const warn = formatMarkerWarning(missing);
      if (warn) setMarkerWarning(warn);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploadFeedback(null);
    const validationErr = validateDocxFile(uploadFile);
    if (validationErr) {
      setUploadFeedback({ type: "error", message: validationErr });
      return;
    }
    try {
      setUploading(true);
      const res = await apiService.uploadReportTemplate(uploadFile, {
        name: uploadName.trim() || stripDocxExtension(uploadFile.name),
        scope: activeScope,
        standard_key: activeScope === "cnd" ? (normalizeCndMethodKey(uploadMethod) || "VT") : undefined,
      });
      const created = res?.data;
      await refreshTemplates(activeScope);
      resetUploadForm();
      setUploadFeedback({
        type: "success",
        message: activeScope === "nc"
          ? (created?.name
            ? `Template NC "${created.name}" caricato. Assegnalo nella sezione sotto per l'export dal registro NC.`
            : "Template NC caricato. Assegnalo per l'export dal registro NC.")
          : activeScope === "cnd"
          ? (created?.name
            ? `Template CND "${created.name}" caricato. L'export usa il modello studio con la stessa chiave metodo (VT/MT/PT/UT), altrimenti il sistema.`
            : "Template CND caricato.")
          : (created?.name
            ? `Template "${created.name}" caricato. Assegnalo agli standard ISO qui sotto o alle checklist custom in Admin → Checklist personalizzate.`
            : "Template caricato. Assegnalo agli standard ISO o alle checklist custom."),
      });
    } catch (err) {
      setUploadFeedback({
        type: "error",
        message: err.message || "Errore durante il caricamento del template.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAssign = async (standardId, templateId) => {
    if (!templateId) return;
    try {
      setSaving(standardId);
      await apiService.assignReportTemplateToStandard(standardId, templateId);
      setAssignments((prev) => ({ ...prev, [standardId]: templateId }));
    } catch (err) {
      console.error("Errore assegnazione:", err);
      window.alert(err.message || "Errore durante il salvataggio dell'assegnazione.");
    } finally {
      setSaving(null);
    }
  };

  const handleNcAssign = async (templateId) => {
    try {
      setSavingNc(true);
      await apiService.assignReportTemplateToNc(templateId || null);
      setNcAssignment(templateId || null);
    } catch (err) {
      console.error("Errore assegnazione NC:", err);
      window.alert(err.message || "Errore durante il salvataggio del template NC.");
    } finally {
      setSavingNc(false);
    }
  };

  const handleDownload = async (template) => {
    if (!template?.id) return;
    const info = getReportTemplateDownloadUrl(template, apiService.baseUrl);
    try {
      await apiService.downloadReportTemplateFile(
        template.id,
        info?.filename || `${template.name || "template"}.docx`,
      );
    } catch (err) {
      console.error("Download template:", err);
      window.alert(err.message || "Download del template non riuscito.");
    }
  };

  const openDuplicateModal = (template) => {
    setDuplicateSource(template);
    setDuplicateName(`${template.name} (copia)`);
    setDuplicateError(null);
  };

  const closeDuplicateModal = () => {
    setDuplicateSource(null);
    setDuplicateName("");
    setDuplicateError(null);
  };

  const handleDuplicateSubmit = async (e) => {
    e.preventDefault();
    const nameErr = validateDuplicateTemplateName(duplicateName);
    if (nameErr) {
      setDuplicateError(nameErr);
      return;
    }
    const dupScope = duplicateSource?.scope === "nc" ? "nc" : duplicateSource?.scope === "cnd" ? "cnd" : "audit";
    try {
      setDuplicating(true);
      setDuplicateError(null);
      await apiService.duplicateReportTemplate(duplicateSource.id, duplicateName.trim());
      await refreshTemplates(dupScope);
      closeDuplicateModal();
      setUploadFeedback({
        type: "success",
        message: dupScope === "nc"
          ? `Template NC "${duplicateName.trim()}" creato nello studio. Assegnalo per l'export dal registro NC.`
          : dupScope === "cnd"
          ? `Template CND "${duplicateName.trim()}" creato nello studio. L'export usa la copia studio se ha la stessa chiave metodo.`
          : `Template "${duplicateName.trim()}" creato nello studio. Puoi assegnarlo a checklist custom (5S, sopralluogo, ecc.) o agli standard ISO.`,
      });
    } catch (err) {
      setDuplicateError(err.message || "Errore durante la duplicazione.");
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = async (template) => {
    if (isSystemReportTemplate(template)) return;
    if (!window.confirm(`Eliminare il template "${template.name}"? Le assegnazioni collegate verranno rimosse.`)) {
      return;
    }
    const delScope = template.scope === "nc" ? "nc" : template.scope === "cnd" ? "cnd" : "audit";
    try {
      await apiService.deleteReportTemplate(template.id);
      await refreshTemplates(delScope);
      if (delScope === "nc" && ncAssignment === template.id) {
        setNcAssignment(null);
      }
      setUploadFeedback({ type: "success", message: "Template eliminato." });
    } catch (err) {
      window.alert(err.message || "Errore durante l'eliminazione.");
    }
  };

  const renderCell = (row, col) => {
    if (col.id === "name") {
      return (
        <span className="rt-name-cell" title={row.name}>
          {row.name}
        </span>
      );
    }
    if (col.id === "origin") {
      return (
        <span className={`rt-origin-badge${isSystemReportTemplate(row) ? " rt-origin-badge--system" : " rt-origin-badge--org"}`}>
          {row.origin}
        </span>
      );
    }
    if (col.id === "standard_key") {
      return row.standard_key || "\u2014";
    }
    if (col.id === "actions") {
      const canDuplicate = isSystemReportTemplate(row);
      const canDelete = !isSystemReportTemplate(row);
      return (
        <div className="rt-row-actions">
          <button type="button" className="rt-action-btn" onClick={() => handleDownload(row)} title="Scarica file Word">
            Scarica
          </button>
          {canDuplicate && (
            <button type="button" className="rt-action-btn" onClick={() => openDuplicateModal(row)} title="Duplica nello studio">
              Duplica
            </button>
          )}
          {canDelete && (
            <button type="button" className="rt-action-btn rt-action-btn--danger" onClick={() => handleDelete(row)} title="Elimina template studio">
              Elimina
            </button>
          )}
        </div>
      );
    }
    return row[col.id] ?? "-";
  };

  const getSortValue = useCallback((row, colId) => {
    if (colId === "origin") return row.origin;
    if (colId === "standard_key") return row.standard_key || "";
    return row[colId] ?? "";
  }, []);

  const switchTab = (tab) => {
    setPageTab(tab);
    resetUploadForm();
    setUploadFeedback(null);
  };

  return (
    <div className="report-templates-admin">
      <div className="rt-header">
        <button type="button" className="btn-back" onClick={onBack}>
          {"\u2190"} Indietro
        </button>
        <h2>Template report Word</h2>
        <p className="rt-desc">
          Catalogo template per export Word: report audit ISO, checklist custom, scheda non conformità e verbali CND (VT/MT/PT/UT).
          Carica un .docx personalizzato o duplica un modello di sistema dalla riga dell&apos;elenco, poi assegnalo allo standard ISO, alla checklist custom, all&apos;export NC o usa la chiave metodo CND.
        </p>
      </div>

      <div className="rt-tabs" role="tablist" aria-label="Tipo template">
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "audit"}
          className={`rt-tab${pageTab === "audit" ? " rt-tab--active" : ""}`}
          onClick={() => switchTab("audit")}
        >
          Audit ISO
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "nc"}
          className={`rt-tab${pageTab === "nc" ? " rt-tab--active" : ""}`}
          onClick={() => switchTab("nc")}
        >
          Non conformità
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pageTab === "cnd"}
          className={`rt-tab${pageTab === "cnd" ? " rt-tab--active" : ""}`}
          onClick={() => switchTab("cnd")}
        >
          CND
        </button>
      </div>

      {loadError && (
        <div className="rt-feedback rt-feedback-error" role="alert">
          {loadError}
        </div>
      )}

      <section className="rt-banner" aria-labelledby="rt-banner-title">
        <h3 id="rt-banner-title" className="rt-banner-title">
          {pageTab === "nc"
            ? "Gestione template scheda NC"
            : pageTab === "cnd"
              ? "Gestione template verbali CND"
              : "Gestione template audit"}
        </h3>
        <p className="rt-banner-guide">
          {pageTab === "nc"
            ? "Duplica sulla riga per una copia nello studio, oppure scarica, modifica in Word (segnaposto {ncNumber}, {description}, {#actions}...) e carica qui."
            : pageTab === "cnd"
              ? "Carica un .docx per metodo (VT, MT, PT, UT). Segnaposto semantici tipo {pt_acc_l2}, non nomi FORMCHECKBOX. Il .doc non è accettato: convertire una volta in .docx. L'export usa il template studio con la stessa chiave, altrimenti il modello di sistema."
              : "Duplica sulla riga per una copia nello studio. Carica file se hai gia un .docx modificato in Word. Poi assegna lo standard sotto l'elenco."}
        </p>
        <div className="rt-banner-cards">
          <div className="rt-banner-card">
            <h4 className="rt-card-title">Carica file</h4>
            <form className="rt-upload-form" onSubmit={handleUpload}>
              <label className="rt-field-label">
                File .docx
                <FileDropzone
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  disabled={uploading}
                  onFiles={handleFileChange}
                  hint="Solo .docx"
                  inputRef={fileInputRef}
                />
              </label>
              <label className="rt-field-label">
                Nome nel menu
                <input
                  type="text"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                  placeholder={
                    pageTab === "nc"
                      ? "Es. Scheda NC studio"
                      : pageTab === "cnd"
                        ? "Es. Verbale PT Mason 2026"
                        : "Es. Verbale 5S, Sopralluogo cantiere"
                  }
                  disabled={uploading}
                />
              </label>
              {pageTab === "cnd" && (
                <label className="rt-field-label">
                  Metodo
                  <select
                    value={uploadMethod}
                    onChange={async (e) => {
                      const next = normalizeCndMethodKey(e.target.value) || "VT";
                      setUploadMethod(next);
                      if (uploadFile) {
                        const missing = await checkCndDocxMarkers(uploadFile, next);
                        setMarkerWarning(formatCndMarkerWarning(missing, next));
                      }
                    }}
                    disabled={uploading}
                  >
                    {CND_METHOD_KEYS.map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                </label>
              )}
              <div className="rt-card-footer">
                <button type="submit" className="btn-rt-primary" disabled={uploading || !uploadFile}>
                  {uploading ? "Caricamento..." : "Carica"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {uploadFile && !uploadFeedback?.type && (
          <p className="rt-upload-selected">
            File selezionato: <strong>{uploadFile.name}</strong> (
            {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)
          </p>
        )}
        {markerWarning && (
          <div className="rt-feedback rt-feedback-warning" role="status">
            {markerWarning}
          </div>
        )}
        {uploadFeedback && (
          <div
            className={`rt-feedback rt-feedback-${uploadFeedback.type}`}
            role={uploadFeedback.type === "error" ? "alert" : "status"}
          >
            {uploadFeedback.message}
          </div>
        )}
      </section>

      <section className="rt-grid-section" aria-labelledby="rt-grid-title">
        <h3 id="rt-grid-title" className="rt-section-title">
          {pageTab === "nc"
            ? "Elenco template scheda NC"
            : pageTab === "cnd"
              ? "Elenco template CND"
              : "Elenco template audit"}
        </h3>
        <SgqDataGrid
          rows={gridRows}
          columns={GRID_COLUMNS}
          loading={loading}
          emptyMessage="Nessun template disponibile."
          theme="plain"
          renderCell={renderCell}
          getSortValue={getSortValue}
          getRowKey={(row) => row.id}
        />
      </section>

      {pageTab === "audit" ? (
        <section className="rt-assign-section" aria-labelledby="rt-assign-title">
          <h3 id="rt-assign-title" className="rt-section-title">
            Assegnazione per standard ISO
          </h3>
          <p className="rt-assign-hint">
            Per checklist custom (5S, sopralluogo, ecc.) usa il dropdown template nell&apos;editor in Checklist personalizzate.
          </p>
          <div className="rt-list">
            {standards.map((std) => (
              <div key={std.standard_id} className="rt-row">
                <span className="rt-std-label">
                  {STANDARD_LABELS[std.standard_id] || std.standard_name}
                </span>
                <select
                  className="rt-select"
                  value={assignments[std.standard_id] ?? ""}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value, 10) : null;
                    if (val) handleAssign(std.standard_id, val);
                    else setAssignments((prev) => {
                      const next = { ...prev };
                      delete next[std.standard_id];
                      return next;
                    });
                  }}
                  disabled={saving === std.standard_id}
                >
                  <option value="">Template di sistema (default)</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {isSystemReportTemplate(t) ? "(sistema)" : ""}
                    </option>
                  ))}
                </select>
                {saving === std.standard_id && <span className="rt-saving">Salvataggio...</span>}
              </div>
            ))}
          </div>
        </section>
      ) : pageTab === "nc" ? (
        <section className="rt-assign-section" aria-labelledby="rt-assign-nc-title">
          <h3 id="rt-assign-nc-title" className="rt-section-title">
            Template export dal registro NC
          </h3>
          <p className="rt-assign-hint">
            Modello usato dal pulsante <strong>Scarica Word</strong> nel dettaglio di ogni non conformità.
          </p>
          <div className="rt-list">
            <div className="rt-row">
              <span className="rt-std-label">Scheda NC studio</span>
              <select
                className="rt-select"
                value={ncAssignment ?? ""}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null;
                  handleNcAssign(val);
                }}
                disabled={savingNc}
              >
                <option value="">Modello di sistema (default)</option>
                {ncTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {isSystemReportTemplate(t) ? "(sistema)" : ""}
                  </option>
                ))}
              </select>
              {savingNc && <span className="rt-saving">Salvataggio...</span>}
            </div>
          </div>
        </section>
      ) : (
        <section className="rt-assign-section" aria-labelledby="rt-assign-cnd-title">
          <h3 id="rt-assign-cnd-title" className="rt-section-title">
            Export verbale CND
          </h3>
          <p className="rt-assign-hint">
            L&apos;export usa il template studio con la stessa chiave metodo (VT, MT, PT, UT), altrimenti il modello di sistema.
            Per sostituire un modello di sistema carica un .docx con quel metodo. Il file .doc Mason va convertito una volta in .docx (Word o LibreOffice), non a runtime.
          </p>
        </section>
      )}

      {duplicateSource && (
        <div className="rt-modal-overlay" onClick={closeDuplicateModal}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="rt-dup-title">
            <h3 id="rt-dup-title">Duplica template di sistema</h3>
            <p className="rt-modal-desc">
              Crea una copia nello studio a partire da <strong>{duplicateSource.name}</strong>.
            </p>
            <form onSubmit={handleDuplicateSubmit}>
              <div className="rt-form-group">
                <label htmlFor="rt-dup-name">Nome del nuovo template *</label>
                <input
                  id="rt-dup-name"
                  type="text"
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  autoFocus
                  disabled={duplicating}
                  maxLength={255}
                />
              </div>
              {duplicateError && (
                <div className="rt-feedback rt-feedback-error" role="alert">
                  {duplicateError}
                </div>
              )}
              <div className="rt-modal-actions">
                <button type="button" className="btn-rt-secondary" onClick={closeDuplicateModal} disabled={duplicating}>
                  Annulla
                </button>
                <button type="submit" className="btn-rt-primary" disabled={duplicating}>
                  {duplicating ? "Duplicazione..." : "Salva copia"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportTemplatesAdminPage;
