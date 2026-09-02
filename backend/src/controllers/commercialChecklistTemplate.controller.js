/**
 * commercialChecklistTemplate.controller.js — API template checklist Riesame requisiti (ING-4)
 */

const logger = require('../utils/logger');
const service = require('../services/commercialChecklistTemplate.service');

function sendErr(res, status, message, code) {
  return res.status(status).json({ error: message, code });
}

function parseId(raw) {
  const id = parseInt(String(raw), 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function listTemplates(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const companyId = req.query.company_id;
    const activeOnly = String(req.query.active_only || '') === '1' || req.query.active_only === 'true';
    const rows = await service.listTemplates(organizationId, { companyId, activeOnly });
    return res.json({ success: true, data: rows });
  } catch (err) {
    logger.error('listCommercialChecklistTemplates', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

async function getTemplate(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const templateId = parseId(req.params.id);
    if (!templateId) return sendErr(res, 400, 'ID template non valido', 'VALIDATION_ERROR');
    const template = await service.getTemplateWithItems(templateId, organizationId);
    if (!template) return sendErr(res, 404, 'Template non trovato', 'NOT_FOUND');
    return res.json({ success: true, data: template });
  } catch (err) {
    logger.error('getCommercialChecklistTemplate', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

async function createTemplate(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const userId = req.user.user_id;
    const result = await service.createTemplate(organizationId, userId, req.body || {});
    if (!result.ok) return sendErr(res, result.status, result.error, result.code);
    return res.status(201).json({ success: true, data: result.template });
  } catch (err) {
    logger.error('createCommercialChecklistTemplate', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

async function updateTemplate(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const templateId = parseId(req.params.id);
    if (!templateId) return sendErr(res, 400, 'ID template non valido', 'VALIDATION_ERROR');
    const result = await service.updateTemplate(templateId, organizationId, req.body || {});
    if (!result.ok) return sendErr(res, result.status, result.error, result.code);
    return res.json({ success: true, data: result.template });
  } catch (err) {
    logger.error('updateCommercialChecklistTemplate', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

async function deleteTemplate(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const templateId = parseId(req.params.id);
    if (!templateId) return sendErr(res, 400, 'ID template non valido', 'VALIDATION_ERROR');
    const result = await service.deleteTemplate(templateId, organizationId);
    if (!result.ok) return sendErr(res, result.status, result.error, result.code);
    return res.json({ success: true });
  } catch (err) {
    logger.error('deleteCommercialChecklistTemplate', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

async function resolvePreview(req, res) {
  try {
    const organizationId = req.user.organization_id;
    const phase = req.query.phase || req.body?.phase;
    const companyIdRaw = req.query.company_id ?? req.body?.company_id;
    const companyId =
      companyIdRaw != null && companyIdRaw !== ''
        ? parseInt(String(companyIdRaw), 10)
        : null;
    const result = await service.resolveItemsForCase({
      organizationId,
      companyId: Number.isFinite(companyId) ? companyId : null,
      phase,
    });
    if (!result.ok) return sendErr(res, 400, result.error, 'VALIDATION_ERROR');
    return res.json({ success: true, data: result });
  } catch (err) {
    logger.error('resolveCommercialChecklistTemplate', err.message);
    return sendErr(res, 500, err.message, 'SERVER_ERROR');
  }
}

module.exports = {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resolvePreview,
};
