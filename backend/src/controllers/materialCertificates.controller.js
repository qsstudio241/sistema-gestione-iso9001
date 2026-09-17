/**
 * Material Compliance MC-4 — API certificati materiale (base e apporto).
 * Extract: ingest AI. Evaluate: Rule Engine MC-3 (zero LLM).
 * MC-I0: evaluate non usa lock updated_at (Date JS vs DATETIME2 → 409 spurio).
 * MC-B: OCR via documentTextExtractor (reason ocr_ok); mapTextReason non collassa unavailable in skipped.
 * MC-I2: alias AI (heat_number/colata/B07, ddt, norma) → colonne griglia; DDT ≠ A07.
 * MC-I3: DDT ≠ mill; document_kind delivery_note non copia colata/norma; Valuta 409.
 * MC-I4: busta 1 PDF → N righe: split per colata + HITL (mai split pagine automatico).
 * MC-7: PATCH/approve → recordFeedback (ADR-017) → few-shot al prossimo extract.

 * workflow_status=compliant solo da HITL approve, mai da AI o dal motore.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { query, getPool } = require('../config/database');
const logger = require('../utils/logger');
const {
  ensureCompanyAccessLoaded,
  companyAccessSqlFilter,
  assertMutatingAllowed,
  sendAccessDenied,
} = require('../services/companyAccess.service');
const { companyBelongsToOrg } = require('../services/qualificationCompany.service');
const { extractDocumentText } = require('../services/documentTextExtractor.service');
const { extractStructuredByDocType } = require('../services/importAiExtraction.service');
const { evaluateMaterialCertificate } = require('../services/materialComplianceRuleEngine.service');
const { recordFeedback } = require('../services/ingestFeedback.service');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');

const MC_FEEDBACK_DOC_TYPE = 'material_certificate';
const MC_FEEDBACK_SOURCE = 'material';

const GRID_STATUSES = new Set([
  'received',
  'text_ready',
  'extracted',
  'pending_review',
  'compliant',
  'non_compliant',
  'archived',
  'ocr_running',
]);
const ROLES = new Set(['base', 'filler']);
const DOC_TYPES = new Set(['2.1', '2.2', '3.1', '3.2']);
const EXTRACTABLE = new Set(['received', 'text_ready', 'extracted', 'ocr_running']);
const EVALUABLE = new Set(['received', 'text_ready', 'extracted', 'pending_review', 'non_compliant']);
const PATCHABLE = new Set(['received', 'text_ready', 'extracted', 'ocr_running', 'pending_review', 'non_compliant']);
const APPROVABLE = new Set(['pending_review', 'non_compliant']);
const REJECTABLE = new Set(['pending_review']);
const ARCHIVABLE = new Set(['compliant', 'non_compliant']);
const MIN_TEXT_CHARS = 80;

/** Chiavi PATCH / form = stesse di aiExpectedSchema(material_certificate) + anagrafica griglia. */
const MATERIAL_CERTIFICATE_MANUAL_EDITABLE_FIELDS = [
  'ddt_no',
  'ddt_date',
  'document_kind',
  'certificate_no',
  'material_role',
  'designation',
  'heat_or_lot_no',
  'product_form',
  'dimensions',
  'material_standard',
  'manufacturer_works',
  'inspection_document_type',
  'purchaser',
  'purchaser_order_no',
  'delivery_condition',
  'actual_mass',
  'ReH',
  'Rm',
  'A',
  'KV',
  'hardness',
  'chemistry',
  'CEV',
  'ndt',
  'validated_by',
  'compliance_statement',
  'steel_designation',
  'filler_designation',
  'filler_standard',
  'filler_diameter_mm',
  'hydrogen_class',
  'thickness_mm',
  'corrected_json',
];

const GRID_COLUMNS = `
  c.id, c.organization_id, c.company_id, c.ddt_no, c.ddt_date, c.certificate_no,
  c.material_role, c.designation, c.heat_or_lot_no, c.product_form, c.dimensions,
  c.material_standard, c.manufacturer_works, c.inspection_document_type,
  c.workflow_status, c.created_at, c.updated_at
`;

