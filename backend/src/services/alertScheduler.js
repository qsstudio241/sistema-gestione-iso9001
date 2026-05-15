/**
 * alertScheduler.js — Cron job giornaliero per invio email alert scadenze
 *
 * Eseguito automaticamente all'avvio del server.
 * Orario: ogni giorno alle 08:00 (ora server).
 *
 * Dipendenze: node-schedule, nodemailer
 * Installare sul VPS: npm install node-schedule nodemailer
 *
 * Configurazione SMTP tramite variabili d'ambiente .env:
 *   SMTP_HOST=smtp.gmail.com
 *   SMTP_PORT=587
 *   SMTP_USER=alerts@qsstudio.it
 *   SMTP_PASS=<app-password>
 *   SMTP_FROM=SGQ Studio <alerts@qsstudio.it>
 *   ALERT_ENABLED=true
 */

const logger = require('../utils/logger');

// Caricamento lazy delle dipendenze opzionali
let schedule, nodemailer;
try {
  schedule   = require('node-schedule');
  nodemailer = require('nodemailer');
} catch {
  logger.warn('[AlertScheduler] node-schedule o nodemailer non installati — cron job disabilitato. Eseguire: npm install node-schedule nodemailer');
}

const { getPool } = require('../config/database');

const ALERT_DAYS_1 = 30; // Prima soglia: 30 giorni
const ALERT_DAYS_2 = 7;  // Seconda soglia: 7 giorni

// ─── Template email ───────────────────────────────────────────────────────────

