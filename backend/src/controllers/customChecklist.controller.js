/**
 * Custom Checklist Controller
 * Phase 5 - API CRUD checklist personalizzate, sezioni, voci, risposte
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const customChecklistService = require('../services/customChecklist.service');
// assertWriteAllowed rimosso in T5 (lock solo UX)

/**
 * GET /api/v1/custom-checklists
 * Lista checklist custom dell'organizzazione
 */
async function listChecklists(req, res) {
  try {
    const data = await customChecklistService.listChecklists(req.user);
    res.json({ success: true, data });
  } catch (err) {
    logger.error('listChecklists error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero checklist', code: 'CUSTOM_CHECKLIST_LIST_ERROR' });
  }
}

/**
 * POST /api/v1/custom-checklists
 * Crea checklist custom
 * Body: { name, description?, is_active?, has_outcome_buttons?, default_report_template_id?, custom_report_template_id? }
 */
async function createChecklist(req, res) {
  try {
    const { name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name obbligatorio', code: 'VALIDATION_ERROR' });
    }

    const data = await customChecklistService.createChecklist(req.user, {
      name: name.trim(),
      description: description || null,
      is_active,
      has_outcome_buttons: has_outcome_buttons ? true : false,
      default_report_template_id: default_report_template_id ? parseInt(default_report_template_id, 10) : null,
      custom_report_template_id: custom_report_template_id ? parseInt(custom_report_template_id, 10) : null,
    });

    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('createChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore creazione checklist', code: 'CUSTOM_CHECKLIST_CREATE_ERROR' });
  }
}

/**
 * GET /api/v1/custom-checklists/:id
 * Dettagli checklist (con sezioni e voci)
 */
async function getChecklist(req, res) {
  try {
    const { id } = req.params;

    const data = await customChecklistService.getChecklistWithStructure(parseInt(id, 10), req.user);
    if (!data) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('getChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero checklist', code: 'CUSTOM_CHECKLIST_GET_ERROR' });
  }
}

/**
 * PUT /api/v1/custom-checklists/:id
 * Aggiorna checklist
 */
async function updateChecklist(req, res) {
  try {
    const { id } = req.params;
    const { name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id } = req.body;

    const data = await customChecklistService.updateChecklist(parseInt(id, 10), req.user, {
      name,
      description,
      is_active,
      has_outcome_buttons: has_outcome_buttons !== undefined ? Boolean(has_outcome_buttons) : undefined,
      default_report_template_id: default_report_template_id !== undefined ? parseInt(default_report_template_id, 10) : undefined,
      custom_report_template_id: custom_report_template_id !== undefined ? parseInt(custom_report_template_id, 10) : undefined,
    });

    if (!data) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('updateChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore aggiornamento checklist', code: 'CUSTOM_CHECKLIST_UPDATE_ERROR' });
  }
}

/**
 * DELETE /api/v1/custom-checklists/:id
 * Elimina checklist (CASCADE su sezioni e voci)
 */
async function deleteChecklist(req, res) {
  try {
    const { id } = req.params;

    const deleted = await customChecklistService.deleteChecklist(parseInt(id, 10), req.user);
    if (!deleted) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, message: 'Checklist eliminata' });
  } catch (err) {
    logger.error('deleteChecklist error', { error: err.message });
    res.status(500).json({ error: 'Errore eliminazione checklist', code: 'CUSTOM_CHECKLIST_DELETE_ERROR' });
  }
}

/**
 * GET /api/v1/custom-checklists/:id/sections
 * Lista sezioni
 */
async function listSections(req, res) {
  try {
    const { id } = req.params;

    const data = await customChecklistService.listSections(parseInt(id, 10), req.user);
    if (data === null) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('listSections error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero sezioni', code: 'CUSTOM_CHECKLIST_SECTIONS_ERROR' });
  }
}

/**
 * POST /api/v1/custom-checklists/:id/sections
 * Crea sezione
 * Body: { code, title, display_order? }
 */
async function createSection(req, res) {
  try {
    const { id } = req.params;
    const { code, title, display_order } = req.body;

    if (!code || !title) {
      return res.status(400).json({ error: 'code e title obbligatori', code: 'VALIDATION_ERROR' });
    }

    const data = await customChecklistService.createSection(parseInt(id, 10), req.user, {
      code: String(code).trim(),
      title: String(title).trim(),
      display_order,
    });

    if (!data) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    logger.error('createSection error', { error: err.message });
    res.status(500).json({ error: 'Errore creazione sezione', code: 'CUSTOM_CHECKLIST_SECTION_CREATE_ERROR' });
  }
}

