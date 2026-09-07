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
import FileDropzone from "../components/FileDropzone";
import CompanyRegistrySearch from "../components/CompanyRegistrySearch";
import StatusBadge from "../components/StatusBadge";
import { scoreCompanyContext, COMPANY_FIELD_LABELS } from "../data/aiContextRubrics";
import "./CompanyDetailPage.css";
import "./StudioSettingsPage.css";

const TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "personale", label: "Personale" },
  { id: "controparti", label: "Controparti" },
];

const PROFILE_TAB = { id: "profilo", label: "Profilo conformit\u00e0" };

/** Stesse soglie company_profile completeness — non fondere i due score. */
const AI_CONTEXT_BADGE = {
  pronto: { status: "active", label: "Pronto" },
  parziale: { status: "orphan", label: "Parziale" },
  incompleto: { status: "inactive", label: "Incompleto" },
};

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

function TabAnagrafica({ company, onSaved, auditorOrgId, canEdit, canSearchRegistry }) {
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

  const liveContext = useMemo(
    () =>
      scoreCompanyContext({
        name: form.name,
        vat_number: form.vat_number,
        sector: form.sector,
        address: form.address,
      }),
    [form.name, form.vat_number, form.sector, form.address]
  );
  const badgeCfg = AI_CONTEXT_BADGE[liveContext.level] || AI_CONTEXT_BADGE.incompleto;

  const handleLogoChange = (files) => {
    const file = files?.[0];
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
        <div className="studio-ai-context-score" data-testid="company-ai-context-score">
          <StatusBadge
            type="user"
            status={badgeCfg.status}
            label={`${liveContext.score}% \u2014 ${badgeCfg.label}`}
          />
          <span className="studio-hint">
            Completezza contesto AI (rubrica {liveContext.version}) — distinta dal profilo legale.
          </span>
        </div>

        {liveContext.missing.length > 0 && (
          <div className="studio-ai-context-wizard" data-testid="company-ai-context-wizard">
            <p className="studio-ai-context-wizard-title">
              Per alzare lo score contesto AI, completa:
            </p>
            <ul className="studio-ai-context-missing">
              {liveContext.missing.map((key) => (
                <li key={key}>{COMPANY_FIELD_LABELS[key] || key}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="form-group">
          <label htmlFor="company-name">Nome *</label>
          <input
            id="company-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label htmlFor="company-vat">P.IVA</label>
          <input
            id="company-vat"
            type="text"
            value={form.vat_number}
            onChange={(e) => setForm({ ...form, vat_number: e.target.value })}
            disabled={!canEdit}
          />
        </div>
        {canEdit && canSearchRegistry && (
          <CompanyRegistrySearch
            name={form.name}
            vatNumber={form.vat_number}
            currentValues={form}
            auditorOrgId={auditorOrgId}
            onPick={(picked) => setForm((prev) => ({
              ...prev,
              ...(picked.name !== undefined ? { name: picked.name } : {}),
              ...(picked.vat_number !== undefined ? { vat_number: picked.vat_number } : {}),
              ...(picked.address !== undefined ? { address: picked.address } : {}),
              ...(picked.sector !== undefined ? { sector: picked.sector } : {}),
            }))}
          />
        )}
        <div className="form-group">
          <label htmlFor="company-sector">Settore</label>
          <input
            id="company-sector"
            type="text"
            value={form.sector}
            onChange={(e) => setForm({ ...form, sector: e.target.value })}
            disabled={!canEdit}
          />
        </div>
        <div className="form-group">
          <label htmlFor="company-address">Indirizzo</label>
          <textarea
            id="company-address"
            className="notes-textarea"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            rows={2}
            disabled={!canEdit}
          />
          <span className="studio-hint">
            Almeno 8 caratteri per lo score pieno. Salvataggio solo con «Salva anagrafica».
          </span>
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
              <FileDropzone
                variant="compact"
                accept="image/*"
                onFiles={handleLogoChange}
                label={displayLogo ? "Cambia logo" : "Carica logo"}
                hint="JPG, PNG, SVG"
              />
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

  const refreshCompanyQuiet = useCallback(async () => {
    if (!companyId) return;
    try {
      const params = isSuperadmin && auditorOrgId ? { auditor_org_id: auditorOrgId } : {};
      const res = await apiService.getCompany(companyId, params);
      const data = res?.data ?? res;
      if (data?.id) setCompany(data);
    } catch {
      /* titolo resta quello già in pagina */
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
            canSearchRegistry={showProfileTab}
          />
        )}
        {activeTab === "profilo" && showProfileTab && (
          <CompanyProfilePanel
            companyId={company.id}
            auditorOrgId={auditorOrgId}
            canEdit={canEdit}
            onUnavailable={hideProfileTab}
            onAnagraficaSynced={refreshCompanyQuiet}
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
export { parseCompanyId, TABS, PROFILE_TAB, visibleTabs, TabAnagrafica, AI_CONTEXT_BADGE };
