/**
 * extractedRequirementsProfile.js
 * Mappa requisiti estratti da disegno/testo in un profilo tecnico WPS-like (slice #7).
 *
 * Funzioni pure — riusano computeQualificationCoverage lato chiamante.
 */

'use strict';

const THICKNESS_FIELD_KEYS = new Set([
    'thickness',
    'thickness_min',
    'thickness_max',
    'spessore',
    'spessore_min',
    'spessore_max',
]);

const MATERIAL_FIELD_KEYS = new Set([
    'material_group',
    'material',
    'materiale',
    'base_material_group',
    'gruppo_materiale',
]);

const PROCESS_FIELD_KEYS = new Set([
    'welding_process',
    'process',
    'processo',
    'processo_saldatura',
]);

const POSITION_FIELD_KEYS = new Set([
    'position',
    'positions',
    'welding_positions',
    'posizione',
    'posizioni',
]);

function normalizeFieldKey(raw) {
    return String(raw || '').trim().toLowerCase().replace(/\s+/g, '_');
}

function parseThicknessValue(valueText, unit) {
    if (valueText == null) return null;
    const text = String(valueText).replace(',', '.');
    const nums = text.match(/\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) return null;

    const values = nums.map(Number).filter((n) => Number.isFinite(n));
    if (!values.length) return null;

    const u = String(unit || '').toLowerCase();
    const toMm = (n) => {
        if (u === 'm' || u === 'metri') return n * 1000;
        if (u === 'cm') return n * 10;
        return n;
    };

    const mmValues = values.map(toMm);
    return {
        min: Math.min(...mmValues),
        max: Math.max(...mmValues),
    };
}

function mergeThickness(profile, range) {
    if (!range) return;
    if (profile.thickness_range_min == null || range.min < profile.thickness_range_min) {
        profile.thickness_range_min = range.min;
    }
    if (profile.thickness_range_max == null || range.max > profile.thickness_range_max) {
        profile.thickness_range_max = range.max;
    }
}

/**
 * @param {Array<object>} requirements
 * @returns {object}
 */
function buildTechnicalProfile(requirements) {
    const profile = {
        welding_process: null,
        base_material_group: null,
        thickness_range_min: null,
        thickness_range_max: null,
        welding_positions: null,
        field_sources: [],
    };

    for (const r of requirements || []) {
        const fk = normalizeFieldKey(r.field_key);
        const val = r.value_text != null ? String(r.value_text).trim() : '';
        if (!val) continue;

        const reqType = String(r.req_type || '').toLowerCase();

        if (
            reqType === 'material'
            || MATERIAL_FIELD_KEYS.has(fk)
            || fk.includes('material')
            || fk.includes('materiale')
        ) {
            if (!profile.base_material_group) {
                profile.base_material_group = val;
                profile.field_sources.push({ field: 'base_material_group', req_type: reqType, value: val });
            }
            continue;
        }

        if (
            reqType === 'weld_symbol'
            || PROCESS_FIELD_KEYS.has(fk)
            || fk.includes('process')
        ) {
            if (!profile.welding_process) {
                profile.welding_process = val;
                profile.field_sources.push({ field: 'welding_process', req_type: reqType, value: val });
            }
            continue;
        }

        if (
            POSITION_FIELD_KEYS.has(fk)
            || fk.includes('position')
            || fk.includes('posiz')
        ) {
            if (!profile.welding_positions) {
                profile.welding_positions = val;
                profile.field_sources.push({ field: 'welding_positions', req_type: reqType, value: val });
            }
            continue;
        }

        if (
            reqType === 'dimension'
            || THICKNESS_FIELD_KEYS.has(fk)
            || fk.includes('thick')
            || fk.includes('spess')
        ) {
            const range = parseThicknessValue(val, r.unit);
            if (range) {
                mergeThickness(profile, range);
                profile.field_sources.push({ field: 'thickness', req_type: reqType, value: val });
            }
        }
    }

    return profile;
}

/**
 * Unisce profilo estratto da documenti con campi WPS (estratto prevale se valorizzato).
 *
 * @param {object} wps
 * @param {object} profile
 * @returns {object}
 */
function mergeWpsWithExtractedProfile(wps, profile) {
    const base = wps || {};
    const p = profile || {};
    return {
        ...base,
        welding_process: p.welding_process || base.welding_process || null,
        base_material_group:
            p.base_material_group
            || base.base_material_group
            || base.material_group
            || null,
        thickness_range_min:
            p.thickness_range_min != null ? p.thickness_range_min : base.thickness_range_min,
        thickness_range_max:
            p.thickness_range_max != null ? p.thickness_range_max : base.thickness_range_max,
        welding_positions:
            p.welding_positions || base.welding_positions || base.position || null,
    };
}

function profileHasTechnicalData(profile) {
    if (!profile) return false;
    return Boolean(
        profile.welding_process
        || profile.base_material_group
        || profile.thickness_range_min != null
        || profile.thickness_range_max != null
        || profile.welding_positions,
    );
}

module.exports = {
    buildTechnicalProfile,
    mergeWpsWithExtractedProfile,
    profileHasTechnicalData,
    parseThicknessValue,
};
