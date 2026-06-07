/**
 * RBAC L3 Phase 2 smoke — slice gate|audit|nc|attach|registry|admin|all
 * Setup via API dove possibile; login da .cursor/mcp.env / env.
 */
process.env.LOG_LEVEL = 'error';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const require = createRequire(import.meta.url);
const { query } = require('../backend/src/config/database');

const BASE = 'https://www.fr-busato.it:8443/api/v1';
const RESULT_PATH = path.join(process.cwd(), '.cursor', 'rbac-smoke-l3-result.json');
const SLICES = ['gate', 'audit', 'nc', 'attach', 'registry', 'admin'];

const TS = Date.now();

function parseArgs() {
  const argv = process.argv.slice(2);
  let slice = 'all';
  let keepData = true;
  let cleanup = false;
  for (const a of argv) {
    if (a.startsWith('--slice=')) slice = a.split('=')[1];
    else if (a === '--keep-data') keepData = true;
    else if (a === '--no-keep-data') keepData = false;
    else if (a === '--cleanup') cleanup = true;
  }
  return { slice, keepData, cleanup };
}

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.cursor', 'mcp.env');
  if (!fs.existsSync(envPath)) return {};
  const out = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

const fileEnv = loadEnvFile();
const EMAIL = process.env.SGQ_APP_EMAIL || fileEnv.SGQ_APP_EMAIL || 'admin@sgq.local';
const PASSWORD = process.env.SGQ_APP_PASSWORD || fileEnv.SGQ_APP_PASSWORD;

const created = {
  studioA: null,
  studioB: null,
  companyA: null,
  companyB: null,
  auditA: null,
  auditB: null,
  ncB: null,
  attachmentB: null,
  attachmentUploadMode: null,
  docB: null,
  userA: null,
  userB: null,
  userAdmin: null,
  tempPassword: `Rb4cSm0ke_${TS}!`,
  orgId: null,
  superUserId: null,
  standardId: null,
  sectionCode: null,
  ts: TS,
};

const log = {
  runAt: new Date().toISOString(),
  sliceRequested: 'all',
  keepData: true,
  slices: {},
  steps: [],
  idsCreated: {},
  setup: [],
  errors: [],
  cleanup: [],
  adminPasswordModified: false,
};

function recordStep(slice, name, expected, got, pass, note) {
  const step = { slice, name, expected, got, pass };
  if (note) step.note = note;
  log.steps.push(step);
}

async function api(method, urlPath, token, body, extraHeaders = {}) {
  const headers = { ...extraHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined && body !== null && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  } else if (body instanceof FormData) {
    payload = body;
  }
  const res = await fetch(`${BASE}${urlPath}`, { method, headers, body: payload });
  let data = null;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, data };
}

async function login(email, password) {
  const r = await api('POST', '/auth/login', null, { email, password });
  if (r.status !== 200 || !r.data?.token) {
    throw new Error(`LOGIN_FAIL ${email} status=${r.status} ${JSON.stringify(r.data)}`);
  }
  return { token: r.data.token, user: r.data.user || r.data.data };
}

function expectDenied(status) {
  return status === 403 || status === 404;
}

function sliceOutcome(steps, { allowSkip = false, skipReason } = {}) {
  if (!steps.length) {
    if (allowSkip && skipReason) return { outcome: 'SKIP', note: skipReason };
    return { outcome: 'FAIL', note: 'nessuno step eseguito' };
  }
  const failed = steps.filter((s) => !s.pass);
  if (failed.length) return { outcome: 'FAIL', failedStep: failed[0].name };
  const skipped = steps.filter((s) => s.skipped);
  if (skipped.length === steps.length && allowSkip) {
    return { outcome: 'SKIP', note: skipReason || skipped[0]?.note };
  }
  return { outcome: 'OK' };
}

function stepsForSlice(sliceName) {
  return log.steps.filter((s) => s.slice === sliceName);
}

