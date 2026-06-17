/**
 * notifications.controller.js  Configurazione notifiche email per organizzazione
 * GET  /notifications-config  ? legge configurazione corrente
 * PUT  /notifications-config  ? salva configurazione
 * POST /notifications-config/test ? invia email di test
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { runNcEscalationForOrg } = require('../services/ncAlertEscalation.service');

const MANUAL_NC_COOLDOWN_MS = 15 * 60 * 1000;
const lastManualNcAlertByOrg = new Map();

/** GET /notifications-config */
async function getConfig(req, res) {
  try {
    const pool  = await getPool();
    const orgId = req.user.organization_id;

    const result = await pool.request()
      .input('orgId', orgId)
      .query(`
        SELECT id, organization_id, recipients_email,
               alert_days_1, alert_days_2, send_time,
               alert_doc_expiry, alert_nc_open, alert_qualif_expiry,
               doc_escalation_enabled, doc_use_legacy_digest, doc_notify_responsible,
               doc_escalation_profile_id,
               enabled, updated_at
        FROM notifications_config
        WHERE organization_id = @orgId
      `);

    if (result.recordset.length === 0) {
      // Nessuna configurazione ancora  restituisce defaults
      return res.json({
        exists: false,
        recipients_email: '',
        alert_days_1: 30,
        alert_days_2: 7,
        send_time: '08:00',
        alert_doc_expiry: true,
        alert_nc_open: true,
        alert_qualif_expiry: false,
        doc_escalation_enabled: true,
        doc_use_legacy_digest: false,
        doc_notify_responsible: false,
        doc_escalation_profile_id: null,
        enabled: false,
      });
    }

    const row = result.recordset[0];
    res.json({
      exists: true,
      ...row,
      alert_doc_expiry:    !!row.alert_doc_expiry,
      alert_nc_open:       !!row.alert_nc_open,
      alert_qualif_expiry: !!row.alert_qualif_expiry,
      doc_escalation_enabled: row.doc_escalation_enabled == null ? true : !!row.doc_escalation_enabled,
      doc_use_legacy_digest:  !!row.doc_use_legacy_digest,
      doc_notify_responsible: !!row.doc_notify_responsible,
      enabled:             !!row.enabled,
    });
  } catch (err) {
    logger.error('getNotificationsConfig:', err.message);
    res.status(500).json({ error: err.message });
  }
}

/** PUT /notifications-config */
async function saveConfig(req, res) {
  try {
    const pool  = await getPool();
    const orgId = req.user.organization_id;
    const {
      recipients_email = '',
      alert_days_1     = 30,
      alert_days_2     = 7,
      send_time        = '08:00',
      alert_doc_expiry    = true,
      alert_nc_open       = true,
      alert_qualif_expiry = false,
      doc_escalation_enabled = true,
      doc_use_legacy_digest  = false,
      doc_notify_responsible = false,
      doc_escalation_profile_id = null,
      enabled             = true,
    } = req.body;

    // Validazione minima
    if (!recipients_email || !recipients_email.trim()) {
      return res.status(400).json({ error: 'Almeno un destinatario email è obbligatorio.' });
    }

    // Upsert
    await pool.request()
      .input('orgId',    orgId)
      .input('emails',   recipients_email.trim())
      .input('days1',    parseInt(alert_days_1) || 30)
      .input('days2',    parseInt(alert_days_2) || 7)
      .input('time',     send_time)
      .input('docExp',   alert_doc_expiry    ? 1 : 0)
      .input('ncOpen',   alert_nc_open       ? 1 : 0)
      .input('qualExp',  alert_qualif_expiry ? 1 : 0)
      .input('docEsc',   doc_escalation_enabled ? 1 : 0)
      .input('legacyDigest', doc_use_legacy_digest ? 1 : 0)
      .input('docResp',  doc_notify_responsible ? 1 : 0)
      .input('docProfileId', doc_escalation_profile_id || null)
      .input('enabled',  enabled             ? 1 : 0)
      .query(`
        MERGE notifications_config AS target
        USING (SELECT @orgId AS organization_id) AS source
          ON target.organization_id = source.organization_id
        WHEN MATCHED THEN
          UPDATE SET
            recipients_email    = @emails,
            alert_days_1        = @days1,
            alert_days_2        = @days2,
            send_time           = @time,
            alert_doc_expiry    = @docExp,
            alert_nc_open       = @ncOpen,
            alert_qualif_expiry = @qualExp,
            doc_escalation_enabled = @docEsc,
            doc_use_legacy_digest  = @legacyDigest,
            doc_notify_responsible = @docResp,
            doc_escalation_profile_id = @docProfileId,
            enabled             = @enabled,
            updated_at          = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (organization_id, recipients_email, alert_days_1, alert_days_2,
                  send_time, alert_doc_expiry, alert_nc_open, alert_qualif_expiry,
                  doc_escalation_enabled, doc_use_legacy_digest, doc_notify_responsible,
                  doc_escalation_profile_id, enabled)
          VALUES (@orgId, @emails, @days1, @days2,
                  @time, @docExp, @ncOpen, @qualExp,
                  @docEsc, @legacyDigest, @docResp, @docProfileId, @enabled);
      `);

    logger.info(`[Notifications] Config salvata per org ${orgId}`);
    res.json({ success: true, message: 'Configurazione salvata.' });
  } catch (err) {
    logger.error('saveNotificationsConfig:', err.message);
    res.status(500).json({ error: err.message });
  }
}

