/**
 * StudioSettingsPage - Impostazioni Studio (anagrafica, documenti, notifiche)
 * Route: /settings/studio
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "../contexts/RouterContext";
import { useAuth } from "../contexts/AuthContext";
import apiService from "../services/apiService";
import NotificationContactsPanel from "../components/NotificationContactsPanel";
import FileDropzone from "../components/FileDropzone";
import SgqDataGrid from "../components/SgqDataGrid";
import { DOC_TYPE_OPTIONS, DOC_TYPE_LABELS } from "../data/documentTypes";
import "./StudioSettingsPage.css";
import "./NotificationsSettingsPage.css";

function hasNotificationsLicense(user) {
  const list = user?.licensed_modules;
  if (!list || !Array.isArray(list) || list.length === 0) return true;
  return list.includes("notifications");
}

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
    ai_context_notes: "",
  });

  const fileInputRef = useRef(null);
  const [logoBlobUrl, setLogoBlobUrl] = useState(null);
  const logoBlobRef = useRef(null);

  // Fetch logo con auth token e crea blob URL (il tag <img> non può inviare JWT)
  useEffect(() => {
    if (!org?.logo_url) {
      if (logoBlobRef.current) { URL.revokeObjectURL(logoBlobRef.current); logoBlobRef.current = null; }
      setLogoBlobUrl(null);
      return;
    }
    let active = true;
    const token = apiService.getToken ? apiService.getToken() : (localStorage.getItem('sgq_auth_token'));
    fetch(apiService.getOrganizationLogoUrl() + `?t=${logoTimestamp}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); })
      .then(blob => {
        if (!active) return;
        if (logoBlobRef.current) URL.revokeObjectURL(logoBlobRef.current);
        const url = URL.createObjectURL(blob);
        logoBlobRef.current = url;
        setLogoBlobUrl(url);
        setLogoError(null);
      })
      .catch(() => { if (active) { setLogoBlobUrl(null); setLogoError("Impossibile caricare il logo."); } });
    return () => {
      active = false;
    };
  }, [org?.logo_url, logoTimestamp]);

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
        ai_context_notes: orgData?.ai_context_notes || "",
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
        payload.ai_context_notes = form.ai_context_notes.trim() || null;
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

  const handleLogoUpload = async (files) => {
    const file = files?.[0];
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

  // logoUrl non più usato direttamente come src (il blob viene caricato via useEffect autenticato)

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

      {!loading && !form.audit_report_prefix && (
        <div className="studio-warning-banner">
          &#9888;&#65039; Prefisso numerazione non impostato &mdash; i nuovi audit useranno il codice generico <strong>AUD</strong>.
          Imposta un prefisso breve (es. <strong>QSS</strong>) per identificare lo studio nei documenti generati.
        </div>
      )}

      {/* Logo */}
      <div className="studio-card">
        <h3 className="studio-card-title">Logo Studio</h3>
        <div className="studio-logo-section">
          <div className="studio-logo-preview">
            {logoBlobUrl ? (
              <img
                src={logoBlobUrl}
                alt="Logo studio"
                className="studio-logo-img"
              />
            ) : (
              <div className="studio-logo-placeholder">
                <span className="studio-logo-placeholder-icon">&#128247;</span>
                <span className="studio-logo-placeholder-text">Nessun logo</span>
              </div>
            )}
          </div>
          <div className="studio-logo-actions">
            <FileDropzone
              variant="compact"
              accept="image/png,image/jpeg,image/svg+xml"
              disabled={uploadingLogo}
              onFiles={handleLogoUpload}
              label={uploadingLogo ? "Caricamento..." : "Carica logo"}
              ariaLabel="Carica logo"
              hint="PNG, JPG, SVG — max 2 MB"
              inputRef={fileInputRef}
            />
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

      {/* Contesto Assistente AI — note operative per lo studio */}
      <div className="studio-card">
        <h3 className="studio-card-title">Contesto Assistente AI</h3>
        <p className="studio-hint" style={{ marginBottom: 12 }}>
          Descrivi in poche righe lo studio, i settori di specializzazione e le preferenze operative.
          Queste note vengono incluse automaticamente in ogni risposta dell&apos;assistente AI
          (chat globale, conclusioni audit, riesame requisiti).
        </p>
        {isAdmin ? (
          <div className="studio-field">
            <label htmlFor="ai-context-notes">Note di contesto studio</label>
            <textarea
              id="ai-context-notes"
              className="studio-textarea"
              value={form.ai_context_notes}
              onChange={handleChange("ai_context_notes")}
              placeholder={"Es.: Studio di consulenza ISO con focus metalmeccanica e saldatura.\nPreferire risposte sintetiche con riferimenti a clausola e codice documento."}
              rows={5}
              maxLength={2000}
            />
            <span className="studio-hint">
              Max 2000 caratteri — visibile solo agli amministratori dello studio
            </span>
          </div>
        ) : (
          <div className="studio-field">
            <label>Note di contesto studio</label>
            <textarea
              className="studio-input-disabled studio-textarea"
              value={org?.ai_context_notes || ""}
              readOnly
              rows={4}
              placeholder="Nessuna nota configurata dall'amministratore."
            />
          </div>
        )}
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

