/**
 * notifications.controller.js  Configurazione notifiche email per organizzazione
 * GET  /notifications-config  ? legge configurazione corrente
 * PUT  /notifications-config  ? salva configurazione
 * POST /notifications-config/test ? invia email di test
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');

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
            enabled             = @enabled,
            updated_at          = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (organization_id, recipients_email, alert_days_1, alert_days_2,
                  send_time, alert_doc_expiry, alert_nc_open, alert_qualif_expiry, enabled)
          VALUES (@orgId, @emails, @days1, @days2,
                  @time, @docExp, @ncOpen, @qualExp, @enabled);
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

module.exports = { getConfig, saveConfig, sendTestEmail };
