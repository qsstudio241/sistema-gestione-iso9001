/**
 * commercialChecklistTemplate.service.js — template checklist Riesame requisiti (ING-4)
 * Snapshot sul caso: resolveItemsForCase → INSERT NOT EXISTS in commercial_case_checklist.
 */

const { query } = require('../config/database');
const {
  mergeTemplateWithDefaults,
  buildSeedItemsFromDefaults,
  assertCoreCoverage,
  isCoreRef,
} = require('../data/commercialChecklistDefaults');

function normalizeName(raw) {
  const s = String(raw || '').trim();
  return s ? s.substring(0, 200) : null;
}

function normalizePhase(raw) {
  const p = String(raw || '').trim().toLowerCase();
  return p === 'preliminary' || p === 'final' ? p : null;
}

function normalizeItemPayload(rawItems) {
  if (!Array.isArray(rawItems)) return { ok: false, error: 'items deve essere un array' };
  const items = [];
  const seen = new Set();
  for (const raw of rawItems) {
    const phase = normalizePhase(raw.phase);
    if (!phase) return { ok: false, error: 'phase deve essere preliminary o final' };
    const ref = String(raw.item_ref || raw.ref || '').trim().substring(0, 30);
    const text = String(raw.item_text || raw.text || '').trim().substring(0, 500);
    if (!ref || !text) return { ok: false, error: 'item_ref e item_text obbligatori' };
    const key = `${phase}:${ref}`;
    if (seen.has(key)) return { ok: false, error: `Voce duplicata ${key}` };
    seen.add(key);
    const sortOrder = Number.isFinite(Number(raw.sort_order)) ? Number(raw.sort_order) : items.length;
    items.push({
      phase,
      item_ref: ref,
      item_text: text,
      sort_order: sortOrder,
      is_core: isCoreRef(phase, ref) ? 1 : raw.is_core === true || raw.is_core === 1 ? 1 : 0,
    });
  }
  const missing = assertCoreCoverage(items);
  if (missing.length) {
    return {
      ok: false,
      error: `Mancano voci core ISO §8.2: ${missing.join(', ')}. La personalizzazione non può bypassare la norma.`,
    };
  }
  return { ok: true, items };
}

async function listTemplates(organizationId, { companyId = null, activeOnly = false } = {}) {
  const params = { organizationId };
  let sqlText = `
    SELECT t.*, c.name AS company_name
    FROM commercial_checklist_templates AS t
    LEFT JOIN companies AS c ON c.id = t.company_id
    WHERE t.organization_id = @organizationId
  `;
  if (companyId != null && companyId !== '') {
    params.companyId = Number(companyId);
    sqlText += ' AND (t.company_id = @companyId OR t.company_id IS NULL)';
  }
  if (activeOnly) {
    sqlText += ' AND t.is_active = 1';
  }
  sqlText += `
    ORDER BY
      CASE WHEN t.company_id IS NULL THEN 1 ELSE 0 END,
      t.company_id,
      t.is_active DESC,
      t.updated_at DESC,
      t.id DESC
  `;
  const r = await query(sqlText, params);
  return r.recordset || [];
}

async function getTemplateWithItems(templateId, organizationId) {
  const head = await query(
    `
    SELECT t.*, c.name AS company_name
    FROM commercial_checklist_templates AS t
    LEFT JOIN companies AS c ON c.id = t.company_id
    WHERE t.id = @templateId AND t.organization_id = @organizationId
    `,
    { templateId, organizationId }
  );
  const template = (head.recordset || [])[0];
  if (!template) return null;
  const items = await query(
    `
    SELECT id, template_id, phase, item_ref, item_text, sort_order, is_core
    FROM commercial_checklist_template_items
    WHERE template_id = @templateId
    ORDER BY phase ASC, sort_order ASC, item_ref ASC
    `,
    { templateId }
  );
  return { ...template, items: items.recordset || [] };
}

