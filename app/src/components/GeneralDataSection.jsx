/**
 * GeneralDataSection - Tab 1: Dati Generali
 * Form per compilare i dati generali dell'audit
 */

import { useState, useEffect } from "react";
import { fetchStandards } from "../services/standardsService";
import "./GeneralDataSection.css";

// Fallback standard se API non disponibile
const FALLBACK_STANDARDS = [
  {
    standard_id: 1,
    standard_code: "ISO_9001_2015",
    standard_name: "ISO 9001:2015",
    category: "quality",
    description: "Qualità",
  },
  {
    standard_id: 2,
    standard_code: "ISO_14001_2015",
    standard_name: "ISO 14001:2015",
    category: "environment",
    description: "Ambiente",
  },
  {
    standard_id: 3,
    standard_code: "ISO_45001_2018",
    standard_name: "ISO 45001:2018",
    category: "safety",
    description: "Sicurezza",
  },
];

// Mappa categoria → descrizione italiana
const CATEGORY_LABELS = {
  quality: "Qualità",
  environment: "Ambiente",
  safety: "Sicurezza",
};

// Normalizza codice standard verso forma canonica senza anno (es. "ISO_9001_2015" → "ISO_9001")
// Deve essere coerente con auditConverter.js NORMALIZE
const NORMALIZE_STD = {
  ISO_9001_2015: "ISO_9001",  ISO_9001: "ISO_9001",
  ISO_14001_2015: "ISO_14001", ISO_14001: "ISO_14001",
  ISO_45001_2018: "ISO_45001", ISO_45001: "ISO_45001",
};

function GeneralDataSection({
  generalData,
  selectedStandards = [],
  standardsWithData = [],
  customChecklistId = null,
  onUpdate,
  onStandardsUpdate,
  readOnly = false,
}) {
  const [availableStandards, setAvailableStandards] =
    useState(FALLBACK_STANDARDS);
  const [loadingStandards, setLoadingStandards] = useState(true);

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

  // Carica standard dall'API
  useEffect(() => {
    loadStandardsFromAPI();
  }, []);

  const loadStandardsFromAPI = async () => {
    try {
      const data = await fetchStandards();
      if (data && data.length > 0) {
        // Aggiungi descrizione dalla categoria
        const standardsWithDesc = data.map((std) => ({
          ...std,
          description: CATEGORY_LABELS[std.category] || std.category,
        }));
        setAvailableStandards(standardsWithDesc);
      }
    } catch (error) {
      console.warn(
        "API standard non disponibile, uso fallback:",
        error.message
      );
      // Mantieni fallback già impostato
    } finally {
      setLoadingStandards(false);
    }
  };

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
    <div className={`general-data-section${readOnly ? ' readonly-mode' : ''}`}>
      <form className="general-data-form">
        {/* NUOVO: Selezione Standard */}
        <div className="form-field standards-selection">
          <label className="field-label">Standard Applicabili</label>
          <p className="field-hint">
            {customChecklistId
              ? "Opzionale: per audit con checklist personalizzata gli standard non sono richiesti. Puoi comunque aggiungerli per un audit ibrido."
              : "Seleziona i sistemi di gestione da auditare. Solo gli standard selezionati appariranno nella sezione Checklist."}
          </p>
          {loadingStandards ? (
            <div className="loading-standards">Caricamento standard...</div>
          ) : (
            <div className="standards-grid">
              {availableStandards.map((standard) => {
                // Normalizza verso forma canonica senza anno (es. "ISO_9001_2015" → "ISO_9001")
                // per essere coerente con selectedStandards che usa la forma corta
                const stdId = NORMALIZE_STD[standard.standard_code] || standard.standard_code || standard.id;
                const hasData = standardsWithData.includes(stdId);
                return (
                  <label
                    key={stdId}
                    className={`standard-checkbox category-${standard.category}${hasData ? " has-data" : ""}`}
                    title={hasData ? `${standard.standard_name}: impossibile deselezionare, esistono già risposte nella checklist` : ""}
                  >
                    <input
                      type="checkbox"
                      checked={selectedStandards.includes(stdId) || hasData}
                      disabled={hasData || readOnly}
                      onChange={(e) => {
                        if (hasData || readOnly) return;
                        const updated = e.target.checked
                          ? [...selectedStandards, stdId]
                          : selectedStandards.filter((s) => s !== stdId);
                        onStandardsUpdate(updated);
                      }}
                    />
                    <div className="standard-info">
                      <span className="standard-label">
                        {standard.standard_name || standard.label}
                      </span>
                      <span
                        className={`standard-description category-badge-${standard.category}`}
                      >
                        {standard.description}
                      </span>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
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
            disabled={readOnly}
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
            disabled={readOnly}
          />
        </div>

        {/* Documenti di Riferimento */}
        <div className="form-field">
          <label className="field-label">Documenti di Riferimento / Disegni-Specifiche</label>
          <p className="field-hint">
            Questo campo alimenta la voce report <strong>DISEGNI/SPECIFICHE DI RIFERIMENTO</strong> (es. disegno, WPS, specifica cliente, capitolato).
          </p>
          {formData.referenceDocuments?.map((doc, index) => (
            <div key={index} className="array-item">
              <input
                type="text"
                className="field-input"
                value={doc}
                onChange={(e) =>
                  handleArrayChange("referenceDocuments", index, e.target.value)
                }
                placeholder="Es: Disegno DRW-001 rev.B / WPS-141-07 / Specifica cliente SPC-22"
                disabled={readOnly}
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeArrayItem("referenceDocuments", index)}
                disabled={readOnly}
              >
                ✕
              </button>
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              className="btn-add"
              onClick={() => addArrayItem("referenceDocuments")}
            >
              ➕ Aggiungi Documento
            </button>
          )}
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
              disabled={readOnly}
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
              disabled={readOnly}
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
            disabled={readOnly}
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
                disabled={readOnly}
              />
              <button
                type="button"
                className="btn-remove"
                onClick={() => removeArrayItem("auditors", index)}
                disabled={readOnly}
              >
                ✕
              </button>
            </div>
          ))}
          {!readOnly && (
            <button
              type="button"
              className="btn-add"
              onClick={() => addArrayItem("auditors")}
            >
              ➕ Aggiungi Verificatore
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

export default GeneralDataSection;
