/**
 * alertScheduler.js — Cron job giornaliero per invio email alert scadenze
 *
 * Orario invio: letto da notifications_config.send_time per org (timezone = ora server Node).
 * NC escalation: send_time + 5 min (separazione digest documenti / NC).
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
 *   NC_ALERT_ENABLED=true
 */

const logger = require('../utils/logger');
const { sendAlertEmail } = require('./alertMail.service');
const {
  sendTimeToCron,
  addMinutesToSendTime,
  DEFAULT_SEND_TIME,
} = require('./alertSchedulerHelpers');
const { runNcEscalationForOrg } = require('./ncAlertEscalation.service');

// Caricamento lazy delle dipendenze opzionali
let schedule;
try {
  schedule = require('node-schedule');
} catch {
  logger.warn('[AlertScheduler] node-schedule non installato — cron job disabilitato. Eseguire: npm install node-schedule');
}

const { getPool } = require('../config/database');

const scheduledJobs = [];

function buildEmailHtml(orgName, expiredDocs, expiringDocs, alertDays1) {
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
        <h3 style="color:#b45309;margin:0 0 12px">🟡 In scadenza entro ${alertDays1} giorni — ${expiringDocs.length}</h3>
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

async function fetchUrgentDocs(pool, orgId, days) {
  const windowDays = parseInt(days, 10) || 30;
  const result = await pool.request()
    .input('orgId', orgId)
    .input('days', windowDays)
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

// ─── Email norme superate ─────────────────────────────────────────────────────

function buildNormValidityEmailHtml(orgName, supersededNorms) {
  const thStyle = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';

  const rows = supersededNorms.map((n) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${n.norm_title || n.standard_code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${n.standard_code}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${n.reason === 'superseded' ? 'Sostituita' : 'Non vigente'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${n.supersededBy || '—'}</td>
    </tr>`).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">SGQ Studio — Norme non più vigenti</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} · ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        <h3 style="color:#b45309;margin:0 0 12px">${supersededNorms.length} norma/e segnalata/e come superata o non vigente</h3>
        <p style="font-size:14px;color:#4b5563">Verifica automatica su cataloghi pubblici (UNI/ISO/BSI, Normattiva, EUR-Lex).</p>
        <table style="${tableStyle}">
          <thead><tr>
            <th style="${thStyle}">Titolo</th>
            <th style="${thStyle}">Codice</th>
            <th style="${thStyle}">Esito</th>
            <th style="${thStyle}">Note</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Messaggio generato dal controllo settimanale del lunedì alle 03:00.
        </p>
      </div>
    </div>`;
}

// ─── Job principale ───────────────────────────────────────────────────────────

async function runAlertJobForSendTime(sendTimeFilter) {
  if (!process.env.ALERT_ENABLED || process.env.ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] Alert disabilitati (ALERT_ENABLED != true)');
    return;
  }

  logger.info(`[AlertScheduler] Avvio job alert scadenze documenti (send_time=${sendTimeFilter || 'all'})...`);
  const pool = await getPool();

  try {
    const orgsResult = await pool.request()
      .input('sendTime', sendTimeFilter || null)
      .query(`
      SELECT nc.organization_id, nc.recipients_email, nc.alert_days_1, nc.alert_days_2,
             nc.send_time, nc.alert_doc_expiry, nc.alert_nc_open,
             o.organization_name
      FROM notifications_config nc
      JOIN organizations o ON nc.organization_id = o.organization_id
      WHERE nc.enabled = 1
        AND nc.alert_doc_expiry = 1
        AND (@sendTime IS NULL OR nc.send_time = @sendTime)
    `);

    const orgs = orgsResult.recordset || [];
    logger.info(`[AlertScheduler] Org con alert documenti attivi: ${orgs.length}`);

    for (const org of orgs) {
      const days1 = parseInt(org.alert_days_1, 10) || 30;
      const docs = await fetchUrgentDocs(pool, org.organization_id, days1);
      if (docs.length === 0) {
        logger.info(`[AlertScheduler] Org ${org.organization_id}: nessun alert documenti`);
        continue;
      }

      const expired  = docs.filter(d => d.is_expired);
      const expiring = docs.filter(d => !d.is_expired);

      const subject = `[SGQ] ${expired.length > 0 ? `${expired.length} documenti scaduti` : ''} ${expiring.length > 0 ? `${expiring.length} in scadenza` : ''} — ${org.organization_name}`.trim();
      const html    = buildEmailHtml(org.organization_name, expired, expiring, days1);

      const sent = await sendAlertEmail(org.recipients_email, subject, html);
      if (sent) {
        logger.info(`[AlertScheduler] Email documenti inviata a ${org.recipients_email} per org ${org.organization_id}`);
      }
    }
  } catch (err) {
    logger.error('[AlertScheduler] Errore job documenti:', err.message);
  }
}

/** @deprecated alias retrocompatibilita test */
async function runAlertJob() {
  return runAlertJobForSendTime(null);
}

// ─── Ottimizzazione knowledge base AI (notturna, dopo reindex) ────────────────

async function runKnowledgeOptimizationJob() {
  logger.info('[AlertScheduler] Avvio job ottimizzazione knowledge base AI...');
  try {
    const { runOptimization } = require('./knowledgeOptimizer.service');
    const pool = await getPool();
    const orgsResult = await pool.request().query(
      'SELECT organization_id FROM organizations WHERE is_active = 1'
    );
    const orgs = orgsResult.recordset || [];
    for (const org of orgs) {
      try {
        const summary = await runOptimization(org.organization_id);
        logger.info(`[AlertScheduler] Knowledge optimization org ${org.organization_id}: dedup=${JSON.stringify(summary.dedup)}, prune=${JSON.stringify(summary.prune)}, gaps=${Array.isArray(summary.gaps) ? summary.gaps.length + ' companies' : 'error'}`);
      } catch (err) {
        logger.error(`[AlertScheduler] Knowledge optimization failed org ${org.organization_id}:`, err.message);
      }
    }
    logger.info(`[AlertScheduler] Ottimizzazione knowledge completata per ${orgs.length} organizzazioni`);
  } catch (err) {
    logger.error('[AlertScheduler] Errore job knowledge optimization:', err.message);
  }
}

// ─── Ottimizzazione knowledge L2 — sintesi AI (settimanale) ───────────────────

async function runKnowledgeL2Job() {
  logger.info('[AlertScheduler] Avvio job knowledge L2 (sintesi AI settimanale)...');
  try {
    const { runLevel2Optimization } = require('./knowledgeOptimizer.service');
    const pool = await getPool();
    const orgsResult = await pool.request().query(
      'SELECT organization_id FROM organizations WHERE is_active = 1'
    );
    const orgs = orgsResult.recordset || [];
    for (const org of orgs) {
      try {
        const summary = await runLevel2Optimization(org.organization_id);
        logger.info(`[AlertScheduler] Knowledge L2 org ${org.organization_id}: synthesis=${JSON.stringify(summary.synthesis)}, crossPatterns=${JSON.stringify(summary.crossPatterns)}, enrichment=${JSON.stringify(summary.enrichment)}`);
      } catch (err) {
        logger.error(`[AlertScheduler] Knowledge L2 failed org ${org.organization_id}:`, err.message);
      }
    }
    logger.info(`[AlertScheduler] Knowledge L2 completata per ${orgs.length} organizzazioni`);
  } catch (err) {
    logger.error('[AlertScheduler] Errore job knowledge L2:', err.message);
  }
}

// ─── Avvio scheduler ──────────────────────────────────────────────────────────

// ─── Verifica validità norme (settimanale) ────────────────────────────────────

async function runNormValidityJob() {
  logger.info('[AlertScheduler] Avvio job verifica validità norme...');
  if (!process.env.ALERT_ENABLED || process.env.ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] Alert disabilitati — skip email norme (verifica DB eseguita)');
  }

  try {
    const { runScheduledValidityCheck } = require('./normValidityChecker.service');
    const pool = await getPool();
    const orgsResult = await pool.request().query(`
      SELECT o.organization_id, o.organization_name, nc.recipients_email, nc.enabled
      FROM organizations o
      LEFT JOIN notifications_config nc ON nc.organization_id = o.organization_id
    `);
    const orgs = orgsResult.recordset || [];

    for (const org of orgs) {
      const { updated } = await runScheduledValidityCheck(org.organization_id);

      if (
        updated.length > 0
        && process.env.ALERT_ENABLED === 'true'
        && org.enabled === 1
        && org.recipients_email
      ) {
        const subject = `[SGQ] ${updated.length} norma/e superata/e — ${org.organization_name}`;
        const html = buildNormValidityEmailHtml(org.organization_name, updated);
        const sent = await sendAlertEmail(org.recipients_email, subject, html);
        if (sent) {
          logger.info(`[AlertScheduler] Email norme superate inviata a ${org.recipients_email} (org ${org.organization_id})`);
        }
      }
    }

    logger.info(`[AlertScheduler] Verifica validità norme completata per ${orgs.length} organizzazioni`);
  } catch (err) {
    logger.error('[AlertScheduler] Errore job validità norme:', err.message);
  }
}

// ─── Indicizzazione knowledge base AI (notturna) ─────────────────────────────

async function runKnowledgeIndexJob() {
  logger.info('[AlertScheduler] Avvio job indicizzazione knowledge base AI...');
  try {
    const { indexAllEntities } = require('./knowledgeIndexer.service');
    const pool = await getPool();
    const orgsResult = await pool.request().query(
      'SELECT organization_id FROM organizations WHERE is_active = 1'
    );
    const orgs = orgsResult.recordset || [];
    for (const org of orgs) {
      try {
        const count = await indexAllEntities(org.organization_id);
        logger.info(`[AlertScheduler] Knowledge index org ${org.organization_id}: ${count} chunks`);
      } catch (err) {
        logger.error(`[AlertScheduler] Knowledge index failed org ${org.organization_id}:`, err.message);
      }
    }
    logger.info(`[AlertScheduler] Indicizzazione knowledge completata per ${orgs.length} organizzazioni`);
  } catch (err) {
    logger.error('[AlertScheduler] Errore job knowledge index:', err.message);
  }
}

async function runNcDueAlertJobForSendTime(sendTimeFilter) {
  if (process.env.ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] NC due alert skip (ALERT_ENABLED != true)');
    return;
  }
  if (process.env.NC_ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] NC due alert skip (NC_ALERT_ENABLED != true)');
    return;
  }

  logger.info(`[AlertScheduler] Avvio escalation NC (send_time=${sendTimeFilter || 'all'})...`);
  const pool = await getPool();

  try {
    const orgsResult = await pool.request()
      .input('sendTime', sendTimeFilter || null)
      .query(`
      SELECT nc.organization_id, nc.recipients_email, nc.alert_days_1, nc.alert_days_2,
             nc.send_time, nc.alert_doc_expiry, nc.alert_nc_open,
             o.organization_name
      FROM notifications_config nc
      JOIN organizations o ON nc.organization_id = o.organization_id
      WHERE nc.enabled = 1
        AND nc.alert_nc_open = 1
        AND (@sendTime IS NULL OR nc.send_time = @sendTime)
    `);
    const orgs = orgsResult.recordset || [];

    for (const org of orgs) {
      const result = await runNcEscalationForOrg(pool, org);
      logger.info(`[AlertScheduler] NC escalation org ${org.organization_id}: email=${result.sent}`);
    }
  } catch (err) {
    logger.error('[AlertScheduler] Errore job NC escalation:', err.message);
  }
}

/** @deprecated alias retrocompatibilita test */
async function runNcDueAlertJob() {
  return runNcDueAlertJobForSendTime(null);
}

async function loadDistinctSendTimes(pool) {
  const result = await pool.request().query(`
    SELECT DISTINCT ISNULL(NULLIF(LTRIM(RTRIM(send_time)), ''), '${DEFAULT_SEND_TIME}') AS send_time
    FROM notifications_config
    WHERE enabled = 1
  `);
  const times = (result.recordset || []).map((r) => r.send_time);
  return times.length > 0 ? times : [DEFAULT_SEND_TIME];
}

function cancelScheduledAlertJobs() {
  for (const job of scheduledJobs) {
    try { job.cancel(); } catch { /* ignore */ }
  }
  scheduledJobs.length = 0;
}

async function scheduleDynamicAlertJobs() {
  if (!schedule) return;

  cancelScheduledAlertJobs();

  let sendTimes = [DEFAULT_SEND_TIME];
  try {
    const pool = await getPool();
    sendTimes = await loadDistinctSendTimes(pool);
  } catch (err) {
    logger.warn('[AlertScheduler] Impossibile leggere send_time da DB, uso default 08:00:', err.message);
  }

  for (const sendTime of sendTimes) {
    const docCron = sendTimeToCron(sendTime);
    const ncSlot = addMinutesToSendTime(sendTime, 5);

    const docJob = schedule.scheduleJob(docCron, () => {
      runAlertJobForSendTime(sendTime).catch((err) => logger.error('[AlertScheduler] Errore doc alert:', err.message));
    });
    if (docJob) scheduledJobs.push(docJob);

    const ncJob = schedule.scheduleJob(ncSlot.cron, () => {
      runNcDueAlertJobForSendTime(sendTime).catch((err) => logger.error('[AlertScheduler] Errore NC alert:', err.message));
    });
    if (ncJob) scheduledJobs.push(ncJob);

    logger.info(`[AlertScheduler] Job programmati send_time=${sendTime} (doc ${docCron}, NC ${ncSlot.cron})`);
  }
}


function startAlertScheduler() {
  if (!schedule) {
    logger.warn('[AlertScheduler] node-schedule non disponibile — scheduler non avviato');
    return;
  }

  scheduleDynamicAlertJobs().catch((err) => {
    logger.error('[AlertScheduler] Errore scheduling dinamico:', err.message);
  });

  // Ricarica send_time da DB ogni notte
  schedule.scheduleJob('1 0 * * *', () => {
    scheduleDynamicAlertJobs().catch((err) => logger.error('[AlertScheduler] Reload send_time:', err.message));
  });

  // Ogni lunedì alle 03:00 — verifica validità norme
  schedule.scheduleJob('0 3 * * 1', () => {
    runNormValidityJob().catch(err => logger.error('[AlertScheduler] Errore non gestito (norme):', err.message));
  });

  // Ogni notte alle 02:00 — indicizzazione knowledge base AI
  schedule.scheduleJob('0 2 * * *', () => {
    runKnowledgeIndexJob().catch(err => logger.error('[AlertScheduler] Errore non gestito (knowledge):', err.message));
  });

  // Ogni notte alle 03:00 — ottimizzazione knowledge base AI (dopo reindex)
  schedule.scheduleJob('0 3 * * *', () => {
    runKnowledgeOptimizationJob().catch(err => logger.error('[AlertScheduler] Errore non gestito (optimization):', err.message));
  });

  // Ogni domenica alle 04:00 — sintesi AI settimanale (Livello 2)
  schedule.scheduleJob('0 4 * * 0', () => {
    runKnowledgeL2Job().catch(err => logger.error('[AlertScheduler] Errore non gestito (knowledge L2):', err.message));
  });

  logger.info('[AlertScheduler] Scheduler avviato — alert dinamici da notifications_config.send_time, norme lun 03:00, knowledge index 02:00');
}

module.exports = {
  startAlertScheduler,
  runAlertJob,
  runAlertJobForSendTime,
  runNormValidityJob,
  runKnowledgeIndexJob,
  runKnowledgeOptimizationJob,
  runKnowledgeL2Job,
  runNcDueAlertJob,
  runNcDueAlertJobForSendTime,
  scheduleDynamicAlertJobs,
};
