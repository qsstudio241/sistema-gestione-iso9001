/**
 * moduleLicense.service.js — Sprint 8: licenze moduli per organizzazione
 * Colonna organizations.licensed_modules: JSON array di chiavi, NULL = tutti i moduli attivi.
 */

const { query } = require('../config/database');

/** Chiavi usate da frontend + middleware (allineare a LicensedRoute / AppLayout) */
const KNOWN_MODULE_KEYS = [
    'audit',
    'documents',
    'qualifiche',
    'nc',
    'rischi',
    'reclami',
    'notifications',
    'sal',
    'saldatura',
    'ai_import',
    'ai_assist',
    'ai_norms',
    'ai_review',
    'ai_chat',
];

const ALL_MODULES_DEFAULT = [...KNOWN_MODULE_KEYS];

const LABELS_IT = {
    audit: 'Audit',
    documents: 'Registro documenti',
    qualifiche: 'Qualifiche personale',
    nc: 'Non conformità',
    rischi: 'Rischi e obiettivi',
    reclami: 'Reclami e fornitori',
    notifications: 'Notifiche e alert email',
    sal: 'SAL — Riesame direzione',
    saldatura: 'Modulo saldatura ISO 3834',
    ai_import: 'Import batch documenti (PDF)',
    ai_assist: 'AI Assist — suggerimenti compilazione',
    ai_norms: 'AI Norme — accesso normativo on-demand',
    ai_review: 'AI Riesame — riesame requisiti assistito',
    ai_chat: 'AI Chat — assistente conversazionale',
};

function parseLicensedModulesColumn(raw) {
    if (raw == null || String(raw).trim() === '') return null;
    try {
        const j = JSON.parse(raw);
        if (Array.isArray(j)) {
            const wanted = new Set(j.map((x) => String(x)));
            const filtered = KNOWN_MODULE_KEYS.filter((k) => wanted.has(k));
            return filtered.length ? filtered : null;
        }
    } catch (_) { /* ignore */ }
    return null;
}

/**
 * Elenco moduli abilitati per l'organizzazione (sempre array non vuoto).
 * NULL / JSON non valido → tutti i moduli noti (retrocompatibilità).
 */
async function getLicensedModuleKeysForOrg(organizationId) {
    const r = await query(
        `SELECT licensed_modules FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) return [...ALL_MODULES_DEFAULT];
    const parsed = parseLicensedModulesColumn(r.recordset[0].licensed_modules);
    if (!parsed || !parsed.length) return [...ALL_MODULES_DEFAULT];
    return parsed;
}

/**
 * Salva elenco moduli (solo chiavi note). Garantisce sempre "audit" attivo.
 */
async function setLicensedModulesForOrg(organizationId, modules) {
    const allowed = new Set(KNOWN_MODULE_KEYS);
    let arr = [...new Set((modules || []).map((m) => String(m)).filter((m) => allowed.has(m)))];
    if (!arr.includes('audit')) arr = ['audit', ...arr];
    const json = JSON.stringify(arr);
    await query(
        `UPDATE organizations SET licensed_modules = @json WHERE organization_id = @organization_id`,
        { organization_id: organizationId, json }
    );
    return arr;
}

/** Ripristina comportamento default (tutti i moduli) */
async function clearLicensedModulesOverride(organizationId) {
    await query(
        `UPDATE organizations SET licensed_modules = NULL WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
}

module.exports = {
    KNOWN_MODULE_KEYS,
    ALL_MODULES_DEFAULT,
    LABELS_IT,
    parseLicensedModulesColumn,
    getLicensedModuleKeysForOrg,
    setLicensedModulesForOrg,
    clearLicensedModulesOverride,
};