async function deactivateSiblings(organizationId, companyId, exceptId) {
  const params = { organizationId, exceptId };
  let sqlText = `
    UPDATE commercial_checklist_templates
    SET is_active = 0, updated_at = SYSUTCDATETIME()
    WHERE organization_id = @organizationId
      AND id <> @exceptId
      AND is_active = 1
  `;
  if (companyId == null) {
    sqlText += ' AND company_id IS NULL';
  } else {
    params.companyId = companyId;
    sqlText += ' AND company_id = @companyId';
  }
  await query(sqlText, params);
}

async function replaceItems(templateId, items) {
  await query(`DELETE FROM commercial_checklist_template_items WHERE template_id = @templateId`, {
    templateId,
  });
  for (const item of items) {
    await query(
      `
      INSERT INTO commercial_checklist_template_items
        (template_id, phase, item_ref, item_text, sort_order, is_core)
      VALUES
        (@templateId, @phase, @itemRef, @itemText, @sortOrder, @isCore)
      `,
      {
        templateId,
        phase: item.phase,
        itemRef: item.item_ref,
        itemText: item.item_text,
        sortOrder: item.sort_order,
        isCore: item.is_core ? 1 : 0,
      }
    );
  }
}

async function createTemplate(organizationId, userId, body) {
  const name = normalizeName(body?.name);
  if (!name) return { ok: false, status: 400, error: 'name obbligatorio', code: 'VALIDATION_ERROR' };

  let companyId = null;
  if (body?.company_id != null && body.company_id !== '') {
    companyId = parseInt(String(body.company_id), 10);
    if (!Number.isFinite(companyId) || companyId <= 0) {
      return { ok: false, status: 400, error: 'company_id non valido', code: 'VALIDATION_ERROR' };
    }
    const owned = await query(
      `SELECT id FROM companies WHERE id = @companyId AND organization_id = @organizationId`,
      { companyId, organizationId }
    );
    if (!(owned.recordset || []).length) {
      return { ok: false, status: 400, error: 'Azienda non trovata nel tenant', code: 'VALIDATION_ERROR' };
    }
  }

  const seed = buildSeedItemsFromDefaults();
  const customItems = body?.items;
  let itemsToSave = seed;
  if (customItems != null) {
    const parsed = normalizeItemPayload(customItems);
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error, code: 'VALIDATION_ERROR' };
    itemsToSave = parsed.items;
  }

  const isActive = body?.is_active === false || body?.is_active === 0 ? 0 : 1;

  const ins = await query(
    `
    INSERT INTO commercial_checklist_templates
      (organization_id, company_id, name, is_active, created_by, updated_at)
    OUTPUT INSERTED.*
    VALUES
      (@organizationId, @companyId, @name, @isActive, @userId, SYSUTCDATETIME())
    `,
    { organizationId, companyId, name, isActive, userId }
  );
  const created = (ins.recordset || [])[0];
  if (!created) return { ok: false, status: 500, error: 'Creazione fallita', code: 'SERVER_ERROR' };

  if (isActive) {
    await deactivateSiblings(organizationId, companyId, created.id);
  }

  await replaceItems(created.id, itemsToSave);
  const full = await getTemplateWithItems(created.id, organizationId);
  return { ok: true, template: full };
}

