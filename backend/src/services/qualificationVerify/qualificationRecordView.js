/**
 * qualificationRecordView.js — vista canonica di una qualifica per le regole di verifica.
 *
 * Normalizza due ingressi diversi nello stesso oggetto:
 * - `review`: campi dell'ingest/review (`welding_positions`, `welding_position`,
 *   `filler_material_group`, `standard_reference`, `pipe_diameter_min_mm`, …);
 * - `db`: riga della tabella `qualifications` (`position_range`, `filler_material`,
 *   `standard_ref`, …).
 * Puro: nessun DB, nessun fs.
 */

'use strict';

const { toNumericOrNull } = require('../../utils/numericSanitizer');
const { getJointTypeProfile, uses9606DimensionalBlock } = require('../../data/jointTypeProfiles');

const SOURCE = Object.freeze({ REVIEW: 'review', DB: 'db' });

const STANDARD_FAMILY = Object.freeze({
    WQ_9606_1: '9606-1',
    WQ_9606_2: '9606-2',
    OP_14732: '14732',
});

// Prima chiave = alias preferito per quell'ingresso; le altre sono fallback.
const ALIASES = {
    standard_reference: { review: ['standard_reference', 'standard_ref'], db: ['standard_ref', 'standard_reference'] },
    qualification_type: { review: ['qualification_type'], db: ['qualification_type'] },
    positions: {
        review: ['welding_positions', 'welding_position', 'position_range'],
        db: ['position_range', 'welding_positions', 'welding_position'],
    },
    filler_material_group: {
        review: ['filler_material_group', 'filler_material'],
        db: ['filler_material', 'filler_material_group'],
    },
    exam_date: { review: ['exam_date', 'issue_date'], db: ['exam_date', 'issue_date'] },
    issuing_body: { review: ['issuing_body', 'examiner_body'], db: ['issuing_body', 'examiner_body'] },
};

const TEXT_FIELDS = [
    'certificate_number', 'welding_process', 'welding_process_test', 'welding_processes_validity',
    'welding_position_test', 'material_group', 'shielding_gas', 'weld_details', 'transfer_mode',
    'qualification_designation', 'examiner_body',
];
const NUMERIC_FIELDS = [
    'thickness_min_mm', 'thickness_max_mm', 'thickness_s_test_mm', 'thickness_t_test_mm',
    'pipe_diameter_min_mm', 'pipe_diameter_max_mm', 'pipe_diameter_test_mm',
];
const DATE_FIELDS = [
    'issue_date', 'expiry_date', 'last_confirmation_date', 'next_confirmation_due', 'revalidation_date',
];

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');

function pick(input, keys) {
    for (const k of keys) {
        if (!isBlank(input[k])) return input[k];
    }
    return null;
}

function toText(v) {
    if (isBlank(v)) return null;
    return String(v).trim();
}

function toDateString(v) {
    if (isBlank(v)) return null;
    if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function toPositions(v) {
    if (isBlank(v)) return [];
    const raw = Array.isArray(v) ? v : String(v).split(/[\s,;]+/);
    const out = [];
    for (const p of raw) {
        const t = String(p).trim().toUpperCase();
        if (t && !out.includes(t)) out.push(t);
    }
    return out;
}

function toBool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') return ['1', 'true', 'si', 'sì'].includes(v.trim().toLowerCase());
    return false;
}

