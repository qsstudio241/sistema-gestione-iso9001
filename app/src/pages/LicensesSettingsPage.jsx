/**
 * Licenze moduli — Sprint 8 (solo admin / superadmin organizzazione)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./LicensesSettingsPage.css";

export default function LicensesSettingsPage() {
  const { user, refreshUser } = useAuth();
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [useDefaults, setUseDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [orgVat, setOrgVat] = useState("");
  const [orgLogoPreview, setOrgLogoPreview] = useState(null);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMessage, setOrgMessage] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAdminLicenses();
      if (!res.success) throw new Error(res.error || "Errore API");
      const d = res.data;
      const mods = d.modules || [];
      setAvailable(d.available || []);
      setSelected(new Set(mods));
      setUseDefaults(d.raw_override == null || String(d.raw_override).trim() === "");
    } catch (e) {
      setError(e.message || "Errore caricamento licenze");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setOrgVat(user?.organization_vat_number || "");
  }, [user?.organization_vat_number]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgLogo() {
      if (!user?.organization_logo_url || !apiService.getToken()) {
        setOrgLogoPreview(null);
        return;
      }
      try {
        const res = await fetch(apiService.getOrganizationLogoUrl(), {
          headers: { Authorization: `Bearer ${apiService.getToken()}` },
        });
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = reject;
          fr.readAsDataURL(blob);
        });
        if (!cancelled) setOrgLogoPreview(dataUrl);
      } catch {
        if (!cancelled) setOrgLogoPreview(null);
      }
    }

    loadOrgLogo();
    return () => {
      cancelled = true;
    };
  }, [user?.organization_id, user?.organization_logo_url]);

  function toggle(key) {
    setUseDefaults(false);
    setSelected((prev) => {
      const n = new Set(prev);
      if (key === "audit") return n;
      if (n.has(key)) n.delete(key);
      else n.add(key);
      if (!n.has("audit")) n.add("audit");
      return n;
    });
  }

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      if (useDefaults) {
        await apiService.patchAdminLicenses({ use_defaults: true });
      } else {
        await apiService.patchAdminLicenses({ modules: [...selected] });
      }
      const updated = await refreshUser();
      if (updated) {
        setMessage(
          "Licenze aggiornate e sessione aggiornata. Gli altri utenti dell’organizzazione vedono i nuovi moduli dopo logout/login o al prossimo refresh token.",
        );
      } else {
        setMessage(
          "Licenze salvate sul server. Ricarica la pagina o rifai login per aggiornare i permessi in questa sessione.",
        );
      }
      await load();
    } catch (e) {
      setError(e.message || "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

  // Solo il superadmin (piattaforma) può modificare le licenze;
  // l'admin dello studio le vede in sola lettura per sapere cosa è abilitato.
  const canEditLicenses = user?.role === "superadmin";
  const canViewLicenses = user?.role === "admin" || user?.role === "superadmin";

  async function handleSaveOrgVat() {
    setOrgSaving(true);
    setOrgMessage(null);
    setError(null);
    try {
      const res = await apiService.patchMyOrganization({ vat_number: orgVat });
      if (!res.success) throw new Error(res.error || "Errore salvataggio");
      await refreshUser();
      setOrgMessage("Partita IVA aggiornata.");
    } catch (e) {
      setError(e.message || "Salvataggio P.IVA non riuscito");
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleOrgLogoChange(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    setOrgSaving(true);
    setOrgMessage(null);
    setError(null);
    try {
      await apiService.uploadOrganizationLogo(file);
      await refreshUser();
      setOrgMessage("Logo organizzazione caricato.");
    } catch (e) {
      setError(e.message || "Upload logo non riuscito");
    } finally {
      setOrgSaving(false);
    }
  }

  async function handleDeleteOrgLogo() {
    if (!window.confirm("Rimuovere il logo dell’organizzazione dai report e dall’interfaccia?")) return;
    setOrgSaving(true);
    setOrgMessage(null);
    setError(null);
    try {
      await apiService.deleteOrganizationLogo();
      await refreshUser();
      setOrgLogoPreview(null);
      setOrgMessage("Logo rimosso.");
    } catch (e) {
      setError(e.message || "Eliminazione logo non riuscita");
    } finally {
      setOrgSaving(false);
    }
  }

  if (!canViewLicenses) {
    return (
      <div className="licenses-page">
        <h1>Licenze moduli</h1>
        <p className="licenses-error">Accesso riservato agli amministratori dell&apos;organizzazione.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="licenses-page">
        <p>Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="licenses-page">
      <h1>Licenze moduli</h1>
      {canEditLicenses ? (
        <p className="licenses-intro">
          Seleziona quali moduli sono attivi per la tua organizzazione. Il modulo <strong>Audit</strong> resta
          sempre abilitato. Valore vuoto sul database significa &quot;tutti i moduli&quot; (compatibilità con
          installazioni esistenti).
        </p>
      ) : (
        <p className="licenses-intro">
          Moduli attivi per la tua organizzazione (sola lettura). Per modificare le licenze contatta
          l&apos;amministratore della piattaforma.
        </p>
      )}

      {error && <p className="licenses-error">{error}</p>}
      {message && <p className="licenses-ok">{message}</p>}

      <section className="licenses-org-section" aria-labelledby="org-profile-heading">
        <h2 id="org-profile-heading" className="licenses-org-title">
          Anagrafica organizzazione
        </h2>
        <p className="licenses-org-intro">
          Nome tenant: <strong>{user?.organization_name || "-"}</strong>. Partita IVA e logo compaiono nel banner
          dell’app e nei report Word (segnaposto <code className="licenses-code">{"{organizationName}"}</code>,{" "}
          <code className="licenses-code">{"{organizationVat}"}</code>; nel template Word anche il marker{" "}
          <code className="licenses-code">[LOGO_ORG]</code> per il logo studio).
        </p>
        <div className="licenses-org-row">
          <label htmlFor="org-vat" className="licenses-org-label">
            Partita IVA
          </label>
          <input
            id="org-vat"
            type="text"
            className="licenses-org-input"
            maxLength={32}
            value={orgVat}
            onChange={(e) => setOrgVat(e.target.value)}
            placeholder="es. IT01234567890"
            disabled={orgSaving}
          />
          <button type="button" className="btn-secondary" onClick={handleSaveOrgVat} disabled={orgSaving}>
            Salva P.IVA
          </button>
        </div>
        <div className="licenses-org-logo-block">
          <span className="licenses-org-label">Logo</span>
          <div className="licenses-org-logo-preview">
            {orgLogoPreview ? (
              <img src={orgLogoPreview} alt="Logo organizzazione" className="licenses-org-logo-img" />
            ) : (
              <span className="licenses-org-logo-placeholder">Nessun logo</span>
            )}
          </div>
          <div className="licenses-org-logo-actions">
            <label className="btn-secondary licenses-file-label">
              Carica immagine
              <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={handleOrgLogoChange} disabled={orgSaving} hidden />
            </label>
            {user?.organization_logo_url ? (
              <button type="button" className="btn-secondary" onClick={handleDeleteOrgLogo} disabled={orgSaving}>
                Rimuovi logo
              </button>
            ) : null}
          </div>
        </div>
        {orgMessage && <p className="licenses-ok licenses-org-msg">{orgMessage}</p>}
      </section>

      {canEditLicenses ? (
        <>
          <label className="licenses-defaults">
            <input
              type="checkbox"
              checked={useDefaults}
              onChange={(e) => setUseDefaults(e.target.checked)}
            />
            Usa impostazione predefinita (tutti i moduli disponibili)
          </label>

          {!useDefaults && (
            <ul className="licenses-list">
              {available.map(({ key, label }) => (
                <li key={key}>
                  <label>
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      disabled={key === "audit"}
                      onChange={() => toggle(key)}
                    />
                    <span className="licenses-key">{key}</span>
                    <span className="licenses-label">{label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          <div className="licenses-actions">
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? "Salvataggio…" : "Salva"}
            </button>
            <button type="button" className="btn-secondary" onClick={load} disabled={saving}>
              Annulla modifiche locali
            </button>
          </div>
        </>
      ) : (
        <ul className="licenses-list licenses-list-readonly">
          {available.map(({ key, label }) => (
            <li key={key} className={selected.has(key) ? "license-active" : "license-inactive"}>
              <span className="licenses-key">{key}</span>
              <span className="licenses-label">{label}</span>
              <span className="license-status-badge">
                {selected.has(key) ? "\u2713 Attivo" : "- Non attivo"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
