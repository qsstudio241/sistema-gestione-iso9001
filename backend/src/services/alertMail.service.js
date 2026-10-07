'use strict';

const logger = require('../utils/logger');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

function envFlag(name) {
  const v = String(process.env[name] || '').trim().toLowerCase();
  return v === '1' || v === 'true';
}

/**
 * Guard fail-safe invio email (unico punto per tutti i chiamanti).
 * - `DISABLE_EMAIL=1|true`: sempre soppresso (vince su tutto).
 * - `NODE_ENV=test`: soppresso salvo `ENABLE_EMAIL_IN_TEST=1|true`. NODE_ENV=test e' lo stesso
 *   selettore che in `config/database.js` sceglie la sezione DB `test` (VPS TEST e Jest): in
 *   produzione (NODE_ENV=production o assente) il guard non scatta senza `DISABLE_EMAIL`.
 * @returns {{ suppressed: boolean, reason: string|null }}
 */
function getEmailSuppression() {
  if (envFlag('DISABLE_EMAIL')) return { suppressed: true, reason: 'DISABLE_EMAIL' };
  if (process.env.NODE_ENV === 'test' && !envFlag('ENABLE_EMAIL_IN_TEST')) {
    return { suppressed: true, reason: 'TEST' };
  }
  return { suppressed: false, reason: null };
}

function isEmailSuppressed() {
  return getEmailSuppression().suppressed;
}

/**
 * Invia email alert se SMTP configurato in .env.
 * Con guard attivo non invia nulla e restituisce false (nessun destinatario/contenuto nei log).
 * @returns {Promise<boolean>}
 */
async function sendAlertEmail(recipients, subject, html, cc) {
  const suppression = getEmailSuppression();
  if (suppression.suppressed) {
    logger.info(`[AlertMail] email soppressa (ambiente TEST/DISABLE_EMAIL) motivo=${suppression.reason}`);
    return false;
  }
  if (!nodemailer) {
    logger.warn('[AlertMail] nodemailer non installato');
    return false;
  }
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn('[AlertMail] SMTP non configurato — email non inviata');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject,
    html,
  };
  if (cc) mailOptions.cc = cc;

  await transporter.sendMail(mailOptions);
  return true;
}

module.exports = { sendAlertEmail, getEmailSuppression, isEmailSuppressed };
