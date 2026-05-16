/**
 * CompaniesPage - Anagrafica Aziende (Fase 1 Multi-Tenant)
 * Lista, crea, modifica, elimina aziende auditate
 */

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import "./CompaniesPage.css";

function CompaniesPage({ onBack }) {
  const { user } = useAuth();
  const [auditorOrgId, setAuditorOrgId] = useState(user?.auditor_org_id || null);
  const [auditorOrgs, setAuditorOrgs] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(null);
  const [formData, setFormData] = useState({ name: "", vat_number: "", sector: "", address: "" });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  const isSuperadmin = user?.role === "admin" && !user?.auditor_org_id;

  const loadAuditorOrgs = useCallback(async () => {
    try {
      const res = await apiService.getAuditorOrgs();
      setAuditorOrgs(res.data || []);
    } catch (err) {
      console.warn("Auditor orgs:", err.message);
    }
  }, []);

  const effectiveOrgId = auditorOrgId || (isSuperadmin && auditorOrgs[0]?.id) || user?.auditor_org_id;

  const loadCompanies = useCallback(async () => {
    const orgId = effectiveOrgId;
    if (!orgId) {
      if (isSuperadmin && auditorOrgs.length === 0) {
        setError("Nessun auditor org configurato. Verifica che la migration 020 sia stata eseguita.");
      } else if (isSuperadmin && auditorOrgs.length > 1) {
        setError("Seleziona uno studio dal menu sopra.");
      } else if (!isSuperadmin) {
        setError("Utente non associato a uno studio. Contatta l'amministratore.");
      }
      setCompanies([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = orgId ? { auditor_org_id: orgId } : {};
      const res = await apiService.getCompanies(params);
      setCompanies(res.data || []);
      setError(null); // Pulisci eventuale errore da richiesta precedente
    } catch (err) {
      setError(err.message || "Errore caricamento aziende");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId, isSuperadmin, auditorOrgs.length]);

  useEffect(() => {
    loadAuditorOrgs();
  }, [loadAuditorOrgs]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  // Sincronizza auditorOrgId: da user per auditor, auto-select per superadmin con 1 org
  useEffect(() => {
    if (user?.auditor_org_id) {
      setAuditorOrgId(user.auditor_org_id);
    } else if (isSuperadmin && auditorOrgs.length === 1) {
      setAuditorOrgId(auditorOrgs[0].id);
    }
  }, [user?.auditor_org_id, isSuperadmin, auditorOrgs]);

  const openCreate = () => {
    setEditingCompany(null);
    setFormData({ name: "", vat_number: "", sector: "", address: "" });
    setLogoFile(null);
    setLogoPreview(null);
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditingCompany(c);
    setFormData({
      name: c.name || "",
      vat_number: c.vat_number || "",
      sector: c.sector || "",
      address: c.address || "",
    });
    setLogoFile(null);
    setLogoPreview(c.logo_url ? apiService.getCompanyLogoUrl(c.id) + `?t=${logoTimestamp}` : null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCompany(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    if (!editingCompany) { setLogoFile(null); setLogoPreview(null); return; }
    if (!window.confirm("Rimuovere il logo?")) return;
    try {
      await apiService.deleteCompanyLogo(editingCompany.id);
      setLogoFile(null);
      setLogoPreview(null);
      setLogoTimestamp(Date.now());
      loadCompanies();
    } catch (err) {
      setError(err.message || "Errore rimozione logo");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name?.trim()) return;
    try {
      let savedCompany;
      if (editingCompany) {
        const res = await apiService.updateCompany(editingCompany.id, formData);
        savedCompany = res.data || res;
      } else {
        if (!effectiveOrgId) { setError("Seleziona un auditor org"); return; }
        const res = await apiService.createCompany({ ...formData, auditor_org_id: effectiveOrgId });
        savedCompany = res.data || res;
      }
      // Upload logo se selezionato
      if (logoFile && savedCompany?.id) {
        await apiService.uploadCompanyLogo(savedCompany.id, logoFile);
        setLogoTimestamp(Date.now());
      }
      closeModal();
      loadCompanies();
    } catch (err) {
      setError(err.message || "Errore salvataggio");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Eliminare questa azienda?")) return;
    try {
      await apiService.deleteCompany(id);
      loadCompanies();
    } catch (err) {
      setError(err.message || "Errore eliminazione");
    }
  };

  return (
    <div className="companies-page">
      <div className="companies-header">
        <button type="button" className="btn-back" onClick={onBack}>
          ← Torna agli Audit
        </button>
        <h2>Anagrafica Aziende</h2>
      </div>

      {isSuperadmin && auditorOrgs.length > 1 && (
        <div className="companies-filter">
          <label>Auditor / Studio:</label>
          <select
            value={auditorOrgId || ""}
            onChange={(e) => setAuditorOrgId(parseInt(e.target.value, 10) || null)}
          >
            <option value="">- Seleziona -</option>
            {auditorOrgs.map((ao) => (
              <option key={ao.id} value={ao.id}>
                {ao.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="companies-error">
          {error}
          <button type="button" onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className="companies-actions">
        <button type="button" className="btn-primary" onClick={openCreate} disabled={!effectiveOrgId}>
          + Nuova Azienda
        </button>
      </div>

      {loading ? (
        <div className="companies-loading">Caricamento...</div>
      ) : (
        <div className="companies-list">
          {companies.length === 0 ? (
            <p className="companies-empty">Nessuna azienda. Clicca "Nuova Azienda" per aggiungerne una.</p>
          ) : (
            <table className="companies-table">
              <thead>
                <tr>
                  <th>Logo</th>
                  <th>Nome</th>
                  <th>P.IVA</th>
                  <th>Settore</th>
                  <th>Azioni</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c) => (
                  <tr key={c.id}>
                    <td className="company-logo-cell">
                      {c.logo_url ? (
                        <img
                          src={apiService.getCompanyLogoUrl(c.id) + `?t=${logoTimestamp}`}
                          alt={`Logo ${c.name}`}
                          className="company-logo-thumb"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <span className="company-logo-placeholder">-</span>
                      )}
                    </td>
                    <td>{c.name}</td>
                    <td>{c.vat_number || "-"}</td>
                    <td>{c.sector || "-"}</td>
                    <td>
                      <button type="button" className="btn-edit" onClick={() => openEdit(c)}>Modifica</button>
                      <button type="button" className="btn-delete" onClick={() => handleDelete(c.id)}>Elimina</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {modalOpen && (
        <div className="companies-modal-overlay" onClick={closeModal}>
          <div className="companies-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{editingCompany ? "Modifica Azienda" : "Nuova Azienda"}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nome *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>P.IVA</label>
                <input
                  type="text"
                  value={formData.vat_number}
                  onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Settore</label>
                <input
                  type="text"
                  value={formData.sector}
                  onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Indirizzo</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label>Logo aziendale</label>
                <div className="logo-upload-area">
                  {logoPreview && (
                    <div className="logo-preview-container">
                      <img src={logoPreview} alt="Anteprima logo" className="logo-preview" />
                      <button type="button" className="btn-remove-logo" onClick={handleRemoveLogo} title="Rimuovi logo">✕</button>
                    </div>
                  )}
                  <label className="btn-upload-logo">
                    {logoPreview ? "Cambia logo" : "Carica logo"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={handleLogoChange}
                    />
                  </label>
                  <span className="logo-hint">JPG, PNG, SVG - max 2 MB</span>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" onClick={closeModal}>Annulla</button>
                <button type="submit">Salva</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompaniesPage;
