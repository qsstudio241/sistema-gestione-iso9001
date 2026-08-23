/**
 * Report Template Service
 * Helper per risoluzione template: organization_id + standard_id/custom_checklist_id -> report_template
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/** Mappa standard_id -> standard_key per template di sistema */
const STANDARD_KEY_MAP = {
  1: 'ISO_9001',
  2: 'ISO_14001',
  3: 'ISO_45001',
  4: 'ISO_3834_2',
  5: 'ISO_3834_2',
  6: 'ISO_3834_2',
  7: 'ISO_3834_2', // RDP_MSN usa template 3834
};

/**
 * Risolve quale template usare per (organization_id, standard_id, custom_checklist_id)
 * 1. Cerca in report_template_assignments
 * 2. Se non trovato e standard_id: cerca template di sistema con standard_key
 * 3. Fallback: template default
 *
 * @param {number} organizationId
 * @param {number|null} standardId
 * @param {number|null} customChecklistId
 * @returns {Promise<{id: number, file_path: string, name: string}>}
 */
async function getReportTemplate(organizationId, standardId, customChecklistId) {
  // 1. Cerca assegnazione
  if (standardId) {
    const assign = await query(
      `SELECT rta.report_template_id, rt.file_path, rt.name
       FROM report_template_assignments rta
       JOIN report_templates rt ON rta.report_template_id = rt.id
       WHERE rta.organization_id = @organization_id AND rta.standard_id = @standard_id`,
      { organization_id: organizationId, standard_id: standardId }
    );
    if (assign.recordset.length > 0) {
      const r = assign.recordset[0];
      return { id: r.report_template_id, file_path: r.file_path, name: r.name };
    }
  }

  if (customChecklistId) {
    const assign = await query(
      `SELECT rta.report_template_id, rt.file_path, rt.name
       FROM report_template_assignments rta
       JOIN report_templates rt ON rta.report_template_id = rt.id
       WHERE rta.organization_id = @organization_id AND rta.custom_checklist_id = @custom_checklist_id`,
      { organization_id: organizationId, custom_checklist_id: customChecklistId }
    );
    if (assign.recordset.length > 0) {
      const r = assign.recordset[0];
      return { id: r.report_template_id, file_path: r.file_path, name: r.name };
    }

    // Fallback: default_report_template_id sulla checklist custom
    const cc = await query(
      `SELECT default_report_template_id FROM custom_checklists WHERE id = @id AND organization_id = @organization_id`,
      { id: customChecklistId, organization_id: organizationId }
    );
    if (cc.recordset.length > 0 && cc.recordset[0].default_report_template_id) {
      const tpl = await query(
        `SELECT id, file_path, name FROM report_templates WHERE id = @id`,
        { id: cc.recordset[0].default_report_template_id }
      );
      if (tpl.recordset.length > 0) {
        const r = tpl.recordset[0];
        return { id: r.id, file_path: r.file_path, name: r.name };
      }
    }

    // Fallback: template "Verbale visita" di sistema (standard_key = 'custom_checklist')
    const verbale = await query(
      `SELECT TOP 1 id, file_path, name FROM report_templates
       WHERE organization_id IS NULL AND scope = 'audit'
         AND (standard_key = 'custom_checklist' OR standard_key = 'verbale_visita')
       ORDER BY CASE WHEN standard_key = 'custom_checklist' THEN 0 ELSE 1 END`
    );
    if (verbale.recordset.length > 0) {
      const r = verbale.recordset[0];
      return { id: r.id, file_path: r.file_path, name: r.name };
    }

    // Ultimo fallback: template default (ISO 9001)
    const def = await query(
      `SELECT TOP 1 id, file_path, name FROM report_templates
       WHERE organization_id IS NULL AND scope = 'audit' AND standard_key = 'default'`
    );
    if (def.recordset.length > 0) {
      const r = def.recordset[0];
      return { id: r.id, file_path: r.file_path, name: r.name };
    }
  }

  // 2. Template di sistema per standard
  const standardKey = standardId ? STANDARD_KEY_MAP[standardId] || 'default' : 'default';
  const sysTemplate = await query(
    `SELECT TOP 1 id, file_path, name FROM report_templates
     WHERE organization_id IS NULL AND scope = 'audit'
       AND (standard_key = @standard_key OR standard_key = 'default')
     ORDER BY CASE WHEN standard_key = @standard_key THEN 0 ELSE 1 END`,
    { standard_key: standardKey }
  );

  if (sysTemplate.recordset.length > 0) {
    const r = sysTemplate.recordset[0];
    return { id: r.id, file_path: r.file_path, name: r.name };
  }

  throw new Error('Nessun template report configurato');
}

