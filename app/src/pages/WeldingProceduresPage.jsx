/**
 * WeldingProceduresPage  -  Gestione WPS e WPQR
 * Modulo Saldatura ISO 3834  -  Mason-ready
 *
 * Due tab: WPS (Welding Procedure Specifications) e WPQR (Qualification Records).
 * Navigazione bidirezionale: da WPS vedi i WPQR collegati, da WPQR torni alla WPS.
 * Company scope, stats semaphore, approval workflow, batch upload WPQR.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import apiService from "../services/apiService";
import { useCompanyScope } from "../contexts/CompanyScopeContext";
import { useAuthOptional } from "../contexts/AuthContext";
import DiscrepancyNotices from "../components/DiscrepancyNotices";
import { numericCompanyScopeId } from "../utils/appCompanyScope";
import { formatDate } from "../utils/dateHelpers";
import WpqrUploadButton from "../components/WpqrUploadButton";
import WpsUploadButton from "../components/WpsUploadButton";
import WpqrTestRunsSection from "../components/WpqrTestRunsSection";
import AskAiButton from "../components/AskAiButton";
import { getProcessSelectOptions, getProcessLabel, canonicalizeProcessValue } from "../utils/weldingProcessSelect";
import ReprocessQueueBanner from "../components/ReprocessQueueBanner";
import {
  saveQualContext,
  consumeWpsGenerateIntent,
  MASON_WPS_GENERATE_DEFAULTS,
} from "../utils/aiAssistantContext";
import { exportWpsAnnexADocx, pickWpqrTestRuns } from "../utils/wordExportWps";
import { ProtectedFileLink } from "../components/ProtectedFile";
import WeldSketchPicker, { WpqrSketchReview } from "../components/WeldSketchPicker";
import {
  isIso14555,
  describeQualifiedParentThicknessRange14555,
} from "../data/weldingQualificationRules14555";
import "./WeldingProceduresPage.css";

/** Valori select norma WPQR (più «altro» free-text). */
const WPQR_STANDARD_OPTIONS = [
  "UNI EN ISO 15614-1:2017",
  "UNI EN ISO 15614-2:2025",
  "UNI EN ISO 14555:2025",
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
    da_rivedere: { cls: "wp-approval wp-approval-da_rivedere", label: "Da rivedere" },
  };
  const { cls, label } = map[approvalStatus] || map.bozza;
  return <span className={cls}>{label}</span>;
}

