/**
 * CompanyDetailPage ? scheda azienda con tab Anagrafica + Personale (slice S4/S5)
 * Route: /companies/:id
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter, useNavigate, Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import { canEditCompany } from "../utils/companyAccess";
import { hasCompanyProfileCapability } from "../utils/licenseUtils";
import apiService from "../services/apiService";
import { useCompanyLogoUrl } from "../hooks/useCompanyLogoUrl";
import CompanyPersonnelPanel from "../components/CompanyPersonnelPanel";
import CompanyCounterpartiesPanel from "../components/CompanyCounterpartiesPanel";
import CompanyProfilePanel from "../components/CompanyProfilePanel";
import "./CompanyDetailPage.css";
import "./StudioSettingsPage.css";

const TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "personale", label: "Personale" },
  { id: "controparti", label: "Controparti" },
];

const PROFILE_TAB = { id: "profilo", label: "Profilo conformit\u00e0" };

function visibleTabs(showProfile) {
  if (!showProfile) return TABS;
  return [TABS[0], PROFILE_TAB, TABS[1], TABS[2]];
}

// Livelli ISO 3834-1 §5: criteri di scelta in base a dimensione/importanza dei
// prodotti critici per la sicurezza, complessita' di fabbricazione, gamma di
// prodotti/materiali, rischio di problemi metallurgici, impatto delle imperfezioni.
const ISO3834_LEVELS = [
  {
    value: "2",
    label: "Livello 2 \u2014 Requisiti di qualita\u2019 complessi (UNI EN ISO 3834-2)",
    hint: "Prodotti critici per la sicurezza, fabbricazione complessa, gamma ampia di materiali/prodotti, rischio elevato di problemi metallurgici o imperfezioni ad alto impatto.",
  },
  {
    value: "3",
    label: "Livello 3 \u2014 Requisiti di qualita\u2019 normali (UNI EN ISO 3834-3)",
    hint: "Caso piu\u2019 diffuso: complessita\u2019 di fabbricazione e gamma di prodotti/materiali intermedie, rischio e impatto delle imperfezioni moderati.",
  },
  {
    value: "4",
    label: "Livello 4 \u2014 Requisiti di qualita\u2019 elementari (UNI EN ISO 3834-4)",
    hint: "Prodotti semplici, fabbricazione poco complessa, gamma ridotta di materiali, basso rischio di problemi metallurgici e basso impatto delle imperfezioni.",
  },
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
    iso3834_level: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  const existingLogoBlob = useCompanyLogoUrl(
    company?.id,
    company?.logo_url && !logoFile ? company.logo_url : null,
    logoTimestamp
  );
  const displayLogo = logoPreview || existingLogoBlob;

  useEffect(() => {
    if (!company) return;
    setForm({
      name: company.name || "",
      vat_number: company.vat_number || "",
      sector: company.sector || "",
      address: company.address || "",
      iso3834_level: company.iso3834_level || "",
    });
    setLogoFile(null);
    setLogoPreview(null);
  }, [company]);

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
    try {
      await apiService.updateCompany(company.id, form);
      if (logoFile) {
        await apiService.uploadCompanyLogo(company.id, logoFile);
        setLogoTimestamp(Date.now());
        setLogoFile(null);
      }
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
        <div className="form-group">
          <label>Livello ISO 3834 dichiarato</label>
          <select
            value={form.iso3834_level}
            onChange={(e) => setForm({ ...form, iso3834_level: e.target.value })}
            disabled={!canEdit}
          >
            <option value="">{"\u2014 Non definito \u2014"}</option>
            {ISO3834_LEVELS.map((lvl) => (
              <option key={lvl.value} value={lvl.value}>{lvl.label}</option>
            ))}
          </select>
          <p className="studio-hint">
            Criteri di scelta (ISO 3834-1 {"\u00A7"}5): dimensione/importanza dei prodotti critici per la
            sicurezza, complessita\u2019 di fabbricazione, gamma di prodotti/materiali, rischio di problemi
            metallurgici, impatto delle imperfezioni.
            {form.iso3834_level && (
              <> {" "}{ISO3834_LEVELS.find((l) => l.value === form.iso3834_level)?.hint}</>
            )}
          </p>
        </div>
        {canEdit && (
          <div className="form-group">
            <label>Logo aziendale</label>
            <div className="logo-upload-area">
              {displayLogo && (
                <img src={displayLogo} alt="Logo" className="company-detail-logo-preview" />
              )}
              <label className="btn-upload-logo">
                {displayLogo ? "Cambia logo" : "Carica logo"}
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
  const [profileTabHidden, setProfileTabHidden] = useState(false);

  const isSuperadmin = user?.role === "admin" && !user?.auditor_org_id;
  const auditorOrgId = user?.auditor_org_id || company?.auditor_org_id || null;
  const canEdit = canEditCompany(user, companyId);
  const showProfileTab = hasCompanyProfileCapability(user) && !profileTabHidden;
  const tabs = visibleTabs(showProfileTab);
  const hideProfileTab = useCallback(() => {
    setProfileTabHidden(true);
    setActiveTab("anagrafica");
  }, []);

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
          Scheda azienda: anagrafica, personale e controparti commerciali.
        </p>
      </div>

      <div className="studio-tabs" role="tablist">
        {tabs.map((tab) => (
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
            onSaved={() => navigate("/companies")}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
          />
        )}
        {activeTab === "profilo" && showProfileTab && (
          <CompanyProfilePanel
            companyId={company.id}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
            onUnavailable={hideProfileTab}
          />
        )}
        {activeTab === "personale" && (
          <CompanyPersonnelPanel
            companyId={company.id}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
          />
        )}
        {activeTab === "controparti" && (
          <CompanyCounterpartiesPanel
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
export { parseCompanyId, TABS, PROFILE_TAB, visibleTabs };
