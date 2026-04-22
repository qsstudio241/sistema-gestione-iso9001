/**
 * Custom Checklist Service
 * Phase 5 - Logica CRUD checklist personalizzate, sezioni, voci, risposte
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

function buildChecklistScopeWhere(reqUser) {
  const isOrgWideAdmin =
    (reqUser?.role === 'admin' || reqUser?.role === 'superadmin') &&
    (reqUser?.auditor_org_id == null);

  if (isOrgWideAdmin) {
    return {
      where: 'organization_id = @organization_id',
      params: { organization_id: reqUser.organization_id },
    };
  }

  // Policy B: checklist legacy (auditor_org_id NULL) restano visibili a tutti gli auditor.
  return {
    where: 'organization_id = @organization_id AND (auditor_org_id = @auditor_org_id OR auditor_org_id IS NULL)',
    params: {
      organization_id: reqUser.organization_id,
      auditor_org_id: reqUser.auditor_org_id ?? null,
    },
  };
}

/**
 * Lista checklist custom per organizzazione
 */
async function listChecklists(reqUser) {
  const scope = buildChecklistScopeWhere(reqUser);
  const result = await query(
    `SELECT id, organization_id, auditor_org_id, name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id, created_at, updated_at
     FROM custom_checklists
     WHERE ${scope.where}
     ORDER BY name`,
    scope.params
  );
  return result.recordset;
}

/**
 * Crea checklist custom
 */
async function createChecklist(reqUser, data) {
  const { name, description = null, is_active = true, has_outcome_buttons = false, default_report_template_id = null, custom_report_template_id = null } = data;
  const isOrgWideAdmin =
    (reqUser?.role === 'admin' || reqUser?.role === 'superadmin') &&
    (reqUser?.auditor_org_id == null);
  const scopedAuditorOrgId = isOrgWideAdmin ? null : (reqUser?.auditor_org_id ?? null);
  const result = await query(
    `INSERT INTO custom_checklists (organization_id, auditor_org_id, name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id, created_at, updated_at)
     OUTPUT INSERTED.id, INSERTED.organization_id, INSERTED.auditor_org_id, INSERTED.name, INSERTED.description, INSERTED.is_active, INSERTED.has_outcome_buttons, INSERTED.created_at
     VALUES (@organization_id, @auditor_org_id, @name, @description, @is_active, @has_outcome_buttons, @default_report_template_id, @custom_report_template_id, GETDATE(), GETDATE())`,
    {
      organization_id: reqUser.organization_id,
      auditor_org_id: scopedAuditorOrgId,
      name,
      description,
      is_active: is_active ? 1 : 0,
      has_outcome_buttons: has_outcome_buttons ? 1 : 0,
      default_report_template_id,
      custom_report_template_id,
    }
  );
  return result.recordset[0];
}

/**
 * Ottieni checklist per id (con verifica org)
 */
async function getChecklistById(id, reqUser) {
  const scope = buildChecklistScopeWhere(reqUser);
  const result = await query(
    `SELECT id, organization_id, auditor_org_id, name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id, created_at, updated_at
     FROM custom_checklists
     WHERE id = @id AND ${scope.where}`,
    { id: parseInt(id, 10), ...scope.params }
  );
  return result.recordset[0] || null;
}

/**
 * Aggiorna checklist
 */
async function updateChecklist(id, reqUser, data) {
  const { name, description, is_active, has_outcome_buttons, default_report_template_id, custom_report_template_id } = data;
  const existing = await getChecklistById(id, reqUser);
  if (!existing) return null;

  await query(
    `UPDATE custom_checklists
     SET name = COALESCE(@name, name),
         description = COALESCE(@description, description),
         is_active = COALESCE(@is_active, is_active),
         has_outcome_buttons = COALESCE(@has_outcome_buttons, has_outcome_buttons),
         default_report_template_id = COALESCE(@default_report_template_id, default_report_template_id),
         custom_report_template_id = COALESCE(@custom_report_template_id, custom_report_template_id),
         updated_at = GETDATE()
     WHERE id = @id`,
    {
      id: parseInt(id, 10),
      name: name ?? existing.name,
      description: description !== undefined ? description : existing.description,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      has_outcome_buttons: has_outcome_buttons !== undefined ? (has_outcome_buttons ? 1 : 0) : existing.has_outcome_buttons,
      default_report_template_id: default_report_template_id !== undefined ? default_report_template_id : existing.default_report_template_id,
      custom_report_template_id: custom_report_template_id !== undefined ? custom_report_template_id : existing.custom_report_template_id,
    }
  );
  return getChecklistById(id, reqUser);
}

