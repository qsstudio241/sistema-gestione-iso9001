/**
 * NotificationsSettingsPage — Configurazione notifiche email SGQ
 * Sprint 3: accessibile solo ad admin/superadmin
 * Route: /settings/notifications
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import "./NotificationsSettingsPage.css";

function NotificationsSettingsPage() {
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);
  const [testMsg, setTestMsg]   = useState(null);

  const [form, setForm] = useState({
    recipients_email:    "",
    alert_days_1:        30,
    alert_days_2:        7,
    send_time:           "08:00",
    alert_doc_expiry:    true,
    alert_nc_open:       true,
    alert_qualif_expiry: false,
    enabled:             false,
  });

  const loadConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getNotificationsConfig();
      setConfig(res);
      setForm({
        recipients_email:    res.recipients_email    || "",
        alert_days_1:        res.alert_days_1        ?? 30,
        alert_days_2:        res.alert_days_2        ?? 7,
        send_time:           res.send_time           || "08:00",
        alert_doc_expiry:    res.alert_doc_expiry    ?? true,
        alert_nc_open:       res.alert_nc_open       ?? true,
        alert_qualif_expiry: res.alert_qualif_expiry ?? false,
        enabled:             res.enabled             ?? false,
      });
    } catch (err) {
      setError("Errore caricamento configurazione: " + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const handleChange = (field) => (e) => {
    const val = e.target.type === "checkbox" ? e.target.checked
              : e.target.type === "number"   ? parseInt(e.target.value) || 0
              : e.target.value;
    setForm((f) => ({ ...f, [field]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    if (!form.recipients_email.trim()) {
      setError("Inserisci almeno un indirizzo email destinatario.");
      return;
    }
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await apiService.saveNotificationsConfig(form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      await loadConfig();
    } catch (err) {
      setError("Errore salvataggio: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    setTestMsg(null);
    setError(null);
    try {
      const res = await apiService.sendTestEmail();
      setTestMsg({ ok: true, text: res.message || "Email inviata con successo." });
    } catch (err) {
      setTestMsg({ ok: false, text: err.message || "Invio fallito." });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="notif-page">
        <div className="notif-loading">
          <div className="loading-spinner-sm" />
          <span>Caricamento configurazione...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="notif-page">
      {/* Header */}
      <div className="notif-header">
        <div>
          <h2 className="notif-title">🔔 Notifiche & Alert</h2>
          <p className="notif-subtitle">
            Configura i destinatari delle email di avviso per scadenze documenti e NC aperte.
          </p>
        </div>
      </div>

      {/* Status SMTP */}
      <div className={`smtp-status ${process.env.NODE_ENV ? "smtp-unknown" : ""}`}>
        <span className="smtp-dot" />
        <span className="smtp-label">
          Account SMTP configurato sul server - gestito dal tecnico tramite variabili d'ambiente
        </span>
      </div>

      {/* Errore */}
      {error && (
        <div className="notif-error">⚠️ {error} <button onClick={() => setError(null)}>✕</button></div>
      )}

      {/* Form */}
      <div className="notif-card">
        <h3 className="notif-card-title">Destinatari</h3>

        <div className="notif-field">
          <label>Indirizzi email <span className="required">*</span></label>
          <input
            type="text"
            placeholder="mario.rossi@studio.it, anna.bianchi@studio.it"
            value={form.recipients_email}
            onChange={handleChange("recipients_email")}
          />
          <span className="notif-hint">Separare più indirizzi con la virgola</span>
        </div>

        <div className="notif-row">
          <div className="notif-field">
            <label>Prima notifica (giorni prima scadenza)</label>
            <input
              type="number" min="1" max="365"
              value={form.alert_days_1}
              onChange={handleChange("alert_days_1")}
            />
          </div>
          <div className="notif-field">
            <label>Seconda notifica (giorni prima scadenza)</label>
            <input
              type="number" min="1" max="365"
              value={form.alert_days_2}
              onChange={handleChange("alert_days_2")}
            />
          </div>
          <div className="notif-field">
            <label>Orario invio giornaliero</label>
            <input
              type="time"
              value={form.send_time}
              onChange={handleChange("send_time")}
            />
          </div>
        </div>
      </div>

      <div className="notif-card">
        <h3 className="notif-card-title">Tipi di alert attivi</h3>

        <div className="notif-toggles">
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.alert_doc_expiry}
              onChange={handleChange("alert_doc_expiry")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">📄 Documenti in scadenza</span>
              <span className="toggle-desc">Avviso quando un documento del registro si avvicina alla scadenza</span>
            </div>
          </label>

          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.alert_nc_open}
              onChange={handleChange("alert_nc_open")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">⚠️ Non conformità aperte</span>
              <span className="toggle-desc">Avviso per NC rimaste aperte oltre 30 giorni</span>
            </div>
          </label>

          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.alert_qualif_expiry}
              onChange={handleChange("alert_qualif_expiry")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">🎓 Qualifiche in scadenza</span>
              <span className="toggle-desc">Avviso per qualifiche saldatori e personale NDT in scadenza (attivo con Sprint D)</span>
            </div>
          </label>
        </div>
      </div>

      <div className="notif-card">
        <h3 className="notif-card-title">Stato notifiche</h3>
        <label className="notif-toggle">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={handleChange("enabled")}
          />
          <span className="toggle-track" />
          <div className="toggle-info">
            <span className="toggle-title">{form.enabled ? "🟢 Notifiche abilitate" : "🔴 Notifiche disabilitate"}</span>
            <span className="toggle-desc">
              {form.enabled
                ? `Le email vengono inviate ogni giorno alle ${form.send_time}`
                : "Nessuna email verrà inviata finché le notifiche sono disabilitate"}
            </span>
          </div>
        </label>
      </div>

      {/* Footer azioni */}
      <div className="notif-actions">
        {saved && <span className="notif-saved">? Configurazione salvata</span>}
        <button
          className="btn-test"
          onClick={handleTestEmail}
          disabled={testing || !form.recipients_email.trim()}
          title="Invia un'email di test per verificare la configurazione SMTP"
        >
          {testing ? "Invio in corso..." : "📧 Invia email di test"}
        </button>
        <button
          className="btn-save-notif"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Salvataggio..." : "Salva configurazione"}
        </button>
      </div>

      {/* Esito test email */}
      {testMsg && (
        <div className={`notif-test-result ${testMsg.ok ? "test-ok" : "test-fail"}`}>
          {testMsg.ok ? "?" : "?"} {testMsg.text}
          <button onClick={() => setTestMsg(null)}>?</button>
        </div>
      )}
    </div>
  );
}

export default NotificationsSettingsPage;
