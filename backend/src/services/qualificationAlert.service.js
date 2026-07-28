'use strict';

/**
 * Alert email qualifiche (scadenza certificato + conferma semestrale ISO 9606).
 * Destinatari: coordinatore responsabile per azienda (fallback difensivo su rubrica/contatti).
 */

const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const {
  buildDocEscalationThresholds,
  daysUntilDue,
  parseRecipientList,
  uniqueEmails,
} = require('./alertSchedulerHelpers');
const { requiresSemiannualConfirmation } = require('./weldingCoordinatorAuth.service');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function validEmail(email) {
  return email && EMAIL_RE.test(String(email).trim().toLowerCase());
}

/**
 * Data guida alert: la piu' imminente tra expiry_date e next_confirmation_due
 * (qualifiche ISO 9606-1 e ISO 14732, entrambe con conferma semestrale).
 * @returns {{ date: string|null, kind: 'expiry'|'confirmation'|null }}
 */
function effectiveAlertDue(q) {
  const expiry = q.expiry_date || null;
  if (!requiresSemiannualConfirmation(q.qualification_type)) {
    return { date: expiry, kind: expiry ? 'expiry' : null };
  }
  const nextConf = q.next_confirmation_due || null;
  if (!expiry && !nextConf) return { date: null, kind: null };
  if (!expiry) return { date: nextConf, kind: 'confirmation' };
  if (!nextConf) return { date: expiry, kind: 'expiry' };
  return new Date(nextConf) < new Date(expiry)
    ? { date: nextConf, kind: 'confirmation' }
    : { date: expiry, kind: 'expiry' };
}

function matchQualAlertRule({ effectiveDate, status, thresholds }) {
  if (['revocata', 'sospesa'].includes(status)) return null;
  const daysLeft = daysUntilDue(effectiveDate);
  if (daysLeft === null) return null;
  if (daysLeft < 0) return { kind: 'overdue', thresholdDays: null };
  if (thresholds.includes(daysLeft)) return { kind: 'threshold', thresholdDays: daysLeft };
  return null;
}

function normalizeThresholdDays(thresholdDays) {
  return thresholdDays == null ? -1 : thresholdDays;
}

function ruleLabel(rule, alertKind) {
  if (!rule) return '';
  const prefix = alertKind === 'confirmation' ? 'Conferma semestrale' : 'Scadenza certificato';
  if (rule.kind === 'overdue') return `${prefix} — scaduta (promemoria giornaliero)`;
  return `${prefix} — tra ${rule.thresholdDays} giorni`;
}

