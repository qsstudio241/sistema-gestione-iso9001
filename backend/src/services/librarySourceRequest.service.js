'use strict';

const logger = require('../utils/logger');
const { query } = require('../config/database');
const { sendAlertEmail } = require('./alertMail.service');
const { normalizeGap } = require('../utils/parseSourceGaps');

const DEDUPE_DAYS = 7;

async function findOpenDuplicate(organizationId, sourceCode) {
  const res = await query(
    `SELECT TOP 1 *
     FROM library_source_requests
     WHERE requesting_organization_id = @orgId
       AND source_code = @code
       AND status IN (N'open', N'in_progress')
       AND created_at >= DATEADD(day, -${DEDUPE_DAYS}, SYSUTCDATETIME())
     ORDER BY created_at DESC`,
    { orgId: organizationId, code: sourceCode }
  );
  return (res.recordset || [])[0] || null;
}

async function listSuperadminEmails() {
  try {
    const res = await query(
      `SELECT email FROM users
       WHERE role = N'superadmin'
         AND is_active = 1
         AND email IS NOT NULL
         AND LEN(LTRIM(RTRIM(email))) > 3`
    );
    const emails = (res.recordset || [])
      .map((r) => String(r.email || '').trim())
      .filter((e) => e.includes('@'));
    return [...new Set(emails)];
  } catch (err) {
    logger.warn('[LibrarySourceRequest] listSuperadminEmails failed:', err.message);
    return [];
  }
}

