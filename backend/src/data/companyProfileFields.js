/**
 * Catalogo campi company_profile (ADR-018).
 * Fonte: docs/specs/COMPANY_PROFILE_CAMPI_E_TEMPLATE_EXCEL.md
 * Usato da controller + test L1 (niente duplicazione whitelist).
 */

const STRING_FIELDS = [
    'legal_name', 'vat_number', 'fiscal_code', 'ateco_primary', 'ateco_primary_desc',
    'ateco_secondary', 'legal_form', 'rea_number', 'cciaa', 'pec',
    'registered_street', 'registered_cap', 'registered_city', 'registered_province',
    'registered_country', 'local_units_summary', 'share_capital', 'company_status',
    'legal_rep_name', 'website', 'phone', 'email',
    'employees_note', 'sites_description', 'collective_agreement',
    'rspp_name', 'competent_doctor', 'rls_name', 'inail_pat',
    'main_hazards', 'equipment_summary',
    'waste_cer_summary', 'waste_broker_or_self', 'authorization_refs',
    'energy_carriers', 'hazardous_substances_env', 'notes', 'profile_version_label',
];

const INT_FIELDS = ['employees_count', 'sites_count'];

const BIT_FIELDS = [
    'has_construction_sites', 'has_third_party_sites', 'has_dvr',
    'uses_hazardous_agents', 'has_work_at_height', 'has_night_shifts',
    'produces_waste', 'has_water_discharge', 'has_air_emissions',
    'has_aua_or_aia', 'uses_fuel_plants', 'noise_external_relevant',
];

const EDITABLE_FIELDS = [...STRING_FIELDS, ...INT_FIELDS, ...BIT_FIELDS];

const STRING_MAX = {
    legal_name: 255,
    vat_number: 50,
    fiscal_code: 50,
    ateco_primary: 20,
    ateco_primary_desc: 500,
    ateco_secondary: 500,
    legal_form: 100,
    rea_number: 50,
    cciaa: 50,
    pec: 320,
    registered_street: 255,
    registered_cap: 10,
    registered_city: 100,
    registered_province: 2,
    registered_country: 2,
    share_capital: 50,
    company_status: 50,
    legal_rep_name: 200,
    website: 255,
    phone: 50,
    email: 320,
    employees_note: 500,
    collective_agreement: 200,
    rspp_name: 200,
    competent_doctor: 200,
    rls_name: 200,
    inail_pat: 50,
    waste_broker_or_self: 200,
    energy_carriers: 200,
    profile_version_label: 50,
};

function emptyProfile() {
    const row = {};
    for (const f of EDITABLE_FIELDS) row[f] = null;
    return row;
}

function normalizeBit(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value === true || value === 1 || value === '1') return 1;
    if (value === false || value === 0 || value === '0') return 0;
    const s = String(value).trim().toLowerCase();
    if (s === 'si' || s === 'sì' || s === 'true' || s === 'yes') return 1;
    if (s === 'no' || s === 'false') return 0;
    return null;
}

function normalizeInt(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : null;
}

function normalizeStr(value, maxLen) {
    if (value === null || value === undefined) return null;
    const s = String(value).trim();
    if (!s) return null;
    return maxLen ? s.slice(0, maxLen) : s;
}

/**
 * Estrae solo i campi editabili presenti nel body (chiavi toccate).
 * @returns {Record<string, string|number|null>}
 */
function pickEditableFields(body) {
    const src = body && typeof body === 'object' ? body : {};
    const out = {};
    for (const key of STRING_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
        out[key] = normalizeStr(src[key], STRING_MAX[key] || null);
    }
    for (const key of INT_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
        out[key] = normalizeInt(src[key]);
    }
    for (const key of BIT_FIELDS) {
        if (!Object.prototype.hasOwnProperty.call(src, key)) continue;
        out[key] = normalizeBit(src[key]);
    }
    return out;
}

function parseSourceMeta(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
        return {};
    }
}

function mergeSourceMeta(existingRaw, touchedKeys, userId) {
    const meta = parseSourceMeta(existingRaw);
    const at = new Date().toISOString();
    for (const key of touchedKeys) {
        meta[key] = { source: 'manual', at, user_id: userId || null };
    }
    return JSON.stringify(meta);
}

function rowToProfile(row) {
    const profile = emptyProfile();
    if (!row) return profile;
    for (const key of EDITABLE_FIELDS) {
        if (row[key] === undefined) continue;
        profile[key] = row[key];
    }
    return profile;
}

module.exports = {
    STRING_FIELDS,
    INT_FIELDS,
    BIT_FIELDS,
    EDITABLE_FIELDS,
    STRING_MAX,
    emptyProfile,
    normalizeBit,
    normalizeInt,
    normalizeStr,
    pickEditableFields,
    parseSourceMeta,
    mergeSourceMeta,
    rowToProfile,
};