/**
 * PUT /api/v1/custom-checklists/:id/sections/:sectionId
 * Aggiorna sezione (code, title, display_order?)
 */
async function updateSection(req, res) {
  try {
    const { id, sectionId } = req.params;
    const { code, title, display_order } = req.body;

    const data = await customChecklistService.updateSection(
      parseInt(sectionId, 10),
      parseInt(id, 10),
      req.user,
      { code, title, display_order }
    );

    if (!data) {
      return res.status(404).json({ error: 'Sezione non trovata', code: 'SECTION_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (err.message?.includes('vuoti')) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
    }
    logger.error('updateSection error', { error: err.message });
    res.status(500).json({ error: 'Errore aggiornamento sezione', code: 'CUSTOM_CHECKLIST_SECTION_UPDATE_ERROR' });
  }
}

/**
 * PUT /api/v1/custom-checklists/:id/sections/order
 * Aggiorna ordine sezioni
 * Body: { sections: [{ id, display_order }] }
 */
async function updateSectionsOrder(req, res) {
  try {
    const { id } = req.params;
    const { sections } = req.body;

    if (!Array.isArray(sections)) {
      return res.status(400).json({ error: 'sections deve essere un array', code: 'VALIDATION_ERROR' });
    }

    const ok = await customChecklistService.updateSectionsOrder(parseInt(id, 10), req.user, sections);
    if (!ok) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, message: 'Ordine aggiornato' });
  } catch (err) {
    logger.error('updateSectionsOrder error', { error: err.message });
    res.status(500).json({ error: 'Errore aggiornamento ordine', code: 'CUSTOM_CHECKLIST_ORDER_ERROR' });
  }
}

/**
 * DELETE /api/v1/custom-checklists/:id/sections/:sectionId
 * Elimina sezione
 */
async function deleteSection(req, res) {
  try {
    const { id, sectionId } = req.params;

    const deleted = await customChecklistService.deleteSection(
      parseInt(sectionId, 10),
      parseInt(id, 10),
      req.user
    );
    if (!deleted) {
      return res.status(404).json({ error: 'Sezione non trovata', code: 'SECTION_NOT_FOUND' });
    }

    res.json({ success: true, message: 'Sezione eliminata' });
  } catch (err) {
    logger.error('deleteSection error', { error: err.message });
    res.status(500).json({ error: 'Errore eliminazione sezione', code: 'SECTION_DELETE_ERROR' });
  }
}

/**
 * GET /api/v1/custom-checklists/:id/items
 * Lista voci (opzionale ?sectionId=)
 */
async function listItems(req, res) {
  try {
    const { id } = req.params;
    const { sectionId } = req.query;

    const data = await customChecklistService.listItems(
      parseInt(id, 10),
      req.user,
      sectionId ? parseInt(sectionId, 10) : null
    );
    if (data === null) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('listItems error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero voci', code: 'CUSTOM_CHECKLIST_ITEMS_ERROR' });
  }
}

/**
 * POST /api/v1/custom-checklists/:id/items
 * Crea voce
 * Body: { section_id, code, title, response_type?, display_order? }
 */
async function createItem(req, res) {
  try {
    const { id } = req.params;
    const { section_id, code, title, response_type, display_order } = req.body;

    if (!section_id || !code || !title) {
      return res.status(400).json({ error: 'section_id, code e title obbligatori', code: 'VALIDATION_ERROR' });
    }

    const data = await customChecklistService.createItem(parseInt(id, 10), req.user, {
      section_id,
      code: String(code).trim(),
      title: String(title).trim(),
      response_type: response_type || 'verbale',
      display_order,
    });

    if (!data) {
      return res.status(404).json({ error: 'Checklist non trovata', code: 'CUSTOM_CHECKLIST_NOT_FOUND' });
    }

    res.status(201).json({ success: true, data });
  } catch (err) {
    if (err.message?.includes('Sezione non trovata')) {
      return res.status(400).json({ error: err.message, code: 'SECTION_NOT_FOUND' });
    }
    logger.error('createItem error', { error: err.message });
    res.status(500).json({ error: 'Errore creazione voce', code: 'CUSTOM_CHECKLIST_ITEM_CREATE_ERROR' });
  }
}