/**
 * Elimina checklist (CASCADE su sections e items)
 */
async function deleteChecklist(id, reqUser) {
  const existing = await getChecklistById(id, reqUser);
  if (!existing) return false;

  await query(`DELETE FROM custom_checklists WHERE id = @id`, { id: parseInt(id, 10) });
  return true;
}

/**
 * Lista sezioni di una checklist
 */
async function listSections(customChecklistId, reqUser) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const result = await query(
    `SELECT id, code, title, display_order
     FROM custom_checklist_sections
     WHERE custom_checklist_id = @custom_checklist_id
     ORDER BY display_order, code`,
    { custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  return result.recordset;
}

/**
 * Crea sezione
 */
async function createSection(customChecklistId, reqUser, data) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const { code, title, display_order = 0 } = data;
  const result = await query(
    `INSERT INTO custom_checklist_sections (custom_checklist_id, code, title, display_order)
     OUTPUT INSERTED.id, INSERTED.code, INSERTED.title, INSERTED.display_order
     VALUES (@custom_checklist_id, @code, @title, @display_order)`,
    {
      custom_checklist_id: parseInt(customChecklistId, 10),
      code,
      title,
      display_order: parseInt(display_order, 10) || 0,
    }
  );
  return result.recordset[0];
}

/**
 * Aggiorna sezione (code, title, display_order)
 */
async function updateSection(sectionId, customChecklistId, reqUser, data) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const existing = await query(
    `SELECT id, code, title, display_order FROM custom_checklist_sections
     WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
    { id: parseInt(sectionId, 10), custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  if (!existing.recordset.length) return null;

  const row = existing.recordset[0];
  const code = data.code !== undefined ? String(data.code).trim() : row.code;
  const title = data.title !== undefined ? String(data.title).trim() : row.title;
  const display_order = data.display_order !== undefined ? parseInt(data.display_order, 10) : row.display_order;

  if (!code || !title) {
    throw new Error('code e title non possono essere vuoti');
  }

  await query(
    `UPDATE custom_checklist_sections
     SET code = @code, title = @title, display_order = @display_order
     WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
    {
      id: parseInt(sectionId, 10),
      custom_checklist_id: parseInt(customChecklistId, 10),
      code,
      title,
      display_order: Number.isNaN(display_order) ? row.display_order : display_order,
    }
  );

  const out = await query(
    `SELECT id, code, title, display_order FROM custom_checklist_sections WHERE id = @id`,
    { id: parseInt(sectionId, 10) }
  );
  return out.recordset[0] || null;
}

/**
 * Aggiorna voce (item): code, title, display_order
 */
async function updateItem(itemId, customChecklistId, reqUser, data) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const existing = await query(
    `SELECT id, section_id, code, title, response_type, display_order
     FROM custom_checklist_items
     WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
    { id: parseInt(itemId, 10), custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  if (!existing.recordset.length) return null;

  const row = existing.recordset[0];
  const code = data.code !== undefined ? String(data.code).trim() : row.code;
  const title = data.title !== undefined ? String(data.title).trim() : row.title;
  const display_order = data.display_order !== undefined ? parseInt(data.display_order, 10) : row.display_order;

  if (!code || !title) {
    throw new Error('code e title non possono essere vuoti');
  }

  await query(
    `UPDATE custom_checklist_items
     SET code = @code, title = @title, display_order = @display_order
     WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
    {
      id: parseInt(itemId, 10),
      custom_checklist_id: parseInt(customChecklistId, 10),
      code,
      title,
      display_order: Number.isNaN(display_order) ? row.display_order : display_order,
    }
  );

  const out = await query(
    `SELECT id, section_id, code, title, response_type, display_order FROM custom_checklist_items WHERE id = @id`,
    { id: parseInt(itemId, 10) }
  );
  return out.recordset[0] || null;
}

/**
 * Aggiorna ordine sezioni (bulk)
 */