function buildEmailHtml(orgName, expiredDocs, expiringDocs) {
  const formatDate = (d) => {
    if (!d) return '—';
    const s = String(d);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };

  const docRow = (doc, isExpired) => `
    <tr style="background:${isExpired ? '#fff5f5' : '#fffbeb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.title}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${doc.doc_code || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.company_name || '—'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${isExpired ? '#dc2626' : '#b45309'};font-weight:600">
        ${isExpired ? '⚠️ SCADUTO' : `Scade il ${formatDate(doc.expiry_date)}`}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.responsible || '—'}</td>
    </tr>`;

  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';
  const thStyle    = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">⚙️ SGQ Studio — Alert Scadenze Documenti</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} · ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">

        ${expiredDocs.length > 0 ? `
        <h3 style="color:#dc2626;margin:0 0 12px">⚠️ Documenti scaduti — ${expiredDocs.length}</h3>
        <table style="${tableStyle}">
          <thead><tr>
            <th style="${thStyle}">Documento</th>
            <th style="${thStyle}">Codice</th>
            <th style="${thStyle}">Azienda</th>
            <th style="${thStyle}">Stato</th>
            <th style="${thStyle}">Responsabile</th>
          </tr></thead>
          <tbody>${expiredDocs.map(d => docRow(d, true)).join('')}</tbody>
        </table>` : ''}

        ${expiringDocs.length > 0 ? `
        <h3 style="color:#b45309;margin:0 0 12px">🟡 In scadenza entro ${ALERT_DAYS_1} giorni — ${expiringDocs.length}</h3>
        <table style="${tableStyle}">
          <thead><tr>
            <th style="${thStyle}">Documento</th>
            <th style="${thStyle}">Codice</th>
            <th style="${thStyle}">Azienda</th>
            <th style="${thStyle}">Scadenza</th>
            <th style="${thStyle}">Responsabile</th>
          </tr></thead>
          <tbody>${expiringDocs.map(d => docRow(d, false)).join('')}</tbody>
        </table>` : ''}

        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Questo messaggio è generato automaticamente da SGQ Studio.<br>
          Per disabilitare le notifiche, accedi all'app → Impostazioni → Alert.
        </p>
      </div>
    </div>`;
}

// ─── Query documenti urgenti ──────────────────────────────────────────────────

async function fetchUrgentDocs(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .input('days', ALERT_DAYS_1)
    .query(`
      SELECT
        dr.id, dr.title, dr.doc_code, dr.doc_type,
        dr.expiry_date, dr.responsible,
        c.name AS company_name,
        CASE WHEN dr.expiry_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS is_expired
      FROM document_registry dr
      LEFT JOIN companies c ON dr.company_id = c.id
      WHERE dr.organization_id = @orgId
        AND dr.status NOT IN ('obsoleto')
        AND dr.expiry_date IS NOT NULL
        AND dr.expiry_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
      ORDER BY dr.expiry_date ASC
    `);
  return result.recordset || [];
}

// ─── Invio email ──────────────────────────────────────────────────────────────

async function sendAlertEmail(recipients, subject, html) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    logger.warn('[AlertScheduler] SMTP non configurato — email non inviata. Impostare SMTP_HOST, SMTP_USER, SMTP_PASS in .env');
    return false;
  }

  const transporter = nodemailer.createTransporter({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from:    process.env.SMTP_FROM || process.env.SMTP_USER,
    to:      recipients,
    subject,
    html,
  });
  return true;
}

// ─── Job principale ───────────────────────────────────────────────────────────

async function runAlertJob() {
  if (!process.env.ALERT_ENABLED || process.env.ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] Alert disabilitati (ALERT_ENABLED != true)');
    return;
  }

  logger.info('[AlertScheduler] Avvio job alert scadenze...');
  const pool = await getPool();

  try {
    // Recupera tutte le organizzazioni con notifiche abilitate
    const orgsResult = await pool.request().query(`
      SELECT nc.organization_id, nc.recipients_email, nc.alert_days_1,
             o.organization_name
      FROM notifications_config nc
      JOIN organizations o ON nc.organization_id = o.organization_id
      WHERE nc.enabled = 1
    `);

    const orgs = orgsResult.recordset || [];
    logger.info(`[AlertScheduler] Organizzazioni con alert attivi: ${orgs.length}`);

    for (const org of orgs) {
      const docs = await fetchUrgentDocs(pool, org.organization_id);
      if (docs.length === 0) {
        logger.info(`[AlertScheduler] Org ${org.organization_id}: nessun alert da inviare`);
        continue;
      }

      const expired  = docs.filter(d => d.is_expired);
      const expiring = docs.filter(d => !d.is_expired);

      const subject = `[SGQ] ${expired.length > 0 ? `${expired.length} documenti scaduti` : ''} ${expiring.length > 0 ? `${expiring.length} in scadenza` : ''} — ${org.organization_name}`.trim();
      const html    = buildEmailHtml(org.organization_name, expired, expiring);

      const sent = await sendAlertEmail(org.recipients_email, subject, html);
      if (sent) {
        logger.info(`[AlertScheduler] Email inviata a ${org.recipients_email} per org ${org.organization_id}`);
      }
    }
  } catch (err) {
    logger.error('[AlertScheduler] Errore job:', err.message);
  }
}

// ─── Avvio scheduler ──────────────────────────────────────────────────────────

// ─── Verifica validità norme (settimanale) ────────────────────────────────────

async function runNormValidityJob() {
  logger.info('[AlertScheduler] Avvio job verifica validità norme...');
  try {
    const { runScheduledValidityCheck } = require('./normValidityChecker.service');
    const pool = await getPool();
    const orgsResult = await pool.request().query(
      'SELECT organization_id FROM organizations'
    );
    const orgs = orgsResult.recordset || [];
    for (const org of orgs) {
      await runScheduledValidityCheck(org.organization_id);
    }
    logger.info(`[AlertScheduler] Verifica validità norme completata per ${orgs.length} organizzazioni`);
  } catch (err) {
    logger.error('[AlertScheduler] Errore job validità norme:', err.message);
  }
}

function startAlertScheduler() {
  if (!schedule) {
    logger.warn('[AlertScheduler] node-schedule non disponibile — scheduler non avviato');
    return;
  }

  // Ogni giorno alle 08:00
  schedule.scheduleJob('0 8 * * *', () => {
    runAlertJob().catch(err => logger.error('[AlertScheduler] Errore non gestito:', err.message));
  });

  // Ogni lunedì alle 03:00 — verifica validità norme
  schedule.scheduleJob('0 3 * * 1', () => {
    runNormValidityJob().catch(err => logger.error('[AlertScheduler] Errore non gestito (norme):', err.message));
  });

  logger.info('[AlertScheduler] Scheduler avviato — alert giornalieri 08:00, verifica norme settimanale lun 03:00');
}

module.exports = { startAlertScheduler, runAlertJob, runNormValidityJob };