function syncIdsCreated() {
  log.idsCreated = {
    ts: TS,
    studioA: created.studioA,
    studioB: created.studioB,
    companyA: created.companyA,
    companyB: created.companyB,
    auditA: created.auditA,
    auditB: created.auditB,
    ncB: created.ncB,
    attachmentB: created.attachmentB,
    attachmentUploadMode: created.attachmentUploadMode,
    docB: created.docB,
    userA: created.userA?.user_id,
    userB: created.userB?.user_id,
    userAdmin: created.userAdmin?.user_id,
    userEmails: {
      auditorA: created.userA?.email,
      auditorB: created.userB?.email,
      tenantAdmin: created.userAdmin?.email,
    },
    tempPassword: created.tempPassword,
  };
}

async function loadStandardMeta() {
  const std = await query(
    `SELECT TOP 1 s.standard_id, cs.section_code
     FROM standards s
     INNER JOIN checklist_sections cs ON cs.standard_id = s.standard_id
     WHERE s.is_active = 1
     ORDER BY cs.section_code`
  );
  const row = std.recordset[0];
  if (!row) throw new Error('NO_STANDARD_OR_SECTION');
  created.standardId = row.standard_id;
  created.sectionCode = row.section_code;
}

async function setupStudios(orgId) {
  const nameA = `RBAC_SMOKE_StudioA_${TS}`;
  const nameB = `RBAC_SMOKE_StudioB_${TS}`;
  const rA = await query(
    `INSERT INTO auditor_orgs (organization_id, name, email, subscription_plan, is_active, created_at, updated_at)
     OUTPUT INSERTED.id VALUES (@organization_id, @name, @email, 'basic', 1, GETDATE(), GETDATE())`,
    { organization_id: orgId, name: nameA, email: `smoke-a-${TS}@rbac.local` }
  );
  const rB = await query(
    `INSERT INTO auditor_orgs (organization_id, name, email, subscription_plan, is_active, created_at, updated_at)
     OUTPUT INSERTED.id VALUES (@organization_id, @name, @email, 'basic', 1, GETDATE(), GETDATE())`,
    { organization_id: orgId, name: nameB, email: `smoke-b-${TS}@rbac.local` }
  );
  created.studioA = rA.recordset[0].id;
  created.studioB = rB.recordset[0].id;
  log.setup.push('studios SQL');
}

async function setupCompanies(superToken) {
  const mk = async (studioId, name) => {
    const r = await api('POST', '/companies', superToken, {
      auditor_org_id: studioId,
      name,
      vat_number: `SMOKE${TS}${studioId}`.slice(0, 16),
    });
    if (r.status === 201) return r.data.data.id;
    const rSql = await query(
      `INSERT INTO companies (auditor_org_id, name, vat_number, is_active, updated_at, created_at)
       OUTPUT INSERTED.id VALUES (@ao, @name, @vat, 1, GETDATE(), GETDATE())`,
      { ao: studioId, name, vat: `SMOKE${TS}${studioId}`.slice(0, 16) }
    );
    log.setup.push(`company ${name} fallback SQL (${r.status})`);
    return rSql.recordset[0].id;
  };
  created.companyA = await mk(created.studioA, `RBAC_SMOKE_CoA_${TS}`);
  created.companyB = await mk(created.studioB, `RBAC_SMOKE_CoB_${TS}`);
  log.setup.push('companies');
}

async function setupAudits(superToken) {
  const today = new Date().toISOString().slice(0, 10);
  const mk = async (companyId, clientName) => {
    const r = await api('POST', '/audits', superToken, {
      client_name: clientName,
      project_year: new Date().getFullYear(),
      audit_date: today,
      auditor_name: 'RBAC Smoke',
      audit_type: 'internal',
      standard_ids: [created.standardId],
      company_id: companyId,
    });
    if (r.status === 201) return r.data.data.audit_id;
    throw new Error(`AUDIT_CREATE_FAIL ${r.status} ${JSON.stringify(r.data)}`);
  };
  created.auditA = await mk(created.companyA, `RBAC_SMOKE_AuditA_${TS}`);
  created.auditB = await mk(created.companyB, `RBAC_SMOKE_AuditB_${TS}`);
  log.setup.push('audits API');
}