async function notifySuperadmins(row) {
  const emails = await listSuperadminEmails();
  if (!emails.length) {
    logger.warn('[LibrarySourceRequest] nessun superadmin con email — skip notify');
    return false;
  }
  const pathLabel =
    row.closure_path === 'tenant'
      ? 'Via 1 — ingest tenant (Libreria/Documenti)'
      : 'Via 2 — digitalizzazione piattaforma (Cursor / PDF\u2192MD, solo superadmin)';
  const html = `
    <p>L'assistente AI ha segnalato una <strong>fonte mancante</strong> (know-how).</p>
    <ul>
      <li><strong>Codice:</strong> ${escapeHtml(row.source_code)}</li>
      <li><strong>Titolo:</strong> ${escapeHtml(row.source_title || '—')}</li>
      <li><strong>Organizzazione richiedente:</strong> ${row.requesting_organization_id}</li>
      <li><strong>Percorso chiusura:</strong> ${escapeHtml(pathLabel)}</li>
      <li><strong>Perch&eacute; serve:</strong> ${escapeHtml(row.reason || '—')}</li>
      <li><strong>Note qualit&agrave;:</strong> ${escapeHtml(row.quality_notes || '—')}</li>
    </ul>
    <p>Nessun automatismo PDF\u2192JSON: digitalizza in Cursor se via piattaforma, poi aggiorna lo stato in Libreria (slice successive).</p>
  `;
  try {
    const ok = await sendAlertEmail(
      emails.join(','),
      `[SGQ Libreria] Fonte mancante: ${row.source_code}`,
      html
    );
    return !!ok;
  } catch (err) {
    logger.warn('[LibrarySourceRequest] email failed:', err.message);
    return false;
  }
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Crea (o riusa) una richiesta gap e notifica i superadmin se nuova.
 * @returns {Promise<{ row: object, created: boolean, emailed: boolean }>}
 */
async function upsertGapRequest(gap, ctx = {}) {
  const normalized = normalizeGap(gap);
  if (!normalized) {
    return { row: null, created: false, emailed: false };
  }
  const organizationId = ctx.organizationId;
  if (!organizationId) {
    throw new Error('organizationId richiesto');
  }

  const existing = await findOpenDuplicate(organizationId, normalized.code);
  if (existing) {
    return { row: existing, created: false, emailed: false };
  }

  const insert = await query(
    `INSERT INTO library_source_requests
      (requesting_organization_id, requesting_user_id, company_id,
       source_code, source_title, reason, quality_notes, closure_path, status,
       chat_message_preview)
     OUTPUT INSERTED.*
     VALUES
      (@orgId, @userId, @companyId,
       @code, @title, @reason, @qualityNotes, @closurePath, N'open',
       @preview)`,
    {
      orgId: organizationId,
      userId: ctx.userId || null,
      companyId: ctx.companyId || null,
      code: normalized.code,
      title: normalized.title,
      reason: normalized.reason,
      qualityNotes: normalized.qualityNotes,
      closurePath: normalized.closurePath,
      preview: ctx.messagePreview ? String(ctx.messagePreview).substring(0, 500) : null,
    }
  );
  const row = (insert.recordset || [])[0];
  if (!row) {
    return { row: null, created: false, emailed: false };
  }

  let emailed = false;
  if (normalized.closurePath === 'platform') {
    emailed = await notifySuperadmins(row);
    if (emailed) {
      await query(
        `UPDATE library_source_requests
         SET email_notified_at = SYSUTCDATETIME(), updated_at = SYSUTCDATETIME()
         WHERE id = @id`,
        { id: row.id }
      );
      row.email_notified_at = new Date().toISOString();
    }
  }

  return { row, created: true, emailed };
}

/**
 * Processa una lista di gap (es. da risposta chat). Errori singoli non bloccano.
 */
async function processGapsFromChat(gaps, ctx) {
  const results = [];
  for (const gap of gaps || []) {
    try {
      const r = await upsertGapRequest(gap, ctx);
      if (r.row) results.push(r);
    } catch (err) {
      logger.warn('[LibrarySourceRequest] process gap failed:', err.message);
    }
  }
  return results;
}

async function listForOrganization(organizationId, { status } = {}) {
  let sql = `
    SELECT id, requesting_organization_id, requesting_user_id, company_id,
           source_code, source_title, reason, quality_notes, closure_path, status,
           chat_message_preview, email_notified_at, created_at, updated_at
    FROM library_source_requests
    WHERE requesting_organization_id = @orgId`;
  const params = { orgId: organizationId };
  if (status) {
    sql += ' AND status = @status';
    params.status = status;
  }
  sql += ' ORDER BY created_at DESC';
  const res = await query(sql, params);
  return res.recordset || [];
}

/**
 * LG-3 — coda superadmin: gap via piattaforma aperti (cross-tenant).
 * Default: status open + in_progress. Opz. filtro status singolo.
 */
async function listPlatformQueue({ status } = {}) {
  let sql = `
    SELECT r.id, r.requesting_organization_id, r.requesting_user_id, r.company_id,
           r.source_code, r.source_title, r.reason, r.quality_notes, r.closure_path, r.status,
           r.chat_message_preview, r.email_notified_at, r.created_at, r.updated_at,
           o.organization_name AS requesting_organization_name
    FROM library_source_requests r
    LEFT JOIN organizations o ON o.organization_id = r.requesting_organization_id
    WHERE r.closure_path = N'platform'`;
  const params = {};
  if (status) {
    sql += ' AND r.status = @status';
    params.status = status;
  } else {
    sql += ` AND r.status IN (N'open', N'in_progress')`;
  }
  sql += ' ORDER BY r.created_at DESC';
  const res = await query(sql, params);
  return res.recordset || [];
}

/**
 * Match codice gap ↔ codice ingest (allineato a libraryGapCodesMatch FE).
 * Uguaglianza case-insensitive o prefisso (es. «ISO 14555:2025» vs «ISO 14555:2025 (arc…)»).
 */
function sourceCodesMatch(a, b) {
  const x = String(a || '')
    .trim()
    .toLowerCase();
  const y = String(b || '')
    .trim()
    .toLowerCase();
  if (!x || !y) return false;
  if (x === y) return true;
  return x.startsWith(y) || y.startsWith(x);
}

/**
 * LG-4 — chiusura via 1 (tenant): quando ingest copre il codice richiesto.
 * Solo closure_path=tenant, status open|in_progress → closed.
 * Non tocca richieste platform (know-how piattaforma = LG-5).
 * @returns {Promise<{ closed: object[], count: number }>}
 */
async function closeTenantRequestsCoveredByCode(organizationId, sourceCode, _meta = {}) {
  const orgId = Number(organizationId);
  const code = String(sourceCode || '').trim();
  if (!Number.isFinite(orgId) || orgId < 1 || !code) {
    return { closed: [], count: 0 };
  }

  const openRes = await query(
    `SELECT id, source_code, status, closure_path, requesting_organization_id
     FROM library_source_requests
     WHERE requesting_organization_id = @orgId
       AND closure_path = N'tenant'
       AND status IN (N'open', N'in_progress')`,
    { orgId }
  );
  const candidates = (openRes.recordset || []).filter((row) =>
    sourceCodesMatch(row.source_code, code)
  );
  if (!candidates.length) {
    return { closed: [], count: 0 };
  }

  const closed = [];
  for (const row of candidates) {
    const upd = await query(
      `UPDATE library_source_requests
       SET status = N'closed', updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.*
       WHERE id = @id
         AND requesting_organization_id = @orgId
         AND closure_path = N'tenant'
         AND status IN (N'open', N'in_progress')`,
      { id: row.id, orgId }
    );
    const updated = (upd.recordset || [])[0];
    if (updated) closed.push(updated);
  }
  if (closed.length) {
    logger.info('[LibrarySourceRequest] LG-4 chiusura tenant', {
      organizationId: orgId,
      sourceCode: code,
      closedIds: closed.map((r) => r.id),
      documentId: _meta.documentId || null,
    });
  }
  return { closed, count: closed.length };
}

/**
 * Fire-and-forget: errori di chiusura non devono far fallire l'ingest.
 */
async function tryCloseTenantRequestsAfterIngest(organizationId, sourceCode, meta = {}) {
  try {
    return await closeTenantRequestsCoveredByCode(organizationId, sourceCode, meta);
  } catch (err) {
    logger.warn('[LibrarySourceRequest] LG-4 close after ingest failed:', err.message);
    return { closed: [], count: 0, error: err.message };
  }
}

/**
 * LG-3 — azione leggera: open → in_progress (presa in carico).
 * Non digitalizza (LG-5). Solo righe platform.
 */
async function acknowledgePlatformRequest(id) {
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return { row: null, error: 'invalid_id' };
  }
  const existing = await query(
    `SELECT TOP 1 * FROM library_source_requests WHERE id = @id`,
    { id: idNum }
  );
  const row = (existing.recordset || [])[0];
  if (!row) return { row: null, error: 'not_found' };
  if (row.closure_path !== 'platform') {
    return { row: null, error: 'not_platform' };
  }
  if (row.status === 'in_progress') {
    return { row, changed: false };
  }
  if (row.status !== 'open') {
    return { row: null, error: 'bad_status' };
  }
  const upd = await query(
    `UPDATE library_source_requests
     SET status = N'in_progress', updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.*
     WHERE id = @id AND status = N'open' AND closure_path = N'platform'`,
    { id: idNum }
  );
  const updated = (upd.recordset || [])[0] || row;
  return { row: updated, changed: true };
}

