/**
 * NotificationsSettingsPage — Configurazione notifiche email SGQ
 * Sprint 3: accessibile solo ad admin/superadmin
 * Route: /settings/notifications
 */

import React, { useState, useEffect, useCallback } from "react";
import apiService from "../services/apiService";
import NotificationContactsPanel from "../components/NotificationContactsPanel";
import "./NotificationsSettingsPage.css";

function NotificationsSettingsPage() {
  const [config, setConfig]     = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [testing, setTesting]   = useState(false);
  const [runningNc, setRunningNc] = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState(null);
  const [testMsg, setTestMsg]   = useState(null);
  const [ncRunMsg, setNcRunMsg] = useState(null);
  const [ncPreview, setNcPreview] = useState(null);

  const [form, setForm] = useState({
    recipients_email:    "",
    alert_days_1:        30,
    alert_days_2:        7,
    send_time:           "08:00",
    alert_doc_expiry:    true,
    alert_nc_open:       true,
    alert_qualif_expiry: false,
    doc_escalation_enabled: true,
    doc_use_legacy_digest: false,
    doc_notify_responsible: false,
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
        doc_escalation_enabled: res.doc_escalation_enabled ?? true,
        doc_use_legacy_digest:  res.doc_use_legacy_digest  ?? false,
        doc_notify_responsible: res.doc_notify_responsible ?? false,
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

  const ncAlertsReady =
    config?.exists &&
    form.enabled &&
    form.alert_nc_open &&
    form.recipients_email.trim();

  const handleNcAlertsRun = async (dryRun) => {
    if (!dryRun) {
      const ok = window.confirm(
        "Inviare ora i promemoria NC verso i referenti in rubrica?\n\n" +
        "Verranno rispettate le stesse regole del job giornaliero (soglie scadenza, anti-duplicati)."
      );
      if (!ok) return;
    }

    setRunningNc(true);
    setNcRunMsg(null);
    setNcPreview(null);
    setError(null);
    try {
      const res = await apiService.runNcAlertsNow({ dryRun });
      setNcRunMsg({ ok: true, text: res.message || "Operazione completata." });
      if (dryRun && Array.isArray(res.recipients)) {
        setNcPreview(res);
      }
    } catch (err) {
      setNcRunMsg({ ok: false, text: err.message || "Operazione fallita." });
    } finally {
      setRunningNc(false);
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
            <label>Finestra email documenti (giorni)</label>
            <input
              type="number" min="1" max="365"
              value={form.alert_days_1}
              onChange={handleChange("alert_days_1")}
            />
            <span className="notif-hint">
              Documenti in scadenza o già scaduti entro questo intervallo (tab Priorità, dashboard, email)
            </span>
          </div>
          <div className="notif-field">
            <label>Soglia escalation NC (giorni)</label>
            <input
              type="number" min="1" max="365"
              value={form.alert_days_2}
              onChange={handleChange("alert_days_2")}
            />
            <span className="notif-hint">
              Seconda soglia per promemoria NC/azioni (oltre a 14, 7 e 1 giorno prima della scadenza)
            </span>
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
              <span className="toggle-desc">
                Una email riepilogativa al giorno con tutti i documenti urgenti — non invia promemoria separati per ogni documento
              </span>
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
              <span className="toggle-desc">Avviso per NC con scadenza entro le soglie configurate, NC scadute (giornaliero) o aperte oltre la prima soglia senza data</span>
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
        <h3 className="notif-card-title">Escalation documenti</h3>
        <p className="notif-hint" style={{ marginBottom: 12 }}>
          Con escalation attiva, ogni documento riceve promemoria alle soglie configurate
          (es. 35, 28, 21, 14, 7, 3, 1 giorni prima + giornaliero dopo scadenza).
          La finestra &quot;Finestra email documenti&quot; sopra definisce anche tab Priorità e dashboard.
        </p>

        <div className="notif-toggles">
          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.doc_escalation_enabled}
              onChange={handleChange("doc_escalation_enabled")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">Curva escalation attiva</span>
              <span className="toggle-desc">
                Promemoria mirati per soglia con log anti-duplicati. Disattiva per non inviare email documenti (anche con toggle sopra attivo).
              </span>
            </div>
          </label>

          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.doc_use_legacy_digest}
              onChange={handleChange("doc_use_legacy_digest")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">Digest legacy (una email riepilogativa)</span>
              <span className="toggle-desc">
                Ripristina il comportamento precedente: un&apos;unica email giornaliera con tutti i documenti urgenti, senza curve per soglia
              </span>
            </div>
          </label>

          <label className="notif-toggle">
            <input
              type="checkbox"
              checked={form.doc_notify_responsible}
              onChange={handleChange("doc_notify_responsible")}
            />
            <span className="toggle-track" />
            <div className="toggle-info">
              <span className="toggle-title">Invia al responsabile documento</span>
              <span className="toggle-desc">
                Se il campo Responsabile contiene un indirizzo email, il promemoria va lì; altrimenti si usano i destinatari globali
              </span>
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

      <NotificationContactsPanel />

      <div className="notif-card">
        <h3 className="notif-card-title">Smoke test promemoria NC</h3>
        <p className="notif-hint" style={{ marginBottom: 12 }}>
          Esegue lo stesso job del cron giornaliero (default alle {form.send_time || "08:00"} + 5 min)
          per la tua organizzazione. I referenti in rubrica ricevono il promemoria; altrimenti i destinatari globali.
        </p>
        <div className="notif-nc-run-actions">
          <button
            type="button"
            className="btn-test"
            onClick={() => handleNcAlertsRun(true)}
            disabled={runningNc || !ncAlertsReady}
            title="Mostra chi riceverebbe email senza inviarle"
          >
            {runningNc ? "Elaborazione..." : "Anteprima promemoria NC"}
          </button>
          <button
            type="button"
            className="btn-nc-run"
            onClick={() => handleNcAlertsRun(false)}
            disabled={runningNc || !ncAlertsReady}
            title="Invia subito i promemoria NC (cooldown 15 min tra un invio e l'altro)"
          >
            {runningNc ? "Invio in corso..." : "Esegui promemoria NC ora"}
          </button>
        </div>
        {!ncAlertsReady && (
          <p className="notif-hint notif-nc-run-hint">
            {!config?.exists
              ? "Salva prima la configurazione (destinatari e toggle), poi usa anteprima o invio manuale."
              : "Abilita notifiche, alert NC aperte e almeno un destinatario globale per usare questa funzione."}
          </p>
        )}
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
          {testMsg.ok ? "\u2713" : "\u2717"} {testMsg.text}
          <button type="button" onClick={() => setTestMsg(null)} aria-label="Chiudi">{"\u00D7"}</button>
        </div>
      )}

      {ncRunMsg && (
        <div className={`notif-test-result ${ncRunMsg.ok ? "test-ok" : "test-fail"}`}>
          {ncRunMsg.ok ? "\u2713" : "\u2717"} {ncRunMsg.text}
          <button type="button" onClick={() => { setNcRunMsg(null); setNcPreview(null); }} aria-label="Chiudi">{"\u00D7"}</button>
        </div>
      )}

      {ncPreview && ncPreview.recipients?.length > 0 && (
        <div className="notif-nc-preview">
          <h4>Anteprima destinatari ({ncPreview.wouldSend} email)</h4>
          {ncPreview.skippedDuplicate > 0 && (
            <p className="notif-hint">
              {ncPreview.skippedDuplicate} notifiche già inviate oggi (saltate per anti-duplicati).
            </p>
          )}
          <ul>
            {ncPreview.recipients.map((r) => (
              <li key={r.email}>
                <strong>{r.email}</strong>
                {r.name ? ` (${r.name})` : ""}
                {" — "}
                {r.ncCount} NC, {r.actionCount} azioni
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NotificationsSettingsPage;
