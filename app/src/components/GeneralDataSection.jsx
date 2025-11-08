/**
 * GeneralDataSection - Tab 1: Dati Generali
 * Form per compilare i dati generali dell'audit
 */

import { useState } from "react";
import "./GeneralDataSection.css";

const AVAILABLE_STANDARDS = [
  { id: "ISO_9001", label: "ISO 9001:2015", description: "Qualità" },
  { id: "ISO_14001", label: "ISO 14001:2015", description: "Ambiente" },
  { id: "ISO_45001", label: "ISO 45001:2018", description: "Sicurezza" },
];

function GeneralDataSection({
  generalData,
  selectedStandards = [],
  onUpdate,
  onStandardsUpdate,
}) {
  const [formData, setFormData] = useState(
    generalData || {
      auditObject: "",
      scope: "",
      referenceDocuments: [],
      auditDate: "",
      processes: "",
      programCommunicatedDate: "",
      auditors: [],
    }
  );

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleArrayChange = (field, index, value) => {
    const updated = { ...formData };
    updated[field][index] = value;
    setFormData(updated);
    onUpdate(updated);
  };

  const addArrayItem = (field) => {
    const updated = { ...formData };
    updated[field] = [...updated[field], ""];
    setFormData(updated);
    onUpdate(updated);
  };

  const removeArrayItem = (field, index) => {
    const updated = { ...formData };
    updated[field] = updated[field].filter((_, i) => i !== index);
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="general-data-section">
      <div className="section-header">
        <h2>📋 1 – DATI GENERALI</h2>
        <p className="section-description">
          Informazioni di base sull'audit: oggetto, campo di applicazione,
          riferimenti documentali
        </p>
      </div>

      <form className="general-data-form">
        {/* NUOVO: Selezione Standard */}
        <div className="form-field standards-selection">
          <label className="field-label">Standard Applicabili</label>
          <p className="field-hint">
            Seleziona i sistemi di gestione da auditare. Solo gli standard
            selezionati appariranno nella sezione Checklist.
          </p>
          <div className="standards-grid">
            {AVAILABLE_STANDARDS.map((standard) => (
              <label key={standard.id} className="standard-checkbox">
                <input
                  type="checkbox"
                  checked={selectedStandards.includes(standard.id)}
                  onChange={(e) => {
                    const updated = e.target.checked
                      ? [...selectedStandards, standard.id]
                      : selectedStandards.filter((s) => s !== standard.id);
                    onStandardsUpdate(updated);
                  }}
                />
                <div className="standard-info">
                  <span className="standard-label">{standard.label}</span>
                  <span className="standard-description">
                    {standard.description}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Oggetto */}
        <div className="form-field">
          <label className="field-label">Oggetto</label>
          <input
            type="text"
            className="field-input"
            value={formData.auditObject}
            onChange={(e) => handleChange("auditObject", e.target.value)}
            placeholder="Es: Audit di Verifica ispettiva interna RP"
          />
        </div>

        {/* Campo Applicazione */}
        <div className="form-field">
          <label className="field-label">Campo Applicazione</label>
          <textarea
            className="field-textarea"
            rows={3}
            value={formData.scope}
            onChange={(e) => handleChange("scope", e.target.value)}
            placeholder="Es: Sistema di Gestione per la Qualità RP: Contesto, Pianificazione, Supporto..."
          />
        </div>

        {/* Documenti di Riferimento */}
        <div className="form-field">
          <label className="field-label">Documenti di Riferimento</label>
          {formData.referenceDocuments?.map((doc, index) => (
            <div key={index} className="array-item">
              <input
                type="text"
                className="field-input"
                value={doc}
                onChange={(e) =>
                  handleArrayChange("referenceDocuments", index, e.target.value)
                }
                placeholder="Es: Norma ISO 9001 cap.4-10"
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeArrayItem("referenceDocuments", index)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-add"
            onClick={() => addArrayItem("referenceDocuments")}
          >
            ➕ Aggiungi Documento
          </button>
        </div>

        {/* Date */}
        <div className="form-row">
          <div className="form-field">
            <label className="field-label">Data Audit</label>
            <input
              type="date"
              className="field-input"
              value={formData.auditDate}
              onChange={(e) => handleChange("auditDate", e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="field-label">Programma Comunicato il</label>
            <input
              type="date"
              className="field-input"
              value={formData.programCommunicatedDate}
              onChange={(e) =>
                handleChange("programCommunicatedDate", e.target.value)
              }
            />
          </div>
        </div>

        {/* Processi/Funzioni */}
        <div className="form-field">
          <label className="field-label">Processi/Funzioni</label>
          <input
            type="text"
            className="field-input"
            value={formData.processes}
            onChange={(e) => handleChange("processes", e.target.value)}
            placeholder="Es: vari"
          />
        </div>

        {/* Verificatori */}
        <div className="form-field">
          <label className="field-label">Verificatori</label>
          {formData.auditors?.map((auditor, index) => (
            <div key={index} className="array-item">
              <input
                type="text"
                className="field-input"
                value={auditor}
                onChange={(e) =>
                  handleArrayChange("auditors", index, e.target.value)
                }
                placeholder="Es: MARCO CAMELLINI (EXT AUDITOR)"
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeArrayItem("auditors", index)}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-add"
            onClick={() => addArrayItem("auditors")}
          >
            ➕ Aggiungi Verificatore
          </button>
        </div>
      </form>
    </div>
  );
}

export default GeneralDataSection;