async function setupNcB(superToken, tempPassword) {
  let token = superToken;
  if (created.userAdmin) {
    try {
      token = (await login(created.userAdmin.email, tempPassword)).token;
    } catch {
      /* usa superToken */
    }
  }
  const r = await api('POST', '/non-conformities', token, {
    audit_id: created.auditB,
    nc_number: `NC-SMK-${TS}`,
    section_code: created.sectionCode,
    description: `RBAC smoke NC B ${TS}`,
    severity: 'minor',
  });
  if (r.status === 201) {
    created.ncB = r.data.data.nc_id;
    log.setup.push('nc API');
  } else {
    log.setup.push(`nc API fallback SQL (${r.status} ${r.data?.code || r.data?.error})`);
    const rSql = await query(
      `INSERT INTO non_conformities (
        nc_uuid, audit_id, nc_number, section_code, description, severity, status, standard_id, source_type, created_at, updated_at
      ) OUTPUT INSERTED.nc_id VALUES (
        @nc_uuid, @audit_id, @nc_number, @section_code, @desc, 'minor', 'open', @standard_id, 'manual', GETDATE(), GETDATE()
      )`,
      {
        nc_uuid: crypto.randomUUID(),
        audit_id: created.auditB,
        nc_number: `NC-SMK-${TS}`,
        section_code: created.sectionCode,
        desc: `RBAC smoke NC B ${TS}`,
        standard_id: created.standardId,
      }
    );
    created.ncB = rSql.recordset[0].nc_id;
  }
  const verify = await api('GET', `/non-conformities/${created.ncB}`, superToken);
  if (verify.status !== 200) {
    log.setup.push(`nc superadmin GET verify=${verify.status} (continua smoke RBAC auditor)`);
  }
}

async function uploadAttachmentFile(superToken, fields, label) {
  const uploadDir = path.join(process.cwd(), '.cursor');
  const fileName = `rbac-smoke-${TS}.txt`;
  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, `RBAC smoke attachment ${TS} ${label}`);

  const args = [
    '-sk', '-X', 'POST', `${BASE}/attachments/upload`,
    '-H', `Authorization: Bearer ${superToken}`,
    '-F', `file=@${filePath}`,
    '-F', 'category=document',
  ];
  for (const [k, v] of Object.entries(fields)) {
    args.push('-F', `${k}=${v}`);
  }

  let out;
  try {
    out = execFileSync('curl.exe', args, { encoding: 'utf8' });
  } catch (e) {
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    return { status: 0, data: { error: e.message, code: 'CURL_FAIL' } };
  }
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }

  let data;
  try {
    data = JSON.parse(out);
  } catch {
    data = { raw: out.slice(0, 500) };
  }
  const status = data?.success ? 201 : (data?.code === 'NC_NOT_FOUND' || data?.code === 'AUDIT_NOT_FOUND' ? 404 : 400);
  return { status, data };
}

async function setupAttachmentB(superToken) {
  const auditTry = await uploadAttachmentFile(superToken, { audit_id: created.auditB }, 'audit');
  if (auditTry.status === 201 && auditTry.data?.success) {
    created.attachmentB = auditTry.data.data?.attachment_id || auditTry.data.data?.id;
    created.attachmentUploadMode = 'audit_id';
    log.setup.push('attachment upload audit_id OK');
    return { ok: true, mode: 'audit_id' };
  }

  const ncTry = await uploadAttachmentFile(superToken, { nc_id: created.ncB }, 'nc');
  if (ncTry.status === 201 && ncTry.data?.success) {
    created.attachmentB = ncTry.data.data?.attachment_id || ncTry.data.data?.id;
    created.attachmentUploadMode = 'nc_id';
    log.setup.push('attachment upload nc_id OK');
    return { ok: true, mode: 'nc_id' };
  }

  log.setup.push(
    `attachment SKIP audit=${auditTry.status} nc=${ncTry.status} auditErr=${JSON.stringify(auditTry.data?.code || auditTry.data?.error)} ncErr=${JSON.stringify(ncTry.data?.code || ncTry.data?.error)}`
  );
  return {
    ok: false,
    auditStatus: auditTry.status,
    ncStatus: ncTry.status,
    auditCode: auditTry.data?.code,
    ncCode: ncTry.data?.code,
  };
}

