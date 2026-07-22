/**
 * ParticipantsList — lista strutturata partecipanti per il Riesame di Direzione.
 * Gestisce un array di { name, role } con aggiunta/rimozione righe
 * e importazione dall'anagrafica personale aziendale.
 */

import React, { useState } from "react";
import apiService from "../services/apiService";

export default function ParticipantsList({ participants, onChange, companyId }) {
  const [importing, setImporting]   = useState(false);
  const [importError, setImportError] = useState(null);

  function addRow() {
    onChange([...participants, { name: "", role: "" }]);
  }

  function removeRow(index) {
    onChange(participants.filter((_, i) => i !== index));
  }

  function updateRow(index, field, value) {
    const updated = participants.map((p, i) =>
      i === index ? { ...p, [field]: value } : p
    );
    onChange(updated);
  }

  async function importFromPersonnel() {
    if (!companyId) return;
    setImporting(true);
    setImportError(null);
    try {
      const res = await apiService.getCompanyPersonnel(companyId);
      const list = Array.isArray(res?.data) ? res.data
                 : Array.isArray(res)       ? res
                 : [];
      const imported = list
        .filter((p) => p.is_active !== false && p.status !== "inactive")
        .map((p) => ({
          name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || p.name || "",
          role: p.job_title || p.role || "",
        }))
        .filter((p) => p.name.trim());

      if (imported.length === 0) {
        setImportError("Nessun personale attivo trovato nell\u2019anagrafica.");
        return;
      }

      const existingNames = new Set(participants.map((p) => p.name.trim().toLowerCase()));
      const toAdd = imported.filter((p) => !existingNames.has(p.name.trim().toLowerCase()));
      if (toAdd.length === 0) {
        setImportError("Tutti i dipendenti trovati sono gi\u00E0 in lista.");
        return;
      }
      onChange([...participants, ...toAdd]);
      setImportError(null);
    } catch (err) {
      setImportError(err?.message || "Errore durante l\u2019importazione del personale.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="pl-container">
      {participants.length > 0 && (
        <div className="pl-grid">
          <div className="pl-grid-header">
            <span>{"Nome e Cognome"}</span>
            <span>{"Ruolo / Qualifica"}</span>
            <span aria-hidden="true" />
          </div>
          {participants.map((p, i) => (
            <div className="pl-grid-row" key={i}>
              <input
                className="pl-input"
                type="text"
                value={p.name}
                onChange={(e) => updateRow(i, "name", e.target.value)}
                placeholder={"Nome e cognome"}
                aria-label={"Nome partecipante"}
              />
              <input
                className="pl-input"
                type="text"
                value={p.role}
                onChange={(e) => updateRow(i, "role", e.target.value)}
                placeholder={"es. Responsabile Qualit\u00E0"}
                aria-label={"Ruolo partecipante"}
              />
              <button
                type="button"
                className="pl-remove-btn"
                onClick={() => removeRow(i)}
                title={"Rimuovi"}
                aria-label={"Rimuovi partecipante"}
              >
                {"\u2715"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="pl-actions">
        <button type="button" className="btn-secondary pl-add-btn" onClick={addRow}>
          {"+ Aggiungi partecipante"}
        </button>
        {companyId && (
          <button
            type="button"
            className="btn-secondary pl-import-btn"
            onClick={importFromPersonnel}
            disabled={importing}
            title={"Importa il personale attivo dall\u2019anagrafica aziendale"}
          >
            {importing ? "Importazione\u2026" : "\u2193 Importa da anagrafica"}
          </button>
        )}
      </div>

      {importError && <p className="pl-error">{importError}</p>}

      {participants.length === 0 && (
        <p className="pl-empty">{"Nessun partecipante aggiunto. Usa i pulsanti sopra."}</p>
      )}
    </div>
  );
}