async function updateSectionsOrder(customChecklistId, reqUser, sections) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return false;

  for (const { id, display_order } of sections) {
    await query(
      `UPDATE custom_checklist_sections SET display_order = @display_order WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
      { id: parseInt(id, 10), display_order: parseInt(display_order, 10) || 0, custom_checklist_id: parseInt(customChecklistId, 10) }
    );
  }
  return true;
}

/**
 * Elimina sezione
 */
async function deleteSection(sectionId, customChecklistId, reqUser) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return false;

  const result = await query(
    `DELETE FROM custom_checklist_sections WHERE id = @id AND custom_checklist_id = @custom_checklist_id`,
    { id: parseInt(sectionId, 10), custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  return result.rowsAffected?.[0] > 0;
}

/**
 * Lista voci (items) di una checklist, opzionalmente per sezione
 */
async function listItems(customChecklistId, reqUser, sectionId = null) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  let sql = `SELECT cci.id, cci.section_id, cci.code, cci.title, cci.response_type, cci.display_order
             FROM custom_checklist_items cci
             INNER JOIN custom_checklist_sections ccs ON cci.section_id = ccs.id
             WHERE ccs.custom_checklist_id = @custom_checklist_id`;
  const params = { custom_checklist_id: parseInt(customChecklistId, 10) };

  if (sectionId) {
    sql += ` AND cci.section_id = @section_id`;
    params.section_id = parseInt(sectionId, 10);
  }

  sql += ` ORDER BY ccs.display_order, ccs.code, cci.display_order, cci.code`;

  const result = await query(sql, params);
  return result.recordset;
}

/**
 * Crea voce (item)
 */
async function createItem(customChecklistId, reqUser, data) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const { section_id, code, title, response_type = 'verbale', display_order = 0 } = data;

  // Verifica che section_id appartenga alla checklist
  const sectionCheck = await query(
    `SELECT 1 FROM custom_checklist_sections WHERE id = @section_id AND custom_checklist_id = @custom_checklist_id`,
    { section_id: parseInt(section_id, 10), custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  if (sectionCheck.recordset.length === 0) {
    throw new Error('Sezione non trovata o non appartiene a questa checklist');
  }

  const result = await query(
    `INSERT INTO custom_checklist_items (custom_checklist_id, section_id, code, title, response_type, display_order)
     OUTPUT INSERTED.id, INSERTED.section_id, INSERTED.code, INSERTED.title, INSERTED.response_type, INSERTED.display_order
     VALUES (@custom_checklist_id, @section_id, @code, @title, @response_type, @display_order)`,
    {
      custom_checklist_id: parseInt(customChecklistId, 10),
      section_id: parseInt(section_id, 10),
      code,
      title,
      response_type: response_type || 'verbale',
      display_order: parseInt(display_order, 10) || 0,
    }
  );
  return result.recordset[0];
}

/**
 * Elimina voce
 */
async function deleteItem(itemId, customChecklistId, reqUser) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return false;

  const result = await query(
    `DELETE cci FROM custom_checklist_items cci
     INNER JOIN custom_checklist_sections ccs ON cci.section_id = ccs.id
     WHERE cci.id = @id AND ccs.custom_checklist_id = @custom_checklist_id`,
    { id: parseInt(itemId, 10), custom_checklist_id: parseInt(customChecklistId, 10) }
  );
  return result.rowsAffected?.[0] > 0;
}

/**
 * Ottieni checklist completa (sezioni + voci) per audit
 */
async function getChecklistWithStructure(customChecklistId, reqUser) {
  const check = await getChecklistById(customChecklistId, reqUser);
  if (!check) return null;

  const sections = await listSections(customChecklistId, reqUser);
  const items = await listItems(customChecklistId, reqUser);

  const sectionsMap = {};
  for (const s of sections) {
    sectionsMap[s.id] = { ...s, items: [] };
  }
  for (const it of items) {
    if (sectionsMap[it.section_id]) {
      sectionsMap[it.section_id].items.push(it);
    }
  }

  return {
    ...check,
    sections: Object.values(sectionsMap),
  };
}

module.exports = {
  listChecklists,
  createChecklist,
  getChecklistById,
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
  getChecklistWithStructure,
};