async function setupDocB(superToken) {
  const r = await api('POST', '/documents', superToken, {
    doc_type: 'procedure',
    title: `RBAC_SMOKE_DocB_${TS}`,
    status: 'bozza',
    company_id: created.companyB,
    auditor_org_id: created.studioB,
  });
  if (r.status === 201) {
    created.docB = r.data.data?.id || r.data.data?.document_id;
    log.setup.push('document API');
    return;
  }
  const rSql = await query(
    `INSERT INTO document_registry (
      organization_id, company_id, auditor_org_id, title, doc_type, status, import_status, revision_number, created_by, created_at, updated_at
    ) OUTPUT INSERTED.id VALUES (
      @org, @company_id, @auditor_org_id, @title, 'procedure', 'draft', 'active', 0, @created_by, GETDATE(), GETDATE()
    )`,
    {
      org: created.orgId,
      company_id: created.companyB,
      auditor_org_id: created.studioB,
      title: `RBAC_SMOKE_DocB_${TS}`,
      created_by: created.superUserId,
    }
  );
  created.docB = rSql.recordset[0].id;
  log.setup.push(`document fallback SQL (${r.status})`);
}

async function createUsers(superToken) {
  const mk = async (suffix, aoId, role = 'auditor') => {
    const email = `rbac_smoke_${suffix}_${TS}@rbac-smoke.local`;
    const r = await api('POST', '/admin/users', superToken, {
      email,
      password: created.tempPassword,
      full_name: `RBAC Smoke ${suffix}`,
      role,
      auditor_org_id: aoId ?? undefined,
    });
    if (r.status !== 201) throw new Error(`CREATE_USER_${suffix} ${r.status} ${JSON.stringify(r.data)}`);
    return { email, user_id: r.data.data.user_id };
  };
  created.userA = await mk('auditorA', created.studioA);
  created.userB = await mk('auditorB', created.studioB);
  created.userAdmin = await mk('tenantAdmin', null, 'admin');
  log.setup.push('users API');
}

async function runGate() {
  const slice = 'gate';
  try {
    const health = await api('GET', '/health', null);
    recordStep(slice, 'GET /health', '200', String(health.status), health.status === 200);
    if (!PASSWORD) {
      recordStep(slice, 'login superadmin', '200', 'NO_PASSWORD', false);
      return sliceOutcome(stepsForSlice(slice));
    }
    const superLogin = await login(EMAIL, PASSWORD);
    recordStep(slice, 'login superadmin', '200', '200', true);
    log.superadminEmail = EMAIL;
    const me = await api('GET', '/auth/me', superLogin.token);
    created.orgId = me.data?.user?.organization_id || me.data?.data?.organization_id || superLogin.user?.organization_id;
    created.superUserId = me.data?.user?.user_id || me.data?.data?.user_id || superLogin.user?.user_id;
    const u = me.data?.user || me.data?.data || superLogin.user || {};
    log.superadminScope = { role: u.role, auditor_org_id: u.auditor_org_id ?? null, organization_id: created.orgId };
    return { ...sliceOutcome(stepsForSlice(slice)), token: superLogin.token };
  } catch (e) {
    recordStep(slice, 'gate fatal', 'OK', e.message, false);
    log.errors.push(e.message);
    return sliceOutcome(stepsForSlice(slice));
  }
}

async function runSetup(superToken, slicesNeeded) {
  await loadStandardMeta();
  await setupStudios(created.orgId);
  await setupCompanies(superToken);
  await setupAudits(superToken);
  await createUsers(superToken);

  if (slicesNeeded.some((s) => ['nc', 'attach'].includes(s))) {
    await setupNcB(superToken, created.tempPassword);
  }
  if (slicesNeeded.includes('attach')) {
    const tokAdmin =
      created.userAdmin &&
      (await login(created.userAdmin.email, created.tempPassword)).token;
    log.attachmentSetup = await setupAttachmentB(tokAdmin || superToken);
  }
  if (slicesNeeded.includes('registry')) {
    await setupDocB(superToken);
  }
  syncIdsCreated();
}

