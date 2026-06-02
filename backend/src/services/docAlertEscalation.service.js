'use strict';

/**
 * Escalation email documenti in scadenza/scaduti.
 * Fallback destinatari: notifications_config.recipients_email
 * Opzionale: document_registry.responsible se contiene un indirizzo email.
 */

const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const {
  buildDocEscalationThresholds,
  matchDocAlertRule,
  parseRecipientList,
} = require('./alertSchedulerHelpers');

function formatItDate(d) {
  if (!d) return '\u2014';
  const raw = String(d);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

function ruleLabel(rule) {
  if (!rule) return '';
  if (rule.kind === 'overdue') return 'Scaduto \u2014 promemoria giornaliero';
  return `Scadenza tra ${rule.thresholdDays} giorni`;
}

function normalizeThresholdDays(thresholdDays) {
  return thresholdDays == null ? -1 : thresholdDays;
}

function parseEmailFromResponsible(raw) {
  if (!raw || !String(raw).includes('@')) return null;
  const candidate = String(raw).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : null;
}

function buildDocAlertHtml(orgName, recipientName, items) {
  const thStyle = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';

  const rows = items.map((doc) => `
    <tr style="background:${doc.rule?.kind === 'overdue' ? '#fff5f5' : '#fffbeb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.title || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${doc.doc_code || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.company_name || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${doc.ruleLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatItDate(doc.expiry_date)}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">SGQ Studio \u2014 Promemoria documenti</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} \u00b7 ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:14px">Gentile ${recipientName || 'referente'},</p>
        <p style="font-size:14px;color:#4b5563">Documenti del registro che richiedono attenzione:</p>
        <table style="${tableStyle}">
          <thead><tr>
            <th style="${thStyle}">Documento</th>
            <th style="${thStyle}">Codice</th>
            <th style="${thStyle}">Azienda</th>
            <th style="${thStyle}">Motivo</th>
            <th style="${thStyle}">Scadenza</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Messaggio automatico SGQ Studio. Le notifiche cessano al rinnovo o archiviazione del documento.
        </p>
      </div>
    </div>`;
}

async function wasAlreadySent(pool, documentId, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  const result = await pool.request()
    .input('documentId', documentId)
    .input('email', email)
    .input('alertDate', alertDate)
    .input('thresholdDays', th)
    .query(`
      SELECT TOP 1 id FROM doc_notification_log
      WHERE document_id = @documentId
        AND recipient_email = @email
        AND alert_date = @alertDate
        AND threshold_days = @thresholdDays
    `);
  return (result.recordset || []).length > 0;
}

async function logSent(pool, orgId, documentId, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  try {
    await pool.request()
      .input('orgId', orgId)
      .input('documentId', documentId)
      .input('email', email)
      .input('alertDate', alertDate)
      .input('thresholdDays', th)
      .query(`
        INSERT INTO doc_notification_log
          (organization_id, document_id, recipient_email, alert_date, threshold_days)
        VALUES (@orgId, @documentId, @email, @alertDate, @thresholdDays)
      `);
  } catch (err) {
    if (err.number !== 2627) throw err;
  }
}

async function fetchOrgDocProfiles(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .query(`
      SELECT id, doc_type, name, rules_json
      FROM doc_escalation_profile
      WHERE organization_id = @orgId
      ORDER BY CASE WHEN doc_type IS NULL THEN 0 ELSE 1 END, id ASC
    `);
  return result.recordset || [];
}

function resolveProfileForDoc(profiles, docType, orgConfig) {
  const typed = profiles.find((p) => p.doc_type && p.doc_type === docType);
  if (typed) return typed;
  const defaultProfile = profiles.find((p) => !p.doc_type);
  if (defaultProfile) return defaultProfile;
  if (orgConfig.doc_escalation_profile_id) {
    return profiles.find((p) => p.id === orgConfig.doc_escalation_profile_id) || null;
  }
  return null;
}

async function fetchOrgDocRows(pool, orgId, windowDays) {
  const result = await pool.request()
    .input('orgId', orgId)
    .input('days', windowDays)
    .query(`
      SELECT
        dr.id, dr.title, dr.doc_code, dr.doc_type,
        dr.expiry_date, dr.responsible, dr.status,
        c.name AS company_name
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

function resolveDocRecipients(row, orgConfig, ccFallback) {
  const primary = [];
  if (orgConfig.doc_notify_responsible) {
    const email = parseEmailFromResponsible(row.responsible);
    if (email) primary.push({ email, name: row.responsible });
  }
  const seen = new Set(primary.map((p) => p.email));
  const cc = ccFallback.filter((e) => !seen.has(e));
  return { primary, cc };
}

/**
 * @param {object} orgConfig row notifications_config + organization_name
 */
async function runDocEscalationForOrg(pool, orgConfig) {
  if (!orgConfig.alert_doc_expiry) {
    logger.info(`[DocEscalation] Org ${orgConfig.organization_id}: alert_doc_expiry disabilitato`);
    return { sent: 0 };
  }
  if (orgConfig.doc_escalation_enabled === 0 || orgConfig.doc_escalation_enabled === false) {
    logger.info(`[DocEscalation] Org ${orgConfig.organization_id}: escalation disabilitata`);
    return { sent: 0 };
  }

  const windowDays = parseInt(orgConfig.alert_days_1, 10) || 30;
  const ccFallback = parseRecipientList(orgConfig.recipients_email);
  const profiles = await fetchOrgDocProfiles(pool, orgConfig.organization_id);
  const docs = await fetchOrgDocRows(pool, orgConfig.organization_id, windowDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alertDateStr = today.toISOString().substring(0, 10);

  /** @type {Map<string, { name: string|null, items: object[] }>} */
  const digestByEmail = new Map();

  for (const row of docs) {
    const profile = resolveProfileForDoc(profiles, row.doc_type, orgConfig);
    const thresholds = buildDocEscalationThresholds(
      orgConfig.alert_days_1,
      orgConfig.alert_days_2,
      profile?.rules_json,
    );
    const rule = matchDocAlertRule({
      expiryDate: row.expiry_date,
      status: row.status,
      thresholds,
    });
    if (!rule) continue;

    const { primary } = resolveDocRecipients(row, orgConfig, ccFallback);
    const targets = primary.length > 0
      ? primary
      : ccFallback.map((email) => ({ email, name: null }));

    for (const target of targets) {
      const email = target.email.toLowerCase();
      // eslint-disable-next-line no-await-in-loop
      const already = await wasAlreadySent(
        pool, row.id, email, alertDateStr, rule.thresholdDays,
      );
      if (already) continue;

      if (!digestByEmail.has(email)) {
        digestByEmail.set(email, { name: target.name, items: [] });
      }
      digestByEmail.get(email).items.push({
        ...row,
        rule,
        ruleLabel: ruleLabel(rule),
      });
    }
  }

  let sentCount = 0;
  for (const [email, bucket] of digestByEmail.entries()) {
    if (bucket.items.length === 0) continue;

    const cc = ccFallback.filter((e) => e !== email);
    const html = buildDocAlertHtml(orgConfig.organization_name, bucket.name, bucket.items);
    const subject = `[SGQ] Promemoria documenti \u2014 ${orgConfig.organization_name}`;
    // eslint-disable-next-line no-await-in-loop
    const sent = await sendAlertEmail(
      email,
      subject,
      html,
      cc.length > 0 ? cc.join(', ') : undefined,
    );
    if (!sent) continue;
    sentCount += 1;

    for (const item of bucket.items) {
      // eslint-disable-next-line no-await-in-loop
      await logSent(
        pool,
        orgConfig.organization_id,
        item.id,
        email,
        alertDateStr,
        item.rule.thresholdDays,
      );
    }
  }

  return { sent: sentCount };
}

module.exports = {
  buildDocAlertHtml,
  ruleLabel,
  matchDocAlertRule,
  parseEmailFromResponsible,
  runDocEscalationForOrg,
  buildDocEscalationThresholds,
};