/** POST /notifications-config/test  invia email di test */
async function sendTestEmail(req, res) {
  try {
    const pool  = await getPool();
    const orgId = req.user.organization_id;

    // Recupera config
    const cfgResult = await pool.request()
      .input('orgId', orgId)
      .query('SELECT recipients_email FROM notifications_config WHERE organization_id = @orgId');

    const recipients = cfgResult.recordset[0]?.recipients_email;
    if (!recipients) {
      return res.status(400).json({ error: 'Nessun destinatario configurato. Salva prima la configurazione.' });
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      return res.status(503).json({
        error: 'SMTP non configurato sul server. Impostare SMTP_HOST e SMTP_USER nel file .env del VPS.',
      });
    }

    let nodemailer;
    try { nodemailer = require('nodemailer'); }
    catch { return res.status(503).json({ error: 'nodemailer non installato sul server.' }); }

    const transporter = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_PORT === '465',
      auth:   { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from:    process.env.SMTP_FROM || process.env.SMTP_USER,
      to:      recipients,
      subject: '[SGQ Studio] Email di test  configurazione notifiche OK',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;padding:24px">
          <h2 style="color:#1e3a5f">? Email di test SGQ Studio</h2>
          <p>Questa email conferma che la configurazione SMTP è corretta e le notifiche automatiche funzionano.</p>
          <p style="color:#6b7280;font-size:13px">Inviata il: ${new Date().toLocaleString('it-IT')}</p>
        </div>
      `,
    });

    logger.info(`[Notifications] Email di test inviata a ${recipients} per org ${orgId}`);
    res.json({ success: true, message: `Email di test inviata a: ${recipients}` });
  } catch (err) {
    logger.error('sendTestEmail:', err.message);
    res.status(500).json({ error: 'Invio fallito: ' + err.message });
  }
}

async function loadOrgNotificationsConfig(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .query(`
      SELECT nc.organization_id, nc.recipients_email, nc.alert_days_1, nc.alert_days_2,
             nc.send_time, nc.alert_nc_open, nc.enabled,
             o.organization_name
      FROM notifications_config nc
      JOIN organizations o ON nc.organization_id = o.organization_id
      WHERE nc.organization_id = @orgId
    `);
  return result.recordset[0] || null;
}

/** POST /notifications-config/run-nc-alerts — esecuzione manuale promemoria NC (admin) */
async function runNcAlertsNow(req, res) {
  try {
    const orgId = req.user.organization_id;
    const userId = req.user.user_id;
    const dryRun = req.query.dryRun === 'true' || req.body?.dryRun === true;

    if (!dryRun) {
      const lastRun = lastManualNcAlertByOrg.get(orgId);
      if (lastRun && Date.now() - lastRun < MANUAL_NC_COOLDOWN_MS) {
        const waitMin = Math.ceil((MANUAL_NC_COOLDOWN_MS - (Date.now() - lastRun)) / 60000);
        return res.status(429).json({
          error: `Attendi ${waitMin} minuti prima di un nuovo invio manuale.`,
          code: 'NC_ALERT_COOLDOWN',
        });
      }

      if (process.env.ALERT_ENABLED !== 'true') {
        return res.status(503).json({
          error: 'Alert disabilitati sul server (ALERT_ENABLED).',
          code: 'ALERT_DISABLED',
        });
      }
      if (process.env.NC_ALERT_ENABLED !== 'true') {
        return res.status(503).json({
          error: 'Alert NC disabilitati sul server (NC_ALERT_ENABLED).',
          code: 'NC_ALERT_DISABLED',
        });
      }
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        return res.status(503).json({
          error: 'SMTP non configurato sul server.',
          code: 'SMTP_NOT_CONFIGURED',
        });
      }
    }

    const pool = await getPool();
    const cfg = await loadOrgNotificationsConfig(pool, orgId);

    if (!cfg) {
      return res.status(400).json({
        error: 'Configurazione notifiche assente. Salva prima le impostazioni.',
        code: 'NOTIFICATIONS_CONFIG_MISSING',
      });
    }
    if (!cfg.enabled) {
      return res.status(400).json({
        error: 'Notifiche disabilitate per questa organizzazione.',
        code: 'NOTIFICATIONS_DISABLED',
      });
    }
    if (!cfg.alert_nc_open) {
      return res.status(400).json({
        error: 'Alert NC disabilitato nelle impostazioni.',
        code: 'NC_ALERT_OFF',
      });
    }

    const result = await runNcEscalationForOrg(pool, cfg, { dryRun });

    if (!dryRun) {
      lastManualNcAlertByOrg.set(orgId, Date.now());
      logger.info(
        `[NC_ALERT_MANUAL] user=${userId} org=${orgId} sent=${result.sent} skipped=${result.skippedDuplicate}`,
      );
    } else {
      logger.info(
        `[NC_ALERT_PREVIEW] user=${userId} org=${orgId} wouldSend=${result.wouldSend} skipped=${result.skippedDuplicate}`,
      );
    }

    const message = dryRun
      ? (result.wouldSend > 0
        ? `Anteprima: ${result.wouldSend} email da inviare a ${result.recipients.length} destinatari.`
        : 'Anteprima: nessuna email da inviare (nessuna NC/azione in soglia o già notificate oggi).')
      : (result.sent > 0
        ? `Inviate ${result.sent} email di promemoria NC.`
        : 'Nessuna email inviata (nessuna NC/azione in soglia o già notificate oggi).');

    res.json({
      success: true,
      dryRun,
      message,
      ...result,
    });
  } catch (err) {
    logger.error('runNcAlertsNow:', err.message);
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getConfig, saveConfig, sendTestEmail, runNcAlertsNow };