function extractEdition(rest) {
    const m = String(rest || '').match(/^\s*[:\-\u2013(]?\s*((?:19|20)\d{2})(?!\d)/);
    return m ? m[1] : null;
}

/**
 * Riconosce norma ed edizione da un testo libero (`standard_reference` o `qualification_type`).
 * `family` è valorizzata solo per le norme con pack (9606-1, 9606-2, 14732); le norme
 * riconosciute ma senza fonte (EN 287-1, 9606-3/-4/-5) hanno `family: null` e `label`.
 * @returns {{family: string|null, edition: string|null, label: string}|null}
 */
function detectStandard(text) {
    const s = toText(text);
    if (!s) return null;

    let m = /9606[\s-]*([1-5])(?!\d)/i.exec(s);
    if (m) {
        const part = m[1];
        const edition = extractEdition(s.slice(m.index + m[0].length));
        if (part === '1') return { family: STANDARD_FAMILY.WQ_9606_1, edition, label: 'ISO 9606-1' };
        if (part === '2') return { family: STANDARD_FAMILY.WQ_9606_2, edition, label: 'ISO 9606-2' };
        return { family: null, edition, label: `ISO 9606-${part}` };
    }

    m = /14732/.exec(s);
    if (m) {
        return {
            family: STANDARD_FAMILY.OP_14732,
            edition: extractEdition(s.slice(m.index + m[0].length)),
            label: 'ISO 14732',
        };
    }

    m = /\b287[\s-]*1(?!\d)/i.exec(s);
    if (m) {
        return { family: null, edition: extractEdition(s.slice(m.index + m[0].length)), label: 'EN 287-1' };
    }

    return null;
}

/**
 * Norma/edizione del record: `standard_reference` (più specifica, porta l'edizione) vince
 * su `qualification_type` (classificazione dell'ingest, senza edizione).
 */
function resolveStandard({ standard_reference: ref, qualification_type: type } = {}) {
    const found = detectStandard(ref) || detectStandard(type);
    const raw = toText(ref) || toText(type);
    if (!found) return { family: null, edition: null, label: null, raw };
    return { ...found, raw };
}

function resolveJointType(v) {
    const profile = getJointTypeProfile(v);
    return profile ? profile.key : null;
}

/**
 * Chiave profilo del registry: `9606-1:BW|FW|UNKNOWN`, `9606-2:BW|FW`, `14732`.
 * `null` se norma non riconosciuta o 9606-2 senza tipo giunto leggibile.
 */
function resolveProfile(standard, jointType) {
    const family = standard && standard.family;
    if (family === STANDARD_FAMILY.OP_14732) return '14732';
    if (family === STANDARD_FAMILY.WQ_9606_1) return `9606-1:${jointType || 'UNKNOWN'}`;
    if (family === STANDARD_FAMILY.WQ_9606_2) return jointType ? `9606-2:${jointType}` : null;
    return null;
}

/**
 * @param {object} input review-fields o riga DB
 * @param {{source?: 'review'|'db'}} [opts]
 */
function toRecordView(input, { source = SOURCE.REVIEW } = {}) {
    const src = source === SOURCE.DB ? SOURCE.DB : SOURCE.REVIEW;
    const f = input && typeof input === 'object' ? input : {};
    const al = (key) => ALIASES[key][src];

    const standard_reference = toText(pick(f, al('standard_reference')));
    const qualification_type = toText(pick(f, al('qualification_type')));
    const standard = resolveStandard({ standard_reference, qualification_type });
    const joint_type = resolveJointType(f.joint_type);
    const product_type = toText(f.product_type) ? toText(f.product_type).toUpperCase() : null;

    const view = {
        source: src,
        standard,
        profile: resolveProfile(standard, joint_type),
        uses_9606_block: uses9606DimensionalBlock(qualification_type),
        standard_reference,
        qualification_type,
        joint_type,
        product_type,
        positions: toPositions(pick(f, al('positions'))),
        filler_material_group: toText(pick(f, al('filler_material_group'))),
        exam_date: toDateString(pick(f, al('exam_date'))),
        issuing_body: toText(pick(f, al('issuing_body'))),
        thickness_max_unlimited: toBool(f.thickness_max_unlimited),
    };

    for (const k of TEXT_FIELDS) {
        if (!(k in view)) view[k] = toText(f[k]);
    }
    for (const k of NUMERIC_FIELDS) view[k] = toNumericOrNull(f[k]);
    for (const k of DATE_FIELDS) {
        view[k] = k === 'issue_date' ? (toDateString(f.issue_date) || view.exam_date) : toDateString(f[k]);
    }

    return view;
}

module.exports = {
    SOURCE,
    STANDARD_FAMILY,
    toRecordView,
    detectStandard,
    resolveStandard,
    resolveProfile,
};
