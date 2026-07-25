/**
 * WeldingProceduresPage  -  Gestione WPS e WPQR
 * Modulo Saldatura ISO 3834  -  Mason-ready
 *
 * Due tab: WPS (Welding Procedure Specifications) e WPQR (Qualification Records).
 * Navigazione bidirezionale: da WPS vedi i WPQR collegati, da WPQR torni alla WPS.
 * Company scope, stats semaphore, approval workflow, batch upload WPQR.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { formatDate } from "../utils/dateHelpers";
import WpqrUploadButton from "../components/WpqrUploadButton";
import WpsUploadButton from "../components/WpsUploadButton";
import AskAiButton from "../components/AskAiButton";
import { saveQualContext } from "../utils/aiAssistantContext";
import {
  resolveInitialQualificationsCompanyScope,
  persistQualificationsCompanyScope,
} from "../utils/qualificationsCompanyScope";
import "./WeldingProceduresPage.css";

const WELDING_PROCESSES = [
  { value: "111", label: "111 - SMAW" },
  { value: "121", label: "121 - SAW" },
  { value: "131", label: "131 - MIG" },
  { value: "135", label: "135 - MAG" },
  { value: "136", label: "136 - FCAW" },
  { value: "141", label: "141 - TIG" },
  { value: "311", label: "311 - Ossiacetilenica" },
  { value: "15",  label: "15x - Plasma" },
];

const WPS_STATUSES = [
  { value: "attiva",   label: "Attiva" },
  { value: "bozza",    label: "Bozza" },
  { value: "sospesa",  label: "Sospesa" },
  { value: "revocata", label: "Revocata" },
];

const TEST_RESULTS = [
  { value: "OK", label: "OK" },
  { value: "KO", label: "KO" },
  { value: "NA", label: "N/A" },
];

function StatusBadge({ status }) {
  const cls = `wp-status wp-status-${status || "bozza"}`;
  const label = WPS_STATUSES.find((s) => s.value === status)?.label || status || "Bozza";
  return <span className={cls}>{label}</span>;
}

function ApprovalBadge({ approvalStatus }) {
  const map = {
    approvata: { cls: "wp-approval wp-approval-approvata", label: "Approvata" },
    rifiutata: { cls: "wp-approval wp-approval-rifiutata", label: "Rifiutata" },
    bozza:     { cls: "wp-approval wp-approval-bozza",     label: "Bozza" },
  };
  const { cls, label } = map[approvalStatus] || map.bozza;
  return <span className={cls}>{label}</span>;
}

function SemaforoDot({ expiry_date, approvalStatus }) {
  if (approvalStatus && approvalStatus !== "approvata") return <span className="wp-sem wp-sem-grigio" title="Non approvata" />;
  if (!expiry_date) return <span className="wp-sem wp-sem-verde" title="Valida" />;
  const now = Date.now();
  const exp = new Date(expiry_date).getTime();
  const diff = exp - now;
  const d30 = 30 * 86400000;
  const d60 = 60 * 86400000;
  if (diff < 0)   return <span className="wp-sem wp-sem-rosso"    title="Scaduta" />;
  if (diff < d30) return <span className="wp-sem wp-sem-rosso"    title="Scade entro 30 gg" />;
  if (diff < d60) return <span className="wp-sem wp-sem-arancio"  title="Scade entro 60 gg" />;
  return <span className="wp-sem wp-sem-verde" title="Valida" />;
}

function TestBadge({ value }) {
  if (!value || value === "NA") return <span className="wp-test wp-test-na">-</span>;
  const cls = value === "OK" ? "wp-test-ok" : "wp-test-ko";
  return <span className={`wp-test ${cls}`}>{value}</span>;
}

// ?
// WPS Form Modal
// ?

function WPSFormModal({ wps, defaultCompanyId, onSave, onClose }) {
  const [form, setForm] = useState({
    wps_code: "", revision: "", welding_process: "", material_group: "",
    filler_material: "", shielding_gas: "", joint_type: "", position: "",
    thickness_range_min: "", thickness_range_max: "", pipe_diameter_min: "",
    preheat_temp: "", interpass_temp: "", pwht: "",
    qualification_standard: "", status: "bozza", notes: "",
    // company_id: ereditato dall'azienda selezionata nel selettore scope
    company_id: defaultCompanyId || null,
    ...(wps || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (wps?.id) {
        await apiService.updateWPS(wps.id, form);
      } else {
        await apiService.createWPS(form);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="wp-modal-overlay" onClick={onClose}>
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-modal-header">
          <h3>{wps?.id ? "Modifica WPS" : "Nuova WPS"}</h3>
          <button className="wp-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="wp-modal-body">
            {error && <div className="wp-error">{error}</div>}
            {!form.company_id && !wps?.id && (
              <div className="wp-warn-no-company">
                {"\u26A0\uFE0F Seleziona un\u2019azienda nel filtro in cima alla pagina prima di creare una WPS."}
              </div>
            )}
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">Codice WPS *</label>
                <input className="wp-form-input" value={form.wps_code} onChange={(e) => set("wps_code", e.target.value)} required />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Revisione</label>
                <input className="wp-form-input" value={form.revision || ""} onChange={(e) => set("revision", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Processo di saldatura</label>
                <select className="wp-form-select" value={form.welding_process || ""} onChange={(e) => set("welding_process", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  {WELDING_PROCESSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gruppo materiale</label>
                <input className="wp-form-input" value={form.material_group || ""} onChange={(e) => set("material_group", e.target.value)} placeholder="es. 1.1, 8.1" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale d'apporto</label>
                <input className="wp-form-input" value={form.filler_material || ""} onChange={(e) => set("filler_material", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gas di protezione</label>
                <input className="wp-form-input" value={form.shielding_gas || ""} onChange={(e) => set("shielding_gas", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo giunto</label>
                <select className="wp-form-select" value={form.joint_type || ""} onChange={(e) => set("joint_type", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="BW">BW - Testa a testa</option>
                  <option value="FW">FW - A filetto</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Posizione</label>
                <input className="wp-form-input" value={form.position || ""} onChange={(e) => set("position", e.target.value)} placeholder="es. PA, PB, PC, PF" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore min (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" value={form.thickness_range_min || ""} onChange={(e) => set("thickness_range_min", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore max (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" value={form.thickness_range_max || ""} onChange={(e) => set("thickness_range_max", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Diametro tubo min (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" value={form.pipe_diameter_min || ""} onChange={(e) => set("pipe_diameter_min", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Temp. preriscaldo</label>
                <input className="wp-form-input" value={form.preheat_temp || ""} onChange={(e) => set("preheat_temp", e.target.value)} placeholder="es. 100 C" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Temp. interpass</label>
                <input className="wp-form-input" value={form.interpass_temp || ""} onChange={(e) => set("interpass_temp", e.target.value)} placeholder="es. max 250 C" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">PWHT</label>
                <input className="wp-form-input" value={form.pwht || ""} onChange={(e) => set("pwht", e.target.value)} placeholder="es. 600 C x 1h" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Norma qualificazione</label>
                <input className="wp-form-input" value={form.qualification_standard || ""} onChange={(e) => set("qualification_standard", e.target.value)} placeholder="es. EN ISO 15614-1" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Stato</label>
                <select className="wp-form-select" value={form.status || "bozza"} onChange={(e) => set("status", e.target.value)}>
                  {WPS_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="wp-form-group full">
                <label className="wp-form-label">Note</label>
                <textarea className="wp-form-textarea" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="wp-modal-footer">
            <button type="button" className="wp-btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="wp-btn-save" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ?
// WPQR Form Modal
// ?

function calcThicknessRangeUI(t) {
  const tNum = parseFloat(t);
  if (!tNum || tNum <= 0) return { thickness_min: "", thickness_max: "" };
  let minT, maxT;
  if (tNum <= 3) {
    minT = tNum;
    maxT = 2 * tNum;
  } else if (tNum <= 12) {
    minT = 3;
    maxT = 2 * tNum;
  } else {
    minT = Math.max(0.5 * tNum, 5);
    maxT = Math.min(2 * tNum, 200);
  }
  return {
    thickness_min: parseFloat(minT.toFixed(2)),
    thickness_max: parseFloat(maxT.toFixed(2)),
  };
}

function WPQRFormModal({ wpqr, wpsList, defaultCompanyId, onSave, onClose }) {
  const [form, setForm] = useState({
    wps_id: "", wpqr_code: "", test_date: "", testing_body: "", examiner_body: "",
    welder_name: "", welding_process: "", base_material_group: "", welding_positions: "",
    thickness_tested: "", thickness_min: "", thickness_max: "",
    diameter_min: "", diameter_max: "", filler_material: "",
    qualification_level: "", joint_type: "", standard_reference: "", wps_ref: "",
    vt_result: "NA", rt_result: "NA", ut_result: "NA", mt_result: "NA", pt_result: "NA",
    tensile_result: "NA", bend_result: "NA", impact_result: "NA", hardness_result: "NA",
    macro_result: "NA", expiry_date: "", issue_date: "", certificate_number: "", notes: "",
    company_id: defaultCompanyId || null,
    ...(wpqr || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  function handleThicknessTested(val) {
    const range = calcThicknessRangeUI(val);
    setForm((f) => ({
      ...f,
      thickness_tested: val,
      thickness_min: range.thickness_min !== "" ? range.thickness_min : f.thickness_min,
      thickness_max: range.thickness_max !== "" ? range.thickness_max : f.thickness_max,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (wpqr?.id) {
        await apiService.updateWPQR(wpqr.id, form);
      } else {
        await apiService.createWPQR(form);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const testFields = [
    { key: "vt_result",      label: "VT (Visivo)" },
    { key: "rt_result",      label: "RT (Radiografico)" },
    { key: "ut_result",      label: "UT (Ultrasuoni)" },
    { key: "mt_result",      label: "MT (Magnetico)" },
    { key: "pt_result",      label: "PT (Liquidi)" },
    { key: "tensile_result", label: "Trazione" },
    { key: "bend_result",    label: "Piega" },
    { key: "impact_result",  label: "Resilienza" },
    { key: "hardness_result",label: "Durezza" },
    { key: "macro_result",   label: "Macrografia" },
  ];

  return (
    <div className="wp-modal-overlay" onClick={onClose}>
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-modal-header">
          <h3>{wpqr?.id ? "Modifica WPQR" : "Nuovo WPQR"}</h3>
          <button className="wp-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="wp-modal-body">
            {error && <div className="wp-error">{error}</div>}
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">WPS di riferimento *</label>
                <select className="wp-form-select" value={form.wps_id || ""} onChange={(e) => set("wps_id", e.target.value)} required>
                  <option value="">-- Seleziona WPS --</option>
                  {wpsList.map((w) => <option key={w.id} value={w.id}>{w.wps_code}{w.revision ? ` (Rev. ${w.revision})` : ""}</option>)}
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Codice WPQR</label>
                <input className="wp-form-input" value={form.wpqr_code || ""} onChange={(e) => set("wpqr_code", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Data prova</label>
                <input className="wp-form-input" type="date" value={form.test_date ? form.test_date.substring(0, 10) : ""} onChange={(e) => set("test_date", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Ente certificatore</label>
                <input className="wp-form-input" value={form.testing_body || ""} onChange={(e) => set("testing_body", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Saldatore</label>
                <input className="wp-form-input" value={form.welder_name || ""} onChange={(e) => set("welder_name", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">N. Certificato</label>
                <input className="wp-form-input" value={form.certificate_number || ""} onChange={(e) => set("certificate_number", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Data emissione</label>
                <input className="wp-form-input" type="date" value={form.issue_date ? form.issue_date.substring(0, 10) : ""} onChange={(e) => set("issue_date", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Scadenza</label>
                <input className="wp-form-input" type="date" value={form.expiry_date ? form.expiry_date.substring(0, 10) : ""} onChange={(e) => set("expiry_date", e.target.value)} />
              </div>
            </div>

            <div className="wp-form-section-title">Parametri tecnici</div>
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">Norma riferimento</label>
                <input className="wp-form-input" value={form.standard_reference || ""} onChange={(e) => set("standard_reference", e.target.value)} placeholder="es. UNI EN ISO 15614-1:2019" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Livello qualifica</label>
                <select className="wp-form-select" value={form.qualification_level || ""} onChange={(e) => set("qualification_level", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="1">Level 1</option>
                  <option value="2">Level 2</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Processo saldatura (ISO 4063)</label>
                <select className="wp-form-select" value={form.welding_process || ""} onChange={(e) => set("welding_process", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  {WELDING_PROCESSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo di giunto</label>
                <select className="wp-form-select" value={form.joint_type || ""} onChange={(e) => set("joint_type", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="BW">BW - Testa a testa</option>
                  <option value="FW">FW - Angolare</option>
                  <option value="BW+FW">BW+FW - Entrambi</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gruppo materiale base (ISO/TR 15608)</label>
                <input className="wp-form-input" value={form.base_material_group || ""} onChange={(e) => set("base_material_group", e.target.value)} placeholder="es. 1.1, 2, 8" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Posizioni saldatura (ISO 6947)</label>
                <input className="wp-form-input" value={form.welding_positions || ""} onChange={(e) => set("welding_positions", e.target.value)} placeholder="es. PA, PB, PC, PF" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale d'apporto</label>
                <input className="wp-form-input" value={form.filler_material || ""} onChange={(e) => set("filler_material", e.target.value)} placeholder="es. G 42 4 M21 4Si1" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">WPS di riferimento (testo)</label>
                <input className="wp-form-input" value={form.wps_ref || ""} onChange={(e) => set("wps_ref", e.target.value)} placeholder="es. 002p_24 rev.0" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore testato (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_tested || ""} onChange={(e) => handleThicknessTested(e.target.value)} placeholder="es. 10" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Range min (mm) — ISO 15614</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_min || ""} onChange={(e) => set("thickness_min", e.target.value)} placeholder="calcolato automaticamente" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Range max (mm) — ISO 15614</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_max || ""} onChange={(e) => set("thickness_max", e.target.value)} placeholder="calcolato automaticamente" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Diametro tubo - min (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.diameter_min || ""} onChange={(e) => set("diameter_min", e.target.value)} placeholder="lascia vuoto se solo piastre" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Diametro tubo - max (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.diameter_max || ""} onChange={(e) => set("diameter_max", e.target.value)} placeholder="lascia vuoto se solo piastre" />
              </div>
            </div>

            <div className="wp-form-section-title">Prove e controlli</div>
            <div className="wp-form-grid">
              {testFields.map((tf) => (
                <div className="wp-form-group" key={tf.key}>
                  <label className="wp-form-label">{tf.label}</label>
                  <select className="wp-form-select" value={form[tf.key] || "NA"} onChange={(e) => set(tf.key, e.target.value)}>
                    {TEST_RESULTS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              ))}

              <div className="wp-form-group full">
                <label className="wp-form-label">Note</label>
                <textarea className="wp-form-textarea" value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="wp-modal-footer">
            <button type="button" className="wp-btn-cancel" onClick={onClose}>Annulla</button>
            <button type="submit" className="wp-btn-save" disabled={saving}>{saving ? "Salvataggio..." : "Salva"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ?
// Pagina Principale
// ?

function WeldingProceduresPage() {
  const [activeTab, setActiveTab] = useState("wps");

  // Company scope (persistito in localStorage, chiave condivisa con qualifiche)
  const [companyScopeId, setCompanyScopeId] = useState(() =>
    resolveInitialQualificationsCompanyScope(null)
  );
  const [companies, setCompanies] = useState([]);
  const companyScopeName = companies.find(c => String(c.id) === String(companyScopeId))?.name || "";

  // WPQR stats
  const [wpqrStats, setWpqrStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // WPS state
  const [wpsList, setWpsList] = useState([]);
  const [wpsLoading, setWpsLoading] = useState(true);
  const [wpsTotal, setWpsTotal] = useState(0);
  const [wpsPage, setWpsPage] = useState(1);

  // WPQR state
  const [wpqrList, setWpqrList] = useState([]);
  const [wpqrLoading, setWpqrLoading] = useState(false);
  const [wpqrTotal, setWpqrTotal] = useState(0);
  const [wpqrPage, setWpqrPage] = useState(1);

  // All WPS for WPQR form select
  const [allWps, setAllWps] = useState([]);

  const [error, setError] = useState(null);
  const LIMIT = 30;

  // Filters
  const [wpsFilters, setWpsFilters] = useState({ welding_process: "", status: "", search: "" });
  const [wpqrFilters, setWpqrFilters] = useState({ approval_status: "", search: "", wps_id: "" });
  const [wpqrFilterWpsId, setWpqrFilterWpsId] = useState("");

  // Modals
  const [wpsFormOpen, setWpsFormOpen] = useState(false);
  const [editingWps, setEditingWps] = useState(null);
  const [wpqrFormOpen, setWpqrFormOpen] = useState(false);
  const [editingWpqr, setEditingWpqr] = useState(null);

  // Delete confirm
  const [deleteWpsId, setDeleteWpsId] = useState(null);
  const [deleteWpqrId, setDeleteWpqrId] = useState(null);

  // Approval
  const [approvingId, setApprovingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { id }
  const [rejectReason, setRejectReason] = useState("");

  // ?? Load companies ??

  const loadCompanies = useCallback(async () => {
    try {
      const res = await apiService.getCompanies({ limit: 500 });
      setCompanies(res.companies || res.data || []);
    } catch {
      // non bloccante
    }
  }, []);

  const handleCompanyScopeChange = useCallback((newId) => {
    setCompanyScopeId(newId);
    persistQualificationsCompanyScope(newId);
    setWpsPage(1);
    setWpqrPage(1);
  }, []);

  // ?? Load WPQR stats 

  const loadWPQRStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (companyScopeId) params.company_id = companyScopeId;
      const res = await apiService.getWPQRStats(params);
      setWpqrStats(res.data || null);
    } catch {
      // non bloccante
    } finally {
      setStatsLoading(false);
    }
  }, [companyScopeId]);

  // ?? Load WPS ??

  const loadWPS = useCallback(async () => {
    setWpsLoading(true);
    setError(null);
    try {
      const params = { page: wpsPage, limit: LIMIT };
      if (wpsFilters.welding_process) params.welding_process = wpsFilters.welding_process;
      if (wpsFilters.status) params.status = wpsFilters.status;
      if (wpsFilters.search) params.search = wpsFilters.search;
      if (companyScopeId) params.company_id = companyScopeId;

      const res = await apiService.getWPSList(params);
      setWpsList(res.data || []);
      setWpsTotal(res.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setWpsLoading(false);
    }
  }, [wpsPage, wpsFilters, companyScopeId]);

  const loadAllWps = useCallback(async () => {
    try {
      const params = { limit: 500 };
      if (companyScopeId) params.company_id = companyScopeId;
      const res = await apiService.getWPSList(params);
      setAllWps(res.data || []);
    } catch {
      // non bloccante
    }
  }, [companyScopeId]);

  // ?? Load WPQR ?

  const loadWPQR = useCallback(async () => {
    setWpqrLoading(true);
    setError(null);
    try {
      const params = { page: wpqrPage, limit: LIMIT };
      if (wpqrFilterWpsId) params.wps_id = wpqrFilterWpsId;
      if (wpqrFilters.approval_status) params.approval_status = wpqrFilters.approval_status;
      if (wpqrFilters.search) params.search = wpqrFilters.search;
      if (companyScopeId) params.company_id = companyScopeId;

      const res = await apiService.getWPQRList(params);
      setWpqrList(res.data || []);
      setWpqrTotal(res.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setWpqrLoading(false);
    }
  }, [wpqrPage, wpqrFilterWpsId, wpqrFilters, companyScopeId]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);
  useEffect(() => { loadWPQRStats(); }, [loadWPQRStats]);
  useEffect(() => { loadWPS(); }, [loadWPS]);
  useEffect(() => { loadAllWps(); }, [loadAllWps]);
  useEffect(() => {
    if (activeTab === "wpqr") loadWPQR();
  }, [activeTab, loadWPQR]);

  // ?? WPS handlers ?

  function handleNewWps()       { setEditingWps(null); setWpsFormOpen(true); }
  function handleEditWps(w)     { setEditingWps(w);    setWpsFormOpen(true); }
  function handleWpsSaved()     { setWpsFormOpen(false); setEditingWps(null); loadWPS(); loadAllWps(); }

  async function handleDeleteWps(id) {
    try {
      await apiService.deleteWPS(id);
      setDeleteWpsId(null);
      loadWPS();
      loadAllWps();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleViewWpqrForWps(wpsId) {
    setWpqrFilterWpsId(String(wpsId));
    setWpqrPage(1);
    setActiveTab("wpqr");
  }

  // ?? WPQR handlers ??

  function handleNewWpqr()      { setEditingWpqr(null); setWpqrFormOpen(true); }
  function handleEditWpqr(w)    { setEditingWpqr(w);    setWpqrFormOpen(true); }
  function handleWpqrSaved()    { setWpqrFormOpen(false); setEditingWpqr(null); loadWPQR(); loadWPS(); loadWPQRStats(); }

  async function handleDeleteWpqr(id) {
    try {
      await apiService.deleteWPQR(id);
      setDeleteWpqrId(null);
      loadWPQR();
      loadWPQRStats();
    } catch (err) {
      setError(err.message);
    }
  }

  function handleGoToWps() {
    setActiveTab("wps");
  }

  async function handleApproveWpqr(id) {
    setApprovingId(id);
    try {
      await apiService.approveWPQR(id);
      loadWPQR();
      loadWPQRStats();
    } catch (err) {
      setError(err.message);
    } finally {
      setApprovingId(null);
    }
  }

  async function handleRejectWpqr() {
    if (!rejectModal) return;
    try {
      await apiService.rejectWPQR(rejectModal.id, rejectReason);
      setRejectModal(null);
      setRejectReason("");
      loadWPQR();
      loadWPQRStats();
    } catch (err) {
      setError(err.message);
    }
  }

  // ?? Pagination 

  const wpsTotalPages  = Math.max(1, Math.ceil(wpsTotal  / LIMIT));
  const wpqrTotalPages = Math.max(1, Math.ceil(wpqrTotal / LIMIT));

  // ?? Stats semaphore helpers ??
  const stats = wpqrStats || {};
  const statsItems = [
    { label: "Valide",         value: stats.valide        || 0, color: "#16a34a" },
    { label: "Scad. 60 gg",    value: stats.in_scadenza_60 || 0, color: "#d97706" },
    { label: "Scad. 30 gg",    value: stats.in_scadenza_30 || 0, color: "#ea580c" },
    { label: "Scadute",        value: stats.scadute        || 0, color: "#dc2626" },
    { label: "Da approvare",   value: stats.da_approvare   || 0, color: "#6b7280" },
  ];

  // ?? Render ?

  return (
    <div className="wp-page">
      {/* Header */}
      <div className="wp-header">
        <div>
          <h2 className="wp-title">Procedure di Saldatura</h2>
          <p className="wp-subtitle">Gestione WPS e WPQR {"\u2014"} ISO 3834 / EN ISO 15614</p>
        </div>
        <div className="wp-header-actions">
          {activeTab === "wps" && (
            <WpsUploadButton
              companyId={companyScopeId}
              companyName={companyScopeName}
              onUploadComplete={() => { loadWPS(); }}
            />
          )}
          {activeTab === "wpqr" && (
            <WpqrUploadButton
              companyId={companyScopeId}
              companyName={companyScopeName}
              onUploadComplete={() => { loadWPQR(); loadWPQRStats(); }}
            />
          )}
          <button className="wp-btn-new" onClick={activeTab === "wps" ? handleNewWps : handleNewWpqr}>
            + {activeTab === "wps" ? "Nuova WPS" : "Nuovo WPQR"}
          </button>
        </div>
      </div>

      {/* Company scope */}
      <div className="wp-company-scope">
        <label className="wp-company-scope-label">Azienda:</label>
        <select
          className="wp-select"
          value={companyScopeId}
          onChange={(e) => handleCompanyScopeChange(e.target.value)}
          style={{ minWidth: 200 }}
        >
          <option value="">Tutte le aziende</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {companyScopeId && (
          <button className="wp-link" onClick={() => handleCompanyScopeChange("")}>
            Mostra tutte
          </button>
        )}
      </div>

      {/* Stats semaphore WPQR */}
      {!statsLoading && wpqrStats && (
        <div className="wp-stats-bar">
          {statsItems.map((s) => (
            <div key={s.label} className="wp-stat-item">
              <span className="wp-stat-dot" style={{ background: s.color }} />
              <span className="wp-stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="wp-stat-label">{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="wp-tabs">
        <button className={`wp-tab${activeTab === "wps" ? " active" : ""}`} onClick={() => setActiveTab("wps")}>
          WPS ({wpsTotal})
        </button>
        <button className={`wp-tab${activeTab === "wpqr" ? " active" : ""}`} onClick={() => { setActiveTab("wpqr"); }}>
          WPQR ({wpqrTotal})
        </button>
      </div>

      {error && (
        <div className="wp-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>&times;</button>
        </div>
      )}

      {/*  TAB WPS  */}
      {activeTab === "wps" && (
        <>
          <div className="wp-toolbar">
            <input
              className="wp-search"
              type="text"
              placeholder="Cerca codice WPS, materiale..."
              value={wpsFilters.search}
              onChange={(e) => { setWpsFilters((f) => ({ ...f, search: e.target.value })); setWpsPage(1); }}
            />
            <select
              className="wp-select"
              value={wpsFilters.welding_process}
              onChange={(e) => { setWpsFilters((f) => ({ ...f, welding_process: e.target.value })); setWpsPage(1); }}
            >
              <option value="">Tutti i processi</option>
              {WELDING_PROCESSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <select
              className="wp-select"
              value={wpsFilters.status}
              onChange={(e) => { setWpsFilters((f) => ({ ...f, status: e.target.value })); setWpsPage(1); }}
            >
              <option value="">Tutti gli stati</option>
              {WPS_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <button className="wp-btn-reload" onClick={loadWPS} title="Aggiorna">&#x21bb;</button>
            <AskAiButton
              label="Chiedi all\u2019AI"
              onBeforeNavigate={() => saveQualContext({
                qualType: "wps",
                qualTypeLabel: "procedure WPS",
                companyName: companyScopeName || null,
                companyId: companyScopeId || null,
              })}
            />
          </div>

          <div className="wp-table-wrap">
            {wpsLoading ? (
              <div className="wp-loading"><div className="wp-spinner" /><span>Caricamento...</span></div>
            ) : wpsList.length === 0 ? (
              <div className="wp-empty">
                <span className="wp-empty-icon">&#x1F527;</span>
                <p>Nessuna WPS trovata.</p>
                <button className="wp-btn-new" onClick={handleNewWps} style={{ marginTop: 12 }}>Crea la prima WPS</button>
              </div>
            ) : (
              <table className="wp-table">
                <thead>
                  <tr>
                    <th>Codice WPS</th>
                    <th>Rev.</th>
                    <th>Processo</th>
                    <th>Materiale</th>
                    <th>Giunto</th>
                    <th>Posizioni</th>
                    <th>Spessore</th>
                    <th>Stato</th>
                    <th>WPQR</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {wpsList.map((w) => (
                    <tr key={w.id}>
                      <td><strong>{w.wps_code}</strong></td>
                      <td>{w.revision || "-"}</td>
                      <td>{WELDING_PROCESSES.find((p) => p.value === w.welding_process)?.label || w.welding_process || "-"}</td>
                      <td>{w.material_group || "-"}</td>
                      <td>{w.joint_type || "-"}</td>
                      <td>{w.position || "-"}</td>
                      <td>
                        {w.thickness_range_min != null || w.thickness_range_max != null
                          ? `${w.thickness_range_min ?? "?"} - ${w.thickness_range_max ?? "?"} mm`
                          : "-"}
                      </td>
                      <td><StatusBadge status={w.status} /></td>
                      <td>
                        <span className="wp-wpqr-count" onClick={() => handleViewWpqrForWps(w.id)} title="Vedi WPQR collegati">
                          {w.wpqr_count || 0} WPQR
                        </span>
                      </td>
                      <td>
                        {deleteWpsId === w.id ? (
                          <div className="wp-confirm">
                            <span>Eliminare?</span>
                            <button className="wp-confirm-yes" onClick={() => handleDeleteWps(w.id)}>Si</button>
                            <button className="wp-confirm-no" onClick={() => setDeleteWpsId(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <button className="wp-btn-icon" title="Modifica" onClick={() => handleEditWps(w)}>&#x270F;&#xFE0F;</button>
                            <button className="wp-btn-icon" title="Elimina" onClick={() => setDeleteWpsId(w.id)}>&#x1F5D1;&#xFE0F;</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {wpsTotalPages > 1 && (
            <div className="wp-pagination">
              <button disabled={wpsPage === 1} onClick={() => setWpsPage((p) => p - 1)}>&laquo; Prec</button>
              <span>Pag. {wpsPage} / {wpsTotalPages} &mdash; {wpsTotal} WPS</span>
              <button disabled={wpsPage === wpsTotalPages} onClick={() => setWpsPage((p) => p + 1)}>Succ &raquo;</button>
            </div>
          )}
        </>
      )}

      {/* TAB WPQR */}
      {activeTab === "wpqr" && (
        <>
          <div className="wp-toolbar">
            <input
              className="wp-search"
              type="text"
              placeholder="Cerca codice WPQR, ente..."
              value={wpqrFilters.search}
              onChange={(e) => { setWpqrFilters((f) => ({ ...f, search: e.target.value })); setWpqrPage(1); }}
            />
            <select
              className="wp-select"
              value={wpqrFilterWpsId}
              onChange={(e) => { setWpqrFilterWpsId(e.target.value); setWpqrPage(1); }}
            >
              <option value="">Tutte le WPS</option>
              {allWps.map((w) => (
                <option key={w.id} value={w.id}>{w.wps_code}{w.revision ? ` (Rev. ${w.revision})` : ""}</option>
              ))}
            </select>
            <select
              className="wp-select"
              value={wpqrFilters.approval_status}
              onChange={(e) => { setWpqrFilters((f) => ({ ...f, approval_status: e.target.value })); setWpqrPage(1); }}
            >
              <option value="">Tutti gli stati</option>
              <option value="bozza">Bozza</option>
              <option value="approvata">Approvata</option>
              <option value="rifiutata">Rifiutata</option>
            </select>
            {(wpqrFilterWpsId || wpqrFilters.approval_status || wpqrFilters.search) && (
              <button className="wp-link" onClick={() => { setWpqrFilterWpsId(""); setWpqrFilters({ approval_status: "", search: "", wps_id: "" }); setWpqrPage(1); }}>
                Azzera filtri
              </button>
            )}
            <button className="wp-btn-reload" onClick={() => { loadWPQR(); loadWPQRStats(); }} title="Aggiorna">&#x21bb;</button>
          </div>

          <div className="wp-table-wrap">
            {wpqrLoading ? (
              <div className="wp-loading"><div className="wp-spinner" /><span>Caricamento...</span></div>
            ) : wpqrList.length === 0 ? (
              <div className="wp-empty">
                <span className="wp-empty-icon">&#x1F4CB;</span>
                <p>Nessun WPQR trovato.</p>
                <button className="wp-btn-new" onClick={handleNewWpqr} style={{ marginTop: 12 }}>Crea il primo WPQR</button>
              </div>
            ) : (
              <table className="wp-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Rif. WPQR</th>
                    <th>WPS rif.</th>
                    <th>Processo</th>
                    <th>Spessore range</th>
                    <th>Data prova</th>
                    <th>Ente</th>
                    <th>Scadenza</th>
                    <th>Approvazione</th>
                    <th>Cert.</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {wpqrList.map((wq) => (
                    <tr key={wq.id}>
                      <td><SemaforoDot expiry_date={wq.expiry_date} approvalStatus={wq.approval_status} /></td>
                      <td><strong>{wq.reference_number || wq.wpqr_code || "-"}</strong></td>
                      <td>
                        {wq.wps_code ? (
                          <span className="wp-link" onClick={() => handleGoToWps()}>
                            {wq.wps_code}
                          </span>
                        ) : "-"}
                      </td>
                      <td>{wq.welding_process || wq.wps_welding_process || "-"}</td>
                      <td>
                        {wq.thickness_min != null && wq.thickness_max != null
                          ? `${wq.thickness_min} \u2013 ${wq.thickness_max} mm`
                          : "-"}
                      </td>
                      <td>{wq.test_date ? formatDate(wq.test_date) : "-"}</td>
                      <td>{wq.examiner_body || wq.testing_body || "-"}</td>
                      <td>{wq.expiry_date ? formatDate(wq.expiry_date) : "-"}</td>
                      <td><ApprovalBadge approvalStatus={wq.approval_status} /></td>
                      <td>
                        {wq.certificate_file_url
                          ? <a href={wq.certificate_file_url} target="_blank" rel="noopener noreferrer" title="Apri certificato PDF">{"\uD83D\uDCC4"}</a>
                          : <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td>
                        {deleteWpqrId === wq.id ? (
                          <div className="wp-confirm">
                            <span>Eliminare?</span>
                            <button className="wp-confirm-yes" onClick={() => handleDeleteWpqr(wq.id)}>S{"\u00ec"}</button>
                            <button className="wp-confirm-no" onClick={() => setDeleteWpqrId(null)}>No</button>
                          </div>
                        ) : (
                          <div className="wp-actions-cell">
                            {(!wq.approval_status || wq.approval_status === "bozza" || wq.approval_status === "rifiutata") && (
                              <button
                                className="wp-btn-approve"
                                title="Approva"
                                disabled={approvingId === wq.id}
                                onClick={() => handleApproveWpqr(wq.id)}
                              >{approvingId === wq.id ? "..." : "\u2714"}</button>
                            )}
                            {(!wq.approval_status || wq.approval_status === "bozza" || wq.approval_status === "approvata") && (
                              <button
                                className="wp-btn-reject"
                                title="Rifiuta"
                                onClick={() => { setRejectModal({ id: wq.id }); setRejectReason(""); }}
                              >{"\u2716"}</button>
                            )}
                            <button className="wp-btn-icon" title="Modifica" onClick={() => handleEditWpqr(wq)}>&#x270F;&#xFE0F;</button>
                            <button className="wp-btn-icon" title="Elimina" onClick={() => setDeleteWpqrId(wq.id)}>&#x1F5D1;&#xFE0F;</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {wpqrTotalPages > 1 && (
            <div className="wp-pagination">
              <button disabled={wpqrPage === 1} onClick={() => setWpqrPage((p) => p - 1)}>&laquo; Prec</button>
              <span>Pag. {wpqrPage} / {wpqrTotalPages} &mdash; {wpqrTotal} WPQR</span>
              <button disabled={wpqrPage === wpqrTotalPages} onClick={() => setWpqrPage((p) => p + 1)}>Succ &raquo;</button>
            </div>
          )}
        </>
      )}

      {/* Modali */}
      {wpsFormOpen && (
        <WPSFormModal
          wps={editingWps}
          defaultCompanyId={companyScopeId || null}
          onSave={handleWpsSaved}
          onClose={() => { setWpsFormOpen(false); setEditingWps(null); }}
        />
      )}
      {wpqrFormOpen && (
        <WPQRFormModal
          wpqr={editingWpqr}
          wpsList={allWps}
          defaultCompanyId={companyScopeId || null}
          onSave={handleWpqrSaved}
          onClose={() => { setWpqrFormOpen(false); setEditingWpqr(null); }}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="wp-modal-overlay" onClick={() => setRejectModal(null)}>
          <div className="wp-modal wp-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="wp-modal-header">
              <h3>Rifiuta WPQR</h3>
              <button className="wp-modal-close" onClick={() => setRejectModal(null)}>&times;</button>
            </div>
            <div className="wp-modal-body">
              <label className="wp-form-label">Motivazione rifiuto</label>
              <textarea
                className="wp-form-textarea"
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Descrivere il motivo del rifiuto..."
              />
            </div>
            <div className="wp-modal-footer">
              <button type="button" className="wp-btn-cancel" onClick={() => setRejectModal(null)}>Annulla</button>
              <button type="button" className="wp-btn-save wp-btn-danger" onClick={handleRejectWpqr}>Rifiuta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default WeldingProceduresPage;
