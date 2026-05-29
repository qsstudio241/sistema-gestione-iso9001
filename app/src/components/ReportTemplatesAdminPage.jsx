/**
 * Report Templates Admin — catalogo template Word (griglia + assegnazione ISO)
 * Template generici (5S, sopralluogo): upload/duplica senza standard_key; assegnazione via checklist custom.
 */
import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import apiService from "../services/apiService";
import SgqDataGrid from "./SgqDataGrid";
import {
  validateDocxFile,
  stripDocxExtension,
  checkDocxMarkers,
  formatMarkerWarning,
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
  7: "RDP Mason",
};

const GRID_COLUMNS = [
  { id: "name", label: "Nome", sortable: true, width: "1fr" },
  { id: "origin", label: "Origine", sortable: true, width: "100px" },
  { id: "standard_key", label: "Chiave norma", sortable: true, width: "140px" },
  { id: "actions", label: "Azioni", sortable: false, width: "220px", cellClassName: "rt-cell-actions" },
];

const ReportTemplatesAdminPage = ({ onBack }) => {
  const [templates, setTemplates] = useState([]);
  const [standards, setStandards] = useState([]);
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(null);

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);
  const [markerWarning, setMarkerWarning] = useState(null);
  const fileInputRef = useRef(null);

  const [duplicateSource, setDuplicateSource] = useState(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicating, setDuplicating] = useState(false);
  const [duplicateError, setDuplicateError] = useState(null);
  const [bannerDuplicateId, setBannerDuplicateId] = useState("");

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [tplRes, stdRes, assignRes] = await Promise.all([
        apiService.getReportTemplates("audit"),
        apiService.getStandards(),
        apiService.getReportTemplateStandardAssignments(),
      ]);
      const tplList = tplRes?.data ?? [];
      const stdList = (stdRes?.data ?? []).filter((s) =>
        [1, 2, 3, 6, 7].includes(s.standard_id)
      );
      const assignMap = {};
      (assignRes?.data ?? []).forEach((a) => {
        if (a.standard_id != null) assignMap[a.standard_id] = a.report_template_id;
      });
      setTemplates(Array.isArray(tplList) ? tplList : []);
      setStandards(stdList);
      setAssignments(assignMap);
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

  const systemTemplates = useMemo(
    () => templates.filter(isSystemReportTemplate),
    [templates]
  );

  useEffect(() => {
    if (!systemTemplates.length) {
      setBannerDuplicateId("");
      return;
    }
    setBannerDuplicateId((prev) => {
      if (prev && systemTemplates.some((t) => String(t.id) === prev)) return prev;
      return String(systemTemplates[0].id);
    });
  }, [systemTemplates]);

  const refreshTemplates = async () => {
    const tplRes = await apiService.getReportTemplates("audit");
    setTemplates(Array.isArray(tplRes?.data) ? tplRes.data : []);
  };

  const gridRows = useMemo(
    () =>
      templates.map((t) => ({
        ...t,
        origin: formatTemplateOrigin(t),
      })),
    [templates]
  );

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
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
      e.target.value = "";
      return;
    }
    setUploadFile(file);
    if (!uploadName.trim()) {
      setUploadName(stripDocxExtension(file.name));
    }
    const missing = await checkDocxMarkers(file);
    const warn = formatMarkerWarning(missing);
    if (warn) setMarkerWarning(warn);
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
        scope: "audit",
      });
      const created = res?.data;
      await refreshTemplates();
      setUploadFile(null);
      setUploadName("");
      setMarkerWarning(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadFeedback({
        type: "success",
        message: created?.name
          ? `Template "${created.name}" caricato. Assegnalo agli standard ISO qui sotto o alle checklist custom in Admin → Checklist personalizzate.`
          : "Template caricato. Assegnalo agli standard ISO o alle checklist custom.",
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

  const handleDownload = (template) => {
    const info = getReportTemplateDownloadUrl(template, apiService.baseUrl);
    if (!info?.url) return;
    const a = document.createElement("a");
    a.href = info.url;
    a.download = info.filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const openDuplicateModal = (template) => {
    setDuplicateSource(template);
    setDuplicateName(`${template.name} (copia)`);
    setDuplicateError(null);
  };

  const handleBannerDuplicate = () => {
    const template = systemTemplates.find((t) => String(t.id) === bannerDuplicateId);
    if (template) openDuplicateModal(template);
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
    try {
      setDuplicating(true);
      setDuplicateError(null);
      await apiService.duplicateReportTemplate(duplicateSource.id, duplicateName.trim());
      await refreshTemplates();
      closeDuplicateModal();
      setUploadFeedback({
        type: "success",
        message: `Template "${duplicateName.trim()}" creato nello studio. Puoi assegnarlo a checklist custom (5S, sopralluogo, ecc.) o agli standard ISO.`,
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
    try {
      await apiService.deleteReportTemplate(template.id);
      await refreshTemplates();
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

  return (
    <div className="report-templates-admin">
      <div className="rt-header">
        <button type="button" className="btn-back" onClick={onBack}>
          {"\u2190"} Indietro
        </button>
        <h2>Template report Word</h2>
        <p className="rt-desc">
          Catalogo template per export Word: modelli di sistema, upload dello studio e duplicati personalizzati.
          Per audit non ISO (5S, sopralluogo, checklist custom) carica o duplica un template e assegnalo in{" "}
          <strong>Checklist personalizzate</strong>; qui sotto resta l&apos;assegnazione per standard ISO.
        </p>
      </div>

      {loadError && (
        <div className="rt-feedback rt-feedback-error" role="alert">
          {loadError}
        </div>
      )}

      <section className="rt-banner" aria-labelledby="rt-banner-title">
        <h3 id="rt-banner-title" className="rt-banner-title">
          Gestione template
        </h3>
        <p className="rt-banner-guide">
          Scarica un modello dalla colonna Azioni. Carica un file personalizzato o duplica un modello di sistema
          e assegnalo alle checklist o agli standard sotto.
        </p>
        <div className="rt-banner-row">
          <form className="rt-upload-form" onSubmit={handleUpload}>
            <label className="rt-upload-label">
              File .docx
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </label>
            <label className="rt-upload-label">
              Nome nel menu
              <input
                type="text"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="Es. Verbale 5S, Sopralluogo cantiere"
                disabled={uploading}
              />
            </label>
            <button type="submit" className="btn-rt-primary" disabled={uploading || !uploadFile}>
              {uploading ? "Caricamento..." : "Carica template Word"}
            </button>
          </form>

          <div className="rt-banner-duplicate">
            <label className="rt-upload-label" htmlFor="rt-banner-dup-select">
              Modello di sistema
              <select
                id="rt-banner-dup-select"
                className="rt-select rt-banner-dup-select"
                value={bannerDuplicateId}
                onChange={(e) => setBannerDuplicateId(e.target.value)}
                disabled={!systemTemplates.length || duplicating}
              >
                {systemTemplates.length === 0 ? (
                  <option value="">Nessun modello di sistema</option>
                ) : (
                  systemTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <button
              type="button"
              className="btn-rt-secondary"
              onClick={handleBannerDuplicate}
              disabled={!bannerDuplicateId || duplicating}
            >
              Duplica da modello di sistema
            </button>
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
          Elenco template (scope audit)
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

      {duplicateSource && (
        <div className="rt-modal-overlay" onClick={closeDuplicateModal}>
          <div className="rt-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="rt-dup-title">
            <h3 id="rt-dup-title">Duplica template di sistema</h3>
            <p className="rt-modal-desc">
              Crea una copia nello studio a partire da <strong>{duplicateSource.name}</strong>.
              Puoi rinominarla prima del salvataggio (utile per 5S, sopralluogo, verbali dedicati).
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