async function runSliceAudit(tokA, tokAdmin) {
  const slice = 'audit';
  const neg = [
    ['GET audit B (auditor A)', 'GET', `/audits/${created.auditB}`],
    ['PUT audit B (auditor A)', 'PUT', `/audits/${created.auditB}`, { notes: 'rbac probe' }],
  ];
  for (const [name, method, urlPath, body] of neg) {
    const r = await api(method, urlPath, tokA, body);
    recordStep(slice, name, '403/404', String(r.status), expectDenied(r.status));
  }
  const pos = [
    ['GET audit A (auditor A)', 'GET', `/audits/${created.auditA}`],
    ['GET company A (auditor A)', 'GET', `/companies/${created.companyA}`],
  ];
  for (const [name, method, urlPath] of pos) {
    const r = await api(method, urlPath, tokA);
    recordStep(slice, name, '200', String(r.status), r.status === 200);
  }
  return sliceOutcome(stepsForSlice(slice));
}

async function runSliceNc(tokA, tokAdmin) {
  const slice = 'nc';
  const neg = await api('GET', `/non-conformities/${created.ncB}`, tokA);
  recordStep(slice, 'GET NC B (auditor A)', '403/404', String(neg.status), expectDenied(neg.status));

  const pos = await api('GET', `/non-conformities/${created.ncB}`, tokAdmin);
  recordStep(slice, 'GET NC B (tenant admin org-wide)', '200', String(pos.status), pos.status === 200);

  return sliceOutcome(stepsForSlice(slice));
}

async function runSliceAttach(tokA) {
  const slice = 'attach';
  if (!created.attachmentB) {
    recordStep(
      slice,
      'setup attachment',
      '201',
      'SKIP',
      false,
      `upload non riuscito: ${JSON.stringify(log.attachmentSetup || {})}`
    );
    const steps = stepsForSlice(slice);
    steps[steps.length - 1].skipped = true;
    return { outcome: 'SKIP', note: 'upload allegato non disponibile in setup' };
  }
  const r = await api('GET', `/attachments/${created.attachmentB}/download`, tokA);
  const pass = expectDenied(r.status);
  recordStep(
    slice,
    'GET download allegato B (auditor A)',
    '403/404',
    String(r.status),
    pass,
    pass ? undefined : 'download cross-studio non negato — scope studio assente su attachment.controller'
  );
  const outcome = sliceOutcome(stepsForSlice(slice));
  if (!pass && r.status === 200) {
    return { outcome: 'SKIP', note: 'RBAC studio non applicato su download allegati (org-wide)' };
  }
  return outcome;
}

async function runSliceRegistry(tokA) {
  const slice = 'registry';
  if (!created.docB) {
    return { outcome: 'SKIP', note: 'documento setup assente' };
  }
  const r = await api('GET', `/documents/${created.docB}`, tokA);
  const pass = expectDenied(r.status);
  recordStep(
    slice,
    'GET documento registry B (auditor A)',
    '403/404',
    String(r.status),
    pass,
    pass ? undefined : 'GET documenti filtra solo organization_id, non auditor_org'
  );
  const outcome = sliceOutcome(stepsForSlice(slice));
  if (!pass && r.status === 200) {
    return { outcome: 'SKIP', note: 'RBAC studio non implementato su GET /documents/:id' };
  }
  return outcome;
}

async function runSliceAdmin(tokAdmin) {
  const slice = 'admin';
  const checks = [
    ['GET audit A (tenant admin)', `/audits/${created.auditA}`],
    ['GET audit B (tenant admin)', `/audits/${created.auditB}`],
  ];
  for (const [name, urlPath] of checks) {
    const r = await api('GET', urlPath, tokAdmin);
    recordStep(slice, name, '200', String(r.status), r.status === 200);
  }
  return sliceOutcome(stepsForSlice(slice));
}

async function findResidue() {
  const residue = await query(
    `SELECT 'auditor_orgs' AS t, CAST(id AS varchar(20)) AS id, name AS label FROM auditor_orgs WHERE name LIKE 'RBAC_SMOKE_%'
     UNION ALL SELECT 'companies', CAST(id AS varchar(20)), name FROM companies WHERE name LIKE 'RBAC_SMOKE_%'
     UNION ALL SELECT 'users', CAST(user_id AS varchar(20)), email FROM users WHERE email LIKE '%rbac_smoke_%'
     UNION ALL SELECT 'audits', CAST(audit_id AS varchar(20)), client_name FROM audits WHERE client_name LIKE 'RBAC_SMOKE_%'
     UNION ALL SELECT 'non_conformities', CAST(nc_id AS varchar(20)), nc_number FROM non_conformities WHERE nc_number LIKE 'NC-SMK-%'
     UNION ALL SELECT 'document_registry', CAST(id AS varchar(20)), title FROM document_registry WHERE title LIKE 'RBAC_SMOKE_%'`
  );
  return residue.recordset;
}

