/**
 * QualificationForm — Form creazione/modifica qualifica
 */

import React, { useState, useEffect, useRef } from "react";
import apiService from "../services/apiService";
import { OCCUPATIONAL_QUALIFICATION_TYPES } from "../data/occupationalQualificationTypes";
import { buildWelderDesignation } from "../utils/weldingDesignation";
import { getApplicableWelderFields } from "../data/weldingQualificationRules9606";
import SemiannualConfirmationSection from "../components/SemiannualConfirmationSection";
import "./QualificationForm.css";

const QUAL_TYPES = [
  "Saldatore ISO 9606-1",
  "Saldatore ISO 9606-2",
  "Saldatore EN 15614",
  "Operatore ISO 14732",
  "Coordinatore ISO 14731",
  "Operatore NDT VT Livello 1",
  "Operatore NDT VT Livello 2",
  "Operatore NDT VT Livello 3",
  "Operatore NDT PT Livello 1",
  "Operatore NDT PT Livello 2",
  "Operatore NDT MT Livello 1",
  "Operatore NDT MT Livello 2",
  "Operatore NDT UT Livello 1",
  "Operatore NDT UT Livello 2",
  "Operatore NDT RT Livello 1",
  "Operatore NDT RT Livello 2",
  "Abilitazione PES/PAV (CEI 11-27)",
  "Patentino PES/PAV (CEI 11-27)",
  "Patentino PES (CEI 11-27)",
  "Patentino PAV (CEI 11-27)",
  "Abilitazione carrello elevatore",
  "Abilitazione piattaforma aerea",
  "Corso primo soccorso",
  "Corso antincendio",
  ...OCCUPATIONAL_QUALIFICATION_TYPES,
  "Altra qualifica",
];

const EMPTY = {
  personnel_id: "", person_name: "", person_code: "", department: "",
  company_id: "", qualification_type: "", standard_ref: "",
  scope_detail: "", certificate_number: "", issuing_body: "",
  issue_date: "", expiry_date: "", last_renewal_date: "",
  status: "valida", notes: "",
  welding_process: "", material_group: "", position_range: "",
  ndt_method: "", ndt_level: "",
  coordinator_title: "", cpd_valid_until: "",
  patent_type: "", certification_scheme: "",
  certificate_file_url: "",
  // Saldatore ISO 9606-1 — dettagli e validità
  examiner_body: "", joint_type: "", product_type: "", weld_details: "",
  filler_material: "", shielding_gas: "", equipment_type: "",
  thickness_min_mm: "", thickness_max_mm: "",
  pipe_diameter_min_mm: "", pipe_diameter_max_mm: "",
  exam_date: "", last_confirmation_date: "", next_confirmation_due: "",
  revalidation_date: "", qualification_designation: "",
  // Operatore ISO 14732 (saldatura automatica/meccanizzata)
  welding_type: "", single_multi_run: "", qualification_method: "",
};

// Campi obbligatori specifici per i saldatori ISO 9606 (validati su blur/submit).
const WELDER_REQUIRED = {
  welding_process: "Il processo di saldatura \u00e8 obbligatorio.",
  material_group: "Il gruppo materiale \u00e8 obbligatorio.",
  position_range: "Le posizioni qualificate sono obbligatorie.",
  expiry_date: "La data di scadenza \u00e8 obbligatoria.",
};

