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
const { sendAlertEmail } = require('./alertMail.service');

// Caricamento lazy delle dipendenze opzionali
let schedule;
try {
  schedule = require('node-schedule');
} catch {
  logger.warn('[AlertScheduler] node-schedule non installato — cron job disabilitato. Eseguire: npm install node-schedule');
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

const NC_ALERT_DAYS = 7;

function formatItDate(d) {
  if (!d) return '\u2014';
  const raw = String(d);
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : raw;
}

function buildNcDueEmailHtml(orgName, overdueNcs, dueSoonNcs, overdueActions, dueSoonActions) {
  const thStyle = 'padding:8px 12px;background:#1e3a5f;color:#fff;text-align:left;font-size:12px';
  const tableStyle = 'width:100%;border-collapse:collapse;font-size:14px;margin-bottom:24px';
  const ncRow = (row, overdue) => `
    <tr style="background:${overdue ? '#fff5f5' : '#fffbeb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${row.nc_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${row.title || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${row.status || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${overdue ? '#dc2626' : '#b45309'};font-weight:600">${overdue ? 'Scaduta' : `Scade ${formatItDate(row.due_date)}`}</td>
    </tr>`;
  const actionRow = (row, overdue) => `
    <tr style="background:${overdue ? '#fff5f5' : '#fffbeb'}">
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-family:monospace">${row.nc_number || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${row.description || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb">${row.responsible || '\u2014'}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:${overdue ? '#dc2626' : '#b45309'};font-weight:600">${overdue ? 'Scaduta' : `Scade ${formatItDate(row.due_date)}`}</td>
    </tr>`;

  const section = (title, color, headers, rowsHtml) => rowsHtml ? `
    <h3 style="color:${color};margin:0 0 12px">${title}</h3>
    <table style="${tableStyle}"><thead><tr>${headers.map((h) => `<th style="${thStyle}">${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table>` : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;color:#111827">
      <div style="background:#1e3a5f;padding:20px 24px;border-radius:8px 8px 0 0">
        <h2 style="margin:0;color:#fff;font-size:18px">SGQ Studio \u2014 Alert NC e azioni correttive</h2>
        <p style="margin:4px 0 0;color:#93c5fd;font-size:13px">${orgName} \u00b7 ${new Date().toLocaleDateString('it-IT')}</p>
      </div>
      <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
        ${section('NC scadute', '#dc2626', ['Numero', 'Titolo', 'Stato', 'Scadenza'], overdueNcs.map((r) => ncRow(r, true)).join(''))}
        ${section(`NC in scadenza entro ${NC_ALERT_DAYS} giorni`, '#b45309', ['Numero', 'Titolo', 'Stato', 'Scadenza'], dueSoonNcs.map((r) => ncRow(r, false)).join(''))}
        ${section('Azioni scadute', '#dc2626', ['NC', 'Descrizione', 'Responsabile', 'Scadenza'], overdueActions.map((r) => actionRow(r, true)).join(''))}
        ${section(`Azioni in scadenza entro ${NC_ALERT_DAYS} giorni`, '#b45309', ['NC', 'Descrizione', 'Responsabile', 'Scadenza'], dueSoonActions.map((r) => actionRow(r, false)).join(''))}
        <p style="font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;margin:0">
          Messaggio automatico SGQ Studio (NC_ALERT_ENABLED=true).
        </p>
      </div>
    </div>`;
}

async function fetchNcDueItems(pool, orgId) {
  const ncResult = await pool.request()
    .input('orgId', orgId)
    .input('days', NC_ALERT_DAYS)
    .query(`
      SELECT nc.nc_id, nc.nc_number, nc.title, nc.status, nc.due_date,
        CASE WHEN nc.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS is_overdue
      FROM non_conformities nc
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE a.organization_id = @orgId
        AND nc.due_date IS NOT NULL
        AND nc.status NOT IN ('closed', 'verified')
        AND (
          nc.due_date < CAST(GETDATE() AS DATE)
          OR nc.due_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
        )
      ORDER BY nc.due_date ASC
    `);

  const actionResult = await pool.request()
    .input('orgId', orgId)
    .input('days', NC_ALERT_DAYS)
    .query(`
      SELECT na.action_id, na.nc_id, nc.nc_number, na.description, na.responsible, na.due_date, na.status,
        CASE WHEN na.due_date < CAST(GETDATE() AS DATE) THEN 1 ELSE 0 END AS is_overdue
      FROM nc_actions na
      INNER JOIN non_conformities nc ON na.nc_id = nc.nc_id
      INNER JOIN audits a ON nc.audit_id = a.audit_id
      WHERE a.organization_id = @orgId
        AND na.due_date IS NOT NULL
        AND na.status NOT IN ('verified')
        AND (
          na.due_date < CAST(GETDATE() AS DATE)
          OR na.due_date <= DATEADD(day, @days, CAST(GETDATE() AS DATE))
        )
      ORDER BY na.due_date ASC
    `);

  return { ncs: ncResult.recordset || [], actions: actionResult.recordset || [] };
}

async function runNcDueAlertJob() {
  if (process.env.ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] NC due alert skip (ALERT_ENABLED != true)');
    return;
  }
  if (process.env.NC_ALERT_ENABLED !== 'true') {
    logger.info('[AlertScheduler] NC due alert skip (NC_ALERT_ENABLED != true)');
    return;
  }

  logger.info('[AlertScheduler] Avvio job alert NC/azioni in scadenza...');
  const pool = await getPool();

  try {
    const orgsResult = await pool.request().query(`
      SELECT nc.organization_id, nc.recipients_email, o.organization_name
      FROM notifications_config nc
      JOIN organizations o ON nc.organization_id = o.organization_id
      WHERE nc.enabled = 1
    `);
    const orgs = orgsResult.recordset || [];

    for (const org of orgs) {
      const { ncs, actions } = await fetchNcDueItems(pool, org.organization_id);
      if (ncs.length === 0 && actions.length === 0) {
        logger.info(`[AlertScheduler] Org ${org.organization_id}: nessuna NC/azione in alert`);
        continue;
      }

      const overdueNcs = ncs.filter((r) => r.is_overdue);
      const dueSoonNcs = ncs.filter((r) => !r.is_overdue);
      const overdueActions = actions.filter((r) => r.is_overdue);
      const dueSoonActions = actions.filter((r) => !r.is_overdue);

      const subject = `[SGQ] NC/azioni in scadenza \u2014 ${org.organization_name}`;
      const html = buildNcDueEmailHtml(org.organization_name, overdueNcs, dueSoonNcs, overdueActions, dueSoonActions);
      const sent = await sendAlertEmail(org.recipients_email, subject, html);
      logger.info(`[AlertScheduler] NC alert org ${org.organization_id}: inviato=${sent}`);
    }
  } catch (err) {
    logger.error('[AlertScheduler] Errore job NC due alert:', err.message);
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

  schedule.scheduleJob('5 8 * * *', () => {
    runNcDueAlertJob().catch(err => logger.error('[AlertScheduler] NC due alert:', err.message));
  });

  logger.info('[AlertScheduler] Scheduler avviato — alert 08:00, NC 08:05, norme lun 03:00, knowledge index 02:00, optimization 03:00, L2 synthesis dom 04:00');
}

module.exports = { startAlertScheduler, runAlertJob, runNormValidityJob, runKnowledgeIndexJob, runKnowledgeOptimizationJob, runKnowledgeL2Job, runNcDueAlertJob };