/**
 * Email di ack al tenant richiedente (user o admin dell'org).
 * Non fallisce la chiusura se SMTP assente.
 */
async function notifyRequestingTenant(row, closureNotes) {
  const emails = [];
  if (row.requesting_user_id) {
    try {
      const u = await query(
        `SELECT email FROM users
         WHERE user_id = @uid AND is_active = 1
           AND email IS NOT NULL AND LEN(LTRIM(RTRIM(email))) > 3`,
        { uid: row.requesting_user_id }
      );
      const e = String((u.recordset || [])[0]?.email || '').trim();
      if (e.includes('@')) emails.push(e);
    } catch (err) {
      logger.warn('[LibrarySourceRequest] lookup requesting user failed:', err.message);
    }
  }
  if (!emails.length && row.requesting_organization_id) {
    try {
      const admins = await query(
        `SELECT email FROM users
         WHERE organization_id = @orgId
           AND role IN (N'admin', N'superadmin')
           AND is_active = 1
           AND email IS NOT NULL AND LEN(LTRIM(RTRIM(email))) > 3`,
        { orgId: row.requesting_organization_id }
      );
      for (const r of admins.recordset || []) {
        const e = String(r.email || '').trim();
        if (e.includes('@')) emails.push(e);
      }
    } catch (err) {
      logger.warn('[LibrarySourceRequest] lookup org admins failed:', err.message);
    }
  }
  const unique = [...new Set(emails)];
  if (!unique.length) {
    logger.warn('[LibrarySourceRequest] nessun email tenant per ack — skip');
    return false;
  }
  const html = `
    <p>La fonte richiesta &egrave; stata <strong>digitalizzata sulla piattaforma</strong>
    (know-how condiviso). Nessun automatismo PDF&rarr;JSON: verifica qualit&agrave; a cura del superadmin.</p>
    <ul>
      <li><strong>Codice:</strong> ${escapeHtml(row.source_code)}</li>
      <li><strong>Titolo:</strong> ${escapeHtml(row.source_title || '—')}</li>
      <li><strong>Note qualit&agrave; chiusura:</strong> ${escapeHtml(closureNotes || row.quality_notes || '—')}</li>
    </ul>
    <p>Puoi riusare la fonte dall&apos;Assistente AI / Libreria Gestione.</p>
  `;
  try {
    const ok = await sendAlertEmail(
      unique.join(','),
      `[SGQ Libreria] Fonte digitalizzata: ${row.source_code}`,
      html
    );
    return !!ok;
  } catch (err) {
    logger.warn('[LibrarySourceRequest] tenant ack email failed:', err.message);
    return false;
  }
}

