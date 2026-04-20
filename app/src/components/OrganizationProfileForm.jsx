/**
 * Anagrafica tenant: partita IVA e logo organizzazione (tabella organizations).
 * Usato in Impostazioni → Organizzazione e nella pagina Licenze moduli.
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import { useAuth } from "../contexts/AuthContext";
import "./OrganizationProfileForm.css";

export default function OrganizationProfileForm({
  /** Testo introduttivo sotto il titolo (opzionale) */
  intro = null,
  /** Titolo sezione (accessibilità) */
  sectionTitle = "Anagrafica organizzazione",
  /** Mostra il titolo h2 */
  showHeading = true,
  /** className wrapper */
  className = "",
}) {
  const { user, refreshUser } = useAuth();
  const [orgVat, setOrgVat] = useState("");
  const [orgLogoPreview, setOrgLogoPreview] = useState(null);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgMessage, setOrgMessage] = useState(null);
  const [error, setError] = useState(null);

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

  const handleSaveOrgVat = useCallback(async () => {
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
  }, [orgVat, refreshUser]);

  const handleOrgLogoChange = useCallback(
    async (ev) => {
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
    },
    [refreshUser],
  );

  const handleDeleteOrgLogo = useCallback(async () => {
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
  }, [refreshUser]);

  return (
    <section
      className={`org-profile-form ${className || ""}`.trim()}
      aria-labelledby="org-profile-form-heading"
    >
      {showHeading ? (
        <h2 id="org-profile-form-heading" className="org-profile-form-title">
          {sectionTitle}
        </h2>
      ) : (
        <span id="org-profile-form-heading" className="visually-hidden">
          {sectionTitle}
        </span>
      )}
      <p className="org-profile-form-intro">
        {intro != null && intro !== "" ? (
          intro
        ) : (
          <>
            Nome tenant: <strong>{user?.organization_name || "—"}</strong>. Partita IVA e logo compaiono nel banner
            dell’app e nei report Word (segnaposti <code className="org-profile-code">{"{organizationName}"}</code>,{" "}
            <code className="org-profile-code">{"{organizationVat}"}</code>; nel template Word anche il marker{" "}
            <code className="org-profile-code">[LOGO_ORG]</code> per il logo studio).
          </>
        )}
      </p>

      {error ? <p className="org-profile-form-error">{error}</p> : null}

      <div className="org-profile-form-row">
        <label htmlFor="org-profile-vat" className="org-profile-form-label">
          Partita IVA
        </label>
        <input
          id="org-profile-vat"
          type="text"
          className="org-profile-form-input"
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
      <div className="org-profile-form-logo-block">
        <span className="org-profile-form-label">Logo</span>
        <div className="org-profile-form-logo-preview">
          {orgLogoPreview ? (
            <img src={orgLogoPreview} alt="Logo organizzazione" className="org-profile-form-logo-img" />
          ) : (
            <span className="org-profile-form-logo-placeholder">Nessun logo</span>
          )}
        </div>
        <div className="org-profile-form-logo-actions">
          <label className="btn-secondary org-profile-file-label">
            Carica immagine
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleOrgLogoChange}
              disabled={orgSaving}
              hidden
            />
          </label>
          {user?.organization_logo_url ? (
            <button type="button" className="btn-secondary" onClick={handleDeleteOrgLogo} disabled={orgSaving}>
              Rimuovi logo
            </button>
          ) : null}
        </div>
      </div>
      {orgMessage ? <p className="org-profile-form-ok">{orgMessage}</p> : null}
    </section>
  );
}
