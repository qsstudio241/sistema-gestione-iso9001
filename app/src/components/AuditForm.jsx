import React, { useState } from "react";
import { useData } from "../contexts/DataContext";
import "./AuditForm.css";

const AuditForm = () => {
  const { addAudit } = useData();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    dataAudit: "",
    tipo: "interno",
    area: "",
    puntoISO: "",
    auditor: "",
    criteri: "",
    osservazioni: "",
    conformita: [],
    nonConformita: [],
    conclusioni: "",
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

    if (!formData.dataAudit || !formData.area) {
      alert("Compilare almeno Data Audit e Area/Processo");
      return;
    }

    const result = addAudit(formData);

    if (result) {
      alert(`✓ Audit ${result.id} creato con successo`);
      setFormData({
        dataAudit: "",
        tipo: "interno",
        area: "",
        puntoISO: "",
        auditor: "",
        criteri: "",
        osservazioni: "",
        conformita: [],
        nonConformita: [],
        conclusioni: "",
      });
      setShowForm(false);
    }
  };

  return (
    <div className="form-container">
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary">
          ➕ Nuovo Audit Interno
        </button>
      ) : (
        <div className="card form-card">
          <div className="form-header">
            <h3>Nuovo Audit Interno (Punto 9.2)</h3>
            <button onClick={() => setShowForm(false)} className="btn-close">
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Data Audit *</label>
                <input
                  type="date"
                  name="dataAudit"
                  value={formData.dataAudit}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Tipo Audit</label>
                <select
                  name="tipo"
                  value={formData.tipo}
                  onChange={handleChange}
                >
                  <option value="interno">Interno</option>
                  <option value="esterno">Esterno</option>
                  <option value="sistema">Sistema</option>
                  <option value="processo">Processo</option>
                  <option value="prodotto">Prodotto</option>
                </select>
              </div>

              <div className="form-group full-width">
                <label>Area/Processo Auditato *</label>
                <input
                  type="text"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="es. Gestione Commerciale, Produzione, Acquisti..."
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
                  placeholder="es. 4.4, 8.5.1, 9.2"
                />
              </div>

              <div className="form-group">
                <label>Auditor</label>
                <input
                  type="text"
                  name="auditor"
                  value={formData.auditor}
                  onChange={handleChange}
                  placeholder="Nome auditor"
                />
              </div>

              <div className="form-group full-width">
                <label>Criteri Audit</label>
                <textarea
                  name="criteri"
                  value={formData.criteri}
                  onChange={handleChange}
                  placeholder="Criteri di audit (requisiti ISO, procedure interne, normative applicabili...)"
                  rows="3"
                />
              </div>

              <div className="form-group full-width">
                <label>Osservazioni</label>
                <textarea
                  name="osservazioni"
                  value={formData.osservazioni}
                  onChange={handleChange}
                  placeholder="Osservazioni generali sull'audit"
                  rows="3"
                />
              </div>

              <div className="form-group full-width">
                <label>Conclusioni</label>
                <textarea
                  name="conclusioni"
                  value={formData.conclusioni}
                  onChange={handleChange}
                  placeholder="Conclusioni dell'audit"
                  rows="3"
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
                💾 Salva Audit
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AuditForm;