const DOC_TYPE_GRID_COLUMNS = [
  { id: "doc_type_label", label: "Tipo documento", sortable: true },
  { id: "prefix", label: "Prefisso", sortable: true },
  { id: "auto_number", label: "Numerazione automatica", sortable: true },
  { id: "default_expiry_months", label: "Scadenza default (mesi)", sortable: true },
];

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
      const serverRows = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      const merged = DOC_TYPE_OPTIONS.map(({ value }) => {
        const existing = serverRows.find((r) => r.doc_type === value);
        return {
          doc_type: value,
          doc_type_label: DOC_TYPE_LABELS[value] || value,
          prefix: existing?.prefix ?? "",
          auto_number: existing?.auto_number ?? true,
          default_expiry_months: existing?.default_expiry_months ?? "",
        };
      });
      setRows(merged);
    } catch (err) {
      if (err?.status === 404 || err?.status === 501) {
        setRows(DOC_TYPE_OPTIONS.map(({ value }) => ({
          doc_type: value,
          doc_type_label: DOC_TYPE_LABELS[value] || value,
          prefix: "",
          auto_number: true,
          default_expiry_months: "",
        })));
      } else {
        setError("Errore caricamento configurazione documenti: " + err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleRowChange = (docType, field, value) => {
    setRows((prev) => prev.map((r) => (
      r.doc_type === docType ? { ...r, [field]: value } : r
    )));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = rows.map(({ doc_type, prefix, auto_number, default_expiry_months }) => ({
        doc_type,
        prefix: prefix || null,
        auto_number,
        default_expiry_months: default_expiry_months === "" || default_expiry_months == null
          ? null
          : parseInt(default_expiry_months, 10),
      }));
      await apiService.put("/doc-type-config", payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const renderGridCell = (row, col) => {
    if (col.id === "prefix") {
      return (
        <input
          type="text"
          value={row.prefix}
          onChange={(e) => handleRowChange(row.doc_type, "prefix", e.target.value.toUpperCase().slice(0, 10))}
          placeholder="es. PG"
          className="studio-doc-prefix-input"
          maxLength={10}
        />
      );
    }
    if (col.id === "auto_number") {
      return (
        <input
          type="checkbox"
          checked={!!row.auto_number}
          onChange={(e) => handleRowChange(row.doc_type, "auto_number", e.target.checked)}
        />
      );
    }
    if (col.id === "default_expiry_months") {
      return (
        <input
          type="number"
          min={1}
          max={120}
          value={row.default_expiry_months}
          onChange={(e) => handleRowChange(row.doc_type, "default_expiry_months", e.target.value)}
          placeholder="—"
          className="studio-doc-prefix-input"
          style={{ width: 72 }}
        />
      );
    }
    return row[col.id] ?? "—";
  };

  return (
    <div className="studio-tab-content">
      {error && (
        <div className="studio-error">
          {error}
          <button type="button" onClick={() => setError(null)}>x</button>
        </div>
      )}

      <div className="studio-card">
        <h3 className="studio-card-title">Prefissi per tipo documento</h3>
        <p className="studio-card-desc">
          Configura il prefisso usato nella numerazione automatica dei documenti nel registro SGQ
          (es. &quot;PG&quot; &rarr; PG-001). Al rilascio, se la scadenza è vuota, viene calcolata
          dai mesi indicati in colonna &quot;Scadenza default (mesi)&quot;.
        </p>
        <p className="studio-hint" style={{ marginBottom: 12 }}>
          La scadenza default si applica solo al rilascio del documento (calcolo automatico della data).
          Non invia email: le notifiche di scadenza si configurano in Impostazioni &rarr; Notifiche.
        </p>
        <p className="studio-hint" style={{ marginBottom: 12 }}>
          Nota: il prefisso report audit (tab Anagrafica) e i prefissi documenti qui sotto sono
          due sistemi separati — il primo numera i verbali di audit, il secondo i documenti del registro.
        </p>

        <SgqDataGrid
          rows={rows}
          columns={DOC_TYPE_GRID_COLUMNS}
          loading={loading}
          emptyMessage="Nessun tipo documento configurato."
          theme="plain"
          getRowKey={(r) => r.doc_type}
          getSortValue={(row, colId) => {
            if (colId === "auto_number") return row.auto_number ? 1 : 0;
            if (colId === "default_expiry_months") {
              return row.default_expiry_months === "" ? -1 : Number(row.default_expiry_months);
            }
            return row[colId] ?? "";
          }}
          renderCell={renderGridCell}
        />
      </div>

      <div className="studio-actions">
        {saved && <span className="studio-saved">&#10003; Configurazione salvata</span>}
        <button
          type="button"
          className="btn-studio-primary"
          onClick={handleSave}
          disabled={saving || loading}
        >
          {saving ? "Salvataggio..." : "Salva configurazione documenti"}
        </button>
      </div>
    </div>
  );
}

// --- Tab Notifiche ---

function TabNotifiche() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superadmin";
  const licensed = hasNotificationsLicense(user);

  if (!licensed) {
    return (
      <div className="studio-tab-content">
        <div className="studio-card">
          <h3 className="studio-card-title">Notifiche NC</h3>
          <p className="studio-card-desc">
            Il modulo notifiche non è attivo per la vostra organizzazione. Contattare l&apos;amministratore per abilitare la licenza.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="studio-tab-content studio-notif-tab">
      <NotificationContactsPanel />

      {isAdmin && (
        <div className="studio-card studio-notif-link-card" style={{ marginTop: 16 }}>
          <h3 className="studio-card-title" style={{ marginBottom: 6 }}>
            Impostazioni avanzate
          </h3>
          <p className="studio-card-desc">
            Destinatari globali, soglie di preavviso, orario invio giornaliero, toggle SMTP e tipi di alert.
          </p>
          <Link
            to="/settings/notifications"
            className="btn-studio-secondary"
            style={{ display: "inline-block", marginTop: 12 }}
          >
            Apri impostazioni notifiche complete &rarr;
          </Link>
        </div>
      )}
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
