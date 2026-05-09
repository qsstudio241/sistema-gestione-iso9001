/**
 * StudioSettingsPage - Impostazioni Studio (anagrafica, documenti, notifiche)
 * Route: /settings/studio
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import "./StudioSettingsPage.css";

const DOC_TYPES = [
  "Procedura",
  "Modulo",
  "Istruzione Operativa",
  "Piano",
  "Registro",
  "Specifica",
  "Manuale",
];

// --- Tab Anagrafica ---

function TabAnagrafica() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [logoError, setLogoError] = useState(null);
  const [logoTimestamp, setLogoTimestamp] = useState(Date.now());

  const [form, setForm] = useState({
    audit_report_prefix: "",
    vat_number: "",
  });

  const fileInputRef = useRef(null);

  const loadOrg = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getMyOrganization();
      const orgData = res?.data ?? res;
      setOrg(orgData);
      setForm({
        audit_report_prefix: orgData?.audit_report_prefix || "",
        vat_number: orgData?.vat_number || "",
      });
    } catch (err) {
      setError("Errore caricamento dati studio: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrg(); }, [loadOrg]);

  const handleChange = (field) => (e) => {
    let val = e.target.value;
    if (field === "audit_report_prefix") val = val.toUpperCase().slice(0, 8);
    setForm((f) => ({ ...f, [field]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = {
        audit_report_prefix: form.audit_report_prefix.trim() || null,
      };
      if (isAdmin) {
        payload.vat_number = form.vat_number.trim() || null;
      }
      await apiService.patchMyOrganization(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadOrg();
    } catch (err) {
      setError("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setLogoError("Il file supera il limite di 2 MB.");
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      await apiService.uploadOrganizationLogo(file);
      setLogoTimestamp(Date.now());
      await loadOrg();
    } catch (err) {
      setLogoError("Errore upload logo: " + err.message);
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    if (!window.confirm("Eliminare il logo dello studio?")) return;
    setUploadingLogo(true);
    setLogoError(null);
    try {
      await apiService.deleteOrganizationLogo();
      setLogoTimestamp(Date.now());
      await loadOrg();
    } catch (err) {
      setLogoError("Errore eliminazione logo: " + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const logoUrl = org?.logo_url
    ? `${apiService.getOrganizationLogoUrl()}?t=${logoTimestamp}`
    : null;

  if (loading) {
    return (
      <div className="studio-loading">
        <div className="loading-spinner-sm" />
        <span>Caricamento dati studio...</span>
      </div>
    );
  }

  return (
    <div className="studio-tab-content">
      {error && (
        <div className="studio-error">
          {error}
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      {/* Logo */}
      <div className="studio-card">
        <h3 className="studio-card-title">Logo Studio</h3>
        <div className="studio-logo-section">
          <div className="studio-logo-preview">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Logo studio"
                className="studio-logo-img"
                onError={() => setLogoError("Impossibile caricare il logo.")}
              />
            ) : (
              <div className="studio-logo-placeholder">
                <span className="studio-logo-placeholder-icon">&#128247;</span>
                <span className="studio-logo-placeholder-text">Nessun logo</span>
              </div>
            )}
          </div>
          <div className="studio-logo-actions">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/svg+xml"
              style={{ display: "none" }}
              onChange={handleLogoUpload}
            />
            <button
              className="btn-studio-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingLogo}
            >
              {uploadingLogo ? "Caricamento..." : "Carica logo"}
            </button>
            {org?.logo_url && (
              <button
                className="btn-studio-danger"
                onClick={handleLogoDelete}
                disabled={uploadingLogo}
              >
                Elimina logo
              </button>
            )}
            <span className="studio-logo-hint">PNG, JPG o SVG &mdash; max 2 MB</span>
          </div>
        </div>
        {logoError && (
          <div className="studio-field-error">{logoError}</div>
        )}
      </div>

      {/* Dati tenant - sola lettura, gestiti dal superadmin */}
      <div className="studio-card">
        <h3 className="studio-card-title">Dati Anagrafici</h3>
        <p className="studio-hint" style={{ marginBottom: 12 }}>
          Questi dati sono gestiti dall&apos;amministratore di sistema e non sono modificabili da qui.
        </p>

        <div className="studio-field">
          <label>Nome Studio</label>
          <input
            type="text"
            value={org?.organization_name || ""}
            readOnly
            className="studio-input-disabled"
          />
        </div>

        <div className="studio-field">
          <label>Codice organizzazione</label>
          <input
            type="text"
            value={org?.organization_code || ""}
            readOnly
            className="studio-input-disabled"
          />
        </div>

        <div className="studio-field">
          <label>Partita IVA</label>
          {isAdmin ? (
            <input
              type="text"
              value={form.vat_number}
              onChange={handleChange("vat_number")}
              placeholder="es. IT12345678901"
              maxLength={32}
            />
          ) : (
            <input
              type="text"
              value={org?.vat_number || ""}
              readOnly
              className="studio-input-disabled"
            />
          )}
        </div>
      </div>

      {/* Personalizzazioni tenant - editabili */}
      <div className="studio-card">
        <h3 className="studio-card-title">Personalizzazioni</h3>

        <div className="studio-field">
          <label>Prefisso numerazione audit</label>
          <input
            type="text"
            value={form.audit_report_prefix}
            onChange={handleChange("audit_report_prefix")}
            placeholder="es. RAP"
            maxLength={8}
          />
          <span className="studio-hint">
            Max 8 caratteri &mdash; es. &quot;RAP&quot; &rarr; RAP-2026-001
          </span>
        </div>
      </div>

      <div className="studio-actions">
        {saved && <span className="studio-saved">&#10003; Personalizzazioni salvate</span>}
        <button
          className="btn-studio-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvataggio..." : "Salva personalizzazioni"}
        </button>
      </div>
    </div>
  );
}

