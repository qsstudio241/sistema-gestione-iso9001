/**
 * Report Templates Admin - Assegnazione template per standard (Phase 3.3)
 * Solo admin/auditor. Elenco standard + dropdown template per ciascuno.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import apiService from "../services/apiService";
import { validateDocxFile, stripDocxExtension } from "../utils/reportTemplateUpload";
import "./ReportTemplatesAdminPage.css";

const STANDARD_LABELS = {
  1: "ISO 9001",
  2: "ISO 14001",
  3: "ISO 45001",
  6: "ISO 3834-2",
  7: "RDP Mason",
};

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
  const fileInputRef = useRef(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const [tplRes, stdRes] = await Promise.all([
        apiService.getReportTemplates("audit"),
        apiService.getStandards(),
      ]);
      const tplList = tplRes?.data ?? [];
      const stdList = (stdRes?.data ?? []).filter((s) =>
        [1, 2, 3, 6, 7].includes(s.standard_id)
      );
      setTemplates(Array.isArray(tplList) ? tplList : []);
      setStandards(stdList);
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

  const refreshTemplates = async () => {
    const tplRes = await apiService.getReportTemplates("audit");
    const tplList = tplRes?.data ?? [];
    setTemplates(Array.isArray(tplList) ? tplList : []);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setUploadFeedback(null);
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
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadFeedback({
        type: "success",
        message: created?.name
          ? `Template "${created.name}" caricato correttamente. Ora puoi assegnarlo agli standard qui sotto.`
          : "Template caricato correttamente. Ora puoi assegnarlo agli standard qui sotto.",
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

  if (loading) {
    return (
      <div className="report-templates-admin">
        <p>Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="report-templates-admin">
      <div className="rt-header">
        <button type="button" className="btn-back" onClick={onBack}>
          ← Indietro
        </button>
        <h2>Template report per standard</h2>
        <p className="rt-desc">
          Carica un modello Word personalizzato e assegnalo a ciascuno standard. Se non assegnato, viene usato il template di sistema.
        </p>
      </div>

      {loadError && (
        <div className="rt-feedback rt-feedback-error" role="alert">
          {loadError}
        </div>
      )}

      <section className="rt-upload-panel" aria-labelledby="rt-upload-title">
        <h3 id="rt-upload-title">Carica template Word</h3>
        <p className="rt-upload-hint">
          File <strong>.docx</strong> fino a 5 MB. Il nome mostrato nei menu può essere personalizzato; se lasci vuoto, si usa il nome del file.
        </p>
        <form className="rt-upload-form" onSubmit={handleUpload}>
          <label className="rt-upload-label">
            File template
            <input
              ref={fileInputRef}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
          <label className="rt-upload-label">
            Nome nel menu (opzionale)
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Es. Verbale visita 2026"
              disabled={uploading}
            />
          </label>
          <button
            type="submit"
            className="btn-rt-upload"
            disabled={uploading || !uploadFile}
          >
            {uploading ? "Caricamento in corso..." : "Carica template Word"}
          </button>
        </form>
        {uploadFile && !uploadFeedback?.type && (
          <p className="rt-upload-selected">
            File selezionato: <strong>{uploadFile.name}</strong> (
            {(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)
          </p>
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

      <h3 className="rt-assign-title">Assegnazione per standard</h3>

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
              }}
              disabled={saving === std.standard_id}
            >
              <option value="">Template di sistema (default)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.is_system ? "(sistema)" : ""}
                </option>
              ))}
            </select>
            {saving === std.standard_id && <span className="rt-saving">Salvataggio...</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportTemplatesAdminPage;