function formatItDate(d) {
  if (!d) return '\u2014';
  const raw = String(d);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

function buildQualAlertHtml(orgName, recipientName, items) {
  const thStyle = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';

  const rows = items.map((q) => `
    <tr style="background:${q.rule?.kind === 'overdue' ? '#fff5f5' : '#fffbeb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${q.person_name || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${q.qualification_type || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${q.company_name || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${q.ruleLabel}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${formatItDate(q.effective_date)}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">SGQ Studio \u2014 Promemoria qualifiche</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} \u00b7 ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <p style="font-size:14px">Gentile ${recipientName || 'coordinatore'},</p>
        <p style="font-size:14px;color:#4b5563">Qualifiche del personale che richiedono attenzione (certificato o conferma semestrale):</p>
        <table style="${tableStyle}">
          <thead><tr>
            <th style="${thStyle}">Persona</th>
            <th style="${thStyle}">Tipo</th>
            <th style="${thStyle}">Azienda</th>
            <th style="${thStyle}">Motivo</th>
            <th style="${thStyle}">Data guida</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Messaggio automatico SGQ Studio. Le notifiche cessano al rinnovo o alla conferma registrata.
        </p>
      </div>
    </div>`;
}

/**
 * Risolve destinatari coordinatore saldatura per azienda.
 * Ordine: notification_contacts (company) → company_personnel (job coordinatore) → user_company_access → fallback org.
 */
async function resolveWeldingCoordinatorRecipients(pool, orgId, companyId, orgFallbackEmail) {
  const nc = await pool.request()
    .input('orgId', orgId)
    .input('compId', companyId)
    .query(`
      SELECT name, email
      FROM notification_contacts
      WHERE organization_id = @orgId
        AND company_id = @compId
        AND active = 1
        AND email IS NOT NULL
        AND LTRIM(RTRIM(email)) <> ''
      ORDER BY id ASC
    `);
  const contacts = (nc.recordset || []).filter((r) => validEmail(r.email));
  if (contacts.length > 0) {
    return {
      primary: { email: contacts[0].email.trim().toLowerCase(), name: contacts[0].name },
      cc: uniqueEmails(contacts.slice(1).map((c) => c.email)),
      source: 'notification_contacts',
    };
  }

  const pers = await pool.request()
    .input('orgId', orgId)
    .input('compId', companyId)
    .query(`
      SELECT name, email, can_verify, job_title
      FROM company_personnel
      WHERE organization_id = @orgId
        AND company_id = @compId
        AND active = 1
        AND email IS NOT NULL
        AND LTRIM(RTRIM(email)) <> ''
        AND (
          job_title LIKE '%coordinat%'
          OR job_title LIKE '%saldatur%'
          OR job_title LIKE '%IWE%'
          OR job_title LIKE '%IWT%'
          OR job_title LIKE '%IWS%'
        )
      ORDER BY can_verify DESC, id ASC
    `);
  const personnel = (pers.recordset || []).filter((r) => validEmail(r.email));
  if (personnel.length > 0) {
    return {
      primary: { email: personnel[0].email.trim().toLowerCase(), name: personnel[0].name },
      cc: uniqueEmails(personnel.slice(1).map((p) => p.email)),
      source: 'company_personnel',
    };
  }

  const users = await pool.request()
    .input('compId', companyId)
    .query(`
      SELECT u.full_name AS name, u.email, u.role
      FROM users u
      INNER JOIN user_company_access uca ON uca.user_id = u.user_id
      WHERE uca.company_id = @compId
        AND u.is_active = 1
        AND u.email IS NOT NULL
        AND LTRIM(RTRIM(u.email)) <> ''
        AND u.role IN ('coordinatore', 'admin', 'superadmin', 'auditor')
      ORDER BY CASE WHEN u.role = 'coordinatore' THEN 0 ELSE 1 END, u.user_id ASC
    `);
  const userRows = (users.recordset || []).filter((r) => validEmail(r.email));
  if (userRows.length > 0) {
    return {
      primary: { email: userRows[0].email.trim().toLowerCase(), name: userRows[0].name },
      cc: uniqueEmails(userRows.slice(1).map((u) => u.email)),
      source: 'user_company_access',
    };
  }

  const fallback = parseRecipientList(orgFallbackEmail);
  if (fallback.length > 0) {
    return {
      primary: { email: fallback[0], name: 'Coordinatore' },
      cc: fallback.slice(1),
      source: 'org_fallback',
    };
  }

  return { primary: null, cc: [], source: 'none' };
}

async function wasAlreadySent(pool, qualificationId, alertKind, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  const result = await pool.request()
    .input('qualId', qualificationId)
    .input('kind', alertKind)
    .input('email', email)
    .input('alertDate', alertDate)
    .input('thresholdDays', th)
    .query(`
      SELECT TOP 1 id FROM qual_notification_log
      WHERE qualification_id = @qualId
        AND alert_kind = @kind
        AND recipient_email = @email
        AND alert_date = @alertDate
        AND threshold_days = @thresholdDays
    `);
  return (result.recordset || []).length > 0;
}

async function logSent(pool, orgId, qualificationId, alertKind, email, alertDate, thresholdDays) {
  const th = normalizeThresholdDays(thresholdDays);
  try {
    await pool.request()
      .input('orgId', orgId)
      .input('qualId', qualificationId)
      .input('kind', alertKind)
      .input('email', email)
      .input('alertDate', alertDate)
      .input('thresholdDays', th)
      .query(`
        INSERT INTO qual_notification_log
          (organization_id, qualification_id, alert_kind, recipient_email, alert_date, threshold_days)
        VALUES (@orgId, @qualId, @kind, @email, @alertDate, @thresholdDays)
      `);
  } catch (err) {
    if (err.number !== 2627) throw err;
  }
}

async function fetchQualificationsForDeadline(pool, orgId) {
  const result = await pool.request()
    .input('orgId', orgId)
    .query(`
      SELECT
        q.id, q.organization_id, q.company_id, q.person_name,
        q.qualification_type, q.certificate_number,
        q.expiry_date, q.next_confirmation_due,
        q.status, q.approval_status,
        c.name AS company_name
      FROM qualifications q
      LEFT JOIN companies c ON c.id = q.company_id
      WHERE q.organization_id = @orgId
        AND q.status NOT IN ('revocata', 'sospesa')
        AND (q.expiry_date IS NOT NULL OR q.next_confirmation_due IS NOT NULL)
    `);
  return result.recordset || [];
}

async function fetchQualificationsForAlert(pool, orgId) {
  // Nessun gate su approval_status (rimosso — v. qualifications.controller.js header):
  // le qualifiche sono attive alla creazione, l'esclusione avviene solo su status/date
  // in fetchQualificationsForDeadline (revocata/sospesa) e in matchQualAlertRule.
  return fetchQualificationsForDeadline(pool, orgId);
}

async function runQualifEscalationForOrg(pool, org) {
  const thresholds = buildDocEscalationThresholds(org.alert_days_1, org.alert_days_2, null);
  const todayStr = new Date().toISOString().slice(0, 10);
  const rows = await fetchQualificationsForAlert(pool, org.organization_id);

  const byCompany = new Map();
  for (const row of rows) {
    const { date, kind } = effectiveAlertDue(row);
    if (!date || !kind) continue;
    const rule = matchQualAlertRule({
      effectiveDate: date,
      status: row.status,
      thresholds,
    });
    if (!rule) continue;

    const enriched = {
      ...row,
      effective_date: date,
      alert_kind: kind,
      rule,
      ruleLabel: ruleLabel(rule, kind),
    };

    const compKey = row.company_id || 0;
    if (!byCompany.has(compKey)) byCompany.set(compKey, []);
    byCompany.get(compKey).push(enriched);
  }

  let sentCount = 0;

  for (const [companyId, items] of byCompany.entries()) {
    if (!companyId) continue;

    const routing = await resolveWeldingCoordinatorRecipients(
      pool,
      org.organization_id,
      companyId,
      org.recipients_email
    );
    if (!routing.primary) {
      logger.warn(`[QualAlert] Nessun destinatario per company ${companyId} org ${org.organization_id}`);
      continue;
    }

    const toSend = [];
    for (const item of items) {
      const already = await wasAlreadySent(
        pool,
        item.id,
        item.alert_kind,
        routing.primary.email,
        todayStr,
        item.rule.thresholdDays
      );
      if (!already) toSend.push(item);
    }
    if (toSend.length === 0) continue;

    const subject = `[SGQ] ${toSend.length} qualifica/e in scadenza — ${org.organization_name}`;
    const html = buildQualAlertHtml(org.organization_name, routing.primary.name, toSend);
    const ccList = uniqueEmails([...routing.cc, ...parseRecipientList(org.recipients_email).filter((e) => e !== routing.primary.email)]);
    const ccStr = ccList.length ? ccList.join(',') : undefined;

    const sent = await sendAlertEmail(routing.primary.email, subject, html, ccStr);
    if (sent) {
      for (const item of toSend) {
        await logSent(
          pool,
          org.organization_id,
          item.id,
          item.alert_kind,
          routing.primary.email,
          todayStr,
          item.rule.thresholdDays
        );
      }
      sentCount += 1;
      logger.info(`[QualAlert] Email inviata a ${routing.primary.email} (org ${org.organization_id}, company ${companyId}, ${toSend.length} qualifiche, source=${routing.source})`);
    }
  }

  return { sent: sentCount };
}

/** Righe virtuali per scadenzario unificato (ADR-013 estensione). */
function mapQualificationDeadlineRows(rows, daysWindow = 365) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out = [];

  for (const q of rows) {
    if (['revocata', 'sospesa'].includes(q.status)) continue;
    const { date, kind } = effectiveAlertDue(q);
    if (!date) continue;

    const daysLeft = daysUntilDue(date);
    if (daysLeft === null || daysLeft > daysWindow) continue;

    const kindLabel = kind === 'confirmation' ? 'Conferma semestrale' : 'Scadenza certificato';
    out.push({
      id: `qual-${q.id}`,
      item_type: 'qualification',
      qualification_id: q.id,
      title: `Qualifica: ${q.person_name} (${q.qualification_type || 'n/d'})`,
      due_date: date,
      days_until_due: daysLeft,
      category: 'qualifica',
      reference_code: q.certificate_number || null,
      source_document_id: null,
      source_document_title: `Registro qualifiche — ${kindLabel}`,
      company_id: q.company_id,
      company_name: q.company_name || null,
      status: 'active',
      alert_kind: kind,
    });
  }

  return out.sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
}

module.exports = {
  effectiveAlertDue,
  matchQualAlertRule,
  resolveWeldingCoordinatorRecipients,
  runQualifEscalationForOrg,
  fetchQualificationsForAlert,
  fetchQualificationsForDeadline,
  mapQualificationDeadlineRows,
};
