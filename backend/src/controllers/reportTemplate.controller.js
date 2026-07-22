/**
 * Report Template Controller
 * API per catalogo template e assegnazioni (Phase 2 roadmap)
 */

const { query } = require('../config/database');
const { getReportTemplate, getNcReportTemplate } = require('../services/reportTemplate.service');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const crypto = require('crypto');

const ALLOWED_SCOPES = new Set(['audit', 'self_assessment', 'nc']);

function normalizeScope(scope) {
  const s = String(scope || 'audit').trim().toLowerCase();
  return ALLOWED_SCOPES.has(s) ? s : 'audit';
}

/** Risolve path assoluto del file sorgente (sistema /uploads o /templates) */
async function resolveTemplateSourcePath(filePath) {
  if (!filePath) return null;
  if (filePath.startsWith('/uploads/')) {
    const rel = filePath.replace(/^\/uploads\//, '');
    const full = path.join(path.resolve(UPLOAD_DIR), rel);
    try {
      await fs.access(full);
      return full;
    } catch {
      return null;
    }
  }
  if (filePath.startsWith('/templates/')) {
    const basename = path.basename(filePath);
    const candidates = [
      process.env.REPORT_TEMPLATES_STATIC_DIR,
      path.join(__dirname, '../../../app/public/templates'),
      path.join(process.cwd(), 'app/public/templates'),
      path.join(process.cwd(), '../app/public/templates'),
    ].filter(Boolean);
    for (const dir of candidates) {
      const full = path.join(dir, basename);
      if (fsSync.existsSync(full)) return full;
    }
  }
  return null;
}

/**
 * GET /api/v1/report-templates?scope=audit
 * Lista template disponibili per l'org (sistema + org)
 */
async function listTemplates(req, res) {
  try {
    const { scope = 'audit' } = req.query;
    const normalizedScope = normalizeScope(scope);
    const organizationId = req.user.organization_id;

    const result = await query(
      `SELECT id, organization_id, name, scope, standard_key, file_path, is_system, created_at
       FROM report_templates
       WHERE scope = @scope AND (organization_id IS NULL OR organization_id = @organization_id)
       ORDER BY CASE WHEN organization_id IS NULL THEN 0 ELSE 1 END, standard_key`,
      { scope: normalizedScope, organization_id: organizationId }
    );

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('listTemplates error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero template', code: 'REPORT_TEMPLATES_LIST_ERROR' });
  }
}

/**
 * POST /api/v1/report-templates
 * Upload template .docx per l'organizzazione
 * Solo admin/auditor
 */
async function uploadTemplate(req, res) {
  try {
    const { organization_id, role } = req.user;
    if (!['admin', 'auditor'].includes(role)) {
      return res.status(403).json({ error: 'Solo admin/auditor possono caricare template', code: 'FORBIDDEN' });
    }

    if (!req.file || !req.file.path) {
      return res.status(400).json({ error: 'File .docx richiesto', code: 'MISSING_FILE' });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== '.docx') {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Solo file .docx consentiti', code: 'INVALID_FILE_TYPE' });
    }

    const name = req.body.name || path.basename(req.file.originalname, '.docx');
    const scope = normalizeScope(req.body.scope);
    const standardKey = req.body.standard_key || (scope === 'nc' ? 'default' : null);

    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    let relPath = path.relative(path.resolve(uploadDir), req.file.path).replace(/\\/g, '/');
    relPath = '/uploads/' + relPath;

    const ins = await query(
      `INSERT INTO report_templates (organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at)
       OUTPUT INSERTED.id, INSERTED.file_path, INSERTED.name
       VALUES (@organization_id, @name, @scope, @standard_key, @file_path, 0, GETDATE(), GETDATE())`,
      {
        organization_id,
        name,
        scope,
        standard_key: standardKey,
        file_path: relPath,
      }
    );

    const row = ins.recordset[0];
    logger.info('Report template uploaded', { id: row.id, org: organization_id });

    res.status(201).json({
      success: true,
      data: { id: row.id, file_path: row.file_path, name: row.name },
    });
  } catch (err) {
    logger.error('uploadTemplate error', { error: err.message });
    res.status(500).json({ error: 'Errore upload template', code: 'REPORT_TEMPLATE_UPLOAD_ERROR' });
  }
}

/**
 * PUT /api/v1/report-template-assignments/standard/:standardId
 * Assegna template a standard per l'org
 * Body: { report_template_id }
 */
