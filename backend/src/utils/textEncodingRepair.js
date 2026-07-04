'use strict';

/**
 * Ripara testo con U+FFFD, mojibake comuni e normalizza separatori per ingest/UI.
 */
function repairTextEncoding(input) {
    if (input == null) return input;
    if (typeof input !== 'string') return input;

    let s = input
        .replace(/\uFFFD/g, '')
        .replace(/\u00A0/g, ' ')
        .replace(/â€"/g, ' - ')
        .replace(/â€“/g, '-')
        .replace(/â€™/g, "'")
        .replace(/â€œ/g, '"')
        .replace(/â€\u009d/g, '"')
        .replace(/Ã¼/g, 'ü')
        .replace(/Ãœ/g, 'Ü')
        .replace(/Ã¨/g, 'è')
        .replace(/Ã©/g, 'é')
        .replace(/Ã¬/g, 'ì')
        .replace(/Ã²/g, 'ò')
        .replace(/Ã¹/g, 'ù')
        .replace(/Ã /g, 'à')
        .replace(/[\u2013\u2014]/g, ' - ')
        .replace(/\s{2,}/g, ' ')
        .trim();

    return s;
}

function repairDeep(value) {
    if (value == null) return value;
    if (typeof value === 'string') return repairTextEncoding(value);
    if (Array.isArray(value)) return value.map(repairDeep);
    if (typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            out[k] = repairDeep(v);
        }
        return out;
    }
    return value;
}

/** Codice processo ISO 4063 da valore AI/label */
function normalizeWeldingProcessCode(val) {
    const s = repairTextEncoding(String(val || ''));
    const m = s.match(/\b(111|121|131|135|136|138|141|145|311)\b/);
    return m ? m[1] : (s || null);
}

/** BW | FW */
function normalizeJointTypeCode(val) {
    const s = repairTextEncoding(String(val || '')).toUpperCase();
    if (/\bBW\b/.test(s)) return 'BW';
    if (/\bFW\b/.test(s)) return 'FW';
    return ['BW', 'FW'].includes(s) ? s : (s || null);
}

/** Valore select issuing_body */
function normalizeIssuingBodyCode(val) {
    const s = repairTextEncoding(String(val || '')).toLowerCase();
    if (!s) return null;
    if (/tüv|tuv/.test(s)) return 'tuv';
    if (/bureau veritas|\bbv\b/.test(s)) return 'bv';
    if (/\bdnv\b/.test(s)) return 'dnv';
    if (/\brina\b/.test(s)) return 'rina';
    if (/\bimq\b/.test(s)) return 'imq';
    if (/iqnet|\biqn\b/.test(s)) return 'iqn';
    if (/csq|certiquality/.test(s)) return 'csq';
    if (/tec eurolab|eurolab/.test(s)) return 'altro';
    const allowed = ['tuv', 'bv', 'dnv', 'rina', 'imq', 'iqn', 'csq', 'altro'];
    return allowed.includes(s) ? s : 'altro';
}

const {
    normalizeMaterialGroupCode: normalizeMaterialGroupFromCatalog,
} = require('../data/materialGroups15608');

function normalizeMaterialGroupCode(val) {
    const s = repairTextEncoding(String(val || ''));
    return normalizeMaterialGroupFromCatalog(s) || (s || null);
}

function normalizeIngestSelectFields(fields) {
    if (!fields || typeof fields !== 'object') return fields;
    const out = repairDeep({ ...fields });
    if (out.welding_process != null) {
        out.welding_process = normalizeWeldingProcessCode(out.welding_process) || out.welding_process;
    }
    if (out.joint_type != null) {
        out.joint_type = normalizeJointTypeCode(out.joint_type) || out.joint_type;
    }
    if (out.issuing_body != null) {
        out.issuing_body = normalizeIssuingBodyCode(out.issuing_body) || out.issuing_body;
    }
    if (out.material_group != null) {
        out.material_group = normalizeMaterialGroupCode(out.material_group) || out.material_group;
    }
    return out;
}

module.exports = {
    repairTextEncoding,
    repairDeep,
    normalizeWeldingProcessCode,
    normalizeJointTypeCode,
    normalizeIssuingBodyCode,
    normalizeMaterialGroupCode,
    normalizeIngestSelectFields,
};
