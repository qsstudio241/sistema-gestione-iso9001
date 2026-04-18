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

  const canEditLicenses = user?.role === "admin" || user?.role === "superadmin";

  if (!canEditLicenses) {
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
      <p className="licenses-intro">
        Seleziona quali moduli sono attivi per la tua organizzazione. Il modulo <strong>Audit</strong> resta
        sempre abilitato. Valore vuoto sul database significa &quot;tutti i moduli&quot; (compatibilità con
        installazioni esistenti).
      </p>

      {error && <p className="licenses-error">{error}</p>}
      {message && <p className="licenses-ok">{message}</p>}

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
    </div>
  );
}