// --- Tab Documenti ---

function TabDocumenti() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.get("/doc-type-config");
      const serverRows = Array.isArray(res) ? res : (res?.data ?? []);
      const merged = DOC_TYPES.map((dt) => {
        const existing = serverRows.find((r) => r.doc_type === dt);
        return {
          doc_type: dt,
          prefix: existing?.prefix ?? "",
          auto_number: existing?.auto_number ?? true,
        };
      });
      setRows(merged);
    } catch (err) {
      if (err?.status === 404 || err?.status === 501) {
        setRows(DOC_TYPES.map((dt) => ({ doc_type: dt, prefix: "", auto_number: true })));
      } else {
        setError("Errore caricamento configurazione documenti: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleRowChange = (idx, field, value) => {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiService.put("/doc-type-config", rows);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="studio-loading">
        <div className="loading-spinner-sm" />
        <span>Caricamento configurazione documenti...</span>
      </div>
    );
  }

  return (
    <div className="studio-tab-content">
      {error && (
        <div className="studio-error">
          {error}
          <button onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className="studio-card">
        <h3 className="studio-card-title">Prefissi per tipo documento</h3>
        <p className="studio-card-desc">
          Configura il prefisso usato nella numerazione automatica dei documenti (es. &quot;PG&quot; &rarr; PG-001).
        </p>

        <table className="studio-doc-table">
          <thead>
            <tr>
              <th>Tipo documento</th>
              <th>Prefisso</th>
              <th>Numerazione automatica</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row.doc_type}>
                <td className="studio-doc-type">{row.doc_type}</td>
                <td>
                  <input
                    type="text"
                    value={row.prefix}
                    onChange={(e) => handleRowChange(idx, "prefix", e.target.value.toUpperCase().slice(0, 10))}
                    placeholder="es. PG"
                    className="studio-doc-prefix-input"
                    maxLength={10}
                  />
                </td>
                <td className="studio-doc-autonumber">
                  <input
                    type="checkbox"
                    checked={row.auto_number}
                    onChange={(e) => handleRowChange(idx, "auto_number", e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="studio-actions">
        {saved && <span className="studio-saved">&#10003; Configurazione salvata</span>}
        <button
          className="btn-studio-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvataggio..." : "Salva configurazione documenti"}
        </button>
      </div>
    </div>
  );
}

// --- Tab Notifiche ---

function TabNotifiche() {
  return (
    <div className="studio-tab-content">
      <div className="studio-card studio-notif-link-card">
        <div>
          <h3 className="studio-card-title" style={{ marginBottom: 6 }}>
            Configurazione Notifiche
          </h3>
          <p className="studio-card-desc">
            Le impostazioni delle notifiche email (destinatari, soglie, orari) sono disponibili nella pagina dedicata.
          </p>
          <Link to="/settings/notifications" className="btn-studio-primary" style={{ display: "inline-block", marginTop: 12 }}>
            Vai a Impostazioni Notifiche &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}

// --- Pagina principale ---

const TABS = [
  { id: "anagrafica", label: "Anagrafica" },
  { id: "documenti",  label: "Documenti" },
  { id: "notifiche",  label: "Notifiche" },
];

function StudioSettingsPage() {
  const [activeTab, setActiveTab] = useState("anagrafica");

  return (
    <div className="studio-page">
      <div className="studio-header">
        <h2 className="studio-title">Il mio Studio</h2>
        <p className="studio-subtitle">
          Personalizza logo e configurazione del tuo studio di consulenza.
        </p>
      </div>

      <div className="studio-tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`studio-tab${activeTab === tab.id ? " active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="studio-tab-panel">
        {activeTab === "anagrafica" && <TabAnagrafica />}
        {activeTab === "documenti"  && <TabDocumenti />}
        {activeTab === "notifiche"  && <TabNotifiche />}
      </div>
    </div>
  );
}

export default StudioSettingsPage;
