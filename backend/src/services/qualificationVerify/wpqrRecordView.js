/**
 * wpqrRecordView.js — vista canonica di una WPQR per le regole di verifica.
 *
 * Normalizza due ingressi diversi nello stesso oggetto:
 * - `review`: review-fields dell'ingest WPQR (`mapPipelineFieldsToReview`: `thickness_test_mm`,
 *   `material_group`, `approval_date`, `test_runs[]`, …);
 * - `db`: riga `wpqr_records` (`thickness_tested`, `base_material_group`, `issue_date`, …) più le
 *   passate `wpqr_test_runs` passate a parte (`opts.runs` o `input.runs`).
 * Chiavi assenti (colonne non ancora migrate, campi non estratti) = `null`: mai un errore.
 *
 * Solo normalizzazione IN MEMORIA: l'input non viene mutato né riscritto, nessuna conversione di
 * unità è persistita. Dato non determinabile (es. `pwht` = 0, `product_type` NULL) → elencato in
 * `not_determinable`, mai interpretato come «no».
 * Puro: nessun DB, nessun fs.
 */

'use strict';

const { toNumericOrNull } = require('../../utils/numericSanitizer');
const { getJointTypeProfile } = require('../../data/jointTypeProfiles');
const { normalizeWeldingProcessCode } = require('../../data/weldingProcesses4063');

const SOURCE = Object.freeze({ REVIEW: 'review', DB: 'db' });

const STANDARD_FAMILY = Object.freeze({
    WPQR_15614_1: '15614-1',
    WPQR_15614_2: '15614-2',
    WPQR_14555: '14555',
});

const DEFAULT_LEVEL = 2;

/** Grafie di edizione non canoniche → edizione canonica (solo in memoria, per famiglia). */
const EDITION_ALIASES = Object.freeze({
    [STANDARD_FAMILY.WPQR_15614_1]: { 2019: '2017+A1:2019', 2012: '2004+A2:2012' },
});

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

