'use strict';

/**
 * Escalation email NC/azioni verso referenti rubrica.
 * CC/fallback: notifications_config.recipients_email
 */

const { getPool } = require('../config/database');
const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const {
  buildEscalationThresholds,
  matchNcAlertRule,
  matchActionAlertRule,
  parseRecipientList,
  uniqueEmails,
} = require('./alertSchedulerHelpers');

function formatItDate(d) {
  if (!d) return '\u2014';
  const raw = String(d);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

function buildDigestHtml(orgName, recipientName, ncItems, actionItems) {
  const thStyle = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';

  const ncRows = ncItems.map((r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${r.nc_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.title || r.description?.substring(0, 80) || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.ruleLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatItDate(r.due_date) || '\u2014'}</td>
    </tr>`).join('');

  const actionRows = actionItems.map((r) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${r.nc_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.description?.substring(0, 80) || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${r.ruleLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatItDate(r.due_date)}</td>
    </tr>`).join('');

  const section = (title, headers, rowsHtml) => rowsHtml ? `
    <h3 style="color:#b45309;margin:0 0 12px">${title}</h3>
    <table style="${tableStyle}">
      <thead><tr>${headers.map((h) => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>` : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">SGQ Studio \u2014 Promemoria NC</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} \u00b7 ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:14px">Gentile ${recipientName || 'referente'},</p>
        <p style="font-size:14px;color:#4b5563">Riepilogo NC e azioni che richiedono attenzione:</p>
        ${section('Non conformit\u00e0', ['Numero', 'Titolo/Descrizione', 'Motivo', 'Scadenza'], ncRows)}
        ${section('Azioni correttive', ['NC', 'Descrizione', 'Motivo', 'Scadenza'], actionRows)}
        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Messaggio automatico SGQ Studio. Le notifiche cessano alla chiusura/verifica.
        </p>
      </div>
    </div>`;
}

function ruleLabel(rule) {
  if (!rule) return '';
  if (rule.kind === 'overdue') return 'Scaduta \u2014 promemoria giornaliero';
  if (rule.kind === 'open_stale') return `Aperta da oltre ${rule.thresholdDays} giorni`;
  return `Scadenza tra ${rule.thresholdDays} giorni`;
}

/** -1 = promemoria giornaliero post-scadenza (evita NULL in UNIQUE SQL Server). */
function normalizeThresholdDays(thresholdDays) {
  return thresholdDays == null ? -1 : thresholdDays;
}

async function wasAlreadySent(pool, entityType, entityId, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  const result = await pool.request()
    .input('entityType', entityType)
    .input('entityId', entityId)
    .input('email', email)
    .input('alertDate', alertDate)
    .input('thresholdDays', th)
    .query(`
      SELECT TOP 1 id FROM nc_notification_log
      WHERE entity_type = @entityType
        AND entity_id = @entityId
        AND recipient_email = @email
        AND alert_date = @alertDate
        AND threshold_days = @thresholdDays
    `);
  return (result.recordset || []).length > 0;
}

async function logSent(pool, orgId, entityType, entityId, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  try {
    await pool.request()
      .input('orgId', orgId)
      .input('entityType', entityType)
      .input('entityId', entityId)
      .input('email', email)
      .input('alertDate', alertDate)
      .input('thresholdDays', th)
      .query(`
        INSERT INTO nc_notification_log
          (organization_id, entity_type, entity_id, recipient_email, alert_date, threshold_days)
        VALUES (@orgId, @entityType, @entityId, @email, @alertDate, @thresholdDays)
      `);
  } catch (err) {
    if (err.number !== 2627) throw err;
  }
}

async function fetchOrgNcRows(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .query(`
      SELECT
        nc.nc_id, nc.nc_number, nc.title, nc.description, nc.status, nc.due_date, nc.created_at,
        nc.responsible_person, nc.verification_responsible,
        nc.responsible_contact_id, nc.verification_contact_id,
        rc.name AS responsible_contact_name, rc.email AS responsible_contact_email,
        vc.name AS verification_contact_name, vc.email AS verification_contact_email
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      LEFT JOIN notification_contacts rc ON nc.responsible_contact_id = rc.id AND rc.active = 1
      LEFT JOIN notification_contacts vc ON nc.verification_contact_id = vc.id AND vc.active = 1
      WHERE a.organization_id = @orgId
        AND nc.status NOT IN ('closed', 'verified')
    `);
  return result.recordset || [];
}

async function fetchOrgActionRows(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .query(`
      SELECT
        na.action_id, na.nc_id, na.description, na.responsible, na.due_date, na.status,
        nc.nc_number,
        na.responsible_contact_id,
        rc.name AS responsible_contact_name, rc.email AS responsible_contact_email
      FROM nc_actions na
      INNER JOIN non_conformities nc ON na.nc_id = nc.nc_id
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      LEFT JOIN notification_contacts rc ON na.responsible_contact_id = rc.id AND rc.active = 1
      WHERE a.organization_id = @orgId
        AND na.status NOT IN ('verified')
        AND nc.status NOT IN ('closed', 'verified')
    `);
  return result.recordset || [];
}

function resolveNcRecipients(row, ccFallback) {
  const primary = [];
  if (row.responsible_contact_email) {
    primary.push({ email: row.responsible_contact_email, name: row.responsible_contact_name });
  }
  if (row.verification_contact_email) {
    primary.push({ email: row.verification_contact_email, name: row.verification_contact_name });
  }
  const deduped = [];
  const seen = new Set();
  for (const p of primary) {
    const key = p.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(p);
    }
  }
  return { primary: deduped, cc: ccFallback.filter((e) => !seen.has(e)) };
}

function resolveActionRecipients(row, ccFallback) {
  const primary = [];
  if (row.responsible_contact_email) {
    primary.push({ email: row.responsible_contact_email, name: row.responsible_contact_name });
  }
  const seen = new Set(primary.map((p) => p.email.toLowerCase()));
  return { primary, cc: ccFallback.filter((e) => !seen.has(e)) };
}

/**
 * @param {object} orgConfig row notifications_config + organization_name
 */
async function runNcEscalationForOrg(pool, orgConfig) {
  if (!orgConfig.alert_nc_open) {
    logger.info(`[NcEscalation] Org ${orgConfig.organization_id}: alert_nc_open disabilitato`);
    return { sent: 0 };
  }

  const thresholds = buildEscalationThresholds(orgConfig.alert_days_1, orgConfig.alert_days_2);
  const ccFallback = parseRecipientList(orgConfig.recipients_email);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const alertDateStr = today.toISOString().substring(0, 10);

  const ncs = await fetchOrgNcRows(pool, orgConfig.organization_id);
  const actions = await fetchOrgActionRows(pool, orgConfig.organization_id);

  /** @type {Map<string, { name: string, nc: object[], actions: object[] }>} */
  const digestByEmail = new Map();

  for (const row of ncs) {
    const rule = matchNcAlertRule({
      dueDate: row.due_date,
      createdAt: row.created_at,
      status: row.status,
      alertDays1: orgConfig.alert_days_1,
      thresholds,
    });
    if (!rule) continue;

    const { primary, cc } = resolveNcRecipients(row, ccFallback);
    const targets = primary.length > 0
      ? primary
      : ccFallback.map((email) => ({ email, name: null }));

    for (const target of targets) {
      const email = target.email.toLowerCase();
      // eslint-disable-next-line no-await-in-loop
      const already = await wasAlreadySent(
        pool, 'nc', row.nc_id, email, alertDateStr, rule.thresholdDays,
      );
      if (already) continue;

      if (!digestByEmail.has(email)) {
        digestByEmail.set(email, { name: target.name, nc: [], actions: [] });
      }
      digestByEmail.get(email).nc.push({ ...row, ruleLabel: ruleLabel(rule), rule, entityType: 'nc', entityId: row.nc_id });
    }
  }

  for (const row of actions) {
    const rule = matchActionAlertRule({
      dueDate: row.due_date,
      status: row.status,
      thresholds,
    });
    if (!rule) continue;

    const { primary } = resolveActionRecipients(row, ccFallback);
    const targets = primary.length > 0
      ? primary
      : ccFallback.map((email) => ({ email, name: null }));

    for (const target of targets) {
      const email = target.email.toLowerCase();
      // eslint-disable-next-line no-await-in-loop
      const already = await wasAlreadySent(
        pool, 'action', row.action_id, email, alertDateStr, rule.thresholdDays,
      );
      if (already) continue;

      if (!digestByEmail.has(email)) {
        digestByEmail.set(email, { name: target.name, nc: [], actions: [] });
      }
      digestByEmail.get(email).actions.push({
        ...row,
        ruleLabel: ruleLabel(rule),
        rule,
        entityType: 'action',
        entityId: row.action_id,
      });
    }
  }

  let sentCount = 0;
  for (const [email, bucket] of digestByEmail.entries()) {
    if (bucket.nc.length === 0 && bucket.actions.length === 0) continue;

    const cc = ccFallback.filter((e) => e !== email);
    const html = buildDigestHtml(orgConfig.organization_name, bucket.name, bucket.nc, bucket.actions);
    const subject = `[SGQ] Promemoria NC \u2014 ${orgConfig.organization_name}`;
    // eslint-disable-next-line no-await-in-loop
    const sent = await sendAlertEmail(
      email,
      subject,
      html,
      cc.length > 0 ? cc.join(', ') : undefined,
    );
    if (!sent) continue;
    sentCount += 1;

    for (const item of bucket.nc) {
      // eslint-disable-next-line no-await-in-loop
      await logSent(
        pool,
        orgConfig.organization_id,
        'nc',
        item.entityId,
        email,
        alertDateStr,
        item.rule.thresholdDays,
      );
    }
    for (const item of bucket.actions) {
      // eslint-disable-next-line no-await-in-loop
      await logSent(
        pool,
        orgConfig.organization_id,
        'action',
        item.entityId,
        email,
        alertDateStr,
        item.rule.thresholdDays,
      );
    }
  }

  return { sent: sentCount };
}

module.exports = {
  buildDigestHtml,
  ruleLabel,
  runNcEscalationForOrg,
  matchNcAlertRule,
  matchActionAlertRule,
};