function emptyToNull(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function clip(value, max) {
  if (value == null) return null;
  const s = String(value);
  return s.length <= max ? s : s.slice(0, max);
}

function parseJsonField(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function sqlInStatus(statuses) {
  return [...statuses].map((s) => `'${String(s).replace(/'/g, '')}'`).join(', ');
}

function illegalTransition(workflowStatus) {
  const err = new Error('Transizione di stato non consentita');
  err.code = 'ILLEGAL_TRANSITION';
  err.httpStatus = 409;
  err.workflowStatus = workflowStatus || null;
  return err;
}

function outputRow(result) {
  return result && result.recordset && result.recordset[0] ? result.recordset[0] : null;
}

async function txQuery(tx, sqlText, params) {
  const request = tx.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }
  return request.query(sqlText);
}

function parseRole(raw, fallback = 'base') {
  const v = emptyToNull(raw);
  if (!v) return fallback;
  return ROLES.has(v) ? v : null;
}

/** MC-B: vocabolario DATA_MODEL. ocr_skipped solo se il file non è un PDF. */
function mapTextReason(extractorReason, text) {
  const t = String(text || '').trim();
  switch (extractorReason) {
    case 'ocr_ok':
      if (t.length >= MIN_TEXT_CHARS) return 'ocr_ok';
      if (t.length > 0) return 'ocr_poor';
      return 'ocr_failed';
    case 'ocr_unavailable':
      return 'ocr_unavailable';
    case 'ocr_failed':
    case 'file_not_found':
    case 'pdf_parse_error':
    case 'no_storage_path':
      return t.length > 0 ? 'ocr_poor' : 'ocr_failed';
    case 'pdf_no_text_layer':
      return t.length >= MIN_TEXT_CHARS ? 'ocr_ok' : 'ocr_unavailable';
    case 'unsupported':
    case 'unsupported_format':
      return 'ocr_skipped';
    default:
      if (t.length >= MIN_TEXT_CHARS) return 'text_layer';
      if (t.length > 0) return 'ocr_poor';
      return extractorReason || 'ocr_failed';
  }
}

function designationFromJson(json, role) {
  if (!json || typeof json !== 'object') return null;
  if (role === 'filler') {
    return emptyToNull(json.filler_designation || json.designation);
  }
  return emptyToNull(json.steel_designation || json.designation);
}

/** MC-I2: chiavi canoniche EN 10168. A07 (ordine acquirente) non è un DDT. */
const HEAT_ALIASES = [
  'heat_or_lot_no', 'heat_number', 'heat_no', 'cast_no', 'cast_number',
  'colata', 'lot_no', 'lot_number', 'B07',
];
const STANDARD_ALIASES = [
  'material_standard', 'steel_standard', 'product_standard',
];
const DDT_NO_ALIASES = ['ddt_no', 'delivery_note_no', 'ddt'];
const DDT_DATE_ALIASES = ['ddt_date', 'delivery_note_date'];

function firstNonEmpty(obj, keys) {
  if (!obj || typeof obj !== 'object') return null;
  for (const key of keys) {
    const v = emptyToNull(obj[key]);
    if (v) return v;
  }
  return null;
}

function normalizeSqlDate(raw) {
  const s = emptyToNull(raw);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function canonicalizeExtractedJson(raw) {
  const json = raw && typeof raw === 'object' && !Array.isArray(raw) ? { ...raw } : {};
  const heat = firstNonEmpty(json, HEAT_ALIASES);
  if (heat) json.heat_or_lot_no = heat;
  for (const k of HEAT_ALIASES) {
    if (k !== 'heat_or_lot_no') delete json[k];
  }
  const std = firstNonEmpty(json, STANDARD_ALIASES);
  if (std) json.material_standard = std;
  delete json.steel_standard;
  delete json.product_standard;
  // filler_standard resta: è campo schema apporto, non alias.
  const ddt = firstNonEmpty(json, DDT_NO_ALIASES);
  if (ddt) json.ddt_no = ddt;
  for (const k of DDT_NO_ALIASES) {
    if (k !== 'ddt_no') delete json[k];
  }
  const ddtDate = firstNonEmpty(json, DDT_DATE_ALIASES);
  if (ddtDate) json.ddt_date = ddtDate;
  for (const k of DDT_DATE_ALIASES) {
    if (k !== 'ddt_date') delete json[k];
  }
  return json;
}

const HEAT_LABEL_PATTERNS = [
  /\bB07\s*[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/gi,
  /\bColata\s*(?:n[°ºo.]?\s*)?[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/gi,
  /\bHeat\s*(?:No\.?|Number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/gi,
  /\bCast\s*(?:No\.?|Number|#)?\s*[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/gi,
  /\bLotto\s*(?:n[°ºo.]?\s*)?[:.\-]?\s*([A-Z0-9][A-Z0-9./\-]{2,40})/gi,
];

function normalizeHeatToken(raw) {
  const v = String(raw || '').replace(/[.,;:]+$/, '').trim();
  if (v.length < 3 || v.length > 40) return null;
  return v;
}

/** Fallback etichettato: Colata / Heat No / B07. Non cattura NNNN/YYYY isolato. */
function fallbackHeatFromText(text) {
  const all = detectAllHeatsFromText(text);
  return all.length ? all[0] : null;
}

/**
 * MC-I4: tutte le colate etichettate nel testo (ordine di apparizione, dedup case-insensitive).
 * Non usa numeri NNNN/YYYY senza etichetta (stesso vincolo di MC-I2).
 */
function detectAllHeatsFromText(text) {
  const t = String(text || '');
  if (!t.trim()) return [];
  const matches = [];
  for (const re of HEAT_LABEL_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(t)) !== null) {
      const v = normalizeHeatToken(m[1]);
      if (!v) continue;
      matches.push({ v, index: m.index });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  const seen = new Set();
  const out = [];
  for (const { v } of matches) {
    const key = v.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function uniqueHeats(list) {
  const seen = new Set();
  const out = [];
  for (const raw of list || []) {
    const v = normalizeHeatToken(raw);
    if (!v) continue;
    const key = v.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/**
 * Candidati split: testo etichettato + eventuali certificate_segments dall'AI.
 * Decisione MC-I4: split per colata (non per pagina PDF).
 */
function buildSplitCandidates(text, extractedJson) {
  const fromText = detectAllHeatsFromText(text);
  const segments = Array.isArray(extractedJson?.certificate_segments)
    ? extractedJson.certificate_segments
    : [];
  const fromAi = [];
  for (const seg of segments) {
    if (!seg || typeof seg !== 'object') continue;
    const heat = firstNonEmpty(seg, HEAT_ALIASES);
    if (heat) fromAi.push(heat);
  }
  const heats = uniqueHeats([...fromText, ...fromAi]);
  if (heats.length < 2) return [];
  return heats.map((heat_or_lot_no) => ({ heat_or_lot_no }));
}

const SPLITABLE = new Set([
  'received',
  'text_ready',
  'extracted',
  'pending_review',
  'non_compliant',
  'ocr_running',
]);

const MILL_JSON_KEYS = [
  'heat_or_lot_no', 'certificate_no', 'inspection_document_type',
  'steel_designation', 'filler_designation', 'ReH', 'Rm', 'A', 'KV',
  'chemistry', 'CEV', 'hardness', 'product_form', 'dimensions',
  'material_standard', 'filler_standard', 'delivery_condition', 'ndt',
  'thickness_mm', 'actual_mass', 'hydrogen_class', 'filler_diameter_mm',
  'manufacturer_works',
];

function filenameOf(storagePath) {
  const raw = String(storagePath || '').split(/[/\\]/).pop() || '';
  return raw.replace(/^\d+_/, '');
}

function normalizeDocumentKind(raw) {
  const k = String(emptyToNull(raw) || '').toLowerCase();
  if (k === 'delivery_note' || k === 'ddt' || k === 'bolla') return 'delivery_note';
  if (k === 'mill_certificate' || k === 'mill') return 'mill_certificate';
  return null;
}

/** MC-I3: il PDF è una bolla, non un 3.1. Filename CERTIFICATO/3.1 vince; DDT nel nome vince sull'AI. */
function detectSourceDocumentKind({ text, storagePath, aiKind }) {
  const file = filenameOf(storagePath);
  if (/\bCERTIFICATO\b/i.test(file) || /\b3[._-]1\b/.test(file)) return 'mill_certificate';
  if (/\bD\.?D\.?T\.?\b/i.test(file) || /\bbolla\b/i.test(file)) return 'delivery_note';
  const fromAi = normalizeDocumentKind(aiKind);
  if (fromAi) return fromAi;
  const head = String(text || '').slice(0, 160);
  if (/\bdocumento di trasporto\b/i.test(head) || /\bbolla di accompagnamento\b/i.test(head)) {
    return 'delivery_note';
  }
  return 'mill_certificate';
}

function fallbackDdtFromFilename(storagePath) {
  const file = filenameOf(storagePath);
  const m = file.match(/\bD\.?D\.?T\.?(?:_n\._|_n[._]|[\s_]*n[°o.]?\s*)([A-Z0-9]+)/i)
    || file.match(/\bDDT[_-]?n?[._-]?([A-Z0-9]+)/i);
  if (!m || !m[1]) return { ddt_no: null, ddt_date: null };
  const del = file.match(/del[_-](\d{1,2})[-.](\d{1,2})[-.](\d{2,4})/i);
  let ddtDate = null;
  if (del) {
    const year = del[3].length === 2 ? `20${del[3]}` : del[3];
    ddtDate = `${year}-${del[2].padStart(2, '0')}-${del[1].padStart(2, '0')}`;
  }
  return { ddt_no: m[1], ddt_date: ddtDate };
}

function fallbackDdtFromText(text) {
  const t = String(text || '');
  const m = t.match(/\b(?:D\.D\.T\.|DDT)\s*n[°o.]?\s*([A-Z0-9]+)/i);
  return m && m[1] ? m[1] : null;
}

function applyDeliveryNoteExtract(json, { text, storagePath }) {
  const out = json && typeof json === 'object' ? { ...json } : {};
  out.document_kind = 'delivery_note';
  for (const key of MILL_JSON_KEYS) out[key] = null;
  const fromFile = fallbackDdtFromFilename(storagePath);
  if (!emptyToNull(out.ddt_no)) out.ddt_no = fromFile.ddt_no || fallbackDdtFromText(text);
  if (!emptyToNull(out.ddt_date)) out.ddt_date = fromFile.ddt_date || out.ddt_date || null;
  return out;
}

function isDeliveryNotePayload(extracted, corrected) {
  return normalizeDocumentKind(
    emptyToNull(corrected?.document_kind) || emptyToNull(extracted?.document_kind)
  ) === 'delivery_note';
}

function applyAnagraficaFromJson(json, roleHint) {
  const canon = canonicalizeExtractedJson(json);
  const role = parseRole(canon.material_role, roleHint || 'base') || roleHint || 'base';
  return {
    material_role: role,
    certificate_no: emptyToNull(canon.certificate_no),
    designation: designationFromJson(canon, role),
    heat_or_lot_no: emptyToNull(canon.heat_or_lot_no),
    product_form: emptyToNull(canon.product_form),
    dimensions: emptyToNull(canon.dimensions),
    material_standard: emptyToNull(canon.material_standard)
      || (role === 'filler' ? emptyToNull(canon.filler_standard) : null),
    manufacturer_works: emptyToNull(canon.manufacturer_works),
    inspection_document_type: DOC_TYPES.has(canon.inspection_document_type)
      ? canon.inspection_document_type
      : null,
    ddt_no: emptyToNull(canon.ddt_no),
    ddt_date: normalizeSqlDate(canon.ddt_date),
  };
}

function buildFileUrl(storagePath) {
  if (!storagePath) return null;
  const uploadBase = process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(__dirname, '../../uploads');
  try {
    const resolved = path.resolve(storagePath);
    if (!fs.existsSync(resolved)) return null;
    return '/uploads/' + path.relative(uploadBase, resolved).replace(/\\/g, '/');
  } catch {
    return null;
  }
}

function hydrateRow(row) {
  if (!row) return row;
  return {
    ...row,
    extracted_json: parseJsonField(row.extracted_json) || row.extracted_json || null,
    corrected_json: parseJsonField(row.corrected_json) || row.corrected_json || null,
    evaluate_result_json: parseJsonField(row.evaluate_result_json) || row.evaluate_result_json || null,
    file_url: buildFileUrl(row.storage_path),
  };
}

/**
 * Griglia/PATCH usano `designation`; lo schema extract usa steel_/filler_designation.
 * Allinea i payload così recordFeedback / few-shot insegnano le chiavi AI.
 */
function alignMcFeedbackPayload(payload, roleHint) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  const out = { ...payload };
  const role = parseRole(out.material_role, roleHint) || roleHint || 'base';
  out.material_role = role;
  const fromGrid = emptyToNull(out.designation);
  if (fromGrid) {
    if (role === 'filler') out.filler_designation = fromGrid;
    else out.steel_designation = fromGrid;
  }
  delete out.designation;
  return out;
}

/**
 * MC-7 — stesso anello ADR-017 di WPQR/qualifiche.
 * Livello B (pattern federati) resta filtrato da REFERENCE_PATTERN_ALLOWLIST
 * (no heat/certificate_no/PII). Few-shot (livello C) resta scoped per org.
 * Non blocca PATCH/approve se il feedback fallisce.
 */
async function safeRecordMcFeedback({ req, row, humanPayload }) {
  const aiRaw = parseJsonField(row.extracted_json);
  if (!aiRaw || typeof aiRaw !== 'object' || !Object.keys(aiRaw).length) {
    return null;
  }
  const humanRaw = (humanPayload && typeof humanPayload === 'object')
    ? humanPayload
    : (parseJsonField(row.corrected_json) || aiRaw);
  const role = parseRole(
    humanRaw.material_role || row.material_role || aiRaw.material_role,
    row.material_role || 'base'
  ) || 'base';
  const aiPayload = alignMcFeedbackPayload(aiRaw, role);
  const human = alignMcFeedbackPayload(humanRaw, role);
  try {
    return await recordFeedback({
      organizationId: req.user.organization_id,
      companyId: row.company_id || null,
      docType: MC_FEEDBACK_DOC_TYPE,
      source: MC_FEEDBACK_SOURCE,
      action: 'accepted',
      aiPayload,
      humanPayload: human,
      fileName: row.storage_path ? path.basename(String(row.storage_path)) : null,
      modelUsed: row.ai_model || null,
      createdBy: req.user.user_id || null,
    });
  } catch (err) {
    logger.warn('[MC] Feedback non salvato', { error: err.message, id: row.id });
    return null;
  }
}

async function scopedCompanyFilter(req) {
  const accessList = await ensureCompanyAccessLoaded(req.user);
  return companyAccessSqlFilter(accessList, 'c');
}

async function loadCertificate(req, id) {
  const orgId = req.user.organization_id;
  const companyFilter = await scopedCompanyFilter(req);
  const params = { id, organization_id: orgId, ...companyFilter.params };
  const extra = companyFilter.clause ? ` AND ${companyFilter.clause}` : '';
  const r = await query(
    `SELECT c.* FROM dbo.material_certificates c
     WHERE c.id = @id AND c.organization_id = @organization_id${extra}`,
    params
  );
  return r.recordset[0] || null;
}

async function denyIfCompanyOutOfScope(req, companyId) {
  const accessList = await ensureCompanyAccessLoaded(req.user);
  if (Array.isArray(accessList) && accessList.length) {
    const ok = accessList.some((a) => Number(a.company_id) === Number(companyId));
    if (!ok) {
      return { status: 403, body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' } };
    }
  }
  const belongs = await companyBelongsToOrg(companyId, req.user.organization_id);
  if (!belongs) {
    return {
      status: 403,
      body: { error: 'Azienda non accessibile', code: 'FORBIDDEN' },
    };
  }
  return null;
}

async function denyIfCannotWrite(req, res, companyId) {
  const denied = await assertMutatingAllowed(req.user, { companyId });
  if (denied) {
    sendAccessDenied(res, denied);
    return true;
  }
  return false;
}

function jsonPayloadFromAi(aiResult) {
  const data = aiResult && aiResult.data && typeof aiResult.data === 'object' ? aiResult.data : {};
  const specific = data.type_specific_data && typeof data.type_specific_data === 'object'
    ? data.type_specific_data
    : data;
  return specific && typeof specific === 'object' && !Array.isArray(specific) ? specific : {};
}

async function persistEvaluateResult(organizationId, certificateId, result) {
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    await txQuery(tx, `
        DELETE FROM dbo.material_certificate_checks
        WHERE certificate_id = @certificate_id AND organization_id = @organization_id
      `, {
      certificate_id: certificateId,
      organization_id: organizationId,
    });
    for (const check of result.checks || []) {
      await txQuery(tx, `
          INSERT INTO dbo.material_certificate_checks
            (organization_id, certificate_id, requirement_key, source_level, source_ref,
             required_value, actual_value, result, explanation)
          VALUES
            (@organization_id, @certificate_id, @requirement_key, @source_level, @source_ref,
             @required_value, @actual_value, @result, @explanation)
        `, {
        organization_id: organizationId,
        certificate_id: certificateId,
        requirement_key: clip(check.requirement_key, 80),
        source_level: clip(check.source_level, 32),
        source_ref: clip(check.source_ref, 300),
        required_value: clip(check.required_value, 200),
        actual_value: clip(check.actual_value, 200),
        result: check.result,
        explanation: clip(check.explanation, 500),
      });
    }
    // MC-I0: non confrontare updated_at con il Date JS di node-mssql.
    // DATETIME2 (100 ns) vs Date (ms) → 409 spurio su extracted (ADA 18/08).
    // Race: workflow_status IN EVALUABLE nella stessa transazione.
    const upd = await txQuery(tx, `
        UPDATE dbo.material_certificates
        SET evaluate_result_json = @evaluate_result_json,
            kb_snapshot_hash = @kb_snapshot_hash,
            kb_snapshot_json = @kb_snapshot_json,
            workflow_status = 'pending_review',
            reviewed_by = NULL,
            reviewed_at = NULL,
            review_notes = NULL,
            updated_at = SYSUTCDATETIME()
        OUTPUT INSERTED.id
        WHERE id = @id AND organization_id = @organization_id
          AND workflow_status IN (${sqlInStatus(EVALUABLE)})
      `, {
      id: certificateId,
      organization_id: organizationId,
      evaluate_result_json: JSON.stringify(result),
      kb_snapshot_hash: result.kb_snapshot_hash || null,
      kb_snapshot_json: JSON.stringify({
        hash: result.kb_snapshot_hash,
        evaluated_at: new Date().toISOString(),
      }),
    });
    if (!outputRow(upd)) {
      throw illegalTransition();
    }
    await tx.commit();
  } catch (err) {
    try { await tx.rollback(); } catch (_) { /* ignore */ }
    throw err;
  }
}

async function listCertificates(req, res) {
  try {
    const orgId = req.user.organization_id;
    const companyFilter = await scopedCompanyFilter(req);
    const companyId = parseId(req.query.company_id);
    if (req.query.company_id && !companyId) {
      return res.status(400).json({ error: 'company_id non valido', code: 'INVALID_COMPANY_ID' });
    }
    if (companyId) {
      const denied = await denyIfCompanyOutOfScope(req, companyId);
      if (denied) return sendAccessDenied(res, denied);
    }

    const where = ['c.organization_id = @organization_id'];
    const params = {
      organization_id: orgId,
      ...companyFilter.params,
    };
    if (companyFilter.clause) where.push(companyFilter.clause);
    if (companyId) {
      where.push('c.company_id = @company_id');
      params.company_id = companyId;
    }
    const role = emptyToNull(req.query.material_role);
    if (role) {
      if (!ROLES.has(role)) {
        return res.status(400).json({ error: 'material_role deve essere base o filler', code: 'INVALID_ROLE' });
      }
      where.push('c.material_role = @material_role');
      params.material_role = role;
    }
    const statusRaw = emptyToNull(req.query.workflow_status);
    if (statusRaw) {
      const statuses = statusRaw.split(',').map((s) => s.trim()).filter(Boolean);
      if (statuses.some((s) => !GRID_STATUSES.has(s))) {
        return res.status(400).json({ error: 'workflow_status non valido', code: 'INVALID_STATUS' });
      }
      const parts = statuses.map((s, i) => {
        params[`st_${i}`] = s;
        return `@st_${i}`;
      });
      where.push(`c.workflow_status IN (${parts.join(', ')})`);
    }
    const q = emptyToNull(req.query.q);
    if (q) {
      params.q = `%${q.slice(0, 80)}%`;
      where.push(`(
        c.ddt_no LIKE @q OR c.certificate_no LIKE @q
        OR c.designation LIKE @q OR c.heat_or_lot_no LIKE @q
      )`);
    }
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    params.limit = limit;
    params.offset = offset;
    const whereSql = where.join(' AND ');
    const rows = await query(
      `SELECT ${GRID_COLUMNS}
       FROM dbo.material_certificates c
       WHERE ${whereSql}
       ORDER BY c.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      params
    );
    res.json({ success: true, data: rows.recordset || [] });
  } catch (err) {
    logger.error('listCertificates', err);
    res.status(500).json({ error: 'Errore nel caricamento dei certificati' });
  }
}

async function getStats(req, res) {
  try {
    const orgId = req.user.organization_id;
    const companyFilter = await scopedCompanyFilter(req);
    const companyId = parseId(req.query.company_id);
    if (req.query.company_id && !companyId) {
      return res.status(400).json({ error: 'company_id non valido', code: 'INVALID_COMPANY_ID' });
    }
    if (companyId) {
      const denied = await denyIfCompanyOutOfScope(req, companyId);
      if (denied) return sendAccessDenied(res, denied);
    }
    const where = ['c.organization_id = @organization_id'];
    const params = { organization_id: orgId, ...companyFilter.params };
    if (companyFilter.clause) where.push(companyFilter.clause);
    if (companyId) {
      where.push('c.company_id = @company_id');
      params.company_id = companyId;
    }
    const role = emptyToNull(req.query.material_role);
    if (role && ROLES.has(role)) {
      where.push('c.material_role = @material_role');
      params.material_role = role;
    }
    const whereSql = where.join(' AND ');
    const r = await query(
      `SELECT c.workflow_status, c.material_role, COUNT(*) AS n
       FROM dbo.material_certificates c
       WHERE ${whereSql}
       GROUP BY c.workflow_status, c.material_role`,
      params
    );
    res.json({ success: true, data: r.recordset || [] });
  } catch (err) {
    logger.error('getCertificateStats', err);
    res.status(500).json({ error: 'Errore nel calcolo delle statistiche' });
  }
}

async function getCertificate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    const row = await loadCertificate(req, id);
    if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
    const checks = await query(
      `SELECT id, requirement_key, source_level, source_ref, required_value,
              actual_value, result, explanation, created_at
       FROM dbo.material_certificate_checks
       WHERE certificate_id = @id AND organization_id = @organization_id
       ORDER BY id`,
      { id, organization_id: req.user.organization_id }
    );
    const hydrated = hydrateRow(row);
    res.json({
      success: true,
      data: {
        ...hydrated,
        checks: checks.recordset || [],
      },
    });
  } catch (err) {
    logger.error('getCertificate', err);
    res.status(500).json({ error: 'Errore nel caricamento del certificato' });
  }
}

async function createCertificate(req, res) {
  try {
    const orgId = req.user.organization_id;
    const companyId = parseId(req.body?.company_id || req.query.company_id);
    if (!companyId) {
      return res.status(400).json({ error: 'company_id obbligatorio', code: 'COMPANY_REQUIRED' });
    }
    const scopeDenied = await denyIfCompanyOutOfScope(req, companyId);
    if (scopeDenied) return sendAccessDenied(res, scopeDenied);
    if (await denyIfCannotWrite(req, res, companyId)) return;
    if (!req.file) {
      return res.status(400).json({ error: 'File PDF mancante', code: 'FILE_REQUIRED' });
    }
    const role = parseRole(req.body?.material_role, 'base');
    if (!role) {
      return res.status(400).json({ error: 'material_role deve essere base o filler', code: 'INVALID_ROLE' });
    }

    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    let inserted;
    try {
      const job = await txQuery(tx, `
        INSERT INTO import_jobs (organization_id, company_id, created_by, title, status, document_type_hint)
        OUTPUT INSERTED.id
        VALUES (@organization_id, @company_id, @created_by, @title, 'draft', 'material_certificate')`, {
        organization_id: orgId,
        company_id: companyId,
        created_by: req.user.user_id || null,
        title: clip(req.file.originalname || 'Certificato materiale', 255),
      });
      const importJobId = job.recordset[0].id;
      const fileIns = await txQuery(tx, `
        INSERT INTO import_job_files (job_id, original_name, storage_path, mime_type, file_size, status)
        OUTPUT INSERTED.id
        VALUES (@job_id, @original_name, @storage_path, @mime_type, @file_size, 'uploaded')`, {
        job_id: importJobId,
        original_name: clip(req.file.originalname, 255),
        storage_path: req.file.path,
        mime_type: req.file.mimetype || 'application/pdf',
        file_size: req.file.size || 0,
      });
      const importJobFileId = fileIns.recordset[0].id;
      inserted = await txQuery(tx, `
        INSERT INTO dbo.material_certificates
          (organization_id, company_id, import_job_id, import_job_file_id, storage_path,
           ddt_no, ddt_date, material_role, workflow_status, created_by)
        OUTPUT INSERTED.id, INSERTED.workflow_status, INSERTED.material_role, INSERTED.company_id
        VALUES
          (@organization_id, @company_id, @import_job_id, @import_job_file_id, @storage_path,
           @ddt_no, @ddt_date, @material_role, 'received', @created_by)`, {
        organization_id: orgId,
        company_id: companyId,
        import_job_id: importJobId,
        import_job_file_id: importJobFileId,
        storage_path: req.file.path,
        ddt_no: clip(emptyToNull(req.body?.ddt_no), 80),
        ddt_date: emptyToNull(req.body?.ddt_date),
        material_role: role,
        created_by: req.user.user_id || null,
      });
      await tx.commit();
    } catch (txErr) {
      try { await tx.rollback(); } catch (_) { /* ignore */ }
      throw txErr;
    }
    res.status(201).json({ success: true, data: inserted.recordset[0] });
  } catch (err) {
    logger.error('createCertificate', err);
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
    }
    const msg = describeIngestFileError(err, 'Errore durante il caricamento del certificato');
    res.status(500).json({ error: msg });
  }
}

function pickPatchColumns(body) {
  const out = {};
  const colKeys = [
    'ddt_no', 'ddt_date', 'certificate_no', 'material_role', 'designation',
    'heat_or_lot_no', 'product_form', 'dimensions', 'material_standard',
    'manufacturer_works', 'inspection_document_type',
  ];
  for (const key of colKeys) {
    if (Object.prototype.hasOwnProperty.call(body, key)) out[key] = body[key];
  }
  return out;
}

async function patchCertificate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'workflow_status')) {
      return res.status(400).json({
        error: 'Lo stato si cambia solo con approva / respingi / archivia',
        code: 'WORKFLOW_VIA_HITL',
      });
    }
    const row = await loadCertificate(req, id);
    if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
    if (await denyIfCannotWrite(req, res, row.company_id)) return;
    if (!PATCHABLE.has(row.workflow_status)) {
      return res.status(409).json({
        error: 'Modifica non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
        workflow_status: row.workflow_status,
      });
    }

    const cols = pickPatchColumns(req.body || {});
    if (cols.material_role != null) {
      const role = parseRole(cols.material_role, null);
      if (!role) {
        return res.status(400).json({ error: 'material_role deve essere base o filler', code: 'INVALID_ROLE' });
      }
      cols.material_role = role;
    }
    if (cols.inspection_document_type != null && cols.inspection_document_type !== '') {
      if (!DOC_TYPES.has(String(cols.inspection_document_type))) {
        return res.status(400).json({ error: 'Tipo documento non valido (2.1–3.2)', code: 'INVALID_DOC_TYPE' });
      }
    }

    let corrected = parseJsonField(row.corrected_json) || parseJsonField(row.extracted_json) || {};
    if (req.body?.corrected_json && typeof req.body.corrected_json === 'object') {
      corrected = { ...corrected, ...req.body.corrected_json };
    }
    for (const key of MATERIAL_CERTIFICATE_MANUAL_EDITABLE_FIELDS) {
      if (key === 'corrected_json' || key === 'ddt_no' || key === 'ddt_date') continue;
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key) && !Object.prototype.hasOwnProperty.call(cols, key)) {
        corrected[key] = req.body[key];
      }
    }
    corrected = canonicalizeExtractedJson(corrected);
    const patchToDdt = normalizeDocumentKind(corrected.document_kind) === 'delivery_note';
    if (patchToDdt) {
      corrected = applyDeliveryNoteExtract(corrected, {
        text: '',
        storagePath: row.storage_path,
      });
    }
    const fromJson = applyAnagraficaFromJson(corrected, cols.material_role || row.material_role);
    const millOrRow = (jsonVal, rowVal) => (patchToDdt ? jsonVal : (jsonVal || rowVal));
    const next = {
      ddt_no: cols.ddt_no !== undefined ? clip(emptyToNull(cols.ddt_no), 80) : (fromJson.ddt_no || row.ddt_no),
      ddt_date: cols.ddt_date !== undefined
        ? normalizeSqlDate(cols.ddt_date)
        : (fromJson.ddt_date || row.ddt_date),
      certificate_no: cols.certificate_no !== undefined
        ? clip(emptyToNull(cols.certificate_no), 120) : millOrRow(fromJson.certificate_no, row.certificate_no),
      material_role: cols.material_role || fromJson.material_role || row.material_role,
      designation: cols.designation !== undefined
        ? clip(emptyToNull(cols.designation), 200) : millOrRow(fromJson.designation, row.designation),
      heat_or_lot_no: cols.heat_or_lot_no !== undefined
        ? clip(emptyToNull(cols.heat_or_lot_no), 80) : millOrRow(fromJson.heat_or_lot_no, row.heat_or_lot_no),
      product_form: cols.product_form !== undefined
        ? clip(emptyToNull(cols.product_form), 40) : millOrRow(fromJson.product_form, row.product_form),
      dimensions: cols.dimensions !== undefined
        ? clip(emptyToNull(cols.dimensions), 120) : millOrRow(fromJson.dimensions, row.dimensions),
      material_standard: cols.material_standard !== undefined
        ? clip(emptyToNull(cols.material_standard), 80) : millOrRow(fromJson.material_standard, row.material_standard),
      manufacturer_works: cols.manufacturer_works !== undefined
        ? clip(emptyToNull(cols.manufacturer_works), 200)
        : millOrRow(fromJson.manufacturer_works, row.manufacturer_works),
      inspection_document_type: cols.inspection_document_type !== undefined
        ? emptyToNull(cols.inspection_document_type)
        : millOrRow(fromJson.inspection_document_type, row.inspection_document_type),
    };
    for (const key of Object.keys(cols)) {
      if (Object.prototype.hasOwnProperty.call(next, key)) {
        corrected[key] = next[key];
      }
    }

    const updated = await query(
      `UPDATE dbo.material_certificates
       SET ddt_no = @ddt_no, ddt_date = @ddt_date, certificate_no = @certificate_no,
           material_role = @material_role, designation = @designation,
           heat_or_lot_no = @heat_or_lot_no, product_form = @product_form,
           dimensions = @dimensions, material_standard = @material_standard,
           manufacturer_works = @manufacturer_works,
           inspection_document_type = @inspection_document_type,
           corrected_json = @corrected_json, updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.id, INSERTED.workflow_status, INSERTED.material_role
       WHERE id = @id AND organization_id = @organization_id
         AND workflow_status IN (${sqlInStatus(PATCHABLE)})`,
      {
        id,
        organization_id: req.user.organization_id,
        ...next,
        corrected_json: JSON.stringify(corrected),
      }
    );
    if (!outputRow(updated)) {
      return res.status(409).json({
        error: 'Modifica non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
      });
    }
    await safeRecordMcFeedback({ req, row, humanPayload: corrected });
    res.json({ success: true, data: updated.recordset[0] });
  } catch (err) {
    logger.error('patchCertificate', err);
    res.status(500).json({ error: 'Errore nel salvataggio delle correzioni' });
  }
}

async function extractCertificate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    const row = await loadCertificate(req, id);
    if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
    if (await denyIfCannotWrite(req, res, row.company_id)) return;
    if (!EXTRACTABLE.has(row.workflow_status)) {
      return res.status(409).json({
        error: 'Estrazione non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
        workflow_status: row.workflow_status,
      });
    }

    const extracted = await extractDocumentText(row.storage_path, 'application/pdf', row.storage_path);
    const text = extracted.text || '';
    const reason = mapTextReason(extracted.reason, text);

    if (!text || text.trim().length < MIN_TEXT_CHARS) {
      const saved = await query(
        `UPDATE dbo.material_certificates
         SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
             extracted_json = NULL,
             corrected_json = NULL,
             workflow_status = 'text_ready', updated_at = SYSUTCDATETIME()
         OUTPUT INSERTED.id
         WHERE id = @id AND organization_id = @organization_id
           AND workflow_status IN (${sqlInStatus(EXTRACTABLE)})`,
        {
          id,
          organization_id: req.user.organization_id,
          extracted_text: text || null,
          text_extract_reason: reason,
        }
      );
      if (!outputRow(saved)) {
        return res.status(409).json({
          error: 'Estrazione non consentita in questo stato',
          code: 'ILLEGAL_TRANSITION',
        });
      }
      return res.json({
        success: true,
        data: {
          id,
          workflow_status: 'text_ready',
          text_extract_reason: reason,
          extracted_json: null,
        },
      });
    }

    let aiResult;
    try {
      aiResult = await extractStructuredByDocType({
        text,
        docType: 'material_certificate',
        organizationId: req.user.organization_id,
      });
    } catch (aiErr) {
      logger.warn('extractCertificate AI', aiErr.message);
      const saved = await query(
        `UPDATE dbo.material_certificates
         SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
             extracted_json = NULL,
             corrected_json = NULL,
             workflow_status = 'text_ready', updated_at = SYSUTCDATETIME()
         OUTPUT INSERTED.id
         WHERE id = @id AND organization_id = @organization_id
           AND workflow_status IN (${sqlInStatus(EXTRACTABLE)})`,
        {
          id,
          organization_id: req.user.organization_id,
          extracted_text: text,
          text_extract_reason: reason,
        }
      );
      if (!outputRow(saved)) {
        return res.status(409).json({
          error: 'Estrazione non consentita in questo stato',
          code: 'ILLEGAL_TRANSITION',
        });
      }
      const code = aiErr.code === 'AI_NOT_CONFIGURED' ? 'AI_NOT_CONFIGURED' : 'AI_EXTRACT_FAILED';
      return res.json({
        success: true,
        data: {
          id,
          workflow_status: 'text_ready',
          text_extract_reason: reason,
          extracted_json: null,
          warning: aiErr.code === 'AI_NOT_CONFIGURED'
            ? 'Provider AI non configurato: testo salvato, JSON da estrarre in seguito'
            : 'Estrazione AI non riuscita: testo salvato, JSON da estrarre in seguito',
          code,
        },
      });
    }

    let extractedJson = canonicalizeExtractedJson(jsonPayloadFromAi(aiResult));
    if (extractedJson.material_role && !ROLES.has(extractedJson.material_role)) {
      extractedJson.material_role = 'base';
    }
    if (!extractedJson.material_role) extractedJson.material_role = row.material_role || 'base';
    const documentKind = detectSourceDocumentKind({
      text,
      storagePath: row.storage_path,
      aiKind: extractedJson.document_kind,
    });
    const clearMill = documentKind === 'delivery_note';
    if (clearMill) {
      extractedJson = applyDeliveryNoteExtract(extractedJson, {
        text,
        storagePath: row.storage_path,
      });
    } else {
      extractedJson.document_kind = 'mill_certificate';
      if (!emptyToNull(extractedJson.heat_or_lot_no)) {
        const fromText = fallbackHeatFromText(text);
        if (fromText) extractedJson.heat_or_lot_no = fromText;
      }
      const splitCandidates = buildSplitCandidates(text, extractedJson);
      if (splitCandidates.length >= 2) {
        extractedJson.split_candidates = splitCandidates;
        if (!emptyToNull(extractedJson.heat_or_lot_no)) {
          extractedJson.heat_or_lot_no = splitCandidates[0].heat_or_lot_no;
        }
      } else {
        delete extractedJson.split_candidates;
      }
    }
    if (clearMill) delete extractedJson.split_candidates;
    const ana = applyAnagraficaFromJson(extractedJson, row.material_role);
    const model = clip(aiResult.model, 80);
    const splitCandidatesOut = Array.isArray(extractedJson.split_candidates)
      ? extractedJson.split_candidates
      : [];

    const saved = await query(
      `UPDATE dbo.material_certificates
       SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
           extracted_json = @extracted_json, ai_model = @ai_model,
           corrected_json = NULL,
           certificate_no = CASE WHEN @clear_mill = 1 THEN @certificate_no ELSE COALESCE(@certificate_no, certificate_no) END,
           designation = CASE WHEN @clear_mill = 1 THEN @designation ELSE COALESCE(@designation, designation) END,
           heat_or_lot_no = CASE WHEN @clear_mill = 1 THEN @heat_or_lot_no ELSE COALESCE(@heat_or_lot_no, heat_or_lot_no) END,
           product_form = CASE WHEN @clear_mill = 1 THEN @product_form ELSE COALESCE(@product_form, product_form) END,
           dimensions = CASE WHEN @clear_mill = 1 THEN @dimensions ELSE COALESCE(@dimensions, dimensions) END,
           material_standard = CASE WHEN @clear_mill = 1 THEN @material_standard ELSE COALESCE(@material_standard, material_standard) END,
           manufacturer_works = CASE WHEN @clear_mill = 1 THEN @manufacturer_works ELSE COALESCE(@manufacturer_works, manufacturer_works) END,
           inspection_document_type = CASE WHEN @clear_mill = 1 THEN @inspection_document_type ELSE COALESCE(@inspection_document_type, inspection_document_type) END,
           ddt_no = COALESCE(@ddt_no, ddt_no),
           ddt_date = COALESCE(@ddt_date, ddt_date),
           material_role = @material_role,
           workflow_status = 'extracted', updated_at = SYSUTCDATETIME()
       OUTPUT INSERTED.id
       WHERE id = @id AND organization_id = @organization_id
         AND workflow_status IN (${sqlInStatus(EXTRACTABLE)})`,
      {
        id,
        organization_id: req.user.organization_id,
        extracted_text: text,
        text_extract_reason: reason,
        extracted_json: JSON.stringify(extractedJson),
        ai_model: model,
        clear_mill: clearMill ? 1 : 0,
        certificate_no: clip(ana.certificate_no, 120),
        designation: clip(ana.designation, 200),
        heat_or_lot_no: clip(ana.heat_or_lot_no, 80),
        product_form: clip(ana.product_form, 40),
        dimensions: clip(ana.dimensions, 120),
        material_standard: clip(ana.material_standard, 80),
        manufacturer_works: clip(ana.manufacturer_works, 200),
        inspection_document_type: ana.inspection_document_type,
        ddt_no: clip(ana.ddt_no, 80),
        ddt_date: ana.ddt_date,
        material_role: ana.material_role,
      }
    );
    if (!outputRow(saved)) {
      return res.status(409).json({
        error: 'Estrazione non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
      });
    }

    res.json({
      success: true,
      data: {
        id,
        workflow_status: 'extracted',
        text_extract_reason: reason,
        extracted_json: extractedJson,
        split_candidates: splitCandidatesOut,
      },
      _aiMeta: {
        provider: 'import',
        model: aiResult.model || 'unknown',
        contextSummary: `material_certificate:${id}`,
      },
    });
  } catch (err) {
    logger.error('extractCertificate', err);
    res.status(500).json({ error: 'Errore durante l\'estrazione del certificato' });
  }
}

/**
 * MC-I4 HITL: dalla busta crea N-1 righe sorelle (stesso PDF), una colata ciascuna.
 * Non spezza il file in pagine: riusa storage_path / import_job.
 */
async function splitCertificate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    const row = await loadCertificate(req, id);
    if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
    if (await denyIfCannotWrite(req, res, row.company_id)) return;
    if (!SPLITABLE.has(row.workflow_status)) {
      return res.status(409).json({
        error: 'Divisione non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
        workflow_status: row.workflow_status,
      });
    }
    if (!row.storage_path) {
      return res.status(400).json({ error: 'PDF assente sulla riga', code: 'NO_STORAGE' });
    }

    const extractedJson = parseJsonField(row.extracted_json) || {};
    const correctedJson = parseJsonField(row.corrected_json);
    if (isDeliveryNotePayload(correctedJson, extractedJson)) {
      return res.status(409).json({
        error: 'Un DDT non si divide in certificati mill',
        code: 'NOT_A_CERTIFICATE',
      });
    }

    let heats = [];
    if (Array.isArray(req.body?.heats)) {
      heats = uniqueHeats(req.body.heats);
    }
    if (heats.length < 2 && Array.isArray(extractedJson.split_candidates)) {
      heats = uniqueHeats(
        extractedJson.split_candidates.map((c) => (c && typeof c === 'object' ? c.heat_or_lot_no : c))
      );
    }
    if (heats.length < 2) {
      heats = uniqueHeats(detectAllHeatsFromText(row.extracted_text));
    }
    if (heats.length < 2) {
      return res.status(400).json({
        error: 'Servono almeno due colate distinte per dividere la busta',
        code: 'SPLIT_NEEDS_HEATS',
      });
    }

    const siblings = await query(
      `SELECT id, heat_or_lot_no FROM dbo.material_certificates
       WHERE organization_id = @organization_id
         AND storage_path = @storage_path
         AND id <> @id`,
      {
        organization_id: req.user.organization_id,
        storage_path: row.storage_path,
        id,
      }
    );
    if ((siblings.recordset || []).length > 0) {
      return res.status(409).json({
        error: 'Questa busta è già stata divisa in più righe',
        code: 'ALREADY_SPLIT',
        data: { existing: siblings.recordset },
      });
    }

    const [firstHeat, ...restHeats] = heats;
    const baseJson = {
      ...extractedJson,
      document_kind: 'mill_certificate',
      split_from_id: id,
    };
    delete baseJson.certificate_segments;
    delete baseJson.split_candidates;

    const pool = await getPool();
    const tx = pool.transaction();
    await tx.begin();
    const created = [];
    try {
      const parentJson = {
        ...baseJson,
        heat_or_lot_no: firstHeat,
        split_index: 1,
        split_total: heats.length,
      };
      await txQuery(tx, `
        UPDATE dbo.material_certificates
        SET heat_or_lot_no = @heat_or_lot_no,
            extracted_json = @extracted_json,
            corrected_json = NULL,
            evaluate_result_json = NULL,
            workflow_status = CASE
              WHEN workflow_status IN ('compliant', 'archived') THEN workflow_status
              ELSE 'extracted'
            END,
            updated_at = SYSUTCDATETIME()
        WHERE id = @id AND organization_id = @organization_id`, {
        id,
        organization_id: req.user.organization_id,
        heat_or_lot_no: clip(firstHeat, 80),
        extracted_json: JSON.stringify(parentJson),
      });

      for (let i = 0; i < restHeats.length; i += 1) {
        const heat = restHeats[i];
        const childJson = {
          ...baseJson,
          heat_or_lot_no: heat,
          split_index: i + 2,
          split_total: heats.length,
        };
        const ana = applyAnagraficaFromJson(childJson, row.material_role || 'base');
        const ins = await txQuery(tx, `
          INSERT INTO dbo.material_certificates
            (organization_id, company_id, import_job_id, import_job_file_id, storage_path,
             ddt_no, ddt_date, certificate_no, material_role, designation, heat_or_lot_no,
             product_form, dimensions, material_standard, manufacturer_works,
             inspection_document_type, workflow_status, extracted_text, text_extract_reason,
             extracted_json, ai_model, created_by)
          OUTPUT INSERTED.id, INSERTED.heat_or_lot_no, INSERTED.workflow_status
          VALUES
            (@organization_id, @company_id, @import_job_id, @import_job_file_id, @storage_path,
             @ddt_no, @ddt_date, @certificate_no, @material_role, @designation, @heat_or_lot_no,
             @product_form, @dimensions, @material_standard, @manufacturer_works,
             @inspection_document_type, 'extracted', @extracted_text, @text_extract_reason,
             @extracted_json, @ai_model, @created_by)`, {
          organization_id: req.user.organization_id,
          company_id: row.company_id,
          import_job_id: row.import_job_id || null,
          import_job_file_id: row.import_job_file_id || null,
          storage_path: row.storage_path,
          ddt_no: clip(emptyToNull(ana.ddt_no) || emptyToNull(row.ddt_no), 80),
          ddt_date: emptyToNull(ana.ddt_date) || emptyToNull(row.ddt_date),
          certificate_no: clip(ana.certificate_no || row.certificate_no, 120),
          material_role: ana.material_role || row.material_role || 'base',
          designation: clip(ana.designation || row.designation, 200),
          heat_or_lot_no: clip(heat, 80),
          product_form: clip(ana.product_form || row.product_form, 40),
          dimensions: clip(ana.dimensions || row.dimensions, 120),
          material_standard: clip(ana.material_standard || row.material_standard, 80),
          manufacturer_works: clip(ana.manufacturer_works || row.manufacturer_works, 200),
          inspection_document_type: ana.inspection_document_type || row.inspection_document_type || null,
          extracted_text: row.extracted_text || null,
          text_extract_reason: row.text_extract_reason || null,
          extracted_json: JSON.stringify(childJson),
          ai_model: clip(row.ai_model, 80),
          created_by: req.user.user_id || null,
        });
        created.push(ins.recordset[0]);
      }
      await tx.commit();
    } catch (txErr) {
      try { await tx.rollback(); } catch (_) { /* ignore */ }
      throw txErr;
    }

    res.status(201).json({
      success: true,
      data: {
        parent_id: id,
        heats,
        created,
        total_rows: heats.length,
      },
    });
  } catch (err) {
    logger.error('splitCertificate', err);
    res.status(500).json({ error: 'Errore durante la divisione della busta' });
  }
}

async function evaluateCertificate(req, res) {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Id non valido' });
    const row = await loadCertificate(req, id);
    if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
    if (await denyIfCannotWrite(req, res, row.company_id)) return;
    if (!EVALUABLE.has(row.workflow_status)) {
      return res.status(409).json({
        error: 'Valutazione non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
        workflow_status: row.workflow_status,
      });
    }

    const extractedJson = parseJsonField(row.extracted_json);
    const correctedJson = parseJsonField(row.corrected_json);
    if (!extractedJson && !correctedJson) {
      return res.status(400).json({
        error: 'JSON di estrazione assente: esegui prima extract',
        code: 'EXTRACT_REQUIRED',
      });
    }
    if (isDeliveryNotePayload(extractedJson, correctedJson)) {
      return res.status(409).json({
        error: 'Questo documento è un DDT, non un certificato 3.1: la valutazione non si applica',
        code: 'NOT_A_CERTIFICATE',
      });
    }

    const result = evaluateMaterialCertificate({
      extractedJson,
      correctedJson,
      // Overlay PO/cliente/azienda solo da KB server-side (slice successiva).
      // Il body client non è fonte di verità ADR-021.
      scope: {},
    });

    await persistEvaluateResult(req.user.organization_id, id, result);

    res.json({
      success: true,
      data: {
        id,
        workflow_status: 'pending_review',
        status: result.status,
        kb_snapshot_hash: result.kb_snapshot_hash,
        checks: result.checks,
      },
    });
  } catch (err) {
    if (err.code === 'ILLEGAL_TRANSITION') {
      return res.status(409).json({
        error: 'Valutazione non consentita in questo stato',
        code: 'ILLEGAL_TRANSITION',
        workflow_status: err.workflowStatus,
      });
    }
    logger.error('evaluateCertificate', err);
    res.status(500).json({ error: 'Errore durante la valutazione del certificato' });
  }
}

async function transitionHitl(req, res, { nextStatus, allowed, notesRequired, recordLearning = false }) {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Id non valido' });
  const row = await loadCertificate(req, id);
  if (!row) return res.status(404).json({ error: 'Certificato non trovato' });
  if (await denyIfCannotWrite(req, res, row.company_id)) return;
  if (!allowed.has(row.workflow_status)) {
    return res.status(409).json({
      error: 'Transizione di stato non consentita',
      code: 'ILLEGAL_TRANSITION',
      workflow_status: row.workflow_status,
    });
  }
  const notes = emptyToNull(req.body?.review_notes);
  if (notesRequired && !notes) {
    return res.status(400).json({ error: 'Note di revisione consigliate: inserisci una nota', code: 'NOTES_REQUIRED' });
  }
  const stampReview = nextStatus === 'compliant' || nextStatus === 'non_compliant';
  const updated = await query(
    `UPDATE dbo.material_certificates
     SET workflow_status = @workflow_status,
         review_notes = COALESCE(@review_notes, review_notes),
         reviewed_by = CASE WHEN @stamp = 1 THEN @reviewed_by ELSE reviewed_by END,
         reviewed_at = CASE WHEN @stamp = 1 THEN SYSUTCDATETIME() ELSE reviewed_at END,
         updated_at = SYSUTCDATETIME()
     OUTPUT INSERTED.id, INSERTED.workflow_status, INSERTED.reviewed_at
     WHERE id = @id AND organization_id = @organization_id
       AND workflow_status IN (${sqlInStatus(allowed)})`,
    {
      id,
      organization_id: req.user.organization_id,
      workflow_status: nextStatus,
      review_notes: notes,
      reviewed_by: req.user.user_id || null,
      stamp: stampReview ? 1 : 0,
    }
  );
  if (!updated.recordset || !updated.recordset.length) {
    return res.status(409).json({
      error: 'Transizione di stato non consentita',
      code: 'ILLEGAL_TRANSITION',
    });
  }
  if (recordLearning) {
    const humanPayload = parseJsonField(row.corrected_json)
      || parseJsonField(row.extracted_json)
      || {};
    await safeRecordMcFeedback({ req, row, humanPayload });
  }
  return res.json({ success: true, data: updated.recordset[0] });
}

async function approveCertificate(req, res) {
  try {
    await transitionHitl(req, res, {
      nextStatus: 'compliant',
      allowed: APPROVABLE,
      notesRequired: false,
      recordLearning: true,
    });
  } catch (err) {
    logger.error('approveCertificate', err);
    res.status(500).json({ error: 'Errore durante l\'approvazione' });
  }
}

async function rejectCertificate(req, res) {
  try {
    await transitionHitl(req, res, {
      nextStatus: 'non_compliant',
      allowed: REJECTABLE,
      notesRequired: false,
    });
  } catch (err) {
    logger.error('rejectCertificate', err);
    res.status(500).json({ error: 'Errore durante il respingimento' });
  }
}

async function archiveCertificate(req, res) {
  try {
    await transitionHitl(req, res, {
      nextStatus: 'archived',
      allowed: ARCHIVABLE,
      notesRequired: false,
    });
  } catch (err) {
    logger.error('archiveCertificate', err);
    res.status(500).json({ error: 'Errore durante l\'archiviazione' });
  }
}

module.exports = {
  MATERIAL_CERTIFICATE_MANUAL_EDITABLE_FIELDS,
  MC_FEEDBACK_DOC_TYPE,
  MC_FEEDBACK_SOURCE,
  listCertificates,
  getStats,
  getCertificate,
  createCertificate,
  patchCertificate,
  extractCertificate,
  splitCertificate,
  evaluateCertificate,
  approveCertificate,
  rejectCertificate,
  archiveCertificate,
  mapTextReason,
  canonicalizeExtractedJson,
  applyAnagraficaFromJson,
  fallbackHeatFromText,
  detectAllHeatsFromText,
  buildSplitCandidates,
  detectSourceDocumentKind,
  applyDeliveryNoteExtract,
  safeRecordMcFeedback,
  alignMcFeedbackPayload,
  fallbackDdtFromFilename,
  isDeliveryNotePayload,
};
