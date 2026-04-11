/**
 * QualificationForm — Form creazione/modifica qualifica
 */

import React, { useState, useEffect } from "react";
import apiService from "../services/apiService";
import "./QualificationForm.css";

const QUAL_TYPES = [
  "Saldatore ISO 9606-1",
  "Saldatore ISO 9606-2",
  "Saldatore EN 15614",
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
  "Patentino PES/PAV (CEI 11-27)",
  "Patentino PES (CEI 11-27)",
  "Patentino PAV (CEI 11-27)",
  "Abilitazione carrello elevatore",
  "Abilitazione piattaforma aerea",
  "Corso primo soccorso",
  "Corso antincendio",
  "Altra qualifica",
];

const EMPTY = {
  person_name: "", person_code: "", department: "",
  company_id: "", qualification_type: "", standard_ref: "",
  scope_detail: "", certificate_number: "", issuing_body: "",
  issue_date: "", expiry_date: "", last_renewal_date: "",
  status: "valida", notes: "",
};

function QualificationForm({ qualification, onSave, onClose }) {
  const isEdit = !!qualification;
  const [form,    setForm]    = useState(EMPTY);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);
  const [companies, setCompanies] = useState([]);
  const [customType, setCustomType] = useState(false);

  useEffect(() => {
    apiService.getCompanies?.().then(r => setCompanies(r?.companies || r || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (qualification) {
      const d = { ...EMPTY, ...qualification };
      // Normalizza date a YYYY-MM-DD
      ["issue_date","expiry_date","last_renewal_date"].forEach(k => {
        if (d[k]) d[k] = String(d[k]).slice(0, 10);
      });
      d.company_id = d.company_id || "";
      setForm(d);
      if (d.qualification_type && !QUAL_TYPES.includes(d.qualification_type)) {
        setCustomType(true);
      }
    }
  }, [qualification]);

  function handle(field) {
    return e => setForm(f => ({ ...f, [field]: e.target.type === "checkbox" ? e.target.checked : e.target.value }));
  }

  async function handleSave() {
    if (!form.person_name.trim()) { setError("Il nome della persona \u00e8 obbligatorio."); return; }
    if (!form.qualification_type.trim()) { setError("Il tipo di qualifica \u00e8 obbligatorio."); return; }
    setSaving(true);
    setError(null);
    try {
      const data = { ...form, company_id: form.company_id || null };
      if (isEdit) {
        await apiService.updateQualification(qualification.id, data);
      } else {
        await apiService.createQualification(data);
      }
      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="qf-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="qf-modal">
        <div className="qf-header">
          <h3 className="qf-title">{isEdit ? "\u270F\uFE0F Modifica qualifica" : "+ Nuova qualifica"}</h3>
          <button className="qf-close" onClick={onClose}>&#x2715;</button>
        </div>

        <div className="qf-body">
          {/* Persona */}
          <div className="qf-section-title">Persona</div>
          <div className="qf-row">
            <div className="qf-field qf-flex2">
              <label>Nome e cognome <span className="req">*</span></label>
              <input type="text" value={form.person_name} onChange={handle("person_name")} placeholder="Mario Rossi" />
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
              <label>Azienda</label>
              <select value={form.company_id} onChange={handle("company_id")}>
                <option value="">-- nessuna --</option>
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

          {/* Date */}
          <div className="qf-section-title" style={{marginTop: 16}}>Date</div>
          <div className="qf-row">
            <div className="qf-field">
              <label>Data emissione</label>
              <input type="date" value={form.issue_date} onChange={handle("issue_date")} />
            </div>
            <div className="qf-field">
              <label>Data scadenza</label>
              <input type="date" value={form.expiry_date} onChange={handle("expiry_date")} />
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
        </div>

        {error && <div className="qf-error">\u26A0\uFE0F {error}</div>}

        <div className="qf-footer">
          <button className="qf-btn-cancel" onClick={onClose}>Annulla</button>
          <button className="qf-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? "Salvataggio..." : isEdit ? "Salva modifiche" : "Crea qualifica"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default QualificationForm;
