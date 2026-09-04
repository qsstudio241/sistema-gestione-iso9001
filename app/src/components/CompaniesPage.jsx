/**
 * CompaniesPage - Anagrafica Aziende (Fase 1 Multi-Tenant)
 * Lista, crea, modifica, elimina aziende auditate
 */

import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import { hasCompanyAccess, canEditCompany } from "../utils/companyAccess";
import { hasCompanyProfileCapability } from "../utils/licenseUtils";
import CompanyRegistrySearch from "./CompanyRegistrySearch";
import { useCompanyLogoUrl } from "../hooks/useCompanyLogoUrl";
import SgqDataGrid from "./SgqDataGrid";
import PencilIcon from "./icons/PencilIcon";
import FileDropzone from "./FileDropzone";
import TrashIcon from "./icons/TrashIcon";
import "./CompaniesPage.css";

function CompanyLogoThumb({ companyId, logoUrl, cacheBust }) {
  const src = useCompanyLogoUrl(companyId, logoUrl, cacheBust);
  if (!logoUrl) {
    return <span className="company-logo-placeholder">{"\u2014"}</span>;
  }
  if (!src) {
    return <span className="company-logo-placeholder">{"\u2026"}</span>;
  }
  return (
    <img
      src={src}
      alt=""
      className="company-logo-thumb"
    />
  );
}

const GRID_COLUMNS = [
  { id: "logo", label: "Logo", width: "56px" },
  { id: "name", label: "Nome", sortable: true },
  { id: "vat_number", label: "P.IVA", sortable: true },
  { id: "sector", label: "Settore", sortable: true },
  { id: "actions", label: "Azioni", width: "150px" },
];

function CompaniesPage({ onBack }) {
  const navigate = useNavigate();
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

  const editingLogoBlob = useCompanyLogoUrl(
    editingCompany?.id,
    editingCompany?.logo_url && !logoFile ? editingCompany.logo_url : null,
    logoTimestamp
  );
  const displayLogo = logoPreview || editingLogoBlob;

  const isSuperadmin = user?.role === "admin" && !user?.auditor_org_id;
  const isCompanyClient = hasCompanyAccess(user);
  const canCreateCompany = canEditCompany(user) && !isCompanyClient;
  const canSearchRegistry = hasCompanyProfileCapability(user);

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
    if (isCompanyClient) {
      setLoading(true);
      setError(null);
      try {
        const res = await apiService.getCompanies({ limit: 500 });
        setCompanies(res.data || []);
      } catch (err) {
        setError(err.message || "Errore caricamento aziende");
        setCompanies([]);
      } finally {
        setLoading(false);
      }
      return;
    }

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
      const params = orgId ? { auditor_org_id: orgId, limit: 500 } : { limit: 500 };
      const res = await apiService.getCompanies(params);
      setCompanies(res.data || []);
      setError(null); // Pulisci eventuale errore da richiesta precedente
    } catch (err) {
      setError(err.message || "Errore caricamento aziende");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [effectiveOrgId, isSuperadmin, auditorOrgs.length, isCompanyClient]);

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

  const closeModal = () => {
    setModalOpen(false);
    setEditingCompany(null);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleLogoChange = (files) => {
    const file = files?.[0];
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

  function renderGridCell(row, col) {
    switch (col.id) {
      case "logo":
        return (
          <CompanyLogoThumb
            companyId={row.id}
            logoUrl={row.logo_url}
            cacheBust={logoTimestamp}
          />
        );
      case "actions": {
        const rowCanEdit = canEditCompany(user, row.id);
        return (
          <div
            className="companies-row-actions"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="grid-icon-btn"
              title="Apri scheda azienda"
              aria-label="Apri scheda azienda"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/companies/${row.id}`);
              }}
            >
              <PencilIcon />
            </button>
            {rowCanEdit && !isCompanyClient && (
              <button
                type="button"
                className="grid-icon-btn grid-icon-btn--danger"
                title="Elimina"
                aria-label="Elimina"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row.id);
                }}
              >
                <TrashIcon />
              </button>
            )}
          </div>
        );
      }
      default: {
        const val = row[col.id];
        if (val == null || val === "") return "\u2014";
        return val;
      }
    }
  }

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
        {canCreateCompany && (
          <button type="button" className="btn-primary" onClick={openCreate} disabled={!effectiveOrgId}>
            + Nuova Azienda
          </button>
        )}
      </div>

      <section className="companies-grid-section" aria-label="Elenco aziende">
        <SgqDataGrid
          rows={companies}
          columns={GRID_COLUMNS}
          loading={loading}
          emptyMessage={'Nessuna azienda. Clicca "Nuova Azienda" per aggiungerne una.'}
          theme="plain"
          renderCell={renderGridCell}
          getRowKey={(row) => row.id}
          onRowClick={(row) => navigate(`/companies/${row.id}`)}
          getSortValue={(row, colId) => {
            if (colId === "logo" || colId === "actions") return "";
            return row[colId] ?? "";
          }}
        />
      </section>

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
              {canSearchRegistry && (
                <CompanyRegistrySearch
                  name={formData.name}
                  vatNumber={formData.vat_number}
                  auditorOrgId={effectiveOrgId}
                  onPick={(picked) => setFormData((prev) => ({
                    ...prev,
                    name: picked.name || prev.name,
                    vat_number: picked.vat_number || prev.vat_number,
                    address: picked.address || prev.address,
                  }))}
                />
              )}
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
                  {displayLogo && (
                    <div className="logo-preview-container">
                      <img src={displayLogo} alt="Anteprima logo" className="logo-preview" />
                      <button type="button" className="btn-remove-logo" onClick={handleRemoveLogo} title="Rimuovi logo">✕</button>
                    </div>
                  )}
                  <FileDropzone
                    variant="compact"
                    accept="image/*"
                    onFiles={handleLogoChange}
                    label={displayLogo ? "Cambia logo" : "Carica logo"}
                    hint="JPG, PNG, SVG - max 2 MB"
                  />
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