async function assignTemplateToStandard(req, res) {
  try {
    const { standardId } = req.params;
    const { report_template_id } = req.body;
    const organizationId = req.user.organization_id;

    if (!report_template_id) {
      return res.status(400).json({ error: 'report_template_id richiesto', code: 'MISSING_TEMPLATE_ID' });
    }

    const stdId = parseInt(standardId, 10);
    const templateId = parseInt(report_template_id, 10);
    if (isNaN(stdId) || isNaN(templateId)) {
      return res.status(400).json({ error: 'standardId e report_template_id devono essere numeri', code: 'INVALID_ID' });
    }

    const tplCheck = await query(
      `SELECT 1 FROM report_templates
       WHERE id = @report_template_id
         AND (organization_id IS NULL OR organization_id = @organization_id)`,
      { report_template_id: templateId, organization_id: organizationId }
    );
    if (tplCheck.recordset.length === 0) {
      return res.status(403).json({
        error: 'Template non disponibile per questa organizzazione',
        code: 'TEMPLATE_FORBIDDEN',
      });
    }

    const params = { organization_id: organizationId, standard_id: stdId, report_template_id: templateId };
    await query(
      `DELETE FROM report_template_assignments
       WHERE organization_id = @organization_id AND standard_id = @standard_id
         AND custom_checklist_id IS NULL AND assignment_type = 'standard'`,
      params
    );
    await query(
      `INSERT INTO report_template_assignments
         (organization_id, standard_id, custom_checklist_id, report_template_id, assignment_type)
       VALUES (@organization_id, @standard_id, NULL, @report_template_id, 'standard')`,
      params
    );

    logger.info('Template assigned to standard', { org: organizationId, standardId: stdId, templateId });

    res.json({ success: true, message: 'Assegnazione salvata' });
  } catch (err) {
    logger.error('assignTemplateToStandard error', { error: err.message });
    res.status(500).json({ error: 'Errore assegnazione template', code: 'ASSIGN_TEMPLATE_ERROR' });
  }
}

/**
 * GET /api/v1/report-templates/resolve?standardId=1
 * GET /api/v1/report-templates/resolve?customChecklistId=5
 * GET /api/v1/report-templates/resolve?scope=nc
 * Risolve quale template usare per standard_id, custom_checklist_id o export NC
 */
async function resolveTemplate(req, res) {
  try {
    const { standardId, customChecklistId, scope } = req.query;
    const organizationId = req.user.organization_id;

    if (normalizeScope(scope) === 'nc') {
      const template = await getNcReportTemplate(organizationId);
      return res.json({ success: true, data: template });
    }

    const stdId = standardId ? parseInt(standardId, 10) : null;
    const customId = customChecklistId ? parseInt(customChecklistId, 10) : null;
    const template = await getReportTemplate(organizationId, stdId, customId);

    res.json({ success: true, data: template });
  } catch (err) {
    logger.error('resolveTemplate error', { error: err.message });
    res.status(500).json({ error: 'Errore risoluzione template', code: 'RESOLVE_TEMPLATE_ERROR' });
  }
}

/**
 * PUT /api/v1/report-template-assignments/custom-checklist/:customChecklistId
 * Assegna template a checklist custom per l'org
 * Body: { report_template_id }
 */
async function assignTemplateToCustomChecklist(req, res) {
  try {
    const { customChecklistId } = req.params;
    const { report_template_id } = req.body;
    const organizationId = req.user.organization_id;

    if (!report_template_id) {
      return res.status(400).json({ error: 'report_template_id richiesto', code: 'MISSING_TEMPLATE_ID' });
    }

    const ccId = parseInt(customChecklistId, 10);
    const templateId = parseInt(report_template_id, 10);
    if (isNaN(ccId) || isNaN(templateId)) {
      return res.status(400).json({ error: 'customChecklistId e report_template_id devono essere numeri', code: 'INVALID_ID' });
    }

    // Verifica che la checklist appartenga all'org
    const ccCheck = await query(
      'SELECT 1 FROM custom_checklists WHERE id = @id AND organization_id = @organization_id',
      { id: ccId, organization_id: organizationId }
    );
    if (ccCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CHECKLIST_NOT_FOUND' });
    }

    const tplCheck = await query(
      `SELECT 1 FROM report_templates
       WHERE id = @report_template_id
         AND (organization_id IS NULL OR organization_id = @organization_id)`,
      { report_template_id: templateId, organization_id: organizationId }
    );
    if (tplCheck.recordset.length === 0) {
      return res.status(403).json({
        error: 'Template non disponibile per questa organizzazione',
        code: 'TEMPLATE_FORBIDDEN',
      });
    }

    // Rimuovi assegnazioni esistenti per questa checklist
    await query(
      `DELETE FROM report_template_assignments
       WHERE organization_id = @organization_id AND custom_checklist_id = @custom_checklist_id
         AND assignment_type = 'custom_checklist'`,
      { organization_id: organizationId, custom_checklist_id: ccId }
    );
    await query(
      `INSERT INTO report_template_assignments
         (organization_id, standard_id, custom_checklist_id, report_template_id, assignment_type)
       VALUES (@organization_id, NULL, @custom_checklist_id, @report_template_id, 'custom_checklist')`,
      { organization_id: organizationId, custom_checklist_id: ccId, report_template_id: templateId }
    );

    logger.info('Template assigned to custom checklist', { org: organizationId, customChecklistId: ccId, templateId });

    res.json({ success: true, message: 'Assegnazione salvata' });
  } catch (err) {
    logger.error('assignTemplateToCustomChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore assegnazione template', code: 'ASSIGN_TEMPLATE_ERROR' });
  }
}

