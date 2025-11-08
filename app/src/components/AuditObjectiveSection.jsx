/**
 * AuditObjectiveSection - Tab 2: Obiettivo dell'Audit
 * Descrizione obiettivo, partecipanti e agenda
 */

import { useState } from "react";
import "./AuditObjectiveSection.css";

function AuditObjectiveSection({ auditObjective, onUpdate }) {
  const [formData, setFormData] = useState(
    auditObjective || {
      description: "",
      participants: [],
      agenda: null,
    }
  );

  const handleChange = (field, value) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onUpdate(updated);
  };

  const handleParticipantChange = (index, field, value) => {
    const updated = { ...formData };
    updated.participants[index][field] = value;
    setFormData(updated);
    onUpdate(updated);
  };

  const addParticipant = () => {
    const updated = { ...formData };
    updated.participants = [...updated.participants, { role: "", name: "" }];
    setFormData(updated);
    onUpdate(updated);
  };

  const removeParticipant = (index) => {
    const updated = { ...formData };
    updated.participants = updated.participants.filter((_, i) => i !== index);
    setFormData(updated);
    onUpdate(updated);
  };

  return (
    <div className="audit-objective-section">
      <div className="section-header">
        <h2>🎯 2 – OBIETTIVO DELL'AUDIT</h2>
        <p className="section-description">
          Definisci lo scopo dell'audit, i criteri di verifica e i partecipanti
        </p>
      </div>

      <form className="audit-objective-form">
        {/* Descrizione Obiettivo */}
        <div className="form-field">
          <label className="field-label">Descrizione Obiettivo</label>
          <textarea
            className="field-textarea large"
            rows={6}
            value={formData.description}
            onChange={(e) => handleChange("description", e.target.value)}
            placeholder="Es: Verificare il grado di implementazione del Sistema di Gestione della Qualità secondo la norma UNI EN ISO 9001:2015 e il rispetto delle procedure interne.&#10;&#10;Verificare la completezza documentale e l'efficacia dei processi."
          />
          <span className="field-hint">
            Descrivi gli obiettivi principali dell'audit e i criteri di verifica
          </span>
        </div>

        {/* Presenti per l'organizzazione */}
        <div className="form-field">
          <label className="field-label">Presenti per l'organizzazione</label>
          <div className="participants-grid">
            {formData.participants?.map((participant, index) => (
              <div key={index} className="participant-item">
                <input
                  type="text"
                  className="field-input role"
                  placeholder="Ruolo (es: DG)"
                  value={participant.role}
                  onChange={(e) =>
                    handleParticipantChange(index, "role", e.target.value)
                  }
                />
                <input
                  type="text"
                  className="field-input name"
                  placeholder="Nome (opzionale)"
                  value={participant.name}
                  onChange={(e) =>
                    handleParticipantChange(index, "name", e.target.value)
                  }
                />
                <button
                  type="button"
                  className="btn-remove-participant"
                  onClick={() => removeParticipant(index)}
                  title="Rimuovi partecipante"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn-add" onClick={addParticipant}>
            ➕ Aggiungi Partecipante
          </button>
        </div>

        {/* Agenda (opzionale) */}
        <div className="form-field">
          <label className="field-label">
            Agenda Audit <span className="optional">(opzionale)</span>
          </label>
          <textarea
            className="field-textarea"
            rows={4}
            value={formData.agenda || ""}
            onChange={(e) => handleChange("agenda", e.target.value)}
            placeholder="Es:&#10;09:00 - Riunione di apertura&#10;09:30 - Verifica documentale&#10;11:00 - Audit processi operativi&#10;15:00 - Riunione di chiusura"
          />
        </div>
      </form>

      {/* Preview partecipanti (stile tabella) */}
      {formData.participants && formData.participants.length > 0 && (
        <div className="participants-preview">
          <h3>Riepilogo Partecipanti</h3>
          <table className="participants-table">
            <thead>
              <tr>
                <th>Ruolo</th>
                <th>Nome</th>
              </tr>
            </thead>
            <tbody>
              {formData.participants.map((p, idx) => (
                <tr key={idx}>
                  <td className="role-cell">{p.role || "—"}</td>
                  <td className="name-cell">{p.name || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AuditObjectiveSection;