function QualificationForm({ qualification, onSave, onClose, defaultCompanyId, openSection }) {
  const isEdit  = !!qualification;
  const isRenew = !!qualification?._renew;
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [companies, setCompanies] = useState([]);
  const [personnelList, setPersonnelList] = useState([]);
  const [certFile, setCertFile] = useState(null);
  const [uploadMsg, setUploadMsg] = useState(null);
  const certInputRef = useRef(null);
  // Timestamp di mount: previene ghost-click mobile che chiuderebbe l'overlay
  const openTimeRef = useRef(Date.now());
  const [customType, setCustomType] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  const isWelder9606 = (form.qualification_type || "").includes("9606");
  const isOperator14732 = (form.qualification_type || "").includes("14732");
  // ISO 9606-1 (saldatori manuali) e ISO 14732 (operatori automatica/meccanizzata) condividono
  // lo stesso obbligo di conferma semestrale — vedi weldingCoordinatorAuth.service.js (backend).
  const requiresConfirmation = isWelder9606 || isOperator14732;
  const isApproved = form.approval_status === "approvata" || qualification?.approval_status === "approvata";
  const revalidationLabel = isWelder9606
    ? "Revalidazione (3 anni)"
    : isOperator14732
    ? "Revalidazione (6 anni)"
    : "Revalidazione";
  // Diametro tubo (Tabella 7 ISO 9606-1): pertinente solo se il prodotto testato
  // e' un tubo — vedi getApplicableWelderFields per la motivazione normativa.
  // Vale anche per 14732/15614: stesso concetto di variabile essenziale piastra/tubo.
  const applicableFields = getApplicableWelderFields({ productType: form.product_type });

  useEffect(() => {
    if (applicableFields.pipeDiameterApplicable) return;
    setForm((f) => {
      if ((f.pipe_diameter_min_mm == null || f.pipe_diameter_min_mm === "")
        && (f.pipe_diameter_max_mm == null || f.pipe_diameter_max_mm === "")) return f;
      return { ...f, pipe_diameter_min_mm: "", pipe_diameter_max_mm: "" };
    });
  }, [applicableFields.pipeDiameterApplicable]);

  function validateWelderField(field, value) {
    if (!isWelder9606 || !WELDER_REQUIRED[field]) return null;
    return value == null || String(value).trim() === "" ? WELDER_REQUIRED[field] : null;
  }

  function handleBlur(field) {
    return () => {
      const msg = validateWelderField(field, form[field]);
      setFieldErrors((errs) => {
        const next = { ...errs };
        if (msg) next[field] = msg; else delete next[field];
        return next;
      });
    };
  }

  useEffect(() => {
    apiService.getCompanies?.().then((res) => {
      const list = res?.data || res?.companies || res || [];
      setCompanies(Array.isArray(list) ? list : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (qualification) {
      const d = { ...EMPTY, ...qualification };
      // Normalizza date a YYYY-MM-DD
      ["issue_date","expiry_date","last_renewal_date","cpd_valid_until",
       "exam_date","last_confirmation_date","next_confirmation_due","revalidation_date"].forEach(k => {
        if (d[k]) d[k] = String(d[k]).slice(0, 10);
      });
      d.company_id = d.company_id || "";
      d.personnel_id = d.personnel_id ? String(d.personnel_id) : "";
      setForm(d);
      if (d.qualification_type && !QUAL_TYPES.includes(d.qualification_type)) {
        setCustomType(true);
      }
    } else if (defaultCompanyId) {
      setForm((f) => ({ ...f, company_id: String(defaultCompanyId) }));
    }
  }, [qualification, defaultCompanyId]);

  useEffect(() => {
    const companyId = form.company_id ? parseInt(form.company_id, 10) : null;
    if (!companyId) {
      setPersonnelList([]);
      return;
    }
    apiService.getCompanyPersonnel(companyId, { active: "true" })
      .then((res) => setPersonnelList(res?.data || []))
      .catch(() => setPersonnelList([]));
  }, [form.company_id]);

  function handle(field) {
    return (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      if (field === "company_id") {
        setForm((f) => ({ ...f, company_id: value, personnel_id: "" }));
        return;
      }
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  async function handleSave() {
    if (!form.person_name.trim()) { setError("Il nome della persona \u00e8 obbligatorio."); return; }
    if (!form.qualification_type.trim()) { setError("Il tipo di qualifica \u00e8 obbligatorio."); return; }
    if (!form.company_id) { setError("L'azienda cliente \u00e8 obbligatoria."); return; }
    // Validazione campi obbligatori saldatore (solo su submit, non a ogni keystroke).
    if (isWelder9606) {
      const errs = {};
      Object.keys(WELDER_REQUIRED).forEach((field) => {
        const msg = validateWelderField(field, form[field]);
        if (msg) errs[field] = msg;
      });
      if (Object.keys(errs).length) {
        setFieldErrors(errs);
        setError("Completa i campi obbligatori della saldatura evidenziati.");
        return;
      }
    }
    setSaving(true);
    setError(null);
    setUploadMsg(null);
    try {
      const data = {
        ...form,
        company_id: parseInt(form.company_id, 10),
        personnel_id: form.personnel_id ? parseInt(form.personnel_id, 10) : null,
      };
      let savedId = qualification?.id;
      if (isRenew) {
        const res = await apiService.renewQualification(qualification.id, data);
        savedId = res?.id || res?.data?.id || null;
      } else if (isEdit) {
        await apiService.updateQualification(qualification.id, data);
        savedId = qualification.id;
      } else {
        const res = await apiService.createQualification(data);
        savedId = res?.id || res?.data?.id || null;
      }
      // Upload certificato PDF se selezionato
      if (certFile && savedId) {
        try {
          await apiService.uploadQualificationCertificate(savedId, certFile);
          setUploadMsg("Certificato allegato con successo.");
        } catch (uploadErr) {
          setUploadMsg("\u26A0\uFE0F Qualifica salvata, ma upload certificato fallito: " + uploadErr.message);
        }
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qf-overlay" onClick={e => {
      if (e.target !== e.currentTarget) return;
      if (Date.now() - openTimeRef.current < 350) return;
      onClose();
    }}>
      <div className="qf-modal">
        <div className="qf-header">
          <h3 className="qf-title">{isRenew ? "\u267B\uFE0F Rinnova qualifica" : isEdit ? "\u270F\uFE0F Modifica qualifica" : "+ Nuova qualifica"}</h3>
          <button className="qf-close" onClick={onClose}>&#x2715;</button>
        </div>

        <div className="qf-body">
          {/* Persona */}
          <div className="qf-section-title">Persona</div>
          <div className="qf-row">
            <div className="qf-field qf-flex2">
              <label>Da anagrafica azienda</label>
              <select
                value={form.personnel_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  if (!pid) {
                    setForm((f) => ({ ...f, personnel_id: "" }));
                    return;
                  }
                  const person = personnelList.find((p) => String(p.id) === pid);
                  if (!person) return;
                  setForm((f) => ({
                    ...f,
                    personnel_id: pid,
                    person_name: person.name || "",
                    person_code: person.person_code || f.person_code || "",
                    department: person.job_title || f.department || "",
                  }));
                }}
                disabled={!form.company_id}
              >
                <option value="">-- testo libero / nuovo --</option>
                {personnelList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.person_code ? ` (${p.person_code})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="qf-row">
            <div className="qf-field qf-flex2">
              <label>Nome e cognome <span className="req">*</span></label>
              <input
                type="text"
                value={form.person_name}
                onChange={(e) => {
                  const newName = e.target.value;
                  setForm((f) => {
                    const linked = f.personnel_id
                      ? personnelList.find((p) => String(p.id) === String(f.personnel_id))
                      : null;
                    const keepLink = linked && linked.name === newName.trim();
                    return {
                      ...f,
                      person_name: newName,
                      personnel_id: keepLink ? f.personnel_id : "",
                    };
                  });
                }}
                placeholder="Mario Rossi"
              />
            </div>
            <div className="qf-field">
              <label>Matricola / codice</label>
              <input type="text" value={form.person_code} onChange={handle("person_code")} placeholder="MAT-001" />
            </div>
          </div>
          <div className="qf-row">
            <div className="qf-field">
              <label>Reparto</label>
              <input type="text" value={form.department} onChange={handle("department")} placeholder="Produzione" />
            </div>
            <div className="qf-field">
              <label>Azienda <span className="req">*</span></label>
              <select
                value={form.company_id}
                onChange={handle("company_id")}
              >
                <option value="">-- seleziona azienda --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          {/* Qualifica */}
          <div className="qf-section-title" style={{marginTop: 16}}>Qualifica</div>
          <div className="qf-row">
            <div className="qf-field qf-flex2">
              <label>Tipo qualifica <span className="req">*</span></label>
              {!customType ? (
                <select value={form.qualification_type} onChange={e => {
                  if (e.target.value === "__custom__") { setCustomType(true); setForm(f => ({...f, qualification_type: ""})); }
                  else handle("qualification_type")(e);
                }}>
                  <option value="">-- seleziona --</option>
                  {QUAL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  <option value="__custom__">Altro (digita manualmente...)</option>
                </select>
              ) : (
                <div style={{display:"flex",gap:8}}>
                  <input type="text" value={form.qualification_type} onChange={handle("qualification_type")} placeholder="Tipo qualifica personalizzato" style={{flex:1}} />
                  <button type="button" className="qf-btn-link" onClick={() => { setCustomType(false); setForm(f => ({...f, qualification_type: ""})); }}>lista</button>
                </div>
              )}
            </div>
            <div className="qf-field">
              <label>Norma di riferimento</label>
              <input type="text" value={form.standard_ref} onChange={handle("standard_ref")} placeholder="ISO 9606-1" />
            </div>
          </div>
          <div className="qf-field">
            <label>Ambito / dettaglio</label>
            <input type="text" value={form.scope_detail} onChange={handle("scope_detail")} placeholder="es. MIG/MAG, acciaio al carbonio, 3-40mm" />
          </div>
          <div className="qf-row">
            <div className="qf-field">
              <label>Numero certificato</label>
              <input type="text" value={form.certificate_number} onChange={handle("certificate_number")} />
            </div>
            <div className="qf-field">
              <label>Ente certificatore</label>
              <input type="text" value={form.issuing_body} onChange={handle("issuing_body")} placeholder="IIS, Bureau Veritas, DNV..." />
            </div>
          </div>

          {/* Dettagli saldatura ISO 3834 / 9606-1 (visibili solo per tipi pertinenti) */}
          {(form.qualification_type.includes("9606") || form.qualification_type.includes("14732") || form.qualification_type.includes("15614")) && (
            <>
              <div className="qf-section-title" style={{marginTop: 16}}>Dettagli saldatura</div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Processo (ISO 4063){isWelder9606 && <span className="req"> *</span>}</label>
                  <select value={form.welding_process} onChange={handle("welding_process")} onBlur={handleBlur("welding_process")}>
                    <option value="">-- seleziona --</option>
                    <option value="111">111 — Elettrodo rivestito (MMA)</option>
                    <option value="121">121 — Arco sommerso (SAW)</option>
                    <option value="131">131 — MIG</option>
                    <option value="135">135 — MAG</option>
                    <option value="136">136 — Filo animato (FCAW)</option>
                    <option value="138">138 — Filo animato metallo (MCAW)</option>
                    <option value="141">141 — TIG</option>
                    <option value="145">145 — TIG + filo freddo</option>
                    <option value="15">15 — Plasma (PAW)</option>
                    <option value="311">311 — Ossiacetilenica</option>
                    <option value="altro">Altro</option>
                  </select>
                  {fieldErrors.welding_process && <span className="qf-field-err">{fieldErrors.welding_process}</span>}
                </div>
                <div className="qf-field">
                  <label>Gruppo materiale (ISO/TR 15608){isWelder9606 && <span className="req"> *</span>}</label>
                  <input type="text" value={form.material_group} onChange={handle("material_group")} onBlur={handleBlur("material_group")} placeholder="es. 1.1, 2, 3" />
                  {fieldErrors.material_group && <span className="qf-field-err">{fieldErrors.material_group}</span>}
                </div>
              </div>
              <div className="qf-field">
                <label>Posizioni qualificate{isWelder9606 && <span className="req"> *</span>}</label>
                <input type="text" value={form.position_range} onChange={handle("position_range")} onBlur={handleBlur("position_range")} placeholder="es. PA, PB, PF, H-L045" />
                {fieldErrors.position_range && <span className="qf-field-err">{fieldErrors.position_range}</span>}
              </div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Tipo giunto</label>
                  <select value={form.joint_type} onChange={handle("joint_type")}>
                    <option value="">-- seleziona --</option>
                    <option value="BW">BW — Testa a testa</option>
                    <option value="FW">FW — Angolare</option>
                  </select>
                </div>
                <div className="qf-field">
                  <label>Tipo prodotto</label>
                  <select value={form.product_type} onChange={handle("product_type")}>
                    <option value="">-- seleziona --</option>
                    <option value="P">P — Lamiera / piastra</option>
                    <option value="T">T — Tubo</option>
                  </select>
                </div>
                <div className="qf-field">
                  <label>Gruppo materiale d'apporto</label>
                  <select value={form.filler_material} onChange={handle("filler_material")}>
                    <option value="">-- seleziona --</option>
                    <option value="FM1">FM1</option>
                    <option value="FM2">FM2</option>
                    <option value="FM3">FM3</option>
                    <option value="FM4">FM4</option>
                    <option value="FM5">FM5</option>
                    <option value="FM6">FM6</option>
                    <option value="nessuno">Nessuno (TIG senza apporto)</option>
                  </select>
                </div>
              </div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Spessore min (mm)</label>
                  <input type="number" step="0.1" min="0" value={form.thickness_min_mm} onChange={handle("thickness_min_mm")} placeholder="es. 3" />
                </div>
                <div className="qf-field">
                  <label>Spessore max (mm)</label>
                  <input type="number" step="0.1" min="0" value={form.thickness_max_mm} onChange={handle("thickness_max_mm")} placeholder="es. 20" />
                </div>
                {applicableFields.pipeDiameterApplicable ? (
                  <>
                    <div className="qf-field">
                      <label>Diametro tubo min (mm)</label>
                      <input type="number" step="0.1" min="0" value={form.pipe_diameter_min_mm} onChange={handle("pipe_diameter_min_mm")} placeholder="vuoto = solo lamiera" />
                    </div>
                    <div className="qf-field">
                      <label>Diametro tubo max (mm)</label>
                      <input type="number" step="0.1" min="0" value={form.pipe_diameter_max_mm} onChange={handle("pipe_diameter_max_mm")} placeholder="vuoto = solo lamiera" />
                    </div>
                  </>
                ) : (
                  <div className="qf-field qf-flex2">
                    <label style={{color:"#94a3b8"}}>Diametro tubo</label>
                    <span style={{fontSize:13, color:"#64748b", fontStyle:"italic", padding:"0.5rem 0"}}>
                      Non applicabile — prodotto: Piastra
                    </span>
                  </div>
                )}
              </div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Gas di protezione</label>
                  <input type="text" value={form.shielding_gas} onChange={handle("shielding_gas")} placeholder="es. M21, I1 (ISO 14175)" />
                </div>
                <div className="qf-field">
                  <label>Dettagli giunto</label>
                  <input type="text" value={form.weld_details} onChange={handle("weld_details")} placeholder="es. ss nb, bs, sl, ml, derivazione/branch tubo-piastra" />
                </div>
                <div className="qf-field">
                  <label>Organismo esaminatore</label>
                  <input type="text" value={form.examiner_body} onChange={handle("examiner_body")} placeholder="se diverso dall'ente" />
                </div>
              </div>
              {isOperator14732 && (
                <>
                  <div className="qf-row">
                    <div className="qf-field">
                      <label>Tipo saldatura (ISO 14732)</label>
                      <select value={form.welding_type} onChange={handle("welding_type")}>
                        <option value="">-- seleziona --</option>
                        <option value="automatic">Automatica</option>
                        <option value="mechanized">Meccanizzata</option>
                      </select>
                    </div>
                    <div className="qf-field">
                      <label>Tipo unità/macchina di saldatura</label>
                      <input type="text" value={form.equipment_type} onChange={handle("equipment_type")} placeholder="es. testa SAW, robot MIG/MAG..." />
                    </div>
                    <div className="qf-field">
                      <label>Tecnica passata</label>
                      <select value={form.single_multi_run} onChange={handle("single_multi_run")}>
                        <option value="">-- seleziona --</option>
                        <option value="single">Passata unica</option>
                        <option value="multi">Passate multiple</option>
                      </select>
                    </div>
                  </div>
                  <div className="qf-field">
                    <label>Metodo di qualificazione (§4.1)</label>
                    <select value={form.qualification_method} onChange={handle("qualification_method")}>
                      <option value="">-- seleziona --</option>
                      <option value="iso_15614">ISO 15614 (WPS qualificato)</option>
                      <option value="iso_15613">ISO 15613 (prova di qualificazione)</option>
                      <option value="iso_9606">ISO 9606 (equiparazione saldatore)</option>
                      <option value="production_test">Prova di produzione</option>
                    </select>
                  </div>
                </>
              )}
              {isWelder9606 && (
                <div className="qf-field">
                  <label>Designazione qualifica (calcolata)</label>
                  <input type="text" value={buildWelderDesignation(form)} readOnly tabIndex={-1}
                    style={{background:"#f3f4f6", color:"#374151", fontFamily:"monospace"}}
                    placeholder="Compila processo, giunto, spessore, posizioni..." />
                </div>
              )}
              {requiresConfirmation && !isApproved && (
                <div className="qf-row">
                  <div className="qf-field">
                    <label>Data esame</label>
                    <input type="date" value={form.exam_date} onChange={handle("exam_date")} />
                  </div>
                  <div className="qf-field">
                    <label>Ultima conferma semestrale</label>
                    <input type="date" value={form.last_confirmation_date} onChange={handle("last_confirmation_date")} />
                  </div>
                  <div className="qf-field">
                    <label>Prossima conferma entro</label>
                    <input type="date" value={form.next_confirmation_due} onChange={handle("next_confirmation_due")} />
                  </div>
                  <div className="qf-field">
                    <label>{revalidationLabel}</label>
                    <input type="date" value={form.revalidation_date} onChange={handle("revalidation_date")} />
                  </div>
                </div>
              )}
              {requiresConfirmation && isApproved && (
                <div className="qf-row">
                  <div className="qf-field">
                    <label>Data esame</label>
                    <input type="date" value={form.exam_date} onChange={handle("exam_date")} />
                  </div>
                  <div className="qf-field">
                    <label>{revalidationLabel}</label>
                    <input type="date" value={form.revalidation_date} onChange={handle("revalidation_date")} />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Dettagli NDT ISO 9712 */}
          {form.qualification_type.includes("NDT") && (
            <>
              <div className="qf-section-title" style={{marginTop: 16}}>Dettagli NDT</div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Metodo NDT</label>
                  <select value={form.ndt_method} onChange={handle("ndt_method")}>
                    <option value="">-- seleziona --</option>
                    <option value="VT">VT — Visivo</option>
                    <option value="MT">MT — Magnetico</option>
                    <option value="PT">PT — Liquidi penetranti</option>
                    <option value="UT">UT — Ultrasuoni</option>
                    <option value="RT">RT — Radiografia</option>
                  </select>
                </div>
                <div className="qf-field">
                  <label>Livello</label>
                  <select value={form.ndt_level} onChange={handle("ndt_level")}>
                    <option value="">-- livello --</option>
                    <option value="1">Livello 1</option>
                    <option value="2">Livello 2</option>
                    <option value="3">Livello 3</option>
                  </select>
                </div>
                <div className="qf-field">
                  <label>Schema certificazione</label>
                  <input type="text" value={form.certification_scheme} onChange={handle("certification_scheme")} placeholder="CICPND, PCN, SNT-TC-1A..." />
                </div>
              </div>
            </>
          )}

          {/* Dettagli Coordinatore ISO 14731 */}
          {form.qualification_type.includes("14731") && (
            <>
              <div className="qf-section-title" style={{marginTop: 16}}>Dettagli Coordinatore Saldatura</div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Titolo</label>
                  <select value={form.coordinator_title} onChange={handle("coordinator_title")}>
                    <option value="">-- seleziona --</option>
                    <option value="IWE">IWE — International Welding Engineer</option>
                    <option value="IWT">IWT — International Welding Technologist</option>
                    <option value="IWS">IWS — International Welding Specialist</option>
                    <option value="IWIP">IWIP — International Welding Inspection Personnel</option>
                    <option value="EWE">EWE — European Welding Engineer</option>
                    <option value="EWT">EWT — European Welding Technologist</option>
                    <option value="EWS">EWS — European Welding Specialist</option>
                  </select>
                </div>
                <div className="qf-field">
                  <label>CPD valida fino a</label>
                  <input type="date" value={form.cpd_valid_until} onChange={handle("cpd_valid_until")} />
                </div>
              </div>
            </>
          )}

          {/* Dettagli PES/PAV */}
          {(form.qualification_type.includes("PES") || form.qualification_type.includes("PAV")) && (
            <>
              <div className="qf-section-title" style={{marginTop: 16}}>Dettagli PES/PAV</div>
              <div className="qf-row">
                <div className="qf-field">
                  <label>Tipo abilitazione</label>
                  <input type="text" value={form.patent_type} onChange={handle("patent_type")} placeholder="es. PES, PAV, PES+PAV" />
                </div>
              </div>
            </>
          )}

          {/* Date */}
          <div className="qf-section-title" style={{marginTop: 16}}>Date</div>
          <div className="qf-row">
            <div className="qf-field">
              <label>Data emissione</label>
              <input type="date" value={form.issue_date} onChange={handle("issue_date")} />
            </div>
            <div className="qf-field">
              <label>Data scadenza{isWelder9606 && <span className="req"> *</span>}</label>
              <input type="date" value={form.expiry_date} onChange={handle("expiry_date")} onBlur={handleBlur("expiry_date")} />
              {fieldErrors.expiry_date && <span className="qf-field-err">{fieldErrors.expiry_date}</span>}
            </div>
            <div className="qf-field">
              <label>Ultimo rinnovo</label>
              <input type="date" value={form.last_renewal_date} onChange={handle("last_renewal_date")} />
            </div>
          </div>

          {/* Stato */}
          <div className="qf-row" style={{marginTop: 12}}>
            <div className="qf-field">
              <label>Stato</label>
              <select value={form.status} onChange={handle("status")}>
                <option value="valida">Valida</option>
                <option value="in_scadenza">In scadenza</option>
                <option value="scaduta">Scaduta</option>
                <option value="sospesa">Sospesa</option>
              </select>
            </div>
            <div className="qf-field qf-flex2">
              <label>Note</label>
              <input type="text" value={form.notes} onChange={handle("notes")} placeholder="Note aggiuntive..." />
            </div>
          </div>

          {/* Upload certificato (visibile in modifica/rinnovo) */}
          {(isEdit || isRenew) && (
            <div style={{marginTop: 16}}>
              <div className="qf-section-title">Certificato PDF</div>
              {form.certificate_file_url && (
                <div style={{marginBottom: 6, fontSize: 13}}>
                  <a href={form.certificate_file_url} target="_blank" rel="noopener noreferrer">
                    {"\uD83D\uDCC4"} Visualizza certificato allegato
                  </a>
                </div>
              )}
              <div className="qf-field">
                <label>Allega / sostituisci certificato</label>
                <input ref={certInputRef} type="file" accept="application/pdf,.pdf,image/jpeg,.jpg,.jpeg,image/png,.png"
                  onChange={e => setCertFile(e.target.files?.[0] || null)} />
                {certFile && <span style={{fontSize:12, color:"#555"}}>{certFile.name}</span>}
              </div>
            </div>
          )}
          {uploadMsg && <div className="qf-info" style={{marginTop:8, fontSize:13}}>{uploadMsg}</div>}

          {(isEdit || isRenew) && requiresConfirmation && isApproved && qualification?.id && (
            <SemiannualConfirmationSection
              qualificationId={qualification.id}
              qualificationType={form.qualification_type}
              approvalStatus={qualification.approval_status}
              lastConfirmationDate={form.last_confirmation_date}
              nextConfirmationDue={form.next_confirmation_due}
              companyId={form.company_id ? parseInt(form.company_id, 10) : null}
              openByDefault={openSection === "conferma"}
              onDatesUpdated={(dates) => setForm((f) => ({ ...f, ...dates }))}
            />
          )}
        </div>

        {error && <div className="qf-error">{"\u26A0\uFE0F "}{error}</div>}

        <div className="qf-footer">
          <button className="qf-btn-cancel" onClick={onClose}>Annulla</button>
          <button className="qf-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : isRenew ? "Crea rinnovo" : isEdit ? "Salva modifiche" : "Crea qualifica"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QualificationForm;
