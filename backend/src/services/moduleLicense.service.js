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
    'riesame_direzione',
    'reclami',
    'notifications',
    'sal',
    'saldatura',
    'cnd',
    'strumenti',
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
    riesame_direzione: 'Riesame di Direzione (§9.3)',
    reclami: 'Reclami e fornitori',
    notifications: 'Notifiche e alert email',
    sal: 'SAL',
    saldatura: 'Modulo saldatura ISO 3834',
    cnd: 'Controlli Non Distruttivi (VT/MT/PT/UT)',
    strumenti: 'Strumenti e attrezzature (anagrafica + tarature)',
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

/** Unisce elenchi mantenendo l'ordine canonico KNOWN_MODULE_KEYS e garantendo audit. */
function mergeModuleKeys(existingKeys, keysToAdd) {
    const allowed = new Set(KNOWN_MODULE_KEYS);
    const wanted = new Set(
        [...(existingKeys || []), ...(keysToAdd || [])]
            .map((k) => String(k))
            .filter((k) => allowed.has(k))
    );
    if (!wanted.has('audit')) wanted.add('audit');
    return KNOWN_MODULE_KEYS.filter((k) => wanted.has(k));
}

function buildAvailableCatalog() {
    return KNOWN_MODULE_KEYS.map((key) => ({ key, label: LABELS_IT[key] || key }));
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

/**
 * Payload licenze per API admin (org corrente o tenant specifico).
 */
async function getOrgLicensesPayload(organizationId) {
    const r = await query(
        `SELECT organization_id, organization_name, licensed_modules
         FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) return null;
    const row = r.recordset[0];
    const raw = row.licensed_modules ?? null;
    const modules = await getLicensedModuleKeysForOrg(organizationId);
    return {
        organization_id: row.organization_id,
        organization_name: row.organization_name,
        modules,
        raw_override: raw,
        available: buildAvailableCatalog(),
    };
}

/**
 * Aggiunge moduli a una lista esplicita (idempotente).
 * licensed_modules NULL = tutti i moduli → nessuna modifica.
 */
async function appendLicensedModulesForOrg(organizationId, moduleKeys) {
    const r = await query(
        `SELECT licensed_modules FROM organizations WHERE organization_id = @organization_id`,
        { organization_id: organizationId }
    );
    if (!r.recordset.length) {
        throw new Error(`Organizzazione ${organizationId} non trovata`);
    }
    const raw = r.recordset[0].licensed_modules;
    if (raw == null || String(raw).trim() === '') {
        return getLicensedModuleKeysForOrg(organizationId);
    }
    const current = parseLicensedModulesColumn(raw) || [];
    const merged = mergeModuleKeys(current, moduleKeys);
    const unchanged = merged.length === current.length && merged.every((k, i) => k === current[i]);
    if (unchanged) return merged;
    return setLicensedModulesForOrg(organizationId, merged);
}

module.exports = {
    KNOWN_MODULE_KEYS,
    ALL_MODULES_DEFAULT,
    LABELS_IT,
    parseLicensedModulesColumn,
    mergeModuleKeys,
    buildAvailableCatalog,
    getLicensedModuleKeysForOrg,
    getOrgLicensesPayload,
    setLicensedModulesForOrg,
    clearLicensedModulesOverride,
    appendLicensedModulesForOrg,
};