function SemaforoDot({ approvalStatus }) {
  if (approvalStatus === "da_rivedere") {
    return <span className="wp-sem wp-sem-ambra" title="Da rivedere" />;
  }
  if (approvalStatus && approvalStatus !== "approvata") {
    return <span className="wp-sem wp-sem-grigio" title="Non approvata" />;
  }
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

function WPSFormModal({ wps, defaultCompanyId, onSave, onClose, onSaved }) {
  const [form, setForm] = useState({
    wps_code: "", revision: "", welding_process: "", material_group: "",
    filler_material: "", shielding_gas: "", joint_type: "", position: "",
    thickness_range_min: "", thickness_range_max: "", pipe_diameter_min: "",
    pipe_diameter_max: "", throat_mm: "",
    preheat_temp: "", interpass_temp: "", pwht: "",
    qualification_standard: "", status: "bozza", notes: "",
    // company_id: ereditato dall'azienda selezionata nel selettore scope
    company_id: defaultCompanyId || null,
    ...(wps || {}),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const savedIdRef    = useRef(wps?.id || null);
  const isFirstRender = useRef(true);
  const autoSaveTimer = useRef(null);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  // Auto-save con debounce 800ms
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!form.wps_code?.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      setSaving(true);
      setAutoSaveStatus('saving');
      setError(null);
      try {
        if (savedIdRef.current) {
          await apiService.updateWPS(savedIdRef.current, form);
        } else {
          const res = await apiService.createWPS(form);
          savedIdRef.current = res?.data?.id || null;
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
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
  }

  return (
    <div className="wp-modal-overlay">
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-modal-header">
          <h3>{wps?.id ? "Modifica WPS" : "Nuova WPS"}</h3>
          {autoSaveStatus === 'saving' && <span className="autosave-status saving">{"Salvataggio\u2026"}</span>}
          {autoSaveStatus === 'saved'  && <span className="autosave-status saved">{"\u2713 Salvato"}</span>}
          {autoSaveStatus === 'error'  && <span className="autosave-status error">{"\u26A0 Errore salvataggio"}</span>}
          <button className="wp-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={e => e.preventDefault()}>
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
                <select className="wp-form-select" value={canonicalizeProcessValue(form.welding_process) || ""} onChange={(e) => set("welding_process", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  {getProcessSelectOptions(form.welding_process).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
                <label className="wp-form-label">Diametro tubo max (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" value={form.pipe_diameter_max || ""} onChange={(e) => set("pipe_diameter_max", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gola a (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" value={form.throat_mm || ""} onChange={(e) => set("throat_mm", e.target.value)} />
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
                <label className="wp-form-label">Riferimento WPQR</label>
                <input className="wp-form-input" value={form.wpqr_ref || ""} onChange={(e) => set("wpqr_ref", e.target.value)} placeholder="es. 24-03390-01" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale padre A</label>
                <input className="wp-form-input" value={form.parent_material_a || ""} onChange={(e) => set("parent_material_a", e.target.value)} placeholder="es. S355" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale padre B</label>
                <input className="wp-form-input" value={form.parent_material_b || ""} onChange={(e) => set("parent_material_b", e.target.value)} placeholder="es. S355" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Apporto termico</label>
                <input className="wp-form-input" value={form.heat_input || ""} onChange={(e) => set("heat_input", e.target.value)} placeholder="es. 0,6–1,3 kJ/mm" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Intervallo corrente</label>
                <input className="wp-form-input" value={form.current_range || ""} onChange={(e) => set("current_range", e.target.value)} placeholder="es. 180–220 A" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Intervallo tensione</label>
                <input className="wp-form-input" value={form.voltage_range || ""} onChange={(e) => set("voltage_range", e.target.value)} placeholder="es. 22–27 V" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Trasferimento di metallo</label>
                <input className="wp-form-input" value={form.metal_transfer || ""} onChange={(e) => set("metal_transfer", e.target.value)} placeholder="es. Spray arc" />
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
            <button type="button" className="wp-btn-save" onClick={onClose} disabled={saving}>
              {saving ? "Salvataggio\u2026" : "Chiudi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Genera WPS da WPQR (P1) ───────────────────────────────────────────────────

async function sketchBufferFromId(id) {
  if (id == null || id === "") return null;
  try {
    const blob = await apiService.getWeldSketchBlob(id);
    const data = new Uint8Array(await blob.arrayBuffer());
    const type = /jpe?g/i.test(blob.type) ? "jpg" : "png";
    return { data, type };
  } catch {
    return null;
  }
}

export async function loadAnnexASketchBuffers(record = {}) {
  const jointId = record.joint_sketch_id;
  const seqId = record.sequence_sketch_id;
  if (!jointId && !seqId) return {};

  const captions = {};
  const metaById = {};
  const wpqrId = record.wpqr_id
    || (Array.isArray(record.wpqr_records) && record.wpqr_records[0] && record.wpqr_records[0].id);
  if (wpqrId && typeof apiService.getWpqrSketches === "function") {
    try {
      const res = await apiService.getWpqrSketches(wpqrId);
      for (const s of (res && res.sketches) || []) {
        if (!s || s.id == null) continue;
        metaById[s.id] = s;
        if (s.dimension_text) captions[s.id] = s.dimension_text;
      }
    } catch { /* caption opzionale */ }
  }

  const attach = async (id) => {
    const buf = await sketchBufferFromId(id);
    if (!buf) return null;
    if (captions[id]) buf.caption = captions[id];
    return buf;
  };
  const isUnsplit = (id) => {
    const m = metaById[id];
    return !!(m && (m.slot === "combined" || m.status === "da dividere"));
  };
  const isJointOnly = (id) => {
    const m = metaById[id];
    if (!m) return false;
    const crop = String(m.crop_bbox_pt || "");
    return m.status === "solo giunto" || crop.includes("solo-giunto");
  };
  const pickSequenceId = (jointSketchId) => {
    const jointMeta = metaById[jointSketchId];
    if (!jointMeta || !jointMeta.crop_bbox_pt) return null;
    const match = Object.values(metaById).find((s) => (
      s.slot === "welding_sequence" && s.crop_bbox_pt === jointMeta.crop_bbox_pt
    ));
    return match ? match.id : null;
  };

  const sameId = jointId && seqId && Number(seqId) === Number(jointId);
  if ((sameId || !seqId) && isJointOnly(jointId)) {
    const joint = await attach(jointId);
    return joint ? { joint, sequencePending: "solo giunto" } : {};
  }
  if ((sameId || !seqId) && isUnsplit(jointId)) {
    const joint = await attach(jointId);
    return joint ? { joint, sequencePending: "da dividere" } : {};
  }
  const resolvedSeqId = (seqId && !sameId) ? seqId : pickSequenceId(jointId);
  const [joint, sequence] = await Promise.all([
    attach(jointId),
    attach(resolvedSeqId),
  ]);
  const out = {};
  if (joint) out.joint = joint;
  if (sequence) out.sequence = sequence;
  else if (joint && isJointOnly(jointId)) out.sequencePending = "solo giunto";
  else if (joint && isUnsplit(jointId)) out.sequencePending = "da dividere";
  return out;
}

export function draftToCreatePayload(draft, companyId, wpsCode) {
  const pipe = draft.pipe_diameter_min != null
    ? draft.pipe_diameter_min
    : (draft.pipe_diameter_mm != null ? draft.pipe_diameter_mm : null);
  const pipeMax = draft.pipe_diameter_max != null
    ? draft.pipe_diameter_max
    : (draft.pipe_diameter_mm != null ? draft.pipe_diameter_mm : null);
  return {
    company_id: companyId || null,
    wps_code: wpsCode,
    revision: "0",
    welding_process: draft.welding_process || null,
    material_group: draft.material_group || null,
    filler_material: draft.filler_material || null,
    shielding_gas: draft.shielding_gas || null,
    joint_type: draft.joint_type || null,
    position: draft.position || draft.welding_positions || null,
    welding_positions: draft.welding_positions || draft.position || null,
    thickness_range_min: draft.thickness_range_min != null ? draft.thickness_range_min : null,
    thickness_range_max: draft.thickness_range_max != null ? draft.thickness_range_max : null,
    pipe_diameter_min: pipe,
    pipe_diameter_max: pipeMax,
    pipe_diameter_mm: draft.pipe_diameter_mm != null ? draft.pipe_diameter_mm : null,
    throat_mm: draft.throat_mm != null ? draft.throat_mm : null,
    preheat_temp: draft.preheat_temp || null,
    interpass_temp: draft.interpass_temp || null,
    pwht: draft.pwht || null,
    qualification_standard: draft.qualification_standard || "ISO 15614-1",
    wpqr_id: draft.wpqr_id != null ? draft.wpqr_id : null,
    wpqr_ref: draft.wpqr_ref || null,
    parent_material_a: draft.parent_material_a || null,
    parent_material_b: draft.parent_material_b || null,
    heat_input: draft.heat_input || null,
    current_range: draft.current_range || null,
    voltage_range: draft.voltage_range || null,
    metal_transfer: draft.metal_transfer || null,
    joint_preparation: draft.joint_preparation || null,
    cleaning_method: draft.cleaning_method || null,
    mechanization: draft.mechanization || null,
    shielding_gas_flow_l_min_min: draft.shielding_gas_flow_l_min_min != null
      ? draft.shielding_gas_flow_l_min_min : null,
    shielding_gas_flow_l_min_max: draft.shielding_gas_flow_l_min_max != null
      ? draft.shielding_gas_flow_l_min_max : null,
    post_heating: draft.post_heating || null,
    pwht_details: draft.pwht_details || null,
    bead_technique: draft.bead_technique || null,
    contact_tube_distance_mm_min: draft.contact_tube_distance_mm_min != null
      ? draft.contact_tube_distance_mm_min : null,
    contact_tube_distance_mm_max: draft.contact_tube_distance_mm_max != null
      ? draft.contact_tube_distance_mm_max : null,
    torch_angle_deg: draft.torch_angle_deg != null ? draft.torch_angle_deg : null,
    joint_sketch_id: draft.joint_sketch_id != null ? draft.joint_sketch_id : null,
    sequence_sketch_id: draft.sequence_sketch_id != null ? draft.sequence_sketch_id : null,
    status: "bozza",
    notes: draft.wpqr_ref
      ? `Generata da WPQR ${draft.wpqr_ref}`
      : "Bozza generata da WPQR (ISO 15614-1)",
  };
}

/**
 * Modal generazione WPS da WPQR (caso Mason precompilabile).
 * Esportato per test Vitest.
 */
export function GenerateWpsModal({
  defaultCompanyId,
  initialValues,
  onSaved,
  onClose,
}) {
  const defaults = { ...MASON_WPS_GENERATE_DEFAULTS, ...(initialValues || {}) };
  const [form, setForm] = useState({
    joint_type: defaults.joint_type || "FW",
    parent_material_a: defaults.parent_material_a || "",
    parent_material_b: defaults.parent_material_b || "",
    thickness_a_mm: defaults.thickness_a_mm != null ? String(defaults.thickness_a_mm) : "",
    thickness_b_mm: defaults.thickness_b_mm != null ? String(defaults.thickness_b_mm) : "",
    welding_process: defaults.welding_process || "",
    pipe_diameter_mm: defaults.pipe_diameter_mm != null ? String(defaults.pipe_diameter_mm) : "",
    throat_mm: defaults.throat_mm != null ? String(defaults.throat_mm) : "",
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [wpsCode, setWpsCode] = useState("");
  const [sketchPick, setSketchPick] = useState({
    joint_sketch_id: null,
    sequence_sketch_id: null,
  });

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  async function handleGenerate(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        joint_type: form.joint_type,
        parent_material_a: form.parent_material_a.trim(),
        parent_material_b: form.parent_material_b.trim(),
        thickness_a_mm: Number(form.thickness_a_mm),
        thickness_b_mm: Number(form.thickness_b_mm),
      };
      if (form.welding_process) payload.welding_process = form.welding_process;
      if (form.pipe_diameter_mm !== "") payload.pipe_diameter_mm = Number(form.pipe_diameter_mm);
      if (form.joint_type === "FW" && form.throat_mm !== "") payload.throat_mm = Number(form.throat_mm);
      if (defaultCompanyId) payload.company_id = defaultCompanyId;

      const res = await apiService.generateWPS(payload);
      setResult(res);
      const sug = res.sketch_suggestions || {};
      const ownCombined = (sug.combined || []).find((s) => s.score === 100);
      const ownJoint = (sug.joint_design || []).find((s) => s.score === 100);
      const ownSeq = (sug.welding_sequence || []).find((s) => s.score === 100);
      if (ownJoint || ownSeq) {
        setSketchPick({
          joint_sketch_id: ownJoint ? ownJoint.id : null,
          sequence_sketch_id: ownSeq ? ownSeq.id : null,
        });
      } else if (ownCombined) {
        setSketchPick({ joint_sketch_id: ownCombined.id, sequence_sketch_id: null });
      } else {
        setSketchPick({ joint_sketch_id: null, sequence_sketch_id: null });
      }
      if (res.wps_draft) {
        const jt = res.wps_draft.joint_type || form.joint_type || "GEN";
        const ma = form.parent_material_a.trim() || "A";
        const mb = form.parent_material_b.trim() || "B";
        setWpsCode(`WPS-${jt}-${ma}-${mb}`);
      }
    } catch (err) {
      setError(err?.data?.error || err.message || "Errore generazione WPS");
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveDraft() {
    if (!result?.wps_draft) return;
    if (!wpsCode.trim()) {
      setError("Inserire un codice WPS per salvare la bozza");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiService.createWPS(
        draftToCreatePayload({
          ...result.wps_draft,
          joint_sketch_id: sketchPick.joint_sketch_id,
          sequence_sketch_id: sketchPick.sequence_sketch_id,
        }, defaultCompanyId, wpsCode.trim())
      );
      onSaved();
    } catch (err) {
      setError(err?.data?.error || err.message || "Errore salvataggio bozza");
    } finally {
      setSaving(false);
    }
  }

  const canSave = result && (result.status === "ok" || result.status === "partial") && result.wps_draft;
  const notPossible = result?.status === "not_possible";

  return (
    <div className="wp-modal-overlay" onClick={onClose} data-testid="generate-wps-modal">
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-modal-header">
          <h3>Genera WPS da WPQR</h3>
          <button type="button" className="wp-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleGenerate}>
          <div className="wp-modal-body">
            {error && <div className="wp-error">{error}</div>}
            {!defaultCompanyId && (
              <div className="wp-warn-no-company">
                {"\u26A0\uFE0F Seleziona un\u2019azienda nell\u2019Ambito in alto per filtrare le WPQR."}
              </div>
            )}
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo giunto *</label>
                <select
                  className="wp-form-select"
                  value={form.joint_type}
                  onChange={(e) => set("joint_type", e.target.value)}
                  required
                  data-testid="gen-joint-type"
                >
                  <option value="FW">FW - A filetto</option>
                  <option value="BW">BW - Testa a testa</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Processo (opzionale)</label>
                <select
                  className="wp-form-select"
                  value={canonicalizeProcessValue(form.welding_process)}
                  onChange={(e) => set("welding_process", e.target.value)}
                >
                  <option value="">-- Qualsiasi --</option>
                  {getProcessSelectOptions(form.welding_process).map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale A *</label>
                <input
                  className="wp-form-input"
                  value={form.parent_material_a}
                  onChange={(e) => set("parent_material_a", e.target.value)}
                  placeholder="es. S355"
                  required
                  data-testid="gen-mat-a"
                />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale B *</label>
                <input
                  className="wp-form-input"
                  value={form.parent_material_b}
                  onChange={(e) => set("parent_material_b", e.target.value)}
                  placeholder="es. S235"
                  required
                  data-testid="gen-mat-b"
                />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore A (mm) *</label>
                <input
                  className="wp-form-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.thickness_a_mm}
                  onChange={(e) => set("thickness_a_mm", e.target.value)}
                  required
                  data-testid="gen-thick-a"
                />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore B (mm) *</label>
                <input
                  className="wp-form-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.thickness_b_mm}
                  onChange={(e) => set("thickness_b_mm", e.target.value)}
                  required
                  data-testid="gen-thick-b"
                />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Diametro tubo (mm)</label>
                <input
                  className="wp-form-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.pipe_diameter_mm}
                  onChange={(e) => set("pipe_diameter_mm", e.target.value)}
                  placeholder="Solo per giunti su tubo"
                  data-testid="gen-pipe-diameter"
                />
              </div>
              {form.joint_type === "FW" && (
                <div className="wp-form-group">
                  <label className="wp-form-label">Gola richiesta (mm)</label>
                  <input
                    className="wp-form-input"
                    type="number"
                    step="0.1"
                    min="0"
                    value={form.throat_mm}
                    onChange={(e) => set("throat_mm", e.target.value)}
                    placeholder="Solo giunti FW — Tabella 8 ISO 15614-1"
                    data-testid="gen-throat"
                  />
                </div>
              )}
            </div>

            {result && canSave && (
              <div className="wp-gen-preview" data-testid="gen-preview-ok">
                <p className="wp-gen-status">
                  Esito: <strong>{result.status === "ok" ? "Copertura OK" : "Copertura parziale"}</strong>
                  {result.wpqr_used?.wpqr_code
                    ? ` — WPQR ${result.wpqr_used.wpqr_code}`
                    : ""}
                </p>
                {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                  <ul className="wp-gen-warnings">
                    {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                <div className="wp-form-grid" style={{ marginTop: 12 }}>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Codice WPS bozza *</label>
                    <input
                      className="wp-form-input"
                      value={wpsCode}
                      onChange={(e) => setWpsCode(e.target.value)}
                      data-testid="gen-wps-code"
                    />
                  </div>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Processo</label>
                    <input className="wp-form-input" readOnly value={result.wps_draft.welding_process || "-"} />
                  </div>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Gruppo materiale</label>
                    <input className="wp-form-input" readOnly value={result.wps_draft.material_group || "-"} />
                  </div>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Giunto</label>
                    <input className="wp-form-input" readOnly value={result.wps_draft.joint_type || "-"} />
                  </div>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Spessore min–max</label>
                    <input
                      className="wp-form-input"
                      readOnly
                      value={`${result.wps_draft.thickness_range_min ?? "?"} – ${result.wps_draft.thickness_range_max ?? "?"} mm`}
                    />
                  </div>
                  <div className="wp-form-group">
                    <label className="wp-form-label">Norma</label>
                    <input className="wp-form-input" readOnly value={result.wps_draft.qualification_standard || "-"} />
                  </div>
                  {result.wps_draft.pipe_diameter_mm != null && (
                    <div className="wp-form-group">
                      <label className="wp-form-label">Diametro tubo richiesto</label>
                      <input className="wp-form-input" readOnly value={`${result.wps_draft.pipe_diameter_mm} mm`} />
                    </div>
                  )}
                  {result.wps_draft.throat_mm != null && (
                    <div className="wp-form-group">
                      <label className="wp-form-label">Gola richiesta</label>
                      <input className="wp-form-input" readOnly value={`${result.wps_draft.throat_mm} mm`} />
                    </div>
                  )}
                </div>
                <WeldSketchPicker
                  suggestions={result.sketch_suggestions || {}}
                  selectedJointId={sketchPick.joint_sketch_id}
                  selectedSequenceId={sketchPick.sequence_sketch_id}
                  companyId={defaultCompanyId}
                  jointType={result.wps_draft.joint_type || form.joint_type}
                  onChange={(next) => setSketchPick({
                    joint_sketch_id: next.joint_sketch_id,
                    sequence_sketch_id: next.sequence_sketch_id,
                  })}
                />
              </div>
            )}

            {notPossible && (
              <div className="wp-gen-not-possible" data-testid="gen-preview-not-possible">
                <p className="wp-gen-status">
                  <strong>WPS non realizzabile</strong> con le WPQR disponibili nell&apos;ambito.
                </p>
                <p>Estensioni necessarie:</p>
                <ul>
                  {(result.extensions_needed || []).map((ext, i) => (
                    <li key={i}>{ext}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="wp-modal-footer">
            <button type="button" className="wp-btn-cancel" onClick={onClose}>Annulla</button>
            {!canSave && (
              <button type="submit" className="wp-btn-save" disabled={loading}>
                {loading ? "Calcolo..." : "Genera"}
              </button>
            )}
            {canSave && (
              <>
                <button
                  type="button"
                  className="wp-btn-cancel"
                  onClick={() => { setResult(null); setError(null); }}
                >
                  Modifica parametri
                </button>
                <button
                  type="button"
                  className="wp-btn-save"
                  disabled={saving}
                  onClick={handleSaveDraft}
                  data-testid="gen-save-draft"
                >
                  {saving ? "Salvataggio..." : "Salva bozza"}
                </button>
              </>
            )}
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

/**
 * STUD-3-B: su ISO 14555 non applicare Tabella 7 / calc 15614.
 * §10.2.8.6 — tutti gli spessori se pWPS applicabile → range aperto.
 */
function calcThicknessRangeForStandard(t, standardReference) {
  if (isIso14555(standardReference)) {
    const r = describeQualifiedParentThicknessRange14555({ pWpsApplies: true });
    if (r.allThicknesses) {
      return {
        thickness_min: "",
        thickness_max: "",
        thickness_max_unlimited: true,
      };
    }
    return { thickness_min: "", thickness_max: "", thickness_max_unlimited: false };
  }
  return { ...calcThicknessRangeUI(t), thickness_max_unlimited: false };
}

/** Payload di salvataggio: la pWPS è testo. Nessun wps_id. */
export function buildWpqrSavePayload(form, scopeCompanyId) {
  const companyText = numericCompanyScopeId(scopeCompanyId)
    || numericCompanyScopeId(form && form.company_id);
  const payload = { ...(form || {}) };
  delete payload.wps_id;
  delete payload.wps_code;
  delete payload.wps_company_id;
  delete payload.linked_wps_id;
  delete payload.linked_wps_code;
  delete payload.company_name;
  delete payload.discrepancy_notices;
  delete payload.open_notice_count;
  delete payload.effective_approval_status;
  delete payload.conformity_verified;
  payload.company_id = companyText ? Number(companyText) : null;
  payload.wps_ref = payload.wps_ref ? String(payload.wps_ref).trim() : null;
  return payload;
}

function WPQRFormModal({ wpqr, defaultCompanyId, onSave, onClose, onSaved }) {
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const savedIdRef    = useRef(wpqr?.id || null);
  const isFirstRender = useRef(true);
  const autoSaveTimer = useRef(null);
  const seeded = { ...(wpqr || {}) };
  delete seeded.wps_id;
  delete seeded.wps_code;
  delete seeded.wps_company_id;
  delete seeded.linked_wps_id;
  const [form, setForm] = useState({
    wpqr_code: "", test_date: "", testing_body: "", examiner_body: "",
    welder_name: "", welding_process: "", base_material_group: "", welding_positions: "",
    thickness_tested: "", thickness_min: "", thickness_max: "", thickness_max_unlimited: false,
    thickness_t1_min: "", thickness_t1_max: "", thickness_t1_max_unlimited: false,
    thickness_t2_min: "", thickness_t2_max: "", thickness_t2_max_unlimited: false,
    diameter_min: "", diameter_max: "", filler_material: "",
    qualification_level: "", joint_type: "", standard_reference: "", wps_ref: "",
    vt_result: "NA", rt_result: "NA", ut_result: "NA", mt_result: "NA", pt_result: "NA",
    tensile_result: "NA", bend_result: "NA", impact_result: "NA", hardness_result: "NA",
    macro_result: "NA", issue_date: "", certificate_number: "", notes: "",
    // Parametri prova avanzati (pag.2 del verbale) — prima estratti solo dall'AI,
    // invisibili/non correggibili qui (gap segnalato dal committente 08/08/2026).
    base_material_spec: "", shielding_gas: "", current_type: "", metal_transfer: "",
    mechanization: "", single_multi_run: "", heat_input_note: "",
    preheat_temp: "", interpass_temp: "", pwht: false,
    // Estensioni copertura ISO 15614-1 (throat/piastra-tubo) — stesso motivo.
    throat_test_mm: "", product_type: "", rotated_position: false,
    // STUD-1: stud/prigioniero + Parent Metal 2
    qualifying_element: "", base_material_group_2: "", base_material_spec_2: "",
    material_group_range: "", fillet_throat_range: "",
    ...seeded,
    company_id: numericCompanyScopeId(defaultCompanyId)
      ? Number(numericCompanyScopeId(defaultCompanyId))
      : (numericCompanyScopeId(seeded.company_id) ? Number(numericCompanyScopeId(seeded.company_id)) : null),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notices, setNotices] = useState(() => wpqr?.discrepancy_notices || []);
  const [noticeBusy, setNoticeBusy] = useState(null);
  const previewGen = useRef(0);
  const resolutionsRef = useRef(
    (wpqr?.discrepancy_notices || [])
      .filter((n) => n.status && n.status !== "aperto")
      .map((n) => ({
        rule_code: n.code,
        fingerprint: n.fingerprint,
        status: n.status,
        note: n.note || null,
      })),
  );
  const auth = useAuthOptional();
  const canWrite = !!(auth && typeof auth.canWriteModule === "function" && auth.canWriteModule(form.company_id));
  const canAct = canWrite && !!savedIdRef.current;
  const lockedTitle = canWrite
    ? "Salva la WPQR prima di registrare l'azione"
    : "Sola lettura: non puoi confermare, correggere o segnalare l'avviso";

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  useEffect(() => {
    if (typeof apiService.previewWpqrNotices !== "function") return undefined;
    const gen = previewGen.current + 1;
    previewGen.current = gen;
    const timer = setTimeout(async () => {
      try {
        const res = await apiService.previewWpqrNotices({
          record: form,
          runs: wpqr?.test_runs || form.test_runs || [],
          resolutions: resolutionsRef.current,
        });
        if (previewGen.current === gen) setNotices(res?.data?.discrepancy_notices || []);
      } catch {
        /* l'ultimo elenco resta visibile */
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form, wpqr]);

  function focusNoticeField(field) {
    if (!field) return;
    const el = document.querySelector(`[data-wpqr-field="${field}"]`);
    if (el && typeof el.focus === "function") el.focus();
  }

  async function handleNoticeAction(notice, action) {
    const id = savedIdRef.current;
    if (!id || typeof apiService.actWpqrNotice !== "function") return;
    previewGen.current += 1;
    setNoticeBusy(notice.code);
    setError(null);
    try {
      const res = await apiService.actWpqrNotice(id, { action, rule_code: notice.code });
      const row = res?.data;
      if (row?.discrepancy_notices) {
        setNotices(row.discrepancy_notices);
        resolutionsRef.current = row.discrepancy_notices
          .filter((n) => n.status && n.status !== "aperto")
          .map((n) => ({
            rule_code: n.code,
            fingerprint: n.fingerprint,
            status: n.status,
            note: n.note || null,
          }));
      }
      onSaved?.();
    } catch (err) {
      setError(err?.message || "Azione sull'avviso non registrata.");
    } finally {
      setNoticeBusy(null);
    }
  }
  const isStudJoint = String(form.joint_type || "").toUpperCase() === "SW";
  const diameterLabelMin = isStudJoint
    ? "Diametro prigioniero - min (mm)"
    : "Diametro tubo - min (mm)";
  const diameterLabelMax = isStudJoint
    ? "Diametro prigioniero - max (mm)"
    : "Diametro tubo - max (mm)";
  const diameterPlaceholder = isStudJoint
    ? "es. 51 (D₁ prigioniero)"
    : "lascia vuoto se testata su piastra";

  function handleThicknessTested(val) {
    setForm((f) => {
      const range = calcThicknessRangeForStandard(val, f.standard_reference);
      if (isIso14555(f.standard_reference)) {
        return {
          ...f,
          thickness_tested: val,
          thickness_min: range.thickness_min,
          thickness_max: range.thickness_max,
          thickness_max_unlimited: !!range.thickness_max_unlimited,
        };
      }
      return {
        ...f,
        thickness_tested: val,
        thickness_min: range.thickness_min !== "" ? range.thickness_min : f.thickness_min,
        thickness_max: range.thickness_max !== "" ? range.thickness_max : f.thickness_max,
      };
    });
  }

  const uses14555 = isIso14555(form.standard_reference);
  const thicknessRangeLabel = uses14555
    ? "ISO 14555 \u00A710.2.8.6 (tutti gli spessori)"
    : "ISO 15614";

  const creatingWithoutCompany = !wpqr?.id && !numericCompanyScopeId(defaultCompanyId);

  // Auto-save con debounce 800ms. Senza azienda il create è rifiutato: non chiamare l'API.
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    if (!form.wpqr_code?.trim()) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      const payload = buildWpqrSavePayload(form, defaultCompanyId);
      if (!savedIdRef.current && payload.company_id == null) return;
      setSaving(true);
      setAutoSaveStatus('saving');
      setError(null);
      try {
        if (savedIdRef.current) {
          await apiService.updateWPQR(savedIdRef.current, payload);
        } else {
          const res = await apiService.createWPQR(payload);
          savedIdRef.current = res?.data?.id || null;
        }
        if (savedIdRef.current && typeof apiService.getWPQR === "function") {
          try {
            const fresh = await apiService.getWPQR(savedIdRef.current);
            if (fresh?.data?.discrepancy_notices) {
              setNotices(fresh.data.discrepancy_notices);
              resolutionsRef.current = fresh.data.discrepancy_notices
                .filter((n) => n.status && n.status !== "aperto")
                .map((n) => ({
                  rule_code: n.code,
                  fingerprint: n.fingerprint,
                  status: n.status,
                  note: n.note || null,
                }));
            }
          } catch {
            /* il salvataggio è già andato a buon fine */
          }
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
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
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
    <div className="wp-modal-overlay">
      <div className="wp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="wp-modal-header">
          <h3>{wpqr?.id ? "Modifica WPQR" : "Nuovo WPQR"}</h3>
          {autoSaveStatus === 'saving' && <span className="autosave-status saving">{"Salvataggio\u2026"}</span>}
          {autoSaveStatus === 'saved'  && <span className="autosave-status saved">{"\u2713 Salvato"}</span>}
          {autoSaveStatus === 'error'  && <span className="autosave-status error">{"\u26A0 Errore salvataggio"}</span>}
          <button className="wp-modal-close" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={e => e.preventDefault()}>
          <div className="wp-modal-body">
            {error && <div className="wp-error">{error}</div>}
            <DiscrepancyNotices
              notices={notices}
              canAct={canAct}
              canCorrect={canWrite}
              lockedTitle={lockedTitle}
              busyCode={noticeBusy}
              onAction={handleNoticeAction}
              onFocusField={focusNoticeField}
            />
            {creatingWithoutCompany && (
              <div className="wp-warn-no-company">
                {"\u26A0\uFE0F Seleziona un\u2019azienda nell\u2019Ambito in alto prima di creare una WPQR."}
              </div>
            )}
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">pWPS di riferimento</label>
                <input className="wp-form-input" value={form.wps_ref || ""} onChange={(e) => set("wps_ref", e.target.value)} placeholder="es. 002p_24 rev.0" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Codice WPQR</label>
                <input className="wp-form-input" data-wpqr-field="wpqr_code" value={form.wpqr_code || ""} onChange={(e) => set("wpqr_code", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Data prova</label>
                <input className="wp-form-input" type="date" value={form.test_date ? form.test_date.substring(0, 10) : ""} onChange={(e) => set("test_date", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Ente / esaminatore</label>
                <input className="wp-form-input" data-wpqr-field="testing_body" value={form.testing_body || ""} onChange={(e) => set("testing_body", e.target.value)} placeholder="es. TÜV, IIS - ISSCERT, Bureau Veritas" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Saldatore</label>
                <input className="wp-form-input" value={form.welder_name || ""} onChange={(e) => set("welder_name", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">N. Certificato</label>
                <input className="wp-form-input" data-wpqr-field="certificate_number" value={form.certificate_number || ""} onChange={(e) => set("certificate_number", e.target.value)} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Data emissione</label>
                <input className="wp-form-input" type="date" value={form.issue_date ? form.issue_date.substring(0, 10) : ""} onChange={(e) => set("issue_date", e.target.value)} />
              </div>
            </div>

            <div className="wp-form-section-title">Parametri tecnici</div>
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">Norma riferimento</label>
                <select
                  className="wp-form-select"
                  data-wpqr-field="standard_reference"
                  value={
                    !form.standard_reference
                      ? ""
                      : WPQR_STANDARD_OPTIONS.includes(form.standard_reference)
                        ? form.standard_reference
                        : form.standard_reference === "altro"
                          ? "altro"
                          : "altro"
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "UNI EN ISO 14555:2025") {
                      const range = calcThicknessRangeForStandard(form.thickness_tested, v);
                      setForm((f) => ({
                        ...f,
                        standard_reference: v,
                        thickness_min: range.thickness_min,
                        thickness_max: range.thickness_max,
                        thickness_max_unlimited: !!range.thickness_max_unlimited,
                      }));
                      return;
                    }
                    set("standard_reference", v);
                  }}
                >
                  <option value="">-- Seleziona --</option>
                  <option value="UNI EN ISO 15614-1:2017">UNI EN ISO 15614-1:2017 — Acciai / nichel</option>
                  <option value="UNI EN ISO 15614-2:2025">UNI EN ISO 15614-2:2025 — Alluminio</option>
                  <option value="UNI EN ISO 14555:2025">UNI EN ISO 14555:2025 — Stud welding</option>
                  <option value="altro">Altro</option>
                </select>
                {form.standard_reference === "altro" || (form.standard_reference && !["", ...WPQR_STANDARD_OPTIONS, "altro"].includes(form.standard_reference)) ? (
                  <input
                    className="wp-form-input"
                    style={{ marginTop: 6 }}
                    value={form.standard_reference === "altro" ? "" : (form.standard_reference || "")}
                    onChange={(e) => set("standard_reference", e.target.value || "altro")}
                    placeholder="Es. UNI EN ISO 15614-2:2016"
                  />
                ) : null}
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
                <select className="wp-form-select" value={canonicalizeProcessValue(form.welding_process) || ""} onChange={(e) => set("welding_process", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  {getProcessSelectOptions(form.welding_process).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo di giunto</label>
                <select className="wp-form-select" data-wpqr-field="joint_type" value={form.joint_type || ""} onChange={(e) => set("joint_type", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="BW">BW - Testa a testa</option>
                  <option value="FW">FW - Angolare</option>
                  <option value="BW+FW">BW+FW - Entrambi</option>
                  <option value="SW">SW - Stud / prigioniero</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Elemento che si qualifica</label>
                <select className="wp-form-select" value={form.qualifying_element || ""} onChange={(e) => set("qualifying_element", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="base">Base (Parent Metal 1)</option>
                  <option value="stud">Prigioniero / stud</option>
                  <option value="both">Entrambi</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gruppo materiale Parent Metal 1 (ISO/TR 15608)</label>
                <input className="wp-form-input" data-wpqr-field="base_material_group" value={form.base_material_group || ""} onChange={(e) => set("base_material_group", e.target.value)} placeholder="es. 1.1, 2, 8" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Campo di validità gruppi</label>
                <input className="wp-form-input" data-wpqr-field="material_group_range" value={form.material_group_range || ""} onChange={(e) => set("material_group_range", e.target.value)} placeholder="es. 1.1-1.2 oppure 1-1" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gruppo materiale Parent Metal 2</label>
                <input className="wp-form-input" value={form.base_material_group_2 || ""} onChange={(e) => set("base_material_group_2", e.target.value)} placeholder="es. 1.2 (prigioniero) — opzionale" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Posizioni saldatura (ISO 6947)</label>
                <input className="wp-form-input" value={form.welding_positions || ""} onChange={(e) => set("welding_positions", e.target.value)} placeholder="es. PA, PB, PC, PF" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Materiale d'apporto</label>
                <input className="wp-form-input" data-wpqr-field="filler_material" value={form.filler_material || ""} onChange={(e) => set("filler_material", e.target.value)} placeholder="es. G 42 4 M21 4Si1" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Range d&apos;angolo (mm)</label>
                <input className="wp-form-input" data-wpqr-field="fillet_throat_range" value={form.fillet_throat_range || ""} onChange={(e) => set("fillet_throat_range", e.target.value)} placeholder="es. 6-24" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore testato (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_tested || ""} onChange={(e) => handleThicknessTested(e.target.value)} placeholder="es. 10" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">{`Range min (mm) — ${thicknessRangeLabel}`}</label>
                <input
                  className="wp-form-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.thickness_min || ""}
                  onChange={(e) => set("thickness_min", e.target.value)}
                  placeholder={uses14555 ? "tutti (14555 §10.2.8.6)" : "calcolato automaticamente"}
                />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">{`Range max (mm) — ${thicknessRangeLabel}`}</label>
                <input
                  className="wp-form-input"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.thickness_max || ""}
                  onChange={(e) => set("thickness_max", e.target.value)}
                  placeholder={uses14555 ? "illimitato se pWPS applica" : "calcolato automaticamente"}
                  disabled={!!form.thickness_max_unlimited}
                />
              </div>
              <div className="wp-form-group wp-form-checkbox">
                <label className="wp-form-label">
                  <input type="checkbox" checked={!!form.thickness_max_unlimited} onChange={(e) => set("thickness_max_unlimited", e.target.checked)} />
                  {" "}Nessun limite superiore dichiarato
                </label>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">t1 minimo (mm) — FW spessori diversi</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_t1_min || ""} onChange={(e) => set("thickness_t1_min", e.target.value)} placeholder="es. 3" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">t1 massimo (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_t1_max || ""} onChange={(e) => set("thickness_t1_max", e.target.value)} disabled={!!form.thickness_t1_max_unlimited} placeholder="es. 50" />
              </div>
              <div className="wp-form-group wp-form-checkbox">
                <label className="wp-form-label">
                  <input type="checkbox" checked={!!form.thickness_t1_max_unlimited} onChange={(e) => set("thickness_t1_max_unlimited", e.target.checked)} />
                  {" "}t1 senza limite superiore
                </label>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">t2 minimo (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_t2_min || ""} onChange={(e) => set("thickness_t2_min", e.target.value)} placeholder="es. 3" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">t2 massimo (mm)</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.thickness_t2_max || ""} onChange={(e) => set("thickness_t2_max", e.target.value)} disabled={!!form.thickness_t2_max_unlimited} placeholder="es. 30" />
              </div>
              <div className="wp-form-group wp-form-checkbox">
                <label className="wp-form-label">
                  <input type="checkbox" checked={!!form.thickness_t2_max_unlimited} onChange={(e) => set("thickness_t2_max_unlimited", e.target.checked)} />
                  {" "}t2 senza limite superiore
                </label>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo prodotto testato</label>
                <select className="wp-form-select" value={form.product_type || ""} onChange={(e) => set("product_type", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="P">P - Piastra</option>
                  <option value="T">T - Tubo</option>
                  <option value="P+T">P+T - Piastra e tubo (entrambi)</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">{diameterLabelMin}</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.diameter_min || ""} onChange={(e) => set("diameter_min", e.target.value)} placeholder={diameterPlaceholder} />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">{diameterLabelMax}</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.diameter_max || ""} onChange={(e) => set("diameter_max", e.target.value)} placeholder={diameterPlaceholder} />
              </div>
              <div className="wp-form-group wp-form-checkbox">
                <label className="wp-form-label">
                  <input type="checkbox" checked={!!form.rotated_position} onChange={(e) => set("rotated_position", e.target.checked)} />
                  {" "}Posizione tubo ruotato (PF/PA ruotata)
                </label>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Spessore gola provino (mm) — solo giunti FW</label>
                <input className="wp-form-input" type="number" step="0.1" min="0" value={form.throat_test_mm || ""} onChange={(e) => set("throat_test_mm", e.target.value)} placeholder="Tabella 8 ISO 15614-1" />
              </div>
            </div>

            <div className="wp-form-section-title">Parametri prova avanzati (pag.2 verbale)</div>
            <div className="wp-form-grid">
              <div className="wp-form-group">
                <label className="wp-form-label">Specifica materiale Parent Metal 1 / base</label>
                <input className="wp-form-input" value={form.base_material_spec || ""} onChange={(e) => set("base_material_spec", e.target.value)} placeholder="es. S355J2+N" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Specifica materiale Parent Metal 2 / prigioniero</label>
                <input className="wp-form-input" value={form.base_material_spec_2 || ""} onChange={(e) => set("base_material_spec_2", e.target.value)} placeholder="es. S235J2H — opzionale" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Gas di protezione</label>
                <input className="wp-form-input" value={form.shielding_gas || ""} onChange={(e) => set("shielding_gas", e.target.value)} placeholder="es. M20, Ar 92% CO2 8%" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tipo corrente</label>
                <input className="wp-form-input" value={form.current_type || ""} onChange={(e) => set("current_type", e.target.value)} placeholder="es. DC-EP" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Trasferimento metallo</label>
                <input className="wp-form-input" value={form.metal_transfer || ""} onChange={(e) => set("metal_transfer", e.target.value)} placeholder="es. Short arc, Spray arc" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Grado meccanizzazione</label>
                <select className="wp-form-select" value={form.mechanization || ""} onChange={(e) => set("mechanization", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="manual">Manuale</option>
                  <option value="partly_mechanized">Parzialmente meccanizzata</option>
                  <option value="mechanized">Meccanizzata</option>
                  <option value="automatic">Automatica</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Tecnica passata</label>
                <select className="wp-form-select" value={form.single_multi_run || ""} onChange={(e) => set("single_multi_run", e.target.value)}>
                  <option value="">-- Seleziona --</option>
                  <option value="single">Mono-passata</option>
                  <option value="multi">Multi-passata</option>
                </select>
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Temperatura preriscaldo (Tp)</label>
                <input className="wp-form-input" value={form.preheat_temp || ""} onChange={(e) => set("preheat_temp", e.target.value)} placeholder="es. min 100 °C" />
              </div>
              <div className="wp-form-group">
                <label className="wp-form-label">Temperatura interpass (Ti)</label>
                <input className="wp-form-input" value={form.interpass_temp || ""} onChange={(e) => set("interpass_temp", e.target.value)} placeholder="es. max 250 °C" />
              </div>
              <div className="wp-form-group full">
                <label className="wp-form-label">Note apporto termico</label>
                <input className="wp-form-input" value={form.heat_input_note || ""} onChange={(e) => set("heat_input_note", e.target.value)} placeholder="es. ±25% rispetto al valore qualificato" />
              </div>
              <div className="wp-form-group wp-form-checkbox">
                <label className="wp-form-label">
                  <input type="checkbox" checked={!!form.pwht} onChange={(e) => set("pwht", e.target.checked)} />
                  {" "}PWHT (trattamento termico post-saldatura)
                </label>
              </div>
            </div>

            <WpqrSketchReview wpqrId={savedIdRef.current} />

            <div className="wp-form-section-title">Passate di prova (pag.2 verbale)</div>
            <WpqrTestRunsSection
              wpqrId={savedIdRef.current}
              standardReference={form.standard_reference}
            />

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
            <button type="button" className="wp-btn-save" onClick={onClose} disabled={saving}>
              {saving ? "Salvataggio\u2026" : "Chiudi"}
            </button>
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
  const { companyId: companyScopeId, scopeCompanyName: companyScopeName } = useCompanyScope();
  // Tutto lo studio ("") e Patrimonio ("studio") non sono un company_id.
  const listCompanyId = numericCompanyScopeId(companyScopeId);
  const [activeTab, setActiveTab] = useState("wps");
  /** P2b: upload PDF WPS non e' piu' il flusso primario — visibile solo su richiesta. */
  const [showLegacyWpsUpload, setShowLegacyWpsUpload] = useState(false);

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
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateInitial, setGenerateInitial] = useState(null);
  const [wpqrFormOpen, setWpqrFormOpen] = useState(false);
  const [editingWpqr, setEditingWpqr] = useState(null);

  // Delete confirm
  const [deleteWpsId, setDeleteWpsId] = useState(null);
  const [deleteWpqrId, setDeleteWpqrId] = useState(null);
  const [exportingWpsId, setExportingWpsId] = useState(null);

  // Approval
  const [approvingId, setApprovingId] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { id }
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    setWpsPage(1);
    setWpqrPage(1);
  }, [listCompanyId]);

  // ?? Load WPQR stats 

  const loadWPQRStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (listCompanyId) params.company_id = listCompanyId;
      const res = await apiService.getWPQRStats(params);
      setWpqrStats(res.data || null);
    } catch {
      // non bloccante
    } finally {
      setStatsLoading(false);
    }
  }, [listCompanyId]);

  // ?? Load WPS ??

  const loadWPS = useCallback(async () => {
    setWpsLoading(true);
    setError(null);
    try {
      const params = { page: wpsPage, limit: LIMIT };
      if (wpsFilters.welding_process) params.welding_process = wpsFilters.welding_process;
      if (wpsFilters.status) params.status = wpsFilters.status;
      if (wpsFilters.search) params.search = wpsFilters.search;
      if (listCompanyId) params.company_id = listCompanyId;

      const res = await apiService.getWPSList(params);
      setWpsList(res.data || []);
      setWpsTotal(res.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setWpsLoading(false);
    }
  }, [wpsPage, wpsFilters, listCompanyId]);

  const loadAllWps = useCallback(async () => {
    try {
      const params = { limit: 500 };
      if (listCompanyId) params.company_id = listCompanyId;
      const res = await apiService.getWPSList(params);
      setAllWps(res.data || []);
    } catch {
      // non bloccante
    }
  }, [listCompanyId]);

  // ?? Load WPQR ?

  const loadWPQR = useCallback(async () => {
    setWpqrLoading(true);
    setError(null);
    try {
      const params = { page: wpqrPage, limit: LIMIT };
      if (wpqrFilterWpsId) params.wps_id = wpqrFilterWpsId;
      if (wpqrFilters.approval_status) params.approval_status = wpqrFilters.approval_status;
      if (wpqrFilters.search) params.search = wpqrFilters.search;
      if (listCompanyId) params.company_id = listCompanyId;

      const res = await apiService.getWPQRList(params);
      setWpqrList(res.data || []);
      setWpqrTotal(res.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setWpqrLoading(false);
    }
  }, [wpqrPage, wpqrFilterWpsId, wpqrFilters, listCompanyId]);

  useEffect(() => { loadWPQRStats(); }, [loadWPQRStats]);
  useEffect(() => { loadWPS(); }, [loadWPS]);
  useEffect(() => { loadAllWps(); }, [loadAllWps]);
  // Il conteggio del tab deve essere vero anche mentre è aperto l'altro tab.
  useEffect(() => { loadWPQR(); }, [loadWPQR]);

  // Chip AskAi / deep-link: apri Genera WPS precompilato (caso Mason)
  useEffect(() => {
    const intent = consumeWpsGenerateIntent();
    if (!intent) return;
    setActiveTab("wps");
    setGenerateInitial(intent);
    setGenerateOpen(true);
  }, []);

  // ?? WPS handlers ?

  function handleNewWps()       { setEditingWps(null); setWpsFormOpen(true); }
  function handleGenerateWps()  {
    setGenerateInitial({ ...MASON_WPS_GENERATE_DEFAULTS });
    setGenerateOpen(true);
  }
  function handleEditWps(w)     { setEditingWps(w);    setWpsFormOpen(true); }
  function handleWpsSaved()     { setWpsFormOpen(false); setEditingWps(null); loadWPS(); loadAllWps(); }
  function handleGenerateSaved() {
    setGenerateOpen(false);
    setGenerateInitial(null);
    loadWPS();
    loadAllWps();
  }

  async function handleExportWps(w) {
    if (!w?.wps_code) return;
    setExportingWpsId(w.id);
    setError(null);
    try {
      let record = w;
      let testRuns = [];
      try {
        const detail = await apiService.getWPS(w.id);
        if (detail?.data) record = detail.data;
      } catch { /* lista già sufficiente per i campi di testata */ }
      const linked = Array.isArray(record.wpqr_records) ? record.wpqr_records[0] : null;
      if (linked?.id) {
        try {
          const tr = await apiService.getWpqrTestRuns(linked.id);
          testRuns = pickWpqrTestRuns(tr);
        } catch { /* tabella passate resta vuota */ }
      }
      if (!testRuns.length) testRuns = pickWpqrTestRuns(record);
      if (!testRuns.length && linked) testRuns = pickWpqrTestRuns(linked);
      const sketches = await loadAnnexASketchBuffers(record);
      await exportWpsAnnexADocx(record, {
        companyName: record.company_name || w.company_name || companyScopeName || "",
        wpqrCode: linked?.wpqr_code || linked?.reference_number || "",
        testRuns,
        sketches,
      });
    } catch (err) {
      setError(err?.message || "Errore export Word WPS");
    } finally {
      setExportingWpsId(null);
    }
  }

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

  // Stats WPQR: solo card cliccabili su approval_status (nessuna scadenza
  // calendario — ISO 15614/15613/14555). Tendina rimossa in DEPUTYTASK4.
  const stats = wpqrStats || {};
  const approvalStatCards = [
    { label: "Da approvare", value: stats.da_approvare || 0, color: "#6b7280", statusValue: "bozza" },
    { label: "Da rivedere",  value: stats.da_rivedere  || 0, color: "#d97706", statusValue: "da_rivedere" },
    { label: "Approvate",    value: stats.approvate     || 0, color: "#16a34a", statusValue: "approvata" },
    { label: "Rifiutate",    value: stats.rifiutate     || 0, color: "#dc2626", statusValue: "rifiutata" },
  ];

  function handleWpqrApprovalCardClick(statusValue) {
    setWpqrFilters((f) => ({ ...f, approval_status: f.approval_status === statusValue ? "" : statusValue }));
    setWpqrPage(1);
  }

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
            <button type="button" className="wp-btn-generate" onClick={handleGenerateWps}>
              Genera WPS
            </button>
          )}
          <button className="wp-btn-new" onClick={activeTab === "wps" ? handleNewWps : handleNewWpqr}>
            + {activeTab === "wps" ? "Nuova WPS" : "Nuovo WPQR"}
          </button>
          {activeTab === "wpqr" && (
            <WpqrUploadButton
              companyId={companyScopeId}
              companyName={companyScopeName}
              onUploadComplete={() => { loadWPQR(); loadWPQRStats(); }}
            />
          )}
          {activeTab === "wps" && (
            <button
              type="button"
              className="wp-btn-legacy"
              onClick={() => setShowLegacyWpsUpload((v) => !v)}
              title="Import PDF WPS gia' esistenti (flusso secondario)"
              aria-expanded={showLegacyWpsUpload}
            >
              {showLegacyWpsUpload ? "Nascondi import PDF" : "Import PDF (legacy)"}
            </button>
          )}
        </div>
      </div>

      <ReprocessQueueBanner module="saldatura" />

      {activeTab === "wps" && showLegacyWpsUpload && (
        <div className="wp-legacy-upload" data-testid="wps-legacy-upload">
          <p className="wp-legacy-upload-hint">
            Preferisci <strong>Genera WPS</strong> dalle WPQR. L&apos;import PDF serve solo per WPS gia&apos; scritte altrove.
          </p>
          <WpsUploadButton
            companyId={companyScopeId}
            companyName={companyScopeName}
            onUploadComplete={() => { loadWPS(); }}
          />
        </div>
      )}

      {/* Stats semaphore WPQR — solo nel tab WPQR: sono calcolate esclusivamente
          su wpqr_records (vedi getWPQRStats) e non hanno alcun significato
          per l'elenco WPS del tab adiacente. */}
      {activeTab === "wpqr" && !statsLoading && wpqrStats && (
        <div className="wp-stats-bar">
          {approvalStatCards.map((s) => (
            <button
              key={s.label}
              type="button"
              className={`wp-stat-item wp-stat-clickable${wpqrFilters.approval_status === s.statusValue ? " wp-stat-active" : ""}`}
              onClick={() => handleWpqrApprovalCardClick(s.statusValue)}
              title={`Filtra: WPQR ${s.label.toLowerCase()}`}
            >
              <span className="wp-stat-dot" style={{ background: s.color }} />
              <span className="wp-stat-value" style={{ color: s.color }}>{s.value}</span>
              <span className="wp-stat-label">{s.label}</span>
            </button>
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
              {getProcessSelectOptions(wpsFilters.welding_process).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
              label="Chiedi all'AI"
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
                <p className="wp-empty-hint">Parti dalle WPQR: usa <strong>Genera WPS</strong> in alto.</p>
                <button type="button" className="wp-btn-generate" onClick={handleGenerateWps} style={{ marginTop: 12 }}>
                  Genera WPS
                </button>
                <button type="button" className="wp-btn-new" onClick={handleNewWps} style={{ marginTop: 8 }}>
                  Oppure nuova WPS manuale
                </button>
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
                    <tr key={w.id} className="wp-row-click" onClick={() => handleEditWps(w)}>
                      <td><strong>{w.wps_code}</strong></td>
                      <td>{w.revision || "-"}</td>
                      <td>{getProcessLabel(w.welding_process) || "-"}</td>
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
                        <span
                          className="wp-wpqr-count"
                          onClick={(e) => { e.stopPropagation(); handleViewWpqrForWps(w.id); }}
                          title="Vedi WPQR collegati"
                        >
                          {w.wpqr_count || 0} WPQR
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {deleteWpsId === w.id ? (
                          <div className="wp-confirm">
                            <span>Il record va nel cestino. Non è una cancellazione definitiva.</span>
                            <button className="wp-confirm-yes" onClick={() => handleDeleteWps(w.id)}>Si</button>
                            <button className="wp-confirm-no" onClick={() => setDeleteWpsId(null)}>No</button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="wp-btn-icon"
                              title="Esporta Word"
                              disabled={exportingWpsId === w.id}
                              onClick={() => handleExportWps(w)}
                            >
                              {exportingWpsId === w.id ? "…" : "Word"}
                            </button>
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
                    <th>pWPS</th>
                    <th>Processo</th>
                    <th>Spessore range</th>
                    <th>Data prova</th>
                    <th>Ente</th>
                    <th>Approvazione</th>
                    <th>Cert.</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {wpqrList.map((wq) => (
                    <tr key={wq.id} className="wp-row-click" onClick={() => handleEditWpqr(wq)}>
                      <td><SemaforoDot approvalStatus={wq.effective_approval_status || wq.approval_status} /></td>
                      <td>
                        <div className="wp-ref-cell">
                          <strong>{wq.reference_number || wq.wpqr_code || "-"}</strong>
                          {wq.open_notice_count > 0 && (
                            <span className="wp-notice-badge" data-testid="wpqr-notice-badge">
                              {`\u26A0\uFE0F ${wq.open_notice_count}`}
                            </span>
                          )}
                          {wq.effective_approval_status === "da_rivedere" && (
                            <span className="wp-approval wp-approval-da_rivedere">Da rivedere</span>
                          )}
                        </div>
                      </td>
                      <td>{wq.wps_ref || "-"}</td>
                      <td>{wq.welding_process || wq.wps_welding_process || "-"}</td>
                      <td>
                        {wq.thickness_min != null && wq.thickness_max != null
                          ? `${wq.thickness_min} \u2013 ${wq.thickness_max} mm`
                          : "-"}
                      </td>
                      <td>{wq.test_date ? formatDate(wq.test_date) : "-"}</td>
                      <td>{wq.examiner_body || wq.testing_body || "-"}</td>
                      <td><ApprovalBadge approvalStatus={wq.effective_approval_status || wq.approval_status} /></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {wq.certificate_file_url
                          ? <ProtectedFileLink fileUrl={wq.certificate_file_url} kind="wpqr" recordId={wq.id} title="Apri certificato PDF">{"\uD83D\uDCC4"}</ProtectedFileLink>
                          : <span style={{ color: "#9ca3af" }}>-</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        {deleteWpqrId === wq.id ? (
                          <div className="wp-confirm">
                            <span>Il record va nel cestino. Non è una cancellazione definitiva.</span>
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
          onSaved={() => { loadWPS(); loadAllWps(); }}
          onClose={() => { setWpsFormOpen(false); setEditingWps(null); }}
        />
      )}
      {generateOpen && (
        <GenerateWpsModal
          defaultCompanyId={companyScopeId || null}
          initialValues={generateInitial}
          onSaved={handleGenerateSaved}
          onClose={() => { setGenerateOpen(false); setGenerateInitial(null); }}
        />
      )}
      {wpqrFormOpen && (
        <WPQRFormModal
          wpqr={editingWpqr}
          defaultCompanyId={companyScopeId || null}
          onSave={handleWpqrSaved}
          onSaved={() => { loadWPQR(); loadWPS(); loadWPQRStats(); }}
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
