/**
 * Report Template Controller
 * API per catalogo template e assegnazioni (Phase 2 roadmap)
 */

const { query } = require('../config/database');
const { getReportTemplate } = require('../services/reportTemplate.service');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs').promises;

/**
 * GET /api/v1/report-templates?scope=audit
 * Lista template disponibili per l'org (sistema + org)
 */
async function listTemplates(req, res) {
  try {
    const { scope = 'audit' } = req.query;
    const organizationId = req.user.organization_id;

    const result = await query(
      `SELECT id, organization_id, name, scope, standard_key, file_path, is_system, created_at
       FROM report_templates
       WHERE scope = @scope AND (organization_id IS NULL OR organization_id = @organization_id)
       ORDER BY CASE WHEN organization_id IS NULL THEN 0 ELSE 1 END, standard_key`,
      { scope, organization_id: organizationId }
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
    const scope = req.body.scope || 'audit';
    const standardKey = req.body.standard_key || null;

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
       WHERE organization_id = @organization_id AND standard_id = @standard_id AND custom_checklist_id IS NULL`,
      params
    );
    await query(
      `INSERT INTO report_template_assignments (organization_id, standard_id, custom_checklist_id, report_template_id)
       VALUES (@organization_id, @standard_id, NULL, @report_template_id)`,
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
 * Risolve quale template usare per standard_id O custom_checklist_id + organization_id
 * Usato dal frontend prima di generare report
 */
async function resolveTemplate(req, res) {
  try {
    const { standardId, customChecklistId } = req.query;
    const organizationId = req.user.organization_id;

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
       WHERE organization_id = @organization_id AND custom_checklist_id = @custom_checklist_id`,
      { organization_id: organizationId, custom_checklist_id: ccId }
    );
    // Inserisci nuova assegnazione
    await query(
      `INSERT INTO report_template_assignments (organization_id, standard_id, custom_checklist_id, report_template_id)
       VALUES (@organization_id, NULL, @custom_checklist_id, @report_template_id)`,
      { organization_id: organizationId, custom_checklist_id: ccId, report_template_id: templateId }
    );

    logger.info('Template assigned to custom checklist', { org: organizationId, customChecklistId: ccId, templateId });

    res.json({ success: true, message: 'Assegnazione salvata' });
  } catch (err) {
    logger.error('assignTemplateToCustomChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore assegnazione template', code: 'ASSIGN_TEMPLATE_ERROR' });
  }
}

module.exports = {
  listTemplates,
  uploadTemplate,
  assignTemplateToStandard,
  assignTemplateToCustomChecklist,
  resolveTemplate,
};