/**
 * PUT /api/v1/custom-checklists/:id/items/:itemId
 * Aggiorna voce (code, title, display_order?)
 */
async function updateItem(req, res) {
  try {
    const { id, itemId } = req.params;
    const { code, title, display_order } = req.body;

    const data = await customChecklistService.updateItem(
      parseInt(itemId, 10),
      parseInt(id, 10),
      req.user,
      { code, title, display_order }
    );

    if (!data) {
      return res.status(404).json({ error: 'Voce non trovata', code: 'ITEM_NOT_FOUND' });
    }

    res.json({ success: true, data });
  } catch (err) {
    if (err.message?.includes('vuoti')) {
      return res.status(400).json({ error: err.message, code: 'VALIDATION_ERROR' });
    }
    logger.error('updateItem error', { error: err.message });
    res.status(500).json({ error: 'Errore aggiornamento voce', code: 'CUSTOM_CHECKLIST_ITEM_UPDATE_ERROR' });
  }
}

/**
 * DELETE /api/v1/custom-checklists/:id/items/:itemId
 * Elimina voce
 */
async function deleteItem(req, res) {
  try {
    const { id, itemId } = req.params;

    const deleted = await customChecklistService.deleteItem(
      parseInt(itemId, 10),
      parseInt(id, 10),
      req.user
    );
    if (!deleted) {
      return res.status(404).json({ error: 'Voce non trovata', code: 'ITEM_NOT_FOUND' });
    }

    res.json({ success: true, message: 'Voce eliminata' });
  } catch (err) {
    logger.error('deleteItem error', { error: err.message });
    res.status(500).json({ error: 'Errore eliminazione voce', code: 'ITEM_DELETE_ERROR' });
  }
}

/**
 * GET /api/v1/audits/:auditId/custom-checklist-responses
 * Risposte custom per audit (evidence_blocks per ogni custom_item)
 */
async function getCustomChecklistResponses(req, res) {
  try {
    const { auditId } = req.params;
    const organizationId = req.user.organization_id;

    const numericId = parseInt(auditId, 10);
    const isUuid = isNaN(numericId) && typeof auditId === 'string' && auditId.length > 10;

    const auditCheck = await query(
      isUuid
        ? `SELECT audit_id, custom_checklist_id FROM audits WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0`
        : `SELECT audit_id, custom_checklist_id FROM audits WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0`,
      isUuid ? { audit_uuid: auditId, organization_id: organizationId } : { audit_id: numericId, organization_id: organizationId }
    );
    if (auditCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
    }

    const audit = auditCheck.recordset[0];
    const resolvedAuditId = audit.audit_id;
    if (!audit.custom_checklist_id) {
      return res.json({ success: true, data: [], message: 'Audit senza checklist custom' });
    }

    const result = await query(
      `SELECT id, custom_item_id, evidence_blocks, status, updated_at
       FROM audit_custom_checklist_responses
       WHERE audit_id = @audit_id`,
      { audit_id: resolvedAuditId }
    );

    res.json({ success: true, data: result.recordset });
  } catch (err) {
    logger.error('getCustomChecklistResponses error', { error: err.message });
    res.status(500).json({ error: 'Errore recupero risposte', code: 'CUSTOM_RESPONSES_GET_ERROR' });
  }
}

/**
 * PUT /api/v1/audits/:auditId/custom-checklist-responses
 * Salva/aggiorna risposte (evidence_blocks)
 * Body: { responses: [{ custom_item_id, evidence_blocks }] }
 * evidence_blocks: JSON array di { text, attachment_id }
 */