async function updateTemplate(templateId, organizationId, body) {
  const existing = await getTemplateWithItems(templateId, organizationId);
  if (!existing) return { ok: false, status: 404, error: 'Template non trovato', code: 'NOT_FOUND' };

  const name = body?.name !== undefined ? normalizeName(body.name) : existing.name;
  if (!name) return { ok: false, status: 400, error: 'name obbligatorio', code: 'VALIDATION_ERROR' };

  let companyId = existing.company_id;
  if (body?.company_id !== undefined) {
    if (body.company_id == null || body.company_id === '') {
      companyId = null;
    } else {
      companyId = parseInt(String(body.company_id), 10);
      if (!Number.isFinite(companyId) || companyId <= 0) {
        return { ok: false, status: 400, error: 'company_id non valido', code: 'VALIDATION_ERROR' };
      }
      const owned = await query(
        `SELECT id FROM companies WHERE id = @companyId AND organization_id = @organizationId`,
        { companyId, organizationId }
      );
      if (!(owned.recordset || []).length) {
        return { ok: false, status: 400, error: 'Azienda non trovata nel tenant', code: 'VALIDATION_ERROR' };
      }
    }
  }

  let isActive = existing.is_active ? 1 : 0;
  if (body?.is_active !== undefined) {
    isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
  }

  let itemsToSave = null;
  if (body?.items !== undefined) {
    const parsed = normalizeItemPayload(body.items);
    if (!parsed.ok) return { ok: false, status: 400, error: parsed.error, code: 'VALIDATION_ERROR' };
    itemsToSave = parsed.items;
  }

  await query(
    `
    UPDATE commercial_checklist_templates
    SET name = @name,
        company_id = @companyId,
        is_active = @isActive,
        updated_at = SYSUTCDATETIME()
    WHERE id = @templateId AND organization_id = @organizationId
    `,
    { name, companyId, isActive, templateId, organizationId }
  );

  if (isActive) {
    await deactivateSiblings(organizationId, companyId, templateId);
  }

  if (itemsToSave) {
    await replaceItems(templateId, itemsToSave);
  }

  const full = await getTemplateWithItems(templateId, organizationId);
  return { ok: true, template: full };
}

async function deleteTemplate(templateId, organizationId) {
  const existing = await query(
    `SELECT id FROM commercial_checklist_templates WHERE id = @templateId AND organization_id = @organizationId`,
    { templateId, organizationId }
  );
  if (!(existing.recordset || []).length) {
    return { ok: false, status: 404, error: 'Template non trovato', code: 'NOT_FOUND' };
  }
  await query(`DELETE FROM commercial_checklist_template_items WHERE template_id = @templateId`, {
    templateId,
  });
  await query(
    `DELETE FROM commercial_checklist_templates WHERE id = @templateId AND organization_id = @organizationId`,
    { templateId, organizationId }
  );
  return { ok: true };
}

/**
 * Risolve le voci da snapshotare sul caso per una fase.
 * Preferenza: template attivo company-specific → template attivo org-wide → solo default ISO.
 */
async function resolveItemsForCase({ organizationId, companyId, phase }) {
  const normalizedPhase = normalizePhase(phase);
  if (!normalizedPhase) return { ok: false, error: 'phase non valida' };

  let templateRow = null;
  if (companyId != null) {
    const companyTpl = await query(
      `
      SELECT TOP 1 id, name
      FROM commercial_checklist_templates
      WHERE organization_id = @organizationId
        AND company_id = @companyId
        AND is_active = 1
      ORDER BY updated_at DESC, id DESC
      `,
      { organizationId, companyId }
    );
    templateRow = (companyTpl.recordset || [])[0] || null;
  }
  if (!templateRow) {
    const orgTpl = await query(
      `
      SELECT TOP 1 id, name
      FROM commercial_checklist_templates
      WHERE organization_id = @organizationId
        AND company_id IS NULL
        AND is_active = 1
      ORDER BY updated_at DESC, id DESC
      `,
      { organizationId }
    );
    templateRow = (orgTpl.recordset || [])[0] || null;
  }

  let templateItems = [];
  if (templateRow) {
    const itemRes = await query(
      `
      SELECT phase, item_ref, item_text, sort_order, is_core
      FROM commercial_checklist_template_items
      WHERE template_id = @templateId AND phase = @phase
      ORDER BY sort_order ASC, item_ref ASC
      `,
      { templateId: templateRow.id, phase: normalizedPhase }
    );
    templateItems = itemRes.recordset || [];
  }

  const items = mergeTemplateWithDefaults(normalizedPhase, templateItems);
  return {
    ok: true,
    phase: normalizedPhase,
    template_id: templateRow ? templateRow.id : null,
    template_name: templateRow ? templateRow.name : null,
    items,
  };
}

module.exports = {
  listTemplates,
  getTemplateWithItems,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  resolveItemsForCase,
  normalizeItemPayload,
  mergeTemplateWithDefaults,
};