/**
 * GET /api/v1/report-template-assignments/standards
 * Assegnazioni template per standard (org corrente)
 */
async function listStandardAssignments(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const result = await query(
      `SELECT standard_id, report_template_id
       FROM report_template_assignments
       WHERE organization_id = @organization_id
         AND standard_id IS NOT NULL
         AND custom_checklist_id IS NULL`,
      { organization_id: organizationId }
    );
    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('listStandardAssignments error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero assegnazioni', code: 'ASSIGNMENTS_LIST_ERROR' });
  }
}

/**
 * POST /api/v1/report-templates/:id/duplicate
 * Duplica template di sistema nello studio (body: { name })
 */
async function duplicateTemplate(req, res) {
  try {
    const { role, organization_id: organizationId } = req.user;
    if (!['admin', 'auditor'].includes(role)) {
      return res.status(403).json({ error: 'Solo admin/auditor possono duplicare template', code: 'FORBIDDEN' });
    }

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'ID template non valido', code: 'INVALID_ID' });
    }

    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!name) {
      return res.status(400).json({ error: 'Nome richiesto per il duplicato', code: 'MISSING_NAME' });
    }
    if (name.length > 255) {
      return res.status(400).json({ error: 'Il nome non può superare 255 caratteri', code: 'NAME_TOO_LONG' });
    }

    const srcResult = await query(
      `SELECT id, organization_id, name, scope, standard_key, file_path, is_system
       FROM report_templates WHERE id = @id`,
      { id: templateId }
    );
    if (srcResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Template non trovato', code: 'NOT_FOUND' });
    }

    const src = srcResult.recordset[0];
    if (src.organization_id != null) {
      return res.status(403).json({
        error: 'Duplicazione consentita solo da template di sistema',
        code: 'NOT_SYSTEM_TEMPLATE',
      });
    }

    const sourcePath = await resolveTemplateSourcePath(src.file_path);
    if (!sourcePath) {
      return res.status(500).json({ error: 'File sorgente non trovato sul server', code: 'SOURCE_NOT_FOUND' });
    }

    const destDir = path.join(path.resolve(UPLOAD_DIR), 'templates', String(organizationId));
    await fs.mkdir(destDir, { recursive: true });
    const safeBase = name.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 40) || 'template';
    const destFilename = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}_${safeBase}.docx`;
    const destFull = path.join(destDir, destFilename);
    await fs.copyFile(sourcePath, destFull);

    const relPath =
      '/uploads/' + path.relative(path.resolve(UPLOAD_DIR), destFull).replace(/\\/g, '/');

    const ins = await query(
      `INSERT INTO report_templates (organization_id, name, scope, standard_key, file_path, is_system, created_at, updated_at)
       OUTPUT INSERTED.id, INSERTED.file_path, INSERTED.name, INSERTED.organization_id, INSERTED.is_system, INSERTED.standard_key
       VALUES (@organization_id, @name, @scope, @standard_key, @file_path, 0, GETDATE(), GETDATE())`,
      {
        organization_id: organizationId,
        name,
        scope: src.scope || 'audit',
        standard_key: src.standard_key || null,
        file_path: relPath,
      }
    );

    const row = ins.recordset[0];
    logger.info('Report template duplicated', { sourceId: templateId, newId: row.id, org: organizationId });

    res.status(201).json({ success: true, data: row });
  } catch (err) {
    logger.error('duplicateTemplate error', { error: err.message });
    res.status(500).json({ error: 'Errore duplicazione template', code: 'DUPLICATE_TEMPLATE_ERROR' });
  }
}

/**
 * DELETE /api/v1/report-templates/:id
 * Elimina template dello studio (non di sistema)
 */
async function deleteTemplate(req, res) {
  try {
    const { role, organization_id: organizationId } = req.user;
    if (!['admin', 'auditor'].includes(role)) {
      return res.status(403).json({ error: 'Solo admin/auditor possono eliminare template', code: 'FORBIDDEN' });
    }

    const templateId = parseInt(req.params.id, 10);
    if (isNaN(templateId)) {
      return res.status(400).json({ error: 'ID template non valido', code: 'INVALID_ID' });
    }

    const tplResult = await query(
      `SELECT id, organization_id, file_path, is_system FROM report_templates WHERE id = @id`,
      { id: templateId }
    );
    if (tplResult.recordset.length === 0) {
      return res.status(404).json({ error: 'Template non trovato', code: 'NOT_FOUND' });
    }

    const row = tplResult.recordset[0];
    if (row.is_system || row.organization_id == null) {
      return res.status(403).json({
        error: 'Non è possibile eliminare template di sistema',
        code: 'SYSTEM_TEMPLATE',
      });
    }
    if (row.organization_id !== organizationId) {
      return res.status(403).json({
        error: 'Template non appartenente a questa organizzazione',
        code: 'FORBIDDEN',
      });
    }

    await query(`DELETE FROM report_template_assignments WHERE report_template_id = @id`, { id: templateId });

    if (row.file_path && row.file_path.startsWith('/uploads/')) {
      const rel = row.file_path.replace(/^\/uploads\//, '');
      const full = path.join(path.resolve(UPLOAD_DIR), rel);
      await fs.unlink(full).catch(() => {});
    }

    await query(`DELETE FROM report_templates WHERE id = @id`, { id: templateId });

    logger.info('Report template deleted', { id: templateId, org: organizationId });
    res.json({ success: true, message: 'Template eliminato' });
  } catch (err) {
    logger.error('deleteTemplate error', { error: err.message });
    res.status(500).json({ error: 'Errore eliminazione template', code: 'DELETE_TEMPLATE_ERROR' });
  }
}

/**
 * GET /api/v1/report-template-assignments/nc
 * Assegnazione template export NC per l'org corrente
 */
async function listNcAssignment(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const result = await query(
      `SELECT report_template_id
       FROM report_template_assignments
       WHERE organization_id = @organization_id AND assignment_type = 'nc'`,
      { organization_id: organizationId }
    );
    const reportTemplateId = result.recordset[0]?.report_template_id ?? null;
    res.json({ success: true, data: { report_template_id: reportTemplateId } });
  } catch (err) {
    logger.error('listNcAssignment error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero assegnazione NC', code: 'ASSIGNMENTS_LIST_ERROR' });
  }
}

/**
 * PUT /api/v1/report-template-assignments/nc
 * Body: { report_template_id } — null/assente rimuove assegnazione (fallback sistema)
 */
async function assignTemplateToNc(req, res) {
  try {
    const { report_template_id: reportTemplateIdRaw } = req.body;
    const organizationId = req.user.organization_id;

    await query(
      `DELETE FROM report_template_assignments
       WHERE organization_id = @organization_id AND assignment_type = 'nc'`,
      { organization_id: organizationId }
    );

    if (reportTemplateIdRaw == null || reportTemplateIdRaw === '') {
      return res.json({ success: true, message: 'Assegnazione NC rimossa (modello di sistema)' });
    }

    const templateId = parseInt(reportTemplateIdRaw, 10);
    if (Number.isNaN(templateId)) {
      return res.status(400).json({ error: 'report_template_id non valido', code: 'INVALID_ID' });
    }

    const tplCheck = await query(
      `SELECT 1 FROM report_templates
       WHERE id = @report_template_id
         AND scope = 'nc'
         AND (organization_id IS NULL OR organization_id = @organization_id)`,
      { report_template_id: templateId, organization_id: organizationId }
    );
    if (tplCheck.recordset.length === 0) {
      return res.status(403).json({
        error: 'Template NC non disponibile per questa organizzazione',
        code: 'TEMPLATE_FORBIDDEN',
      });
    }

    await query(
      `INSERT INTO report_template_assignments
         (organization_id, standard_id, custom_checklist_id, report_template_id, assignment_type)
       VALUES (@organization_id, NULL, NULL, @report_template_id, 'nc')`,
      { organization_id: organizationId, report_template_id: templateId }
    );

    logger.info('Template assigned to NC export', { org: organizationId, templateId });
    res.json({ success: true, message: 'Assegnazione NC salvata' });
  } catch (err) {
    logger.error('assignTemplateToNc error', { error: err.message });
    res.status(500).json({ error: 'Errore assegnazione template NC', code: 'ASSIGN_TEMPLATE_ERROR' });
  }
}

module.exports = {
  listTemplates,
  uploadTemplate,
  assignTemplateToStandard,
  assignTemplateToCustomChecklist,
  assignTemplateToNc,
  resolveTemplate,
  listStandardAssignments,
  listNcAssignment,
  duplicateTemplate,
  deleteTemplate,
};