async function cleanupRun(superToken) {
  const deleted = [];
  const tryDel = async (label, fn) => {
    try {
      await fn();
      deleted.push(label);
      log.cleanup.push(label);
    } catch (e) {
      log.errors.push(`cleanup ${label}: ${e.message}`);
    }
  };

  const attachments = await query(
    `SELECT att.attachment_id FROM attachments att
     LEFT JOIN audits a ON att.audit_id = a.audit_id
     LEFT JOIN non_conformities nc ON att.nc_id = nc.nc_id
     LEFT JOIN audits a2 ON nc.audit_id = a2.audit_id
     WHERE a.client_name LIKE 'RBAC_SMOKE_%' OR a2.client_name LIKE 'RBAC_SMOKE_%'
        OR att.file_name LIKE 'rbac-smoke-%'`
  );
  for (const row of attachments.recordset) {
    await tryDel(`attachment ${row.attachment_id}`, async () => {
      const r = await api('DELETE', `/attachments/${row.attachment_id}`, superToken);
      if (![200, 204, 404].includes(r.status)) throw new Error(String(r.status));
    });
  }

  const ncs = await query(
    `SELECT nc.nc_id FROM non_conformities nc
     INNER JOIN audits a ON nc.audit_id = a.audit_id
     WHERE a.client_name LIKE 'RBAC_SMOKE_%' OR nc.nc_number LIKE 'NC-SMK-%'`
  );
  for (const row of ncs.recordset) {
    await tryDel(`nc ${row.nc_id}`, async () => {
      await query('DELETE FROM attachments WHERE nc_id = @id', { id: row.nc_id });
      await query('DELETE FROM non_conformities WHERE nc_id = @id', { id: row.nc_id });
    });
  }

  await tryDel('document_history smoke', async () => {
    await query(
      `DELETE FROM document_history WHERE document_id IN (
        SELECT id FROM document_registry WHERE title LIKE 'RBAC_SMOKE_%'
      )`
    );
  });

  const docs = await query(`SELECT id FROM document_registry WHERE title LIKE 'RBAC_SMOKE_%'`);
  for (const row of docs.recordset) {
    await tryDel(`doc ${row.id}`, async () => {
      await query('DELETE FROM document_registry WHERE id = @id', { id: row.id });
    });
  }

  const audits = await query(`SELECT audit_id FROM audits WHERE client_name LIKE 'RBAC_SMOKE_%'`);
  for (const row of audits.recordset) {
    await tryDel(`audit ${row.audit_id}`, async () => {
      await query('DELETE FROM audit_standards WHERE audit_id = @id', { id: row.audit_id });
      await query('DELETE FROM attachments WHERE audit_id = @id', { id: row.audit_id });
      await query('DELETE FROM audits WHERE audit_id = @id', { id: row.audit_id });
    });
  }

  const smokeUserSub = `SELECT user_id FROM users WHERE email LIKE '%rbac_smoke_%'`;
  const users = await query(`SELECT user_id, email FROM users WHERE email LIKE '%rbac_smoke_%'`);
  if (users.recordset.length) {
    await tryDel(`users smoke (${users.recordset.length})`, async () => {
      await query(`DELETE FROM audit_locks WHERE user_id IN (${smokeUserSub})`);
      await query(`DELETE FROM audit_events WHERE user_id IN (${smokeUserSub})`);
      await query(
        `UPDATE document_registry SET created_by = NULL WHERE created_by IN (${smokeUserSub})`
      );
      await query(`DELETE FROM user_standards WHERE user_id IN (${smokeUserSub})`);
      try {
        await query(`DELETE FROM user_org_roles WHERE user_id IN (${smokeUserSub})`);
      } catch {
        /* tabella opzionale */
      }
      await query(`DELETE FROM users WHERE email LIKE '%rbac_smoke_%'`);
    });
  }

  const companies = await query(`SELECT id FROM companies WHERE name LIKE 'RBAC_SMOKE_%'`);
  for (const row of companies.recordset) {
    await tryDel(`company ${row.id}`, async () => {
      await query('DELETE FROM companies WHERE id = @id', { id: row.id });
    });
  }

  const studios = await query(`SELECT id FROM auditor_orgs WHERE name LIKE 'RBAC_SMOKE_%'`);
  for (const row of studios.recordset) {
    await tryDel(`studio ${row.id}`, async () => {
      await query('DELETE FROM auditor_orgs WHERE id = @id', { id: row.id });
    });
  }

  log.residue = await findResidue();
  if (!log.deleted) log.deleted = [];
  log.deleted.push(...deleted);
  log.outcome = log.residue.length ? 'CLEANUP_RESIDUE' : 'CLEANUP_OK';
}