async function saveCustomChecklistResponses(req, res) {
  try {
    const { auditId } = req.params;
    const organizationId = req.user.organization_id;
    const { responses } = req.body;

    const numericId = parseInt(auditId, 10);
    const isUuid = isNaN(numericId) && typeof auditId === 'string' && auditId.length > 10;
    const auditCheck = await query(
      isUuid
        ? `SELECT audit_id, custom_checklist_id FROM audits WHERE audit_uuid = @audit_uuid AND organization_id = @organization_id AND is_deleted = 0`
        : `SELECT audit_id, custom_checklist_id FROM audits WHERE audit_id = @audit_id AND organization_id = @organization_id AND is_deleted = 0`,
      isUuid ? { audit_uuid: auditId, organization_id: organizationId } : { audit_id: numericId, organization_id: organizationId }
    );
    if (auditCheck.recordset.length === 0) {
      return res.status(404).json({ error: 'Audit non trovato', code: 'AUDIT_NOT_FOUND' });
    }

    const audit = auditCheck.recordset[0];
    const resolvedAuditId = audit.audit_id;

    // Lock check rimosso (T5): il lock è solo UX informativo, non blocca scrittura.

    if (!audit.custom_checklist_id) {
      return res.status(400).json({ error: 'Audit senza checklist custom', code: 'NO_CUSTOM_CHECKLIST' });
    }

    if (!Array.isArray(responses)) {
      return res.status(400).json({ error: 'responses deve essere un array', code: 'VALIDATION_ERROR' });
    }

    const checklistId = audit.custom_checklist_id;

    const VALID_STATUSES = new Set(['C', 'OSS', 'NC', 'OM', 'NV', 'NA']);

    for (const r of responses) {
      const { custom_item_id, evidence_blocks, status } = r;
      if (!custom_item_id) continue;

      const cid = parseInt(custom_item_id, 10);

      // Verifica che custom_item_id appartenga alla checklist dell'audit
      const itemCheck = await query(
        `SELECT 1 FROM custom_checklist_items cci
         INNER JOIN custom_checklist_sections ccs ON cci.section_id = ccs.id
         WHERE cci.id = @custom_item_id AND ccs.custom_checklist_id = @custom_checklist_id`,
        { custom_item_id: cid, custom_checklist_id: checklistId }
      );
      if (itemCheck.recordset.length === 0) {
        logger.warn('saveCustomChecklistResponses: custom_item_id non valido', { custom_item_id: cid, auditId: resolvedAuditId });
        continue; // Salta item non valido
      }

      const blocksJson = typeof evidence_blocks === 'string' ? evidence_blocks : JSON.stringify(evidence_blocks || []);
      const safeStatus = (status && VALID_STATUSES.has(String(status).toUpperCase()))
        ? String(status).toUpperCase()
        : null;

      const existing = await query(
        `SELECT id FROM audit_custom_checklist_responses WHERE audit_id = @audit_id AND custom_item_id = @custom_item_id`,
        { audit_id: resolvedAuditId, custom_item_id: cid }
      );

      if (existing.recordset.length > 0) {
        await query(
          `UPDATE audit_custom_checklist_responses
           SET evidence_blocks = @evidence_blocks,
               status = CASE WHEN @status IS NULL THEN status ELSE @status END,
               updated_at = GETDATE()
           WHERE audit_id = @audit_id AND custom_item_id = @custom_item_id`,
          { audit_id: resolvedAuditId, custom_item_id: cid, evidence_blocks: blocksJson, status: safeStatus }
        );
      } else {
        await query(
          `INSERT INTO audit_custom_checklist_responses (audit_id, custom_item_id, evidence_blocks, status, updated_at)
           VALUES (@audit_id, @custom_item_id, @evidence_blocks, @status, GETDATE())`,
          { audit_id: resolvedAuditId, custom_item_id: cid, evidence_blocks: blocksJson, status: safeStatus }
        );
      }
    }

    const updated = await query(
      `SELECT id, custom_item_id, evidence_blocks, status, updated_at FROM audit_custom_checklist_responses WHERE audit_id = @audit_id`,
      { audit_id: resolvedAuditId }
    );

    res.json({ success: true, data: updated.recordset });
  } catch (err) {
    logger.error('saveCustomChecklistResponses error', { error: err.message });
    res.status(500).json({ error: 'Errore salvataggio risposte', code: 'CUSTOM_RESPONSES_SAVE_ERROR' });
  }
}

module.exports = {
  listChecklists,
  createChecklist,
  getChecklist,
  updateChecklist,
  deleteChecklist,
  listSections,
  createSection,
  updateSection,
  updateSectionsOrder,
  deleteSection,
  listItems,
  createItem,
  updateItem,
  deleteItem,
  getCustomChecklistResponses,
  saveCustomChecklistResponses,
};
