/**
 * Licenze moduli — Sprint 8 (solo admin / superadmin organizzazione)
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import StatusBadge from "../components/StatusBadge";
import "./LicensesSettingsPage.css";

export default function LicensesSettingsPage() {
  const { user, refreshUser } = useAuth();
  const isSuperadmin = user?.role === "superadmin";
  const ownOrgId = user?.organization_id ?? null;

  const [organizations, setOrganizations] = useState([]);
  const [selectedOrgId, setSelectedOrgId] = useState(ownOrgId);
  const [selectedOrgName, setSelectedOrgName] = useState(user?.organization_name || "");
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

  const editingOwnOrg = selectedOrgId != null && selectedOrgId === ownOrgId;

  const applyLicensePayload = useCallback((d) => {
    const mods = d.modules || [];
    setAvailable(d.available || []);
    setSelected(new Set(mods));
    setUseDefaults(d.raw_override == null || String(d.raw_override).trim() === "");
    if (d.organization_name) setSelectedOrgName(d.organization_name);
  }, []);

  const loadOrganizations = useCallback(async () => {
    if (!isSuperadmin) return;
    try {
      const res = await apiService.getAdminOrganizations();
      if (res.success && Array.isArray(res.data)) {
        setOrganizations(res.data);
      }
    } catch (_) {
      /* elenco tenant opzionale — la pagina resta usabile sulla propria org */
    }
  }, [isSuperadmin]);

  const loadLicenses = useCallback(async (orgId) => {
    if (orgId == null) return;
    setLoading(true);
    setError(null);
    try {
      const useOwnEndpoint = !isSuperadmin || orgId === ownOrgId;
      const res = useOwnEndpoint
        ? await apiService.getAdminLicenses()
        : await apiService.getOrgLicenses(orgId);
      if (!res.success) throw new Error(res.error || "Errore API");
      applyLicensePayload(res.data);
    } catch (e) {
      setError(e.message || "Errore caricamento licenze");
    } finally {
      setLoading(false);
    }
  }, [applyLicensePayload, isSuperadmin, ownOrgId]);

  useEffect(() => {
    if (ownOrgId != null) {
      setSelectedOrgId(ownOrgId);
      setSelectedOrgName(user?.organization_name || "");
    }
  }, [ownOrgId, user?.organization_name]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    if (selectedOrgId != null) {
      loadLicenses(selectedOrgId);
    }
  }, [selectedOrgId, loadLicenses]);

  useEffect(() => {
    setOrgVat(user?.organization_vat_number || "");
  }, [user?.organization_vat_number]);

  useEffect(() => {
    let cancelled = false;

    async function loadOrgLogo() {
      if (!editingOwnOrg || !user?.organization_logo_url || !apiService.getToken()) {
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
  }, [editingOwnOrg, user?.organization_id, user?.organization_logo_url]);

  function handleOrgChange(ev) {
    const nextId = parseInt(ev.target.value, 10);
    if (!Number.isFinite(nextId)) return;
    const org = organizations.find((o) => o.organization_id === nextId);
    setSelectedOrgId(nextId);
    setSelectedOrgName(org?.organization_name || "");
    setMessage(null);
    setError(null);
  }

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
      const body = useDefaults
        ? { use_defaults: true }
        : { modules: [...selected] };

      if (editingOwnOrg) {
        await apiService.patchAdminLicenses(body);
        const updated = await refreshUser();
        if (updated) {
          setMessage(
            "Licenze aggiornate e sessione aggiornata. Gli altri utenti dell'organizzazione vedono i nuovi moduli dopo logout/login o al prossimo refresh token.",
          );
        } else {
          setMessage(
            "Licenze salvate sul server. Ricarica la pagina o rifai login per aggiornare i permessi in questa sessione.",
          );
        }
      } else {
        await apiService.patchOrgLicenses(selectedOrgId, body);
        setMessage(
          `Licenze aggiornate per ${selectedOrgName || "l'organizzazione selezionata"}. Gli utenti di quell'organizzazione vedono i nuovi moduli dopo logout/login.`,
        );
      }
      await loadLicenses(selectedOrgId);
    } catch (e) {
      setError(e.message || "Salvataggio non riuscito");
    } finally {
      setSaving(false);
    }
  }

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
    if (!window.confirm("Rimuovere il logo dell'organizzazione dai report e dall'interfaccia?")) return;
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

      {isSuperadmin && organizations.length > 0 ? (
        <div className="licenses-tenant-row">
          <label htmlFor="license-org-select" className="licenses-org-label">
            Organizzazione
          </label>
          <select
            id="license-org-select"
            className="licenses-tenant-select"
            value={selectedOrgId ?? ""}
            onChange={handleOrgChange}
            disabled={saving}
          >
            {organizations.map((org) => (
              <option key={org.organization_id} value={org.organization_id}>
                {org.organization_name} (ID {org.organization_id})
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {!editingOwnOrg && isSuperadmin ? (
        <p className="licenses-tenant-banner" role="status">
          Stai modificando le licenze di <strong>{selectedOrgName || "un altro tenant"}</strong>.
          L&apos;anagrafica P.IVA/logo resta quella della tua organizzazione ({user?.organization_name}).
        </p>
      ) : null}

      {canEditLicenses ? (
        <p className="licenses-intro">
          Seleziona quali moduli sono attivi per{" "}
          {editingOwnOrg ? "la tua organizzazione" : `l'organizzazione ${selectedOrgName || ""}`}. Il modulo{" "}
          <strong>Audit</strong> resta sempre abilitato. Valore vuoto sul database significa &quot;tutti i moduli&quot;
          (compatibilità con installazioni esistenti).
        </p>
      ) : (
        <p className="licenses-intro">
          Moduli attivi per la tua organizzazione (sola lettura). Per modificare le licenze contatta
          l&apos;amministratore della piattaforma.
        </p>
      )}

      {error && <p className="licenses-error">{error}</p>}
      {message && <p className="licenses-ok">{message}</p>}

      {editingOwnOrg ? (
        <section className="licenses-org-section" aria-labelledby="org-profile-heading">
          <h2 id="org-profile-heading" className="licenses-org-title">
            Anagrafica organizzazione
          </h2>
          <p className="licenses-org-intro">
            Nome tenant: <strong>{user?.organization_name || "-"}</strong>. Partita IVA e logo compaiono nel banner
            dell&apos;app e nei report Word (segnaposto <code className="licenses-code">{"{organizationName}"}</code>,{" "}
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
      ) : null}

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
            <button type="button" className="btn-secondary" onClick={() => loadLicenses(selectedOrgId)} disabled={saving}>
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
              <StatusBadge
                type="license"
                status={selected.has(key) ? "active" : "inactive"}
                size="small"
                className="license-status-badge"
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