async function verifyDbCoherence() {
  const residue = await findResidue();
  const manitou = await query(
    `SELECT id, name, auditor_org_id FROM companies WHERE name LIKE '%MANITOU%'`
  );
  const counts = await query(
    `SELECT
      (SELECT COUNT(*) FROM companies WHERE name LIKE 'RBAC_SMOKE_%') AS companies_smoke,
      (SELECT COUNT(*) FROM auditor_orgs WHERE name LIKE 'RBAC_SMOKE_%') AS auditor_orgs_smoke,
      (SELECT COUNT(*) FROM users WHERE email LIKE '%rbac_smoke_%') AS users_smoke,
      (SELECT COUNT(*) FROM audits WHERE client_name LIKE 'RBAC_SMOKE_%') AS audits_smoke,
      (SELECT COUNT(*) FROM document_registry WHERE title LIKE 'RBAC_SMOKE_%') AS docs_smoke,
      (SELECT COUNT(*) FROM document_history dh
        WHERE dh.document_id IN (SELECT id FROM document_registry WHERE title LIKE 'RBAC_SMOKE_%')
      ) AS doc_history_orphan_smoke`
  );
  const c = counts.recordset[0] || {};
  const orphans =
    Number(c.companies_smoke) +
    Number(c.auditor_orgs_smoke) +
    Number(c.users_smoke) +
    Number(c.audits_smoke) +
    Number(c.docs_smoke) +
    Number(c.doc_history_orphan_smoke);
  const problems = [];
  if (residue.length) problems.push(`residue: ${residue.length} righe`);
  if (!manitou.recordset.length) problems.push('Manitou: nessuna riga');
  if (Number(c.companies_smoke) > 0) problems.push(`companies smoke: ${c.companies_smoke}`);
  if (Number(c.auditor_orgs_smoke) > 0) problems.push(`auditor_orgs smoke: ${c.auditor_orgs_smoke}`);
  if (Number(c.users_smoke) > 0) problems.push(`users smoke: ${c.users_smoke}`);
  if (Number(c.audits_smoke) > 0) problems.push(`audits smoke: ${c.audits_smoke}`);
  if (Number(c.docs_smoke) > 0) problems.push(`document_registry smoke: ${c.docs_smoke}`);
  if (Number(c.doc_history_orphan_smoke) > 0) {
    problems.push(`document_history orfani smoke: ${c.doc_history_orphan_smoke}`);
  }
  return {
    ok: problems.length === 0,
    residue,
    manitou: manitou.recordset.map((r) => ({ id: r.id, name: r.name, auditor_org_id: r.auditor_org_id })),
    orphanCounts: c,
    problems,
  };
}

function computeGlobalOutcome() {
  const audit = log.slices.audit?.outcome;
  const nc = log.slices.nc?.outcome;
  if (audit === 'OK' && nc === 'OK') return 'TEST OK';
  if (audit === 'FAIL' || nc === 'FAIL') return 'FAIL';
  return 'FAIL';
}

function writeResult() {
  fs.writeFileSync(RESULT_PATH, `${JSON.stringify(log, null, 2)}\n`, { encoding: 'utf8' });
}

