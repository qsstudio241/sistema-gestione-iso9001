import React, { useState } from "react";
import { useData } from "../contexts/DataContext";
import "./AuditForm.css";

const NonConformitaForm = () => {
  const { addNonConformita } = useData();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    descrizione: "",
    puntoISO: "",
    gravita: "media",
    origine: "",
    analisiCause: "",
    azioniCorrettive: "",
    responsabile: "",
    dataScadenza: "",
    esitoVerifica: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.descrizione) {
      alert("Inserire almeno una descrizione della non conformità");
      return;
    }

    const result = addNonConformita(formData);

    if (result) {
      alert(`✓ Non conformità ${result.id} registrata con successo`);
      setFormData({
        descrizione: "",
        puntoISO: "",
        gravita: "media",
        origine: "",
        analisiCause: "",
        azioniCorrettive: "",
        responsabile: "",
        dataScadenza: "",
        esitoVerifica: "",
      });
      setShowForm(false);
    }
  };

  return (
    <div className="form-container">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          ➕ Nuova Non Conformità
        </button>
      ) : (
        <div className="card form-card">
          <div className="form-header">
            <h3>Nuova Non Conformità (Punto 10.2)</h3>
            <button onClick={() => setShowForm(false)} className="btn-close">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="iso-note">
              <strong>Ciclo gestione NC (punto 10.2):</strong> Reagire →
              Valutare → Attuare → Riesaminare → Aggiornare
            </div>

            <div className="form-grid">
              <div className="form-group full-width">
                <label>Descrizione Non Conformità *</label>
                <textarea
                  name="descrizione"
                  value={formData.descrizione}
                  onChange={handleChange}
                  placeholder="Descrivere dettagliatamente la non conformità rilevata"
                  rows="4"
                  required
                />
              </div>

              <div className="form-group">
                <label>Punto ISO 9001:2015</label>
                <input
                  type="text"
                  name="puntoISO"
                  value={formData.puntoISO}
                  onChange={handleChange}
                  placeholder="es. 8.5.1, 7.1.5"
                />
              </div>

              <div className="form-group">
                <label>Gravità</label>
                <select
                  name="gravita"
                  value={formData.gravita}
                  onChange={handleChange}
                >
                  <option value="bassa">Bassa</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                  <option value="critica">Critica</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Origine/Fonte</label>
                <input
                  type="text"
                  name="origine"
                  value={formData.origine}
                  onChange={handleChange}
                  placeholder="es. Audit interno, Reclamo cliente, Controllo processo"
                />
              </div>

              <div className="form-group full-width">
                <label>Analisi delle Cause</label>
                <textarea
                  name="analisiCause"
                  value={formData.analisiCause}
                  onChange={handleChange}
                  placeholder="Analizzare le cause della non conformità (punto 10.2.1 b)"
                  rows="3"
                />
              </div>

              <div className="form-group full-width">
                <label>Azioni Correttive</label>
                <textarea
                  name="azioniCorrettive"
                  value={formData.azioniCorrettive}
                  onChange={handleChange}
                  placeholder="Definire le azioni correttive necessarie (punto 10.2.1 c)"
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Responsabile</label>
                <input
                  type="text"
                  name="responsabile"
                  value={formData.responsabile}
                  onChange={handleChange}
                  placeholder="Responsabile gestione NC"
                />
              </div>

              <div className="form-group">
                <label>Data Scadenza Azioni</label>
                <input
                  type="date"
                  name="dataScadenza"
                  value={formData.dataScadenza}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group full-width">
                <label>Esito Verifica Efficacia</label>
                <textarea
                  name="esitoVerifica"
                  value={formData.esitoVerifica}
                  onChange={handleChange}
                  placeholder="Riesaminare l'efficacia delle azioni correttive (punto 10.2.1 d)"
                  rows="2"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-secondary"
              >
                Annulla
              </button>
              <button type="submit" className="btn-primary">
                💾 Registra Non Conformità
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default NonConformitaForm;
