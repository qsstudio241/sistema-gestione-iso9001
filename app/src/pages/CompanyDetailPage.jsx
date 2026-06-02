/**
 * CompanyDetailPage ù scheda azienda con tab Anagrafica + Personale (slice S4/S5)
 * Route: /companies/:id
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useNavigate, Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import { canEditCompany } from "../utils/companyAccess";
import apiService from "../services/apiService";
import CompanyPersonnelPanel from "../components/CompanyPersonnelPanel";
import "./CompanyDetailPage.css";
import "./StudioSettingsPage.css";

const TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "personale", label: "Personale" },
];

function parseCompanyId(path) {
  const m = path.match(/^\/companies\/(\d+)(?:\/)?$/);
  return m ? parseInt(m[1], 10) : null;
}

function TabAnagrafica({ company, onSaved, auditorOrgId, canEdit }) {
  const [form, setForm] = useState({
    name: "",
    vat_number: "",
    sector: "",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || "",
      vat_number: company.vat_number || "",
      sector: company.sector || "",
      address: company.address || "",
    });
    setLogoPreview(
      company.logo_url
        ? apiService.getCompanyLogoUrl(company.id) + `?t=${logoTimestamp}`
        : null
    );
  }, [company, logoTimestamp]);

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name?.trim() || !company?.id) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiService.updateCompany(company.id, form);
      if (logoFile) {
        await apiService.uploadCompanyLogo(company.id, logoFile);
        setLogoTimestamp(Date.now());
        setLogoFile(null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onSaved?.();
    } catch (err) {
      setError(err.message || "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  };

  if (!company) return null;

  return (
    <div className="studio-tab-content company-detail-anagrafica">
      {error && <div className="studio-warning-banner">{error}</div>}
      <form className="studio-card" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome *</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label>P.IVA</label>
          <input
            type="text"
            value={form.vat_number}
            onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label>Settore</label>
          <input
            type="text"
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label>Indirizzo</label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            disabled={!canEdit}
          />
        </div>
        {canEdit && (
          <div className="form-group">
            <label>Logo aziendale</label>
            <div className="logo-upload-area">
              {logoPreview && (
                <img src={logoPreview} alt="Logo" className="company-detail-logo-preview" />
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
            </div>
          </div>
        )}
        {canEdit && (
          <div className="studio-actions">
            {saved && <span className="studio-saved">&#10003; Salvato</span>}
            <button type="submit" className="btn-studio-primary" disabled={saving}>
              {saving ? "Salvataggio..." : "Salva anagrafica"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

function CompanyDetailPage() {
  const { path } = useRouter();
  const navigate = useNavigate();
  const { user } = useAuth();
  const companyId = useMemo(() => parseCompanyId(path), [path]);
  const [activeTab, setActiveTab] = useState("anagrafica");
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperadmin = user?.role === "admin" && !user?.auditor_org_id;
  const auditorOrgId = user?.auditor_org_id || company?.auditor_org_id || null;
  const canEdit = canEditCompany(user, companyId);

  const loadCompany = useCallback(async () => {
    if (!companyId) {
      setError("ID azienda non valido");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = isSuperadmin && auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.getCompany(companyId, params);
      const data = res?.data ?? res;
      if (!data?.id) throw new Error("Azienda non trovata");
      setCompany(data);
    } catch (err) {
      setError(err.message || "Errore caricamento azienda");
      setCompany(null);
    } finally {
      setLoading(false);
    }
  }, [companyId, isSuperadmin, auditorOrgId]);

  useEffect(() => {
    loadCompany();
  }, [loadCompany]);

  useEffect(() => {
    if (!companyId && !loading) {
      navigate("/companies");
    }
  }, [companyId, loading, navigate]);

  if (loading) {
    return (
      <div className="company-detail-page">
        <div className="studio-loading">
          <div className="loading-spinner-sm" />
          <span>Caricamento scheda azienda...</span>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="company-detail-page">
        <Link to="/companies" className="btn-back">
          {"\u2190"} Elenco aziende
        </Link>
        <div className="studio-warning-banner">{error || "Azienda non disponibile"}</div>
      </div>
    );
  }

  return (
    <div className="company-detail-page">
      <div className="company-detail-header">
        <Link to="/companies" className="btn-back">
          {"\u2190"} Elenco aziende
        </Link>
        <h2 className="studio-title">{company.name}</h2>
        <p className="studio-subtitle">
          Scheda azienda ù anagrafica e personale collegato alle NC.
        </p>
      </div>

      <div className="studio-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`studio-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="studio-tab-panel">
        {activeTab === "anagrafica" && (
          <TabAnagrafica
            company={company}
            onSaved={loadCompany}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
          />
        )}
        {activeTab === "personale" && (
          <CompanyPersonnelPanel
            companyId={company.id}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}

export default CompanyDetailPage;
export { parseCompanyId, TABS };