/**
 * LG-5 — chiusura via 2: superadmin marca «digitalizzata piattaforma» dopo Cursor.
 * Solo closure_path=platform, status open|in_progress → digitized.
 * Opz. aggiorna quality_notes e ack email al tenant richiedente.
 * Niente avvio pdf-to-json.
 */
async function markPlatformDigitized(id, opts = {}) {
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum < 1) {
    return { row: null, error: 'invalid_id' };
  }
  const qualityNotes =
    opts.qualityNotes != null ? String(opts.qualityNotes).trim() : '';
  const notifyTenant = !!opts.notifyTenant;

  const existing = await query(
    `SELECT TOP 1 * FROM library_source_requests WHERE id = @id`,
    { id: idNum }
  );
  const row = (existing.recordset || [])[0];
  if (!row) return { row: null, error: 'not_found' };
  if (row.closure_path !== 'platform') {
    return { row: null, error: 'not_platform' };
  }
  if (row.status === 'digitized') {
    return { row, changed: false, tenantEmailed: false };
  }
  if (row.status !== 'open' && row.status !== 'in_progress') {
    return { row: null, error: 'bad_status' };
  }

  let mergedNotes = row.quality_notes || null;
  if (qualityNotes) {
    const prior = String(row.quality_notes || '').trim();
    mergedNotes = prior
      ? `${prior}\nChiusura piattaforma: ${qualityNotes}`
      : `Chiusura piattaforma: ${qualityNotes}`;
  }

  const upd = await query(
    `UPDATE library_source_requests
     SET status = N'digitized',
         quality_notes = @notes,
         updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.*
     WHERE id = @id
       AND closure_path = N'platform'
       AND status IN (N'open', N'in_progress')`,
    { id: idNum, notes: mergedNotes }
  );
  const updated = (upd.recordset || [])[0];
  if (!updated) {
    return { row: null, error: 'bad_status' };
  }

  let tenantEmailed = false;
  if (notifyTenant) {
    tenantEmailed = await notifyRequestingTenant(updated, qualityNotes || mergedNotes);
  }

  logger.info('[LibrarySourceRequest] LG-5 digitalizzata piattaforma', {
    id: idNum,
    sourceCode: updated.source_code,
    tenantEmailed,
    notifyTenant,
  });

  return { row: updated, changed: true, tenantEmailed };
}

module.exports = {
  upsertGapRequest,
  processGapsFromChat,
  listForOrganization,
  listPlatformQueue,
  acknowledgePlatformRequest,
  markPlatformDigitized,
  notifyRequestingTenant,
  closeTenantRequestsCoveredByCode,
  tryCloseTenantRequestsAfterIngest,
  sourceCodesMatch,
  listSuperadminEmails,
  notifySuperadmins,
  findOpenDuplicate,
  DEDUPE_DAYS,
};