function toBool(v) {
    if (v === true || v === 1) return true;
    if (typeof v === 'string') return ['1', 'true', 'si', 'sì'].includes(v.trim().toLowerCase());
    return false;
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

const round6 = (n) => Math.round(n * 1e6) / 1e6;

// ---------------------------------------------------------------------------
// Norma, edizione, livello, profilo
// ---------------------------------------------------------------------------

/**
 * Edizione dopo il numero di norma: «:2017», «:2017+A1:2019», «2017/A1 2019», «2004 + A2:2012».
 * Edizione canonica = anno base, con l'emendamento se dichiarato.
 */
function extractEdition(rest) {
    const m = /^[\s:\-\u2013(/,.]*((?:19|20)\d{2})(?!\d)(?:\s*(?:\+|\/|,)?\s*A\s?(\d)\s*[:\-]?\s*((?:19|20)\d{2})(?!\d))?/i
        .exec(String(rest || ''));
    if (!m) return null;
    return m[2] ? `${m[1]}+A${m[2]}:${m[3]}` : m[1];
}

function canonicalEdition(family, edition) {
    if (!edition) return null;
    const aliases = EDITION_ALIASES[family];
    return (aliases && aliases[edition]) || edition;
}

/**
 * Riconosce norma ed edizione da un testo libero. `family` è valorizzata solo per le norme con
 * pack (15614-1, 15614-2, 14555); 15614-N (N ≠ 1, 2) e 15614 senza parte sono riconosciute ma
 * senza fonte (`family: null`, `label`).
 * @returns {{family: string|null, edition: string|null, label: string, edition_read: string|null}|null}
 */
function detectWpqrStandard(text) {
    const s = toText(text);
    if (!s) return null;

    let m = /15614[\s\-\u2013]*(\d{1,2})(?!\d)/i.exec(s);
    if (m) {
        const part = m[1];
        const edition_read = extractEdition(s.slice(m.index + m[0].length));
        if (part === '1' || part === '2') {
            const family = part === '1' ? STANDARD_FAMILY.WPQR_15614_1 : STANDARD_FAMILY.WPQR_15614_2;
            return {
                family, edition: canonicalEdition(family, edition_read), label: `ISO 15614-${part}`, edition_read,
            };
        }
        return {
            family: null, edition: edition_read, label: `ISO 15614-${part}`, edition_read,
        };
    }

    m = /14555(?!\d)/.exec(s);
    if (m) {
        const edition_read = extractEdition(s.slice(m.index + m[0].length));
        return {
            family: STANDARD_FAMILY.WPQR_14555, edition: edition_read, label: 'ISO 14555', edition_read,
        };
    }

    m = /15614(?!\d)/.exec(s);
    if (m) return { family: null, edition: null, label: 'ISO 15614', edition_read: null };

    return null;
}

function detect15613(text) {
    const s = toText(text);
    const m = s && /15613(?!\d)/.exec(s);
    if (!m) return null;
    return { label: 'ISO 15613', edition: extractEdition(s.slice(m.index + m[0].length)) };
}

/**
 * Norma/edizione del record. `standard_reference` vince; per una qualifica ISO 15613 la parte
 * 15614 con cui sono espressi i range è quella di `range_standard_reference` (15613 §8). Un record
 * stud senza norma leggibile (`qualifying_element` stud/both) è 14555.
 */
function resolveWpqrStandard({ standard_reference: ref, range_standard_reference: rangeRef, qualifying_element: element }) {
    const raw = toText(ref);
    let found = detectWpqrStandard(ref);
    let via = found ? 'standard_reference' : null;
    const qualification_standard = detect15613(ref);
    let range_part_missing = false;

    if (!found && (qualification_standard || !raw)) {
        found = detectWpqrStandard(rangeRef);
        if (found) via = 'range_standard_reference';
        else if (qualification_standard) range_part_missing = true;
    }
    if (!found && !range_part_missing && (element === 'stud' || element === 'both')) {
        found = {
            family: STANDARD_FAMILY.WPQR_14555, edition: null, label: 'ISO 14555', edition_read: null,
        };
        via = 'qualifying_element';
    }

    const standard = found
        ? {
            family: found.family, edition: found.edition, label: found.label, raw, edition_read: found.edition_read, via,
        }
        : {
            family: null, edition: null, label: null, raw, edition_read: null, via: null,
        };
    return { standard, qualification_standard, range_part_missing };
}

function resolveJointType(v) {
    const profile = getJointTypeProfile(v);
    if (profile) return profile.key;
    const s = toText(v);
    if (!s) return null;
    if (/^(?:butt|testa)/i.test(s)) return 'BW';
    if (/^(?:fillet|angol)/i.test(s)) return 'FW';
    return null;
}

/**
 * Chiave profilo del registry: `15614-1:BW|FW|UNKNOWN`, `15614-2:BW|FW`, `14555:SW`.
 * `null` se norma non coperta o 15614-2 senza tipo giunto leggibile.
 */
function resolveWpqrProfile(standard, jointType) {
    const family = standard && standard.family;
    if (family === STANDARD_FAMILY.WPQR_14555) return '14555:SW';
    if (family === STANDARD_FAMILY.WPQR_15614_1) return `15614-1:${jointType || 'UNKNOWN'}`;
    if (family === STANDARD_FAMILY.WPQR_15614_2) return jointType ? `15614-2:${jointType}` : null;
    return null;
}

/**
 * Livello 15614-1: dichiarato sul certificato; assente → Level 2 (National foreword NORMA_00043).
 * Altre famiglie: nessun livello.
 */
function resolveLevel(family, levelText, ...fallbackTexts) {
    if (family !== STANDARD_FAMILY.WPQR_15614_1) return { level: null, level_declared: false };
    const read = (t) => {
        const s = toText(t);
        if (!s) return null;
        const m = /^(?:level|livello|lev\.?|l)?\s*([12])$/i.exec(s) || /(?:level|livello)\s*([12])(?!\d)/i.exec(s);
        return m ? Number(m[1]) : null;
    };
    const declared = read(levelText) ?? fallbackTexts.map(read).find((n) => n != null) ?? null;
    return declared != null
        ? { level: declared, level_declared: true }
        : { level: DEFAULT_LEVEL, level_declared: false };
}

// ---------------------------------------------------------------------------
// Valori canonici (solo in memoria)
// ---------------------------------------------------------------------------

/** Tipo di corrente/polarità: DC-EP / DCEP / DC+ → `DCEP`; DC-EN / DC- → `DCEN`; `DC`; `AC`. Altro → `null`. */
function canonicalCurrent(v) {
    const s = toText(v);
    if (!s) return null;
    const k = s.toUpperCase().replace(/[\s()/_.]/g, '');
    if (/^DC-?EP$|^DC\+$|^DC-?POS(?:ITIVE|ITIVA)?$/.test(k)) return 'DCEP';
    if (/^DC-?EN$|^DC-$|^DC-?NEG(?:ATIVE|ATIVA)?$/.test(k)) return 'DCEN';
    if (k === 'DC') return 'DC';
    if (k === 'AC') return 'AC';
    return null;
}

const OK_RESULT = /^(?:ok|pass(?:ed)?|acceptable|satisfactory|accettabile(?:\s*\/\s*satisfactory)?|conforme|positivo|satisfactory\s*\/\s*accettabile|accettabile\s*\/\s*acceptable)$/i;
const KO_RESULT = /^(?:ko|fail(?:ed)?|not\s+(?:acceptable|satisfactory)|non\s+(?:accettabile|conforme|soddisfacente)|negativo)$/i;

/** Esito di prova: `OK`/`KO` solo se scritti; ogni altra grafia (`Not required`, `--`, `N.A.`) è `NA`, mai un KO dedotto. */
function canonicalResult(v) {
    const s = toText(v);
    if (!s) return null;
    if (OK_RESULT.test(s)) return 'OK';
    if (KO_RESULT.test(s)) return 'KO';
    return 'NA';
}

function canonicalProductType(v) {
    const s = toText(v);
    if (!s) return null;
    const k = s.toUpperCase().replace(/\s+/g, '');
    if (['P', 'PLATE', 'PIASTRA', 'LAMIERA'].includes(k)) return 'P';
    if (['T', 'TUBE', 'PIPE', 'TUBO'].includes(k)) return 'T';
    if (['P+T', 'PT', 'BOTH', 'ENTRAMBI'].includes(k)) return 'P+T';
    return null;
}

function canonicalHeatInputKind(v) {
    const s = toText(v);
    if (!s) return null;
    const k = s.toLowerCase().replace(/[\s_-]+/g, '');
    if (k === 'heatinput') return 'heat_input';
    if (k === 'arcenergy') return 'arc_energy';
    return null;
}

function canonicalElement(v) {
    const s = toText(v);
    return s ? s.toLowerCase() : null;
}

const HEAT_INPUT_TO_KJ_MM = { 'kj/mm': 1, 'j/mm': 0.001, 'kj/cm': 0.1, 'j/cm': 0.0001 };
const TRAVEL_SPEED_TO_MM_S = {
    'mm/s': 1, 'cm/s': 10, 'mm/min': 1 / 60, 'cm/min': 10 / 60, 'm/min': 1000 / 60,
};

function convertUnit(value, unit, table) {
    if (value == null || isBlank(unit)) return null;
    const factor = table[String(unit).trim().toLowerCase().replace(/\s+/g, '')];
    return factor == null ? null : round6(value * factor);
}

/** Preheat/interpass di prova: colonna numerica, con ripiego sul testo di testata (record senza colonne nuove). */
function testTemperature(column, text) {
    const value = toNumericOrNull(column);
    const t = toText(text);
    const none = t != null && /^(?:none|nessuno|nessuna|no)$/i.test(t);
    if (value != null) return { value, text: t, source: 'test_column', none: false };
    if (t != null) return { value: null, text: t, source: 'text_fallback', none };
    return { value: null, text: null, source: null, none: false };
}

function normalizeRun(raw, headerCurrent) {
    const r = raw && typeof raw === 'object' ? raw : {};
    const label = toText(r.run_label ?? r.run_no ?? r.run);
    const intMatch = label && /\d+/.exec(label);
    const polarityRaw = toText(r.current_polarity ?? r.polarity);
    const polarityCanon = canonicalCurrent(polarityRaw);
    const headerCanon = canonicalCurrent(headerCurrent);

    let polarityEffective = null;
    let polaritySource = null;
    if (polarityCanon || polarityRaw) {
        polarityEffective = polarityCanon || polarityRaw;
        polaritySource = 'run';
    } else if (headerCanon || toText(headerCurrent)) {
        polarityEffective = headerCanon || toText(headerCurrent);
        polaritySource = 'header';
    }

    const num = (k) => toNumericOrNull(r[k]);
    const travel = num('travel_speed');
    const heat = num('heat_input_value');
    const process = toText(r.welding_process);

    return {
        run_no: r.run_no != null && toNumericOrNull(r.run_no) != null
            ? Math.trunc(toNumericOrNull(r.run_no))
            : (intMatch ? Number(intMatch[0]) : null),
        run_label: label,
        welding_process: process,
        welding_process_code: normalizeWeldingProcessCode(process),
        filler_diameter_mm: num('filler_diameter_mm'),
        filler_designation: toText(r.filler_designation),
        filler_make: toText(r.filler_make),
        current_a: num('current_a'),
        voltage_v: num('voltage_v'),
        current_polarity: polarityRaw,
        current_polarity_canonical: polarityCanon,
        polarity_effective: polarityEffective,
        polarity_source: polaritySource,
        wire_feed_speed: num('wire_feed_speed'),
        wire_feed_unit: toText(r.wire_feed_unit),
        travel_speed: travel,
        travel_speed_unit: toText(r.travel_speed_unit),
        travel_speed_mm_s: convertUnit(travel, r.travel_speed_unit, TRAVEL_SPEED_TO_MM_S),
        heat_input_value: heat,
        heat_input_unit: toText(r.heat_input_unit),
        heat_input_kj_mm: convertUnit(heat, r.heat_input_unit, HEAT_INPUT_TO_KJ_MM),
        metal_transfer: toText(r.metal_transfer),
        weld_time_ms: num('weld_time_ms'),
        protrusion_mm: num('protrusion_mm'),
        lift_mm: num('lift_mm'),
        capacitance_mf: num('capacitance_mf'),
        charging_voltage_v: num('charging_voltage_v'),
        gap_lift_mm: num('gap_lift_mm'),
        spring_force_n: num('spring_force_n'),
        remarks: toText(r.remarks),
        source: toText(r.source),
    };
}

// ---------------------------------------------------------------------------

const TEXT_FIELDS = [
    'certificate_number', 'welding_process', 'material_group_2', 'base_material_spec', 'base_material_spec_2',
    'filler_make', 'filler_size', 'shielding_gas', 'backing_gas', 'metal_transfer', 'mechanization',
    'single_multi_run', 'heat_input_note', 'heat_input_range_unit', 'heat_input_range_basis', 'preheat_temp',
    'interpass_temp', 'post_heating', 'pwht_details', 'wps_ref', 'welding_position_test', 'welder_name',
    'joint_preparation', 'cleaning_method', 'bead_technique',
];
const NUMERIC_FIELDS = [
    'thickness_min', 'thickness_max', 'thickness_t1_min', 'thickness_t1_max', 'thickness_t2_min', 'thickness_t2_max',
    'thickness_t2_test_mm', 'deposited_thickness_mm', 'throat_test_mm', 'diameter_min', 'diameter_max',
    'diameter_test_mm', 'heat_input_range_min', 'heat_input_range_max', 'heat_input_tol_minus_pct',
    'heat_input_tol_plus_pct', 'shielding_gas_flow_l_min_min', 'shielding_gas_flow_l_min_max',
    'nozzle_diameter_mm', 'contact_tube_distance_mm_min', 'contact_tube_distance_mm_max', 'torch_angle_deg',
];
const BOOL_FIELDS = [
    'thickness_max_unlimited', 'thickness_t1_max_unlimited', 'thickness_t2_max_unlimited',
    'heat_input_plus_unlimited', 'rotated_position',
];
const DATE_FIELDS = ['test_date', 'expiry_date'];
const RESULT_FIELDS = [
    'vt_result', 'rt_result', 'ut_result', 'mt_result', 'pt_result',
    'tensile_result', 'bend_result', 'impact_result', 'hardness_result', 'macro_result',
];

const ALIASES = {
    standard_reference: ['standard_reference', 'standard_ref'],
    thickness_test: { review: ['thickness_test_mm', 'thickness_tested'], db: ['thickness_tested', 'thickness_test_mm'] },
    material_group: { review: ['material_group', 'base_material_group'], db: ['base_material_group', 'material_group'] },
    issue_date: { review: ['approval_date', 'issue_date'], db: ['issue_date', 'approval_date'] },
    examiner_body: ['examiner_body', 'issuing_body', 'testing_body'],
};

const aliasFor = (key, src) => {
    const a = ALIASES[key];
    return Array.isArray(a) ? a : a[src];
};

/**
 * @param {object} input review-fields dell'ingest o riga DB `wpqr_records`
 * @param {{source?: 'review'|'db', runs?: object[]}} [opts] `runs` = righe `wpqr_test_runs` (default `input.runs` / `input.test_runs`)
 */
function toWpqrView(input, { source = SOURCE.REVIEW, runs } = {}) {
    const src = source === SOURCE.DB ? SOURCE.DB : SOURCE.REVIEW;
    const f = input && typeof input === 'object' ? input : {};

    const standard_reference = toText(pick(f, aliasFor('standard_reference', src)));
    const range_standard_reference = toText(f.range_standard_reference);
    const qualifying_element = canonicalElement(f.qualifying_element);
    const { standard, qualification_standard, range_part_missing } = resolveWpqrStandard({
        standard_reference, range_standard_reference, qualifying_element,
    });

    const joint_type = resolveJointType(f.joint_type);
    const { level, level_declared } = resolveLevel(
        standard.family,
        f.qualification_level,
        range_standard_reference,
        standard_reference,
    );
    const product_type = canonicalProductType(f.product_type);
    const pwht = toBool(f.pwht);

    const current_type = toText(f.current_type);
    const current_type_canonical = canonicalCurrent(current_type);
    const runsInput = [runs, f.runs, f.test_runs].find(Array.isArray) || [];
    const normalizedRuns = runsInput.map((r) => normalizeRun(r, current_type));

    const filler_material = toText(f.filler_material);
    const filler_material_key = filler_material ? filler_material.toUpperCase().replace(/[\s\-_/.]+/g, '') : null;

    const normalization = [];
    const editionText = standard.via === 'range_standard_reference' ? range_standard_reference : standard_reference;
    if (standard.edition && editionText
        && !editionText.replace(/\s+/g, '').toLowerCase().includes(standard.edition.toLowerCase())) {
        normalization.push({ field: 'standard_reference', read: editionText, canonical: standard.edition });
    }
    if (current_type && current_type_canonical && current_type !== current_type_canonical) {
        normalization.push({ field: 'current_type', read: current_type, canonical: current_type_canonical });
    }
    if (filler_material && filler_material_key !== filler_material.toUpperCase()) {
        normalization.push({ field: 'filler_material', read: filler_material, canonical: filler_material_key });
    }

    const not_determinable = [];
    if (product_type == null) not_determinable.push('product_type');
    if (!pwht) not_determinable.push('pwht');

    const view = {
        source: src,
        standard,
        qualification_standard,
        range_part_missing,
        profile: resolveWpqrProfile(standard, joint_type),
        level,
        level_declared,
        standard_reference,
        range_standard_reference,
        qualifying_element,
        joint_type,
        product_type,
        pwht,
        not_determinable,
        reference_number: toText(f.reference_number ?? f.wpqr_number ?? f.wpqr_code),
        material_group: toText(pick(f, aliasFor('material_group', src))),
        examiner_body: toText(pick(f, aliasFor('examiner_body', src))),
        issue_date: toDateString(pick(f, aliasFor('issue_date', src))),
        thickness_tested: toNumericOrNull(pick(f, aliasFor('thickness_test', src))),
        positions: toPositions(f.welding_positions),
        welding_process_code: normalizeWeldingProcessCode(f.welding_process),
        filler_material,
        filler_material_key,
        current_type,
        current_type_canonical,
        heat_input_kind: canonicalHeatInputKind(f.heat_input_kind),
        preheat_test: testTemperature(f.preheat_temp_test, f.preheat_temp),
        interpass_test: testTemperature(f.interpass_temp_test, f.interpass_temp),
        results: Object.fromEntries(RESULT_FIELDS.map((k) => [k, canonicalResult(f[k])])),
        runs: normalizedRuns,
        runs_archived: normalizedRuns.length > 0,
        normalization,
    };

    for (const k of TEXT_FIELDS) view[k] = toText(f[k]);
    for (const k of NUMERIC_FIELDS) view[k] = toNumericOrNull(f[k]);
    for (const k of BOOL_FIELDS) view[k] = toBool(f[k]);
    for (const k of DATE_FIELDS) view[k] = toDateString(f[k]);

    return view;
}

module.exports = {
    SOURCE,
    STANDARD_FAMILY,
    DEFAULT_LEVEL,
    toWpqrView,
    detectWpqrStandard,
    resolveWpqrStandard,
    resolveWpqrProfile,
    canonicalCurrent,
    canonicalResult,
};
