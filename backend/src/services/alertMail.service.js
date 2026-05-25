'use strict';

const logger = require('../utils/logger');

let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch {
  nodemailer = null;
}

/**
 * Invia email alert se SMTP configurato in .env.
 * @returns {Promise<boolean>}
 */
async function sendAlertEmail(recipients, subject, html) {
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

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipients,
    subject,
    html,
  });
  return true;
}

module.exports = { sendAlertEmail };