/**
 * Risolve template export Word per scheda NC (scope nc).
 * 1. Assegnazione org (assignment_type = nc)
 * 2. Template di sistema default
 *
 * @param {number} organizationId
 * @returns {Promise<{id: number, file_path: string, name: string}>}
 */
async function getNcReportTemplate(organizationId) {
  const assign = await query(
    `SELECT rta.report_template_id, rt.file_path, rt.name
     FROM report_template_assignments rta
     JOIN report_templates rt ON rta.report_template_id = rt.id
     WHERE rta.organization_id = @organization_id
       AND rta.assignment_type = 'nc'`,
    { organization_id: organizationId }
  );
  if (assign.recordset.length > 0) {
    const r = assign.recordset[0];
    return { id: r.report_template_id, file_path: r.file_path, name: r.name };
  }

  const sysTemplate = await query(
    `SELECT TOP 1 id, file_path, name FROM report_templates
     WHERE organization_id IS NULL AND scope = 'nc' AND standard_key = 'default'`
  );
  if (sysTemplate.recordset.length > 0) {
    const r = sysTemplate.recordset[0];
    return { id: r.id, file_path: r.file_path, name: r.name };
  }

  throw new Error('Nessun template NC configurato');
}

/** Chiavi metodo CND (scope cnd). Runtime solo .docx. */
const CND_METHOD_KEYS = ['VT', 'MT', 'PT', 'UT'];

function normalizeCndMethodKey(value) {
  const key = String(value || '').trim().toUpperCase();
  return CND_METHOD_KEYS.includes(key) ? key : null;
}

/**
 * Risolve template export Word per verbale CND (scope cnd).
 * 1. Template studio con standard_key = VT|MT|PT|UT
 * 2. Template di sistema stessa chiave
 *
 * @param {number} organizationId
 * @param {string} methodKey
 * @returns {Promise<{id: number, file_path: string, name: string}>}
 */
async function getCndReportTemplate(organizationId, methodKey) {
  const key = normalizeCndMethodKey(methodKey);
  if (!key) {
    throw new Error('standard_key CND non valido (attesi VT, MT, PT, UT)');
  }

  if (organizationId) {
    const orgTpl = await query(
      `SELECT TOP 1 id, file_path, name FROM report_templates
       WHERE organization_id = @organization_id AND scope = 'cnd' AND standard_key = @standard_key
       ORDER BY updated_at DESC`,
      { organization_id: organizationId, standard_key: key }
    );
    if (orgTpl.recordset.length > 0) {
      const r = orgTpl.recordset[0];
      return { id: r.id, file_path: r.file_path, name: r.name };
    }
  }

  const sysTpl = await query(
    `SELECT TOP 1 id, file_path, name FROM report_templates
     WHERE organization_id IS NULL AND scope = 'cnd' AND standard_key = @standard_key`,
    { standard_key: key }
  );
  if (sysTpl.recordset.length > 0) {
    const r = sysTpl.recordset[0];
    return { id: r.id, file_path: r.file_path, name: r.name };
  }

  throw new Error(`Nessun template CND configurato per ${key}`);
}

module.exports = {
  getReportTemplate,
  getNcReportTemplate,
  getCndReportTemplate,
  normalizeCndMethodKey,
  CND_METHOD_KEYS,
  STANDARD_KEY_MAP,
};
