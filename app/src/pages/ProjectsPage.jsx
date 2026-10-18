/**
 * ProjectsPage  -  Gestione Commesse ISO 3834
 * Pattern CRUD identico a WeldingProceduresPage.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { formatDate } from "../utils/dateHelpers";
import StatusBadge from "../components/StatusBadge";
import PencilIcon from "../components/icons/PencilIcon";
import TrashIcon from "../components/icons/TrashIcon";
import { getWelderQualificationWarning } from "../utils/welderQualificationExpiryWarnings";
import AiDisclaimer from "../components/AiDisclaimer";
import CoverageFeasibilityBlock from "../components/CoverageFeasibilityBlock";
import { TECHNICAL_REVIEW_ITEMS } from "../data/technicalReviewItems";
import {
  applyTechnicalReviewCompletionStamp,
  checklistForWordExport,
  formatTechnicalReviewCompletion,
  getTechnicalReviewCompletion,
  isTechnicalReviewComplete,
  parseTechnicalReviewChecklist,
} from "../utils/technicalReviewChecklist";
import { exportTechnicalReviewDocx } from "../utils/wordExportTechnicalReview";
import { normalizeApplicableWpsIds } from "../utils/applicableWpsIds";
import { STATUS_LABELS } from "../utils/contractReviewLabels";
import { INSPECTION_PHASES } from "../utils/ndtInspectionPhase";
import "./ProjectsPage.css";

const AI_COVERAGE_LABELS = {
  covered: { label: "Coperta", cls: "pj-ai-covered" },
  partial: { label: "Parziale", cls: "pj-ai-partial" },
  missing: { label: "Mancante", cls: "pj-ai-missing" },
};

const PROJECT_STATUSES = [
  { value: "offerta", label: "Offerta" },
  { value: "aperta",  label: "Aperta" },
  { value: "chiusa",  label: "Chiusa" },
  { value: "sospesa", label: "Sospesa" },
];

// Stati di commessa che richiedono il riesame tecnico §5.3 completato (gate soft).
const STATUSES_REQUIRING_TECHNICAL_REVIEW = ["aperta"];
const INSPECTION_METHODS = ["VT", "MT", "PT", "UT", "RT", "ET"];

//  Form modale commessa 

function ProjectFormModal({ project, companies, defaultCompanyId, wpsList, qualifications, onSave, onClose, onSaved }) {
  // Prepopola welder_ids dai welders già assegnati al progetto
  const existingWelderIds = Array.isArray(project?.welders)
    ? project.welders.map(w => w.qualification_id)
    : [];
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const savedIdRef          = useRef(project?.id || null);
  const [savedProjectId, setSavedProjectId] = useState(project?.id || null);
  const [inspectionItems, setInspectionItems] = useState([]);
  const [inspectionDraft, setInspectionDraft] = useState({
    inspection_phase: "",
    method: "",
    coverage_percent: "",
    acceptance_standard: "",
  });
  const [inspectionMessage, setInspectionMessage] = useState(null);
  const [inspectionBusy, setInspectionBusy] = useState(false);
  const isFirstRender       = useRef(true);
  const autoSaveTimer       = useRef(null);
  const lastSyncedWelderIds = useRef([...existingWelderIds]);

  const [form, setForm] = useState({
    company_id: defaultCompanyId || "",
    project_code: "",
    client_name: "",
    end_customer_id: "",
    description: "",
    start_date: "",
    end_date: "",
    status: "offerta",
    requirements_review_date: "",
    technical_review_date: "",
    notes: "",
    welder_ids: existingWelderIds,
    ...(project || {}),
    // Normalizzato nello stato iniziale (non in un effect: cambiare `form` all'apertura farebbe partire l'auto-save).
    applicable_wps_ids: normalizeApplicableWpsIds(project?.applicable_wps_ids),
    commercial_case_id: project?.commercial_case_id ? String(project.commercial_case_id) : "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // Il passaggio all'approvazione scrive la commessa da solo. Il caso parte
  // solo col salvataggio della scelta, non con le modifiche successive.
  const caseRevRef = useRef(0);
  const caseSentRef = useRef(0);

  // Cliente: elenco controparti (anagrafica aziende) per l'azienda selezionata,
  // stesso pattern usato dal Riesame Contratti (company_counterparties, ruolo end_customer).
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  useEffect(() => {
    if (!form.company_id) { setCustomers([]); return; }
    let cancelled = false;
    setCustomersLoading(true);
    apiService.getCompanyCounterparties(form.company_id, { role: "end_customer", is_active: "true" })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setCustomers(list);
      })
      .catch(() => { if (!cancelled) setCustomers([]); })
      .finally(() => { if (!cancelled) setCustomersLoading(false); });
    return () => { cancelled = true; };
  }, [form.company_id]);

  const [reviewCases, setReviewCases] = useState([]);
  const [reviewCasesLoading, setReviewCasesLoading] = useState(false);
  useEffect(() => {
    if (!form.company_id) { setReviewCases([]); return; }
    let cancelled = false;
    setReviewCasesLoading(true);
    const load = typeof apiService.getContractReviews === "function"
      ? apiService.getContractReviews()
      : Promise.resolve([]);
    load
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        const companyId = String(form.company_id);
        setReviewCases(list.filter((row) => String(row.company_id) === companyId));
      })
      .catch(() => { if (!cancelled) setReviewCases([]); })
      .finally(() => { if (!cancelled) setReviewCasesLoading(false); });
    return () => { cancelled = true; };
  }, [form.company_id]);

  const { user } = useAuth();
  const [technicalReviewChecklist, setTechnicalReviewChecklist] = useState(() =>
    parseTechnicalReviewChecklist(project?.technical_review_checklist)
  );
  const [technicalReviewOpen, setTechnicalReviewOpen] = useState(false);
  const [wordExporting, setWordExporting] = useState(false);

  function setTechnicalReviewItem(key, patch) {
    setTechnicalReviewChecklist((prev) => {
      const next = {
        ...prev,
        [key]: { ...(prev[key] || {}), ...patch },
      };
      return applyTechnicalReviewCompletionStamp(next, user);
    });
  }

  const technicalReviewComplete = isTechnicalReviewComplete(technicalReviewChecklist);
  const persistedReviewStamp = getTechnicalReviewCompletion(
    parseTechnicalReviewChecklist(project?.technical_review_checklist)
  );
  const showTechnicalReviewWarning =
    STATUSES_REQUIRING_TECHNICAL_REVIEW.includes(form.status) && !technicalReviewComplete;

  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiSuggestResult, setAiSuggestResult] = useState(null);
  const [aiSuggestError, setAiSuggestError] = useState(null);

  async function handleAiSuggest() {
    if (!project?.id) return;
    setAiSuggestLoading(true);
    setAiSuggestError(null);
    try {
      const res = await apiService.post(`/projects/${project.id}/ai/suggest-compliance`, {});
      setAiSuggestResult(res?.data || res);
    } catch (err) {
      setAiSuggestError(err.message);
    } finally {
      setAiSuggestLoading(false);
    }
  }

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  function projectPayload() {
    const payload = {
      ...form,
      applicable_wps_ids: normalizeApplicableWpsIds(form.applicable_wps_ids),
      technical_review_checklist: JSON.stringify(
        applyTechnicalReviewCompletionStamp(technicalReviewChecklist || {}, user)
      ),
    };
    const rev = caseRevRef.current;
    const pending = rev !== caseSentRef.current;
    if (pending) {
      payload.commercial_case_id = form.commercial_case_id ? Number(form.commercial_case_id) : null;
    } else {
      delete payload.commercial_case_id;
    }
    return { payload, rev, pending };
  }

  function acceptCaseWrite(built) {
    if (built.pending && caseRevRef.current === built.rev) {
      caseSentRef.current = built.rev;
    }
  }

  // Auto-save con debounce 800ms (salva progetto + sync welders)
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!form.project_code?.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaving(true);
      setAutoSaveStatus('saving');
      setError(null);
      try {
        const built = projectPayload();
        const payload = built.payload;
        let savedProjectId = savedIdRef.current;
        if (savedIdRef.current) {
          await apiService.updateProject(savedIdRef.current, payload);
        } else {
          const res = await apiService.createProject(payload);
          savedProjectId = res?.data?.id || res?.id;
          savedIdRef.current = savedProjectId;
          if (savedProjectId) setSavedProjectId(savedProjectId);
        }
        acceptCaseWrite(built);
        // Sincronizza welders diff dall'ultima sincronizzazione
        if (savedProjectId) {
          const newIds = Array.isArray(form.welder_ids) ? form.welder_ids : [];
          const oldIds = lastSyncedWelderIds.current;
          const toAdd    = newIds.filter(id => !oldIds.includes(id));
          const toRemove = oldIds.filter(id => !newIds.includes(id));
          await Promise.all([
            ...toAdd.map(qid => apiService.addProjectWelder(savedProjectId, { qualification_id: qid }).catch(() => {})),
            ...toRemove.map(qid => apiService.removeProjectWelder(savedProjectId, qid).catch(() => {})),
          ]);
          lastSyncedWelderIds.current = [...newIds];
        }
        setAutoSaveStatus('saved');
        onSaved?.();
      } catch (err) {
        setAutoSaveStatus('error');
        setError(err?.message || "Errore salvataggio.");
      } finally {
        setSaving(false);
      }
    }, 800);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, technicalReviewChecklist]);

  function toggleWps(wpsId) {
    setForm((f) => {
      const ids = Array.isArray(f.applicable_wps_ids) ? [...f.applicable_wps_ids] : [];
      const idx = ids.indexOf(wpsId);
      if (idx >= 0) ids.splice(idx, 1);
      else ids.push(wpsId);
      return { ...f, applicable_wps_ids: ids };
    });
  }

  useEffect(() => {
    if (!savedProjectId) {
      setInspectionItems([]);
      return;
    }
    if (typeof apiService.getProjectInspectionItems !== "function") return;
    let cancelled = false;
    apiService.getProjectInspectionItems(savedProjectId)
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || []);
        setInspectionItems(list);
      })
      .catch(() => { if (!cancelled) setInspectionItems([]); });
    return () => { cancelled = true; };
  }, [savedProjectId]);

  async function addInspectionItem() {
    if (!savedProjectId || inspectionBusy) return;
    if (typeof apiService.createProjectInspectionItem !== "function") return;
    setInspectionBusy(true);
    setInspectionMessage(null);
    try {
      const res = await apiService.createProjectInspectionItem(savedProjectId, {
        inspection_phase: inspectionDraft.inspection_phase || null,
        method: inspectionDraft.method || null,
        coverage_percent: inspectionDraft.coverage_percent,
        acceptance_standard: inspectionDraft.acceptance_standard,
      });
      const row = res?.data || res;
      if (row && row.id != null) setInspectionItems((items) => [...items, row]);
      setInspectionDraft({
        inspection_phase: "",
        method: "",
        coverage_percent: "",
        acceptance_standard: "",
      });
    } catch (err) {
      setInspectionMessage(err?.message || "Controllo non salvato.");
    } finally {
      setInspectionBusy(false);
    }
  }

  async function removeInspectionItem(itemId) {
    if (!savedProjectId || inspectionBusy) return;
    if (typeof apiService.deleteProjectInspectionItem !== "function") return;
    setInspectionBusy(true);
    setInspectionMessage(null);
    try {
      await apiService.deleteProjectInspectionItem(savedProjectId, itemId);
      setInspectionItems((items) => items.filter((item) => item.id !== itemId));
    } catch (err) {
      setInspectionMessage(err?.message || "Controllo non rimosso.");
    } finally {
      setInspectionBusy(false);
    }
  }

  async function createInspectionDrafts() {
    if (!savedProjectId || inspectionBusy) return;
    if (typeof apiService.generateProjectInspectionDrafts !== "function") return;
    setInspectionBusy(true);
    setInspectionMessage(null);
    try {
      const res = await apiService.generateProjectInspectionDrafts(savedProjectId);
      const data = res?.data || {};
      const created = Array.isArray(data.created) ? data.created.length : 0;
      const already = Array.isArray(data.already) ? data.already.length : 0;
      const skipped = Array.isArray(data.skipped) ? data.skipped.length : 0;
      const parts = [`Bozze create: ${created}`];
      if (already) parts.push(`già presenti: ${already}`);
      if (skipped) parts.push(`senza metodo: ${skipped}`);
      setInspectionMessage(`${parts.join(". ")}.`);
    } catch (err) {
      setInspectionMessage(err?.message || "Bozze non create.");
    } finally {
      setInspectionBusy(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const built = projectPayload();
      const payload = built.payload;
      let savedProjectId;
      if (project?.id) {
        await apiService.updateProject(project.id, payload);
        savedProjectId = project.id;
      } else {
        const res = await apiService.createProject(payload);
        savedProjectId = res?.data?.id || res?.id;
        if (savedProjectId) setSavedProjectId(savedProjectId);
      }
      acceptCaseWrite(built);

      // Sincronizza welders: aggiungi i nuovi, rimuovi i vecchi
      if (savedProjectId) {
        const newIds = Array.isArray(form.welder_ids) ? form.welder_ids : [];
        const oldIds = existingWelderIds;
        const toAdd    = newIds.filter(id => !oldIds.includes(id));
        const toRemove = oldIds.filter(id => !newIds.includes(id));
        await Promise.all([
          ...toAdd.map(qid => apiService.addProjectWelder(savedProjectId, { qualification_id: qid }).catch(() => {})),
          ...toRemove.map(qid => apiService.removeProjectWelder(savedProjectId, qid).catch(() => {})),
        ]);
      }

      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const dateVal = (v) => (v ? String(v).substring(0, 10) : "");
  const wpsIds = Array.isArray(form.applicable_wps_ids) ? form.applicable_wps_ids : [];

  return (
    <div className="pj-modal-overlay">
      <div className="pj-modal pj-modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="pj-modal-header">
          <h3>{project?.id ? "Modifica commessa" : "Nuova commessa"}</h3>
          {autoSaveStatus === 'saving' && <span className="autosave-status saving">{"Salvataggio\u2026"}</span>}
          {autoSaveStatus === 'saved'  && <span className="autosave-status saved">{"\u2713 Salvato"}</span>}
          {autoSaveStatus === 'error'  && <span className="autosave-status error">{"\u26A0 Errore salvataggio"}</span>}
          <button className="pj-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={e => e.preventDefault()}>
          <div className="pj-modal-body">
            {error && <div className="pj-error">{error}</div>}
            <div className="pj-form-grid">
              <div className="pj-form-group">
                <label className="pj-form-label">Codice commessa *</label>
                <input className="pj-form-input" value={form.project_code} onChange={(e) => set("project_code", e.target.value)} required />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Azienda (ambito)</label>
                <select
                  className="pj-form-select"
                  value={form.company_id || ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Cambiando azienda la controparte e il caso di riesame potrebbero non appartenerle più.
                    caseRevRef.current += 1;
                    setForm((f) => ({ ...f, company_id: val, end_customer_id: "", commercial_case_id: "" }));
                  }}
                >
                  <option value="">- Nessuna -</option>
                  {(companies || []).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label" htmlFor="project-commercial-case">Caso Riesame Requisiti</label>
                <select
                  id="project-commercial-case"
                  className="pj-form-select"
                  value={form.commercial_case_id || ""}
                  disabled={!form.company_id}
                  title={form.company_id ? "Caso della stessa azienda" : "Seleziona un'azienda per scegliere il caso"}
                  onChange={(e) => {
                    caseRevRef.current += 1;
                    set("commercial_case_id", e.target.value);
                  }}
                >
                  <option value="">{"\u2014 Nessuno \u2014"}</option>
                  {reviewCases.map((row) => {
                    const status = STATUS_LABELS[row.status] || row.status || "";
                    const title = row.title || row.external_ref || `Caso ${row.id}`;
                    return (
                      <option key={row.id} value={row.id}>
                        {status ? `${title} (${status})` : title}
                      </option>
                    );
                  })}
                  {form.commercial_case_id
                    && !reviewCases.some((row) => String(row.id) === String(form.commercial_case_id))
                    && !reviewCasesLoading && (
                    <option value={form.commercial_case_id}>{`Caso ${form.commercial_case_id}`}</option>
                  )}
                </select>
                {!form.company_id && (
                  <p className="pj-hint" style={{ margin: "4px 0" }}>Seleziona un&apos;azienda per vedere i casi di Riesame Requisiti.</p>
                )}
                {form.company_id && reviewCasesLoading && (
                  <span className="pj-hint">Caricamento casi...</span>
                )}
                {form.company_id && !reviewCasesLoading && reviewCases.length === 0 && !form.commercial_case_id && (
                  <p className="pj-hint" style={{ margin: "4px 0" }}>Nessun caso di Riesame Requisiti per questa azienda.</p>
                )}
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Cliente</label>
                {form.company_id ? (
                  customersLoading ? (
                    <span className="pj-hint">Caricamento anagrafica...</span>
                  ) : customers.length > 0 ? (
                    <select
                      className="pj-form-select"
                      value={form.end_customer_id || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val) {
                          const cust = customers.find((c) => String(c.id) === val);
                          setForm((f) => ({ ...f, end_customer_id: val, client_name: cust?.name || "" }));
                        } else {
                          setForm((f) => ({ ...f, end_customer_id: "" }));
                        }
                      }}
                    >
                      <option value="">{"\u2014"} Altro (testo libero) {"\u2014"}</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="pj-hint" style={{ margin: "4px 0" }}>
                      Nessun cliente in anagrafica per questa azienda. Aggiungilo da Aziende {"\u2192"} Controparti, oppure inserisci il nome qui sotto.
                    </p>
                  )
                ) : (
                  <p className="pj-hint" style={{ margin: "4px 0" }}>Seleziona un&apos;azienda per usare l&apos;anagrafica clienti.</p>
                )}
                {!form.end_customer_id && (
                  <input
                    className="pj-form-input"
                    value={form.client_name || ""}
                    onChange={(e) => set("client_name", e.target.value)}
                    placeholder="Nome cliente"
                    style={form.company_id && customers.length > 0 ? { marginTop: 6 } : undefined}
                  />
                )}
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Data inizio</label>
                <input className="pj-form-input" type="date" value={dateVal(form.start_date)} onChange={(e) => set("start_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Data fine</label>
                <input className="pj-form-input" type="date" value={dateVal(form.end_date)} onChange={(e) => set("end_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Stato</label>
                <select className="pj-form-select" value={form.status || "offerta"} onChange={(e) => set("status", e.target.value)}>
                  {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Riesame requisiti</label>
                <input className="pj-form-input" type="date" value={dateVal(form.requirements_review_date)} onChange={(e) => set("requirements_review_date", e.target.value)} />
              </div>
              <div className="pj-form-group">
                <label className="pj-form-label">Riesame tecnico</label>
                <input className="pj-form-input" type="date" value={dateVal(form.technical_review_date)} onChange={(e) => set("technical_review_date", e.target.value)} />
              </div>
              <div className="pj-form-group full">
                <label className="pj-form-label">Descrizione</label>
                <textarea className="pj-form-textarea" value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
              </div>
              <div className="pj-form-group full">
                <label className="pj-form-label">Note</label>
                <textarea className="pj-form-textarea" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>

            {/* Riesame tecnico ISO 3834-3 §5.3 (gate soft: non blocca il salvataggio) */}
            <div className="pj-wps-section">
              <button
                type="button"
                className="pj-section-toggle"
                onClick={() => setTechnicalReviewOpen((v) => !v)}
              >
                <h4 className="pj-section-label" style={{ margin: 0 }}>
                  Riesame tecnico (ISO 3834-3 {"\u00A7"}5.3)
                  {technicalReviewComplete
                    ? <span className="pj-badge-ok"> Completato</span>
                    : <span className="pj-badge-warn"> Da completare</span>}
                </h4>
                <span>{technicalReviewOpen ? "\u25B2" : "\u25BC"}</span>
              </button>

              {showTechnicalReviewWarning && (
                <div className="pj-warn-banner">
                  {"\u26A0\uFE0F"} Il riesame tecnico non risulta completato per tutti i punti previsti dalla norma.
                  La commessa può comunque essere salvata come &quot;Aperta&quot;, ma si consiglia di completare
                  la verifica prima di avviare la produzione.
                </div>
              )}

              {technicalReviewComplete && persistedReviewStamp && (
                <p className="pj-technical-review-stamp">
                  {formatTechnicalReviewCompletion(persistedReviewStamp)}
                </p>
              )}

              <button
                type="button"
                className="pj-btn-ai-suggest"
                onClick={async () => {
                  setWordExporting(true);
                  try {
                    await exportTechnicalReviewDocx({
                      projectCode: form.project_code,
                      clientName: form.client_name,
                      status: form.status,
                      checklist: checklistForWordExport(
                        technicalReviewChecklist,
                        project?.technical_review_checklist
                      ),
                    });
                  } catch (err) {
                    setError(err.message || "Export Word non riuscito");
                  } finally {
                    setWordExporting(false);
                  }
                }}
                disabled={wordExporting}
                title="Scarica la checklist §5.3 in Word"
              >
                {wordExporting ? "Preparazione Word..." : "Scarica Word checklist"}
              </button>

              {technicalReviewOpen && (
                <div className="pj-checkbox-list pj-technical-review-list">
                  {TECHNICAL_REVIEW_ITEMS.map((item) => {
                    const itemState = technicalReviewChecklist[item.key] || {};
                    return (
                      <label key={item.key} className="pj-checkbox-item pj-technical-review-item">
                        <input
                          type="checkbox"
                          checked={!!itemState.checked}
                          onChange={(e) => setTechnicalReviewItem(item.key, { checked: e.target.checked })}
                        />
                        <span>{item.label}</span>
                        <input
                          className="pj-form-input pj-technical-review-note"
                          type="text"
                          placeholder="Nota breve (opzionale)"
                          value={itemState.note || ""}
                          onChange={(e) => setTechnicalReviewItem(item.key, { note: e.target.value })}
                        />
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Suggeritore AI conformità 3834-3 (pattern SAL — proposta, mai scrittura automatica) */}
            {project?.id && (
              <div className="pj-wps-section">
                <div className="pj-ai-suggest-header">
                  <h4 className="pj-section-label" style={{ margin: 0 }}>Suggeritore conformità ISO 3834-3 (AI)</h4>
                  <button
                    type="button"
                    className="pj-btn-ai-suggest"
                    onClick={handleAiSuggest}
                    disabled={aiSuggestLoading}
                  >
                    {aiSuggestLoading ? "Analisi in corso..." : "Suggerisci stato (AI)"}
                  </button>
                </div>

                {aiSuggestError && <div className="pj-error" style={{ marginTop: 8 }}>{aiSuggestError}</div>}

                {aiSuggestResult && !aiSuggestResult.aiAvailable && (
                  <p className="pj-hint">{aiSuggestResult.message || "Suggeritore AI non disponibile."}</p>
                )}

                {aiSuggestResult?.aiAvailable && Array.isArray(aiSuggestResult.suggestions) && (
                  <>
                    <div className="pj-ai-suggest-list">
                      {aiSuggestResult.suggestions.map((s) => {
                        const cov = AI_COVERAGE_LABELS[s.coverage] || { label: "Non valutata", cls: "pj-ai-unknown" };
                        return (
                          <div key={s.clauseRef} className="pj-ai-suggest-item">
                            <div className="pj-ai-suggest-item-head">
                              <strong>{"\u00A7"}{s.clauseRef}</strong> {s.clauseTitle}
                              <span className={`pj-ai-badge ${cov.cls}`}>{cov.label}</span>
                              <span className="pj-ai-confidence">confidenza: {s.confidence}</span>
                            </div>
                            <p className="pj-ai-rationale">{s.rationale}</p>
                          </div>
                        );
                      })}
                    </div>
                    <AiDisclaimer style={{ marginTop: 8, display: "block" }} />
                  </>
                )}
              </div>
            )}

            <div className="pj-wps-section">
              <h4 className="pj-section-label">Controlli previsti</h4>
              <div className="pj-form-grid">
                <div className="pj-form-group">
                  <label className="pj-form-label" htmlFor="inspection-phase">Fase</label>
                  <select
                    id="inspection-phase"
                    className="pj-form-select"
                    value={inspectionDraft.inspection_phase}
                    disabled={!savedProjectId}
                    onChange={(e) => setInspectionDraft((d) => ({ ...d, inspection_phase: e.target.value }))}
                  >
                    <option value="">{"\u2014"}</option>
                    {INSPECTION_PHASES.map((phase) => (
                      <option key={phase.value} value={phase.value}>{phase.label}</option>
                    ))}
                  </select>
                </div>
                <div className="pj-form-group">
                  <label className="pj-form-label" htmlFor="inspection-method">Metodo</label>
                  <select
                    id="inspection-method"
                    className="pj-form-select"
                    value={inspectionDraft.method}
                    disabled={!savedProjectId}
                    onChange={(e) => setInspectionDraft((d) => ({ ...d, method: e.target.value }))}
                  >
                    <option value="">{"\u2014"}</option>
                    {INSPECTION_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                </div>
                <div className="pj-form-group">
                  <label className="pj-form-label" htmlFor="inspection-percent">Percentuale</label>
                  <input
                    id="inspection-percent"
                    className="pj-form-input"
                    inputMode="decimal"
                    value={inspectionDraft.coverage_percent}
                    disabled={!savedProjectId}
                    onChange={(e) => setInspectionDraft((d) => ({ ...d, coverage_percent: e.target.value }))}
                  />
                </div>
                <div className="pj-form-group">
                  <label className="pj-form-label" htmlFor="inspection-standard">Norma di accettazione</label>
                  <input
                    id="inspection-standard"
                    className="pj-form-input"
                    value={inspectionDraft.acceptance_standard}
                    disabled={!savedProjectId}
                    onChange={(e) => setInspectionDraft((d) => ({ ...d, acceptance_standard: e.target.value }))}
                  />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                <button
                  type="button"
                  className="pj-btn-save"
                  disabled={!savedProjectId || inspectionBusy}
                  title={savedProjectId ? "Aggiunge il controllo alla commessa" : "Salva la commessa per aggiungere i controlli previsti"}
                  onClick={addInspectionItem}
                >
                  Aggiungi
                </button>
                <button
                  type="button"
                  className="pj-btn-save"
                  disabled={!savedProjectId || inspectionBusy}
                  title={savedProjectId ? "Crea una bozza di verbale per ogni controllo con un metodo" : "Salva la commessa per creare le bozze"}
                  onClick={createInspectionDrafts}
                >
                  Crea bozze verbali
                </button>
              </div>
              {!savedProjectId && (
                <p className="pj-hint">Salva la commessa per aggiungere i controlli previsti.</p>
              )}
              {inspectionMessage && <p className="pj-hint">{inspectionMessage}</p>}
              {inspectionItems.length > 0 && (
                <ul className="pj-checkbox-list">
                  {inspectionItems.map((item) => {
                    const phase = INSPECTION_PHASES.find((p) => p.value === item.inspection_phase);
                    const percent = item.coverage_percent == null || item.coverage_percent === ""
                      ? ""
                      : `${item.coverage_percent}%`;
                    const bits = [phase ? phase.label : "", item.method || "", percent, item.acceptance_standard || ""].filter(Boolean);
                    return (
                      <li key={item.id} className="pj-checkbox-item">
                        <span>{bits.join(" \u00b7 ") || "Controllo senza dettagli"}</span>
                        <button
                          type="button"
                          className="pj-btn-cancel"
                          disabled={inspectionBusy}
                          onClick={() => removeInspectionItem(item.id)}
                        >
                          Rimuovi
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* WPS applicabili */}
            {wpsList.length > 0 && (
              <div className="pj-wps-section">
                <h4 className="pj-section-label">WPS applicabili</h4>
                <div className="pj-checkbox-list">
                  {wpsList.map((w) => (
                    <label key={w.id} className="pj-checkbox-item">
                      <input
                        type="checkbox"
                        checked={wpsIds.includes(w.id)}
                        onChange={() => toggleWps(w.id)}
                      />
                      <span>{w.wps_code}{w.revision ? ` (Rev. ${w.revision})` : ""}</span>
                      <span className="pj-checkbox-sub">{w.welding_process || ""}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Saldatori assegnati */}
            {qualifications.length > 0 && (
              <div className="pj-wps-section">
                <h4 className="pj-section-label">Saldatori qualificati</h4>
                <div className="pj-checkbox-list">
                  {qualifications.map((q) => {
                    const isAssigned = Array.isArray(form.welder_ids) && form.welder_ids.includes(q.id);
                    const qualWarning = getWelderQualificationWarning(q);
                    return (
                      <label key={q.id} className="pj-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => {
                            setForm(f => {
                              const ids = Array.isArray(f.welder_ids) ? [...f.welder_ids] : [];
                              const idx = ids.indexOf(q.id);
                              if (idx >= 0) ids.splice(idx, 1);
                              else ids.push(q.id);
                              return { ...f, welder_ids: ids };
                            });
                          }}
                        />
                        <span>{q.person_name}</span>
                        <span className="pj-checkbox-sub">{q.qualification_type} &mdash; {q.certificate_number || "N/A"}</span>
                        {q.approval_status !== "approvata" && (
                          <span className="pj-badge-warn">non approvata</span>
                        )}
                        {qualWarning && (
                          <span
                            className={`pj-badge-warn ${qualWarning.level === "danger" ? "pj-badge-danger" : ""}`}
                            title={qualWarning.text}
                          >
                            {qualWarning.level === "danger" ? "scaduta" : "in scadenza"}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="pj-hint">L&apos;assegnazione viene salvata contestualmente alla commessa.</p>
              </div>
            )}
          </div>
          <div className="pj-modal-footer">
            <button type="button" className="pj-btn-save" onClick={onClose} disabled={saving}>
              {saving ? "Salvataggio\u2026" : "Chiudi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Widget Copertura Commessa ──────────────────────────────────────────────────

function CoverageModal({ projectId, projectCode, companyId = null, companyName = "", onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    apiService.getQualificationsCoverage(projectId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  const esito = { verde: "\u2705", rosso: "\u274C", giallo: "\u26A0\uFE0F" };

  return (
    <div className="pj-modal-overlay" onClick={onClose}>
      <div className="pj-modal pj-modal-large" onClick={e => e.stopPropagation()}>
        <div className="pj-modal-header">
          <h3>Copertura Commessa &mdash; {projectCode}</h3>
          <button className="pj-modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="pj-modal-body">
          {loading && <div className="pj-loading"><div className="pj-spinner" /><span>Calcolo copertura...</span></div>}
          {error && <div className="pj-error">{error}</div>}
          {data && !data.has_wps && (
            <div className="pj-hint">Nessuna WPS associata alla commessa. Assegna le WPS per verificare la copertura.</div>
          )}
          {data && data.has_wps && (
            <>
              <div className="pj-coverage-summary">
                <span className="pj-cov-ok">{"\u2705"} Coperte: {data.summary.covered}</span>
                <span className="pj-cov-ko">{"\u274C"} Non coperte: {data.summary.uncovered}</span>
                <span className="pj-cov-tot">Totale WPS: {data.summary.total}</span>
              </div>
              <table className="pj-table" style={{ marginTop: 12 }}>
                <thead>
                  <tr>
                    <th>WPS</th>
                    <th>Processo</th>
                    <th>Saldatori qualificati</th>
                    <th>Esito</th>
                  </tr>
                </thead>
                <tbody>
                  {data.coverage.map(row => (
                    <tr key={row.wps_id}>
                      <td><strong>{row.wps_code}</strong></td>
                      <td>{row.welding_process || "\u2014"}</td>
                      <td>
                        {row.qualifiers.length === 0
                          ? <span style={{ color: "#dc2626" }}>Nessuno disponibile</span>
                          : row.qualifiers.map(q => (
                            <div key={q.id} className="pj-qual-chip">
                              {q.person_name}
                              {q.semaforo !== "verde" && (
                                <span className={`pj-chip-warn pj-chip-${q.semaforo}`}>
                                  {q.semaforo === "rosso" ? " (scaduta)" : " (in scadenza)"}
                                </span>
                              )}
                            </div>
                          ))}
                      </td>
                      <td>{esito[row.esito] || row.esito}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
          {data && (
            <div style={{ marginTop: 16 }}>
              <CoverageFeasibilityBlock
                rows={data.coverage}
                welderSummary={data.summary}
                companyId={companyId}
                companyName={companyName}
              />
            </div>
          )}
        </div>
        <div className="pj-modal-footer">
          <button className="pj-btn-cancel" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagina principale ─────────────────────────────────────────────────────────

function ProjectsPage() {
  const { user } = useAuth();
  const { companyId: companyScope, companies, scopeCompanyName } = useCompanyScope();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const LIMIT = 30;

  const [filters, setFiltersState] = useState({ search: "", status: "" });
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const [coverageProject, setCoverageProject] = useState(null); // { id, project_code, company_id, company_name }

  const [wpsList, setWpsList] = useState([]);
  const [qualifications, setQualifications] = useState([]);

  const setFilter = useCallback((key, val) => {
    setFiltersState((f) => ({ ...f, [key]: val }));
    setPage(1);
  }, []);

  useEffect(() => { setPage(1); }, [companyScope]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: LIMIT };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (companyScope) params.company_id = companyScope;

      const res = await apiService.getProjects(params);
      setProjects(res.data || []);
      setTotal(res.pagination?.total || res.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, filters, companyScope]);

  const loadFormData = useCallback(async () => {
    try {
      const [wpsRes, qualRes] = await Promise.allSettled([
        apiService.getWPSList({ status: "attiva", limit: 500 }),
        apiService.getQualifications({ qualification_type: "iso9606_1", limit: 200 }),
      ]);
      if (wpsRes.status === "fulfilled") setWpsList(wpsRes.value?.data || []);
      if (qualRes.status === "fulfilled") setQualifications(qualRes.value?.qualifications || []);
    } catch { /* non bloccante */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadFormData(); }, [loadFormData]);

  function handleNew()       { setEditingProject(null); setFormOpen(true); }
  async function handleEdit(p) {
    try {
      const full = await apiService.getProject(p.id);
      setEditingProject(full?.data || full || p);
    } catch {
      setEditingProject(p);
    }
    setFormOpen(true);
  }
  function handleSaved()     { setFormOpen(false); setEditingProject(null); loadData(); }

  async function handleConfirmDelete(id) {
    try {
      await apiService.deleteProject(id);
      setDeleteId(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function getWpsCount(project) {
    return normalizeApplicableWpsIds(project.applicable_wps_ids).length;
  }

  return (
    <div className="pj-page">
      {/* Header */}
      <div className="pj-header">
        <div>
          <h2 className="pj-title">Gestione Commesse</h2>
          <p className="pj-subtitle">Commesse di saldatura  -  ISO 3834</p>
        </div>
        <div className="pj-header-actions">
          <button className="pj-btn-new" onClick={handleNew}>+ Nuova commessa</button>
        </div>
      </div>
      {companyScope && (
        <p className="pj-hint" style={{ marginTop: -8 }}>{"Ambito attivo: "}{scopeCompanyName}</p>
      )}

      {/* Filtri */}
      <div className="pj-toolbar">
        <input
          className="pj-search"
          type="text"
          placeholder="Cerca codice, cliente..."
          value={filters.search}
          onChange={(e) => setFilter("search", e.target.value)}
        />
        <select
          className="pj-select"
          value={filters.status}
          onChange={(e) => setFilter("status", e.target.value)}
        >
          <option value="">Tutti gli stati</option>
          {PROJECT_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button className="pj-btn-reload" onClick={loadData} title="Aggiorna">&#x21bb;</button>
      </div>

      {error && (
        <div className="pj-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/* Tabella */}
      <div className="pj-table-wrap">
        {loading ? (
          <div className="pj-loading"><div className="pj-spinner" /><span>Caricamento...</span></div>
        ) : projects.length === 0 ? (
          <div className="pj-empty">
            <span className="pj-empty-icon">{"\uD83D\uDCCB"}</span>
            <p>Nessuna commessa trovata.</p>
            <button className="pj-btn-new" onClick={handleNew} style={{ marginTop: 12 }}>Crea la prima commessa</button>
          </div>
        ) : (
          <table className="pj-table pj-table-list">
            <thead>
              <tr>
                <th>Codice</th>
                <th>Cliente</th>
                <th>Stato</th>
                <th>Inizio</th>
                <th>Fine</th>
                <th>N.WPS</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="pj-row-click" onClick={() => handleEdit(p)}>
                  <td><strong>{p.project_code}</strong></td>
                  <td>{p.end_customer_name || p.client_name || "-"}</td>
                  <td><StatusBadge type="project" status={p.status || "offerta"} /></td>
                  <td>{formatDate(p.start_date)}</td>
                  <td>{formatDate(p.end_date)}</td>
                  <td>{getWpsCount(p)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {deleteId === p.id ? (
                      <div className="pj-confirm">
                        <span>Il record va nel cestino. Non è una cancellazione definitiva.</span>
                        <button className="pj-confirm-yes" type="button" onClick={() => handleConfirmDelete(p.id)}>S - </button>
                        <button className="pj-confirm-no" onClick={() => setDeleteId(null)}>No</button>
                      </div>
                    ) : (
                      <div className="pj-actions">
                        <button
                          className="grid-icon-btn"
                          title="Modifica commessa"
                          aria-label="Modifica commessa"
                          onClick={() => handleEdit(p)}
                        >
                          <PencilIcon size={15} />
                        </button>
                        <button
                          className="pj-btn-coverage"
                          title="Verifica copertura saldatori"
                          onClick={() => setCoverageProject({
                            id: p.id,
                            project_code: p.project_code,
                            company_id: p.company_id ?? null,
                            company_name: p.company_name || "",
                          })}
                        >
                          {"\uD83D\uDD0D"}
                        </button>
                        <button
                          className="grid-icon-btn grid-icon-btn--danger"
                          title="Elimina commessa"
                          aria-label="Elimina commessa"
                          onClick={() => setDeleteId(p.id)}
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div className="pj-pagination">
          <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>&laquo; Prec</button>
          <span>Pag. {page} / {totalPages} &mdash; {total} commesse</span>
          <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>Succ &raquo;</button>
        </div>
      )}

      {/* Form modale */}
      {formOpen && (
        <ProjectFormModal
          project={editingProject}
          companies={companies}
          defaultCompanyId={!editingProject && companyScope ? companyScope : ""}
          wpsList={wpsList}
          qualifications={qualifications}
          onSave={handleSaved}
          onSaved={loadData}
          onClose={() => { setFormOpen(false); setEditingProject(null); }}
        />
      )}

      {/* Modal copertura */}
      {coverageProject && (
        <CoverageModal
          projectId={coverageProject.id}
          projectCode={coverageProject.project_code}
          companyId={coverageProject.company_id}
          companyName={coverageProject.company_name}
          onClose={() => setCoverageProject(null)}
        />
      )}
    </div>
  );
}

export default ProjectsPage;
