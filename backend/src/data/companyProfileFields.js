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

function mergeSourceMeta(existingRaw, touchedKeys, userId, extra = {}) {
    const meta = parseSourceMeta(existingRaw);
    const at = new Date().toISOString();
    const source = extra.source === 'excel' || extra.source === 'registry' ? extra.source : 'manual';
    for (const key of touchedKeys) {
        const entry = { source, at, user_id: userId || null };
        if (extra.file) entry.file = extra.file;
        meta[key] = entry;
    }
    return JSON.stringify(meta);
}

/** Header Excel canonici (catalogo §2–3) + sinonimi accettati dal detector. */
const EXCEL_CANONICAL = {
    legal_name: 'ragione_sociale',
    vat_number: 'partita_iva',
    fiscal_code: 'codice_fiscale',
    ateco_primary: 'ateco_primario',
    ateco_primary_desc: 'ateco_primario_desc',
    ateco_secondary: 'ateco_secondari',
    legal_form: 'forma_giuridica',
    rea_number: 'rea',
    cciaa: 'cciaa',
    pec: 'pec',
    registered_street: 'sede_via',
    registered_cap: 'sede_cap',
    registered_city: 'sede_comune',
    registered_province: 'sede_provincia',
    registered_country: 'sede_nazione',
    local_units_summary: 'unita_locali',
    share_capital: 'capitale_sociale',
    company_status: 'stato_impresa',
    legal_rep_name: 'legale_rappresentante',
    website: 'sito_web',
    phone: 'telefono',
    email: 'email',
    employees_count: 'n_lavoratori',
    employees_note: 'nota_organico',
    sites_count: 'n_sedi_operative',
    sites_description: 'descrizione_sedi',
    collective_agreement: 'ccnl',
    has_construction_sites: 'cantieri',
    has_third_party_sites: 'presso_terzi',
    has_dvr: 'ha_dvr',
    rspp_name: 'rspp',
    competent_doctor: 'medico_competente',
    rls_name: 'rls',
    inail_pat: 'pat_inail',
    main_hazards: 'pericoli_principali',
    uses_hazardous_agents: 'agenti_pericolosi',
    has_work_at_height: 'lavoro_quota',
    has_night_shifts: 'turni_notturni',
    equipment_summary: 'attrezzature',
    produces_waste: 'produce_rifiuti',
    waste_cer_summary: 'rifiuti_cer',
    waste_broker_or_self: 'gestione_rifiuti',
    has_water_discharge: 'scarichi_idrici',
    has_air_emissions: 'emissioni_aria',
    has_aua_or_aia: 'aua_aia',
    authorization_refs: 'rif_autorizzazioni',
    uses_fuel_plants: 'impianti_combustione',
    energy_carriers: 'vettori_energetici',
    noise_external_relevant: 'rumore_esterno',
    hazardous_substances_env: 'sostanze_ambiente',
    notes: 'note',
    profile_version_label: 'revisione',
};

const EXCEL_SYNONYMS = {
    vat_number: ['p.iva', 'piva', 'vat', 'partita iva', 'partitaiva'],
    ateco_primary: ['ateco', 'codice ateco', 'ateco primario'],
    employees_count: ['dipendenti', 'addetti', 'numero dipendenti', 'n lavoratori'],
    registered_city: ['comune', 'citta', 'città'],
    legal_name: ['ragione sociale', 'denominazione', 'nome'],
    fiscal_code: ['cf', 'cod fisc', 'codice fiscale'],
    pec: ['posta certificata'],
    registered_street: ['via', 'indirizzo', 'sede via'],
    registered_cap: ['cap'],
    registered_province: ['provincia', 'prov'],
};

function normalizeExcelHeader(raw) {
    return String(raw || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[.'’]/g, '')
        .replace(/[\s-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
}

function buildHeaderLookup() {
    const map = new Map();
    for (const [field, canonical] of Object.entries(EXCEL_CANONICAL)) {
        map.set(normalizeExcelHeader(canonical), field);
        map.set(normalizeExcelHeader(field), field);
    }
    for (const [field, aliases] of Object.entries(EXCEL_SYNONYMS)) {
        for (const alias of aliases) {
            map.set(normalizeExcelHeader(alias), field);
        }
    }
    return map;
}

const EXCEL_HEADER_LOOKUP = buildHeaderLookup();

function fieldFromExcelHeader(header) {
    return EXCEL_HEADER_LOOKUP.get(normalizeExcelHeader(header)) || null;
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
    EXCEL_CANONICAL,
    EXCEL_SYNONYMS,
    normalizeExcelHeader,
    fieldFromExcelHeader,
};
