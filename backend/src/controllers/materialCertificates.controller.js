/**
 * Material Compliance MC-4 — API certificati materiale (base e apporto).
 * Extract: ingest AI. Evaluate: Rule Engine MC-3 (zero LLM).
 * workflow_status=compliant solo da HITL approve, mai da AI o dal motore.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { query } = require('../config/database');
const logger = require('../utils/logger');
const {
  ensureCompanyAccessLoaded,
  companyAccessSqlFilter,
  assertMutatingAllowed,
  sendAccessDenied,
} = require('../services/companyAccess.service');
const { extractDocumentText } = require('../services/documentTextExtractor.service');
const { extractStructuredByDocType } = require('../services/importAiExtraction.service');
const { evaluateMaterialCertificate } = require('../services/materialComplianceRuleEngine.service');
const { describeIngestFileError } = require('../utils/ingestErrorMessage');

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
const EVALUABLE = new Set(['received', 'text_ready', 'extracted', 'pending_review']);
const APPROVABLE = new Set(['pending_review', 'non_compliant']);
const REJECTABLE = new Set(['pending_review', 'compliant']);
const ARCHIVABLE = new Set(['compliant', 'non_compliant']);
const MIN_TEXT_CHARS = 80;

/** Chiavi PATCH / form = stesse di aiExpectedSchema(material_certificate) + anagrafica griglia. */
const MATERIAL_CERTIFICATE_MANUAL_EDITABLE_FIELDS = [
  'ddt_no',
  'ddt_date',
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

function parseRole(raw, fallback = 'base') {
  const v = emptyToNull(raw);
  if (!v) return fallback;
  return ROLES.has(v) ? v : null;
}

function mapTextReason(extractorReason, text) {
  const t = String(text || '').trim();
  if (t.length >= MIN_TEXT_CHARS && !extractorReason) return 'text_layer';
  if (t.length > 0 && t.length < MIN_TEXT_CHARS && !extractorReason) return 'ocr_poor';
  switch (extractorReason) {
    case 'pdf_no_text_layer':
      return 'ocr_skipped';
    case 'file_not_found':
    case 'pdf_parse_error':
    case 'no_storage_path':
      return extractorReason === 'file_not_found' || extractorReason === 'pdf_parse_error'
        ? 'ocr_failed'
        : 'ocr_failed';
    case 'unsupported':
      return 'ocr_skipped';
    default:
      if (t.length >= MIN_TEXT_CHARS) return 'text_layer';
      if (t.length > 0) return 'ocr_poor';
      return 'ocr_skipped';
  }
}

function designationFromJson(json, role) {
  if (!json || typeof json !== 'object') return null;
  if (role === 'filler') {
    return emptyToNull(json.filler_designation || json.designation);
  }
  return emptyToNull(json.steel_designation || json.designation);
}

function applyAnagraficaFromJson(json, roleHint) {
  const role = parseRole(json?.material_role, roleHint || 'base') || roleHint || 'base';
  return {
    material_role: role,
    certificate_no: emptyToNull(json?.certificate_no),
    designation: designationFromJson(json, role),
    heat_or_lot_no: emptyToNull(json?.heat_or_lot_no),
    product_form: emptyToNull(json?.product_form),
    dimensions: emptyToNull(json?.dimensions),
    material_standard: emptyToNull(json?.material_standard || json?.filler_standard),
    manufacturer_works: emptyToNull(json?.manufacturer_works),
    inspection_document_type: DOC_TYPES.has(json?.inspection_document_type)
      ? json.inspection_document_type
      : null,
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

async function persistChecks(organizationId, certificateId, checks) {
  await query(
    `DELETE FROM dbo.material_certificate_checks
     WHERE certificate_id = @certificate_id AND organization_id = @organization_id`,
    { certificate_id: certificateId, organization_id: organizationId }
  );
  for (const check of checks || []) {
    await query(
      `INSERT INTO dbo.material_certificate_checks
        (organization_id, certificate_id, requirement_key, source_level, source_ref,
         required_value, actual_value, result, explanation)
       VALUES
        (@organization_id, @certificate_id, @requirement_key, @source_level, @source_ref,
         @required_value, @actual_value, @result, @explanation)`,
      {
        organization_id: organizationId,
        certificate_id: certificateId,
        requirement_key: clip(check.requirement_key, 80),
        source_level: clip(check.source_level, 32),
        source_ref: clip(check.source_ref, 300),
        required_value: clip(check.required_value, 200),
        actual_value: clip(check.actual_value, 200),
        result: check.result,
        explanation: clip(check.explanation, 500),
      }
    );
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
      const accessList = req.user.company_access;
      if (Array.isArray(accessList) && accessList.length) {
        const ok = accessList.some((a) => a.company_id === companyId);
        if (!ok) {
          return res.status(403).json({ error: 'Azienda non accessibile', code: 'FORBIDDEN' });
        }
      }
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
    if (await denyIfCannotWrite(req, res, companyId)) return;
    if (!req.file) {
      return res.status(400).json({ error: 'File PDF mancante', code: 'FILE_REQUIRED' });
    }
    const role = parseRole(req.body?.material_role, 'base');
    if (!role) {
      return res.status(400).json({ error: 'material_role deve essere base o filler', code: 'INVALID_ROLE' });
    }

    const job = await query(
      `INSERT INTO import_jobs (organization_id, company_id, created_by, title, status, document_type_hint)
       OUTPUT INSERTED.id
       VALUES (@organization_id, @company_id, @created_by, @title, 'draft', 'material_certificate')`,
      {
        organization_id: orgId,
        company_id: companyId,
        created_by: req.user.user_id || null,
        title: clip(req.file.originalname || 'Certificato materiale', 255),
      }
    );
    const importJobId = job.recordset[0].id;
    const fileIns = await query(
      `INSERT INTO import_job_files (job_id, original_name, storage_path, mime_type, file_size, status)
       OUTPUT INSERTED.id
       VALUES (@job_id, @original_name, @storage_path, @mime_type, @file_size, 'uploaded')`,
      {
        job_id: importJobId,
        original_name: clip(req.file.originalname, 255),
        storage_path: req.file.path,
        mime_type: req.file.mimetype || 'application/pdf',
        file_size: req.file.size || 0,
      }
    );
    const importJobFileId = fileIns.recordset[0].id;

    const inserted = await query(
      `INSERT INTO dbo.material_certificates
        (organization_id, company_id, import_job_id, import_job_file_id, storage_path,
         ddt_no, ddt_date, material_role, workflow_status, created_by)
       OUTPUT INSERTED.id, INSERTED.workflow_status, INSERTED.material_role, INSERTED.company_id
       VALUES
        (@organization_id, @company_id, @import_job_id, @import_job_file_id, @storage_path,
         @ddt_no, @ddt_date, @material_role, 'received', @created_by)`,
      {
        organization_id: orgId,
        company_id: companyId,
        import_job_id: importJobId,
        import_job_file_id: importJobFileId,
        storage_path: req.file.path,
        ddt_no: clip(emptyToNull(req.body?.ddt_no), 80),
        ddt_date: emptyToNull(req.body?.ddt_date),
        material_role: role,
        created_by: req.user.user_id || null,
      }
    );
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
    const fromJson = applyAnagraficaFromJson(corrected, cols.material_role || row.material_role);
    const next = {
      ddt_no: cols.ddt_no !== undefined ? clip(emptyToNull(cols.ddt_no), 80) : row.ddt_no,
      ddt_date: cols.ddt_date !== undefined ? emptyToNull(cols.ddt_date) : row.ddt_date,
      certificate_no: cols.certificate_no !== undefined
        ? clip(emptyToNull(cols.certificate_no), 120) : (fromJson.certificate_no || row.certificate_no),
      material_role: cols.material_role || fromJson.material_role || row.material_role,
      designation: cols.designation !== undefined
        ? clip(emptyToNull(cols.designation), 200) : (fromJson.designation || row.designation),
      heat_or_lot_no: cols.heat_or_lot_no !== undefined
        ? clip(emptyToNull(cols.heat_or_lot_no), 80) : (fromJson.heat_or_lot_no || row.heat_or_lot_no),
      product_form: cols.product_form !== undefined
        ? clip(emptyToNull(cols.product_form), 40) : (fromJson.product_form || row.product_form),
      dimensions: cols.dimensions !== undefined
        ? clip(emptyToNull(cols.dimensions), 120) : (fromJson.dimensions || row.dimensions),
      material_standard: cols.material_standard !== undefined
        ? clip(emptyToNull(cols.material_standard), 80) : (fromJson.material_standard || row.material_standard),
      manufacturer_works: cols.manufacturer_works !== undefined
        ? clip(emptyToNull(cols.manufacturer_works), 200)
        : (fromJson.manufacturer_works || row.manufacturer_works),
      inspection_document_type: cols.inspection_document_type !== undefined
        ? emptyToNull(cols.inspection_document_type)
        : (fromJson.inspection_document_type || row.inspection_document_type),
    };

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
       WHERE id = @id AND organization_id = @organization_id`,
      {
        id,
        organization_id: req.user.organization_id,
        ...next,
        corrected_json: JSON.stringify(corrected),
      }
    );
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

    const extracted = await extractDocumentText(row.storage_path, 'application/pdf', row.storage_path);
    const text = extracted.text || '';
    const reason = mapTextReason(extracted.reason, text);

    if (!text || text.trim().length < MIN_TEXT_CHARS) {
      await query(
        `UPDATE dbo.material_certificates
         SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
             workflow_status = 'text_ready', updated_at = SYSUTCDATETIME()
         WHERE id = @id AND organization_id = @organization_id`,
        {
          id,
          organization_id: req.user.organization_id,
          extracted_text: text || null,
          text_extract_reason: reason,
        }
      );
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
      await query(
        `UPDATE dbo.material_certificates
         SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
             workflow_status = 'text_ready', updated_at = SYSUTCDATETIME()
         WHERE id = @id AND organization_id = @organization_id`,
        {
          id,
          organization_id: req.user.organization_id,
          extracted_text: text,
          text_extract_reason: reason,
        }
      );
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

    const extractedJson = jsonPayloadFromAi(aiResult);
    if (extractedJson.material_role && !ROLES.has(extractedJson.material_role)) {
      extractedJson.material_role = 'base';
    }
    if (!extractedJson.material_role) extractedJson.material_role = row.material_role || 'base';
    const ana = applyAnagraficaFromJson(extractedJson, row.material_role);
    const model = clip(aiResult.model, 80);

    await query(
      `UPDATE dbo.material_certificates
       SET extracted_text = @extracted_text, text_extract_reason = @text_extract_reason,
           extracted_json = @extracted_json, ai_model = @ai_model,
           certificate_no = COALESCE(@certificate_no, certificate_no),
           designation = COALESCE(@designation, designation),
           heat_or_lot_no = COALESCE(@heat_or_lot_no, heat_or_lot_no),
           product_form = COALESCE(@product_form, product_form),
           dimensions = COALESCE(@dimensions, dimensions),
           material_standard = COALESCE(@material_standard, material_standard),
           manufacturer_works = COALESCE(@manufacturer_works, manufacturer_works),
           inspection_document_type = COALESCE(@inspection_document_type, inspection_document_type),
           material_role = @material_role,
           workflow_status = 'extracted', updated_at = SYSUTCDATETIME()
       WHERE id = @id AND organization_id = @organization_id`,
      {
        id,
        organization_id: req.user.organization_id,
        extracted_text: text,
        text_extract_reason: reason,
        extracted_json: JSON.stringify(extractedJson),
        ai_model: model,
        certificate_no: clip(ana.certificate_no, 120),
        designation: clip(ana.designation, 200),
        heat_or_lot_no: clip(ana.heat_or_lot_no, 80),
        product_form: clip(ana.product_form, 40),
        dimensions: clip(ana.dimensions, 120),
        material_standard: clip(ana.material_standard, 80),
        manufacturer_works: clip(ana.manufacturer_works, 200),
        inspection_document_type: ana.inspection_document_type,
        material_role: ana.material_role,
      }
    );

    res.json({
      success: true,
      data: {
        id,
        workflow_status: 'extracted',
        text_extract_reason: reason,
        extracted_json: extractedJson,
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

    const scope = req.body?.scope && typeof req.body.scope === 'object' ? req.body.scope : {};
    const result = evaluateMaterialCertificate({
      extractedJson,
      correctedJson,
      scope,
    });

    await persistChecks(req.user.organization_id, id, result.checks);
    await query(
      `UPDATE dbo.material_certificates
       SET evaluate_result_json = @evaluate_result_json,
           kb_snapshot_hash = @kb_snapshot_hash,
           kb_snapshot_json = @kb_snapshot_json,
           workflow_status = 'pending_review',
           updated_at = SYSUTCDATETIME()
       WHERE id = @id AND organization_id = @organization_id`,
      {
        id,
        organization_id: req.user.organization_id,
        evaluate_result_json: JSON.stringify(result),
        kb_snapshot_hash: result.kb_snapshot_hash || null,
        kb_snapshot_json: JSON.stringify({
          hash: result.kb_snapshot_hash,
          evaluated_at: new Date().toISOString(),
        }),
      }
    );

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
    logger.error('evaluateCertificate', err);
    res.status(500).json({ error: 'Errore durante la valutazione del certificato' });
  }
}

async function transitionHitl(req, res, { nextStatus, allowed, notesRequired }) {
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
     WHERE id = @id AND organization_id = @organization_id`,
    {
      id,
      organization_id: req.user.organization_id,
      workflow_status: nextStatus,
      review_notes: notes,
      reviewed_by: req.user.user_id || null,
      stamp: stampReview ? 1 : 0,
    }
  );
  return res.json({ success: true, data: updated.recordset[0] });
}

async function approveCertificate(req, res) {
  try {
    await transitionHitl(req, res, {
      nextStatus: 'compliant',
      allowed: APPROVABLE,
      notesRequired: false,
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
  listCertificates,
  getStats,
  getCertificate,
  createCertificate,
  patchCertificate,
  extractCertificate,
  evaluateCertificate,
  approveCertificate,
  rejectCertificate,
  archiveCertificate,
  mapTextReason,
};