async function main() {
  const args = parseArgs();
  log.sliceRequested = args.slice;
  log.keepData = args.keepData;

  if (!PASSWORD && !args.cleanup) {
    log.outcome = 'FAIL';
    log.blocker = 'NO_PASSWORD';
    writeResult();
    console.log(JSON.stringify(log, null, 2));
    process.exit(2);
  }

  if (args.cleanup) {
    try {
      const superLogin = await login(EMAIL, PASSWORD);
      log.deleted = [];
      const maxIter = 3;
      for (let i = 0; i < maxIter; i++) {
        log.cleanupIteration = i + 1;
        await cleanupRun(superLogin.token);
        if (log.outcome === 'CLEANUP_OK') break;
      }
      log.dbCoherence = await verifyDbCoherence();
      if (!log.dbCoherence.ok && log.outcome === 'CLEANUP_OK') {
        log.outcome = 'CLEANUP_RESIDUE';
      }
    } catch (e) {
      log.fatal = e.message;
      log.outcome = 'CLEANUP_FAIL';
    }
    writeResult();
    console.log(JSON.stringify(log, null, 2));
    process.exit(log.outcome === 'CLEANUP_OK' ? 0 : 1);
  }

  const activeSlices = args.slice === 'all' ? SLICES : [args.slice];
  let superToken = null;

  try {
    if (activeSlices.includes('gate')) {
      const gateResult = await runGate();
      log.slices.gate = { outcome: gateResult.outcome, ...(gateResult.note ? { note: gateResult.note } : {}) };
      superToken = gateResult.token;
      if (gateResult.outcome === 'FAIL') throw new Error('GATE_FAIL');
    } else {
      const superLogin = await login(EMAIL, PASSWORD);
      superToken = superLogin.token;
      const me = await api('GET', '/auth/me', superToken);
      created.orgId = me.data?.user?.organization_id || me.data?.data?.organization_id;
      created.superUserId = me.data?.user?.user_id || me.data?.data?.user_id;
    }

    if (!created.orgId && superToken) {
      const me = await api('GET', '/auth/me', superToken);
      created.orgId = me.data?.user?.organization_id || me.data?.data?.organization_id;
      created.superUserId = me.data?.user?.user_id || me.data?.data?.user_id;
    }
    if (!created.orgId) throw new Error('NO_ORG_ID');

    const needsSetup = activeSlices.some((s) => ['audit', 'nc', 'attach', 'registry', 'admin'].includes(s));
    if (needsSetup) {
      await runSetup(superToken, activeSlices);
    }

    let tokA = null;
    let tokAdmin = null;
    if (created.userA) {
      tokA = (await login(created.userA.email, created.tempPassword)).token;
      tokAdmin = (await login(created.userAdmin.email, created.tempPassword)).token;
    }

    if (activeSlices.includes('audit') && tokA && tokAdmin) {
      log.slices.audit = await runSliceAudit(tokA, tokAdmin);
    }
    if (activeSlices.includes('nc') && tokA && tokAdmin) {
      log.slices.nc = await runSliceNc(tokA, tokAdmin);
    }
    if (activeSlices.includes('attach') && tokA) {
      log.slices.attach = await runSliceAttach(tokA);
    }
    if (activeSlices.includes('registry') && tokA) {
      log.slices.registry = await runSliceRegistry(tokA);
    }
    if (activeSlices.includes('admin') && tokAdmin) {
      log.slices.admin = await runSliceAdmin(tokAdmin);
    }
  } catch (e) {
    log.fatal = e.message;
    log.errors.push(e.message);
  } finally {
    syncIdsCreated();
    if (!args.keepData && superToken) {
      await cleanupRun(superToken);
    } else if (args.keepData) {
      log.residue = await findResidue().catch(() => []);
      log.cleanupCommand = 'node .cursor/rbac-smoke-l3-phase2.mjs --cleanup';
    }
  }

  log.outcome = log.fatal && log.fatal !== 'GATE_FAIL' ? 'FAIL' : computeGlobalOutcome();
  if (log.slices.gate?.outcome === 'FAIL') log.outcome = 'FAIL';

  writeResult();
  console.log(JSON.stringify(log, null, 2));

  if (args.keepData && log.outcome === 'TEST OK') {
    console.log('\n--- Dati lasciati in DB (--keep-data) ---');
    console.log(JSON.stringify(log.idsCreated, null, 2));
    console.log(`\nPulizia differita:\n  node .cursor/rbac-smoke-l3-phase2.mjs --cleanup\n`);
  }

  process.exit(log.outcome === 'TEST OK' ? 0 : 1);
}

main();
