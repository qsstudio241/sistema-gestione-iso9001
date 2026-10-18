/**
 * wpqrCompleteness.pack.js — famiglia «completezza» WPQR (15614-1 BW/FW/UNKNOWN, 15614-2, 14555).
 * Piano: PLAN_VERIFICA_WPQR_SLICES.md § 5.1 (WV-5a).
 *
 * Domanda: i campi che la norma pretende sul certificato sono presenti?
 * Nessuna soglia di range: solo presenza. Gli esiti non bloccano e non propongono valori da scrivere.
 * Prefissi finding: `WPQR15614_1.COMP.*`, `WPQR15614_2.COMP.*`, `WPQR14555.COMP.*`.
 * Modulo puro: nessun DB, nessun fs.
 */

'use strict';

const {
    FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding,
} = require('../findingTypes');
const { isDiameterEssentialVariable } = require('../../../data/weldingQualificationRules15614');
const { STANDARD_FAMILY } = require('../wpqrRecordView');

const EXTRACT_REF = 'docs/reference/WPQR-dati-prova-pagina-2-estratto.md';
const STUD_PROCESS_CODES = new Set(['783', '784', '785', '786']);
const CD_STUD_CODES = new Set(['785', '786']);
const NO_FILLER_PROCESSES = new Set(['142', '311']);
const NONE_RE = /^(?:none|nessuno|nessuna|no|n\.?\s?a\.?|--)$/i;

const FAMILY_META = {
    [STANDARD_FAMILY.WPQR_15614_1]: {
        prefix: 'WPQR15614_1.COMP.',
        norm: 'ISO 15614-1',
        edition: '2017+A1:2019',
        ref: `docs/Normative/Normative NORMA_00043_ BS EN ISO 15614-1_2017_A1_2019 Rev. 0.md; ${EXTRACT_REF}`,
    },
    [STANDARD_FAMILY.WPQR_15614_2]: {
        prefix: 'WPQR15614_2.COMP.',
        norm: 'ISO 15614-2',
        edition: '2025',
        ref: `docs/Normative/Normative NORMA_00031_ UNI EN ISO 15614-2_2025 Rev. 0.md; ${EXTRACT_REF}`,
    },
    [STANDARD_FAMILY.WPQR_14555]: {
        prefix: 'WPQR14555.COMP.',
        norm: 'ISO 14555',
        edition: '2025',
        ref: `docs/Normative/Normative NORMA_00033_ BS EN ISO 14555_2025 Rev. 0.md; ${EXTRACT_REF}`,
    },
};

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isNone = (v) => !isBlank(v) && NONE_RE.test(String(v).trim());
const isStud = (view) => view.standard && view.standard.family === STANDARD_FAMILY.WPQR_14555;
const isAutogenous = (code) => code && NO_FILLER_PROCESSES.has(code);
const isArc = (view) => !isStud(view)
    && !STUD_PROCESS_CODES.has(view.welding_process_code)
    && !isAutogenous(view.welding_process_code);

function processCodesOn(view) {
    const out = [];
    if (view.welding_process_code) out.push(view.welding_process_code);
    for (const r of view.runs || []) {
        if (r.welding_process_code) out.push(r.welding_process_code);
    }
    return out;
}

function fillerNotRequired(view) {
    const codes = processCodesOn(view);
    return codes.length > 0 && codes.every(isAutogenous);
}

function fillerPresentOnCertificate(view) {
    if (!isBlank(view.filler_material) || !isBlank(view.filler_material_key)) return true;
    return (view.runs || []).some((r) => !isBlank(r.filler_designation) || !isBlank(r.filler_make));
}

function currentTypePresentOnCertificate(view) {
    if (!isBlank(view.current_type) || !isBlank(view.current_type_canonical)) return true;
    return (view.runs || []).some((r) => !isBlank(r.polarity_effective));
}

function diameterIsEssential(view) {
    if (isStud(view)) return false;
    if (view.standard && view.standard.family === STANDARD_FAMILY.WPQR_15614_2) return true;
    return isDiameterEssentialVariable(view.level);
}

function diameterClause(view) {
    return view.standard && view.standard.family === STANDARD_FAMILY.WPQR_15614_2 ? '§8.3.2.4' : '§8.3.3';
}

function metaOf(view) {
    return FAMILY_META[view.standard && view.standard.family] || FAMILY_META[STANDARD_FAMILY.WPQR_15614_1];
}

function sourceOf(view, clause) {
    const m = metaOf(view);
    return {
        norm: m.norm,
        edition: m.edition,
        clause,
        text_status: TEXT_STATUS.ESTRATTO,
        ref: m.ref,
    };
}

function allCodes(suffix) {
    return Object.values(FAMILY_META).map((m) => m.prefix + suffix);
}

function rule(suffix, run) {
    return {
        id: FAMILY_META[STANDARD_FAMILY.WPQR_15614_1].prefix + suffix,
        family: FAMILY.COMPLETEZZA,
        codes: allCodes(suffix),
        run,
    };
}

function missingFinding(view, {
    suffix, field, fields, severity, clause, label, note = '', status = STATUS.VERIFICABILE,
}) {
    const m = metaOf(view);
    return makeFinding({
        code: m.prefix + suffix,
        family: FAMILY.COMPLETEZZA,
        severity,
        status,
        field,
        fields,
        direction: DIRECTION.MISSING,
        read_value: null,
        expected_value: null,
        source: sourceOf(view, clause),
        message_it: status === STATUS.NON_VERIFICABILE_DATO_MANCANTE
            ? `${label}: controllo non eseguibile, ${note} (${m.norm} ${clause}).`
            : `${label}: dato ${severity === SEVERITY.WARN ? 'richiesto' : 'previsto'} dalla norma assente sul certificato (${m.norm} ${clause}).${note ? ` ${note}` : ''}`,
    });
}

function infoFinding(view, {
    suffix, field, fields, clause, message, read_value = null, status = STATUS.VERIFICABILE,
    direction = null,
}) {
    const m = metaOf(view);
    const cited = message.includes(clause) ? message : `${message} (${m.norm} ${clause}).`;
    return makeFinding({
        code: m.prefix + suffix,
        family: FAMILY.COMPLETEZZA,
        severity: SEVERITY.INFO,
        status,
        field,
        fields,
        direction,
        read_value,
        expected_value: null,
        source: sourceOf(view, clause),
        message_it: cited,
    });
}

function tempPresent(slot) {
    if (!slot) return false;
    if (slot.none) return true;
    if (isNum(slot.value)) return true;
    return !isBlank(slot.text);
}

function heatInputPresent(view) {
    if (!isBlank(view.heat_input_note)) return true;
    if (isNum(view.heat_input_range_min) || isNum(view.heat_input_range_max)) return true;
    return (view.runs || []).some((r) => isNum(r.heat_input_value));
}

function processPresent(view) {
    return !isBlank(view.welding_process) || !isBlank(view.welding_process_code)
        || (view.runs || []).some((r) => !isBlank(r.welding_process) || !isBlank(r.welding_process_code));
}

const RULES = [
    rule('PROCESS', (view) => {
        if (processPresent(view)) return [];
        return [missingFinding(view, {
            suffix: 'PROCESS',
            field: 'welding_process',
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.4, §10.4' : '§8.4.1, §9',
            label: isStud(view) ? 'Processo di saldatura stud' : 'Processo di saldatura',
        })];
    }),

    rule('POSITIONS', (view) => {
        if ((view.positions || []).length > 0 || !isBlank(view.welding_position_test)) return [];
        return [missingFinding(view, {
            suffix: 'POSITIONS',
            field: 'welding_positions',
            fields: ['welding_positions', 'welding_position_test'],
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.5.2, §10.2.8.9' : '§8.4.2, §9',
            label: 'Posizioni di saldatura',
        })];
    }),

    rule('FILLER', (view) => {
        if (isStud(view) || !isArc(view) || fillerNotRequired(view)) return [];
        if (fillerPresentOnCertificate(view)) return [];
        return [missingFinding(view, {
            suffix: 'FILLER',
            field: 'filler_material',
            severity: SEVERITY.WARN,
            clause: '§8.4.4, §9',
            label: 'Designazione del materiale d\'apporto',
        })];
    }),

    rule('MATERIAL_GROUP', (view) => {
        if (!isBlank(view.material_group)) return [];
        return [missingFinding(view, {
            suffix: 'MATERIAL_GROUP',
            field: 'material_group',
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.3.1, §10.2.8.4' : '§8.3.1, §9',
            label: isStud(view) ? 'Gruppo del materiale base (parent)' : 'Gruppo del materiale base',
        })];
    }),

    rule('THICKNESS', (view) => {
        if (isNum(view.thickness_tested) || isNum(view.throat_test_mm) || isNum(view.deposited_thickness_mm)) {
            return [];
        }
        return [missingFinding(view, {
            suffix: 'THICKNESS',
            field: 'thickness_tested',
            fields: ['thickness_tested', 'throat_test_mm', 'deposited_thickness_mm'],
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.3.2, §10.2.8.6' : '§8.3.2, §9',
            label: 'Spessore del provino di prova',
        })];
    }),

    rule('DIAMETER', (view) => {
        if (isStud(view)) return [];
        if (view.product_type === 'P') return [];
        if (!diameterIsEssential(view)) return [];
        const fields = ['diameter_test_mm', 'diameter_min', 'diameter_max', 'product_type'];
        const clause = diameterClause(view);
        const label = 'Diametro esterno del tubo di prova';
        if (view.product_type == null) {
            return [missingFinding(view, {
                suffix: 'DIAMETER',
                field: 'product_type',
                fields,
                severity: SEVERITY.INFO,
                clause,
                label,
                status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
                note: view.standard.family === STANDARD_FAMILY.WPQR_15614_2
                    ? 'tipo di prodotto non dichiarato: il diametro è richiesto per i tubi (Tab. 7)'
                    : 'tipo di prodotto non dichiarato: il diametro è variabile essenziale solo per i tubi in Level 2',
            })];
        }
        if (view.product_type !== 'T' && view.product_type !== 'P+T') return [];
        if (isNum(view.diameter_test_mm) || isNum(view.diameter_min) || isNum(view.diameter_max)) return [];
        return [missingFinding(view, {
            suffix: 'DIAMETER',
            field: 'diameter_test_mm',
            fields,
            severity: SEVERITY.WARN,
            clause,
            label,
        })];
    }),

    rule('CURRENT_TYPE', (view) => {
        if (!isArc(view) || fillerNotRequired(view)) return [];
        if (currentTypePresentOnCertificate(view)) return [];
        return [missingFinding(view, {
            suffix: 'CURRENT_TYPE',
            field: 'current_type',
            severity: SEVERITY.WARN,
            clause: '§8.4.6, ISO 15609-1 §4.4.9',
            label: 'Tipo di corrente e polarità',
        })];
    }),

    rule('PREHEAT', (view) => {
        if (tempPresent(view.preheat_test)) return [];
        return [missingFinding(view, {
            suffix: 'PREHEAT',
            field: 'preheat_temp_test',
            fields: ['preheat_temp_test', 'preheat_temp'],
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.11 a, §10.2.8.11' : '§8.4.8',
            label: 'Temperatura di preriscaldo di prova',
        })];
    }),

    rule('INTERPASS', (view) => {
        if (isStud(view)) return [];
        if (tempPresent(view.interpass_test)) return [];
        return [missingFinding(view, {
            suffix: 'INTERPASS',
            field: 'interpass_temp_test',
            fields: ['interpass_temp_test', 'interpass_temp'],
            severity: SEVERITY.INFO,
            clause: '§8.4.9',
            label: 'Temperatura di interpass di prova',
        })];
    }),

    rule('HEAT_INPUT_KIND', (view) => {
        if (isStud(view)) return [];
        if (!heatInputPresent(view)) return [];
        if (!isBlank(view.heat_input_kind) || !isBlank(view.heat_input_kind_read)) return [];
        return [infoFinding(view, {
            suffix: 'HEAT_INPUT_KIND',
            field: 'heat_input_kind',
            fields: ['heat_input_kind', 'heat_input_note'],
            clause: '§8.4.7',
            read_value: view.heat_input_note,
            direction: DIRECTION.MISSING,
            message: `Tipo di calcolo dell'apporto termico (heat input / arc energy) non indicato, pur essendo presente un valore: da documentare (${metaOf(view).norm} §8.4.7).`,
        })];
    }),

    rule('LEVEL', (view) => {
        if (view.standard.family !== STANDARD_FAMILY.WPQR_15614_1) return [];
        if (view.level_declared) return [];
        return [infoFinding(view, {
            suffix: 'LEVEL',
            field: 'qualification_level',
            clause: 'National foreword',
            read_value: null,
            message: 'Livello 1/2 non dichiarato sul certificato: applicato Level 2.',
        })];
    }),

    rule('NORMALIZATION', (view) => {
        const items = view.normalization || [];
        if (!items.length) return [];
        return items.map((item) => infoFinding(view, {
            suffix: 'NORMALIZATION',
            field: item.field,
            clause: item.field === 'current_type' ? '§8.4.6' : (item.field === 'filler_material' ? '§8.4.4' : '§9'),
            read_value: item.read,
            message: `Grafia non canonica di ${item.field} («${item.read}»): in verifica si usa «${item.canonical}», il dato sul certificato non viene modificato.`,
        }));
    }),

    rule('BACKING_GAS', (view) => {
        if (isStud(view)) return [];
        if (!isBlank(view.backing_gas) || isNone(view.backing_gas)) return [];
        return [missingFinding(view, {
            suffix: 'BACKING_GAS',
            field: 'backing_gas',
            severity: SEVERITY.INFO,
            clause: '§8.5.6',
            label: 'Gas di protezione al rovescio',
        })];
    }),

    rule('POST_HEATING', (view) => {
        if (isStud(view)) return [];
        if (!isBlank(view.post_heating) || isNone(view.post_heating)) return [];
        return [missingFinding(view, {
            suffix: 'POST_HEATING',
            field: 'post_heating',
            severity: SEVERITY.INFO,
            clause: '§8.4.10',
            label: 'Post-heating',
        })];
    }),

    rule('PWHT_DETAILS', (view) => {
        if (!view.pwht) return [];
        if (!isBlank(view.pwht_details)) return [];
        return [missingFinding(view, {
            suffix: 'PWHT_DETAILS',
            field: 'pwht_details',
            fields: ['pwht', 'pwht_details'],
            severity: SEVERITY.WARN,
            clause: isStud(view) ? '§9.12' : '§8.4.11',
            label: 'Dettagli del trattamento termico post-saldatura (PWHT)',
        })];
    }),

    rule('RUNS_PRESENT', (view) => {
        if (view.runs_archived) return [];
        return [infoFinding(view, {
            suffix: 'RUNS_PRESENT',
            field: 'runs',
            clause: isStud(view) ? '§10.4, Annex C' : '§9, Annex B',
            status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
            direction: DIRECTION.MISSING,
            message: `Nessuna passata di prova archiviata: i controlli sui parametri di saldatura non sono eseguibili (${metaOf(view).norm} ${isStud(view) ? '§10.4, Annex C' : '§9, Annex B'}). Completare da Rielaborazioni se il PDF è conservato.`,
        })];
    }),

    rule('RUN_FIELDS', (view) => {
        const runs = view.runs || [];
        if (!runs.length) return [];
        const out = [];
        const m = metaOf(view);
        const clause = isStud(view) ? '§9.10, Annex C' : '§9, ISO 15609-1 §4.4.8–§4.4.9, Annex B';

        const pushMissing = (run, index, field, severity, label) => {
            out.push(makeFinding({
                code: m.prefix + 'RUN_FIELDS',
                family: FAMILY.COMPLETEZZA,
                severity,
                status: STATUS.VERIFICABILE,
                field: 'runs',
                fields: [`runs[${index}].${field}`],
                direction: DIRECTION.MISSING,
                read_value: run.run_label || String(index + 1),
                expected_value: null,
                source: sourceOf(view, clause),
                message_it: `Passata ${run.run_label || (index + 1)}: ${label} assente sul certificato (${m.norm} ${clause}).`,
            }));
        };

        runs.forEach((run, index) => {
            if (isStud(view)) {
                const code = run.welding_process_code || view.welding_process_code;
                if (CD_STUD_CODES.has(code)) {
                    if (!isNum(run.charging_voltage_v)) pushMissing(run, index, 'charging_voltage_v', SEVERITY.WARN, 'tensione di carica');
                    if (!isNum(run.capacitance_mf)) pushMissing(run, index, 'capacitance_mf', SEVERITY.INFO, 'capacità');
                } else {
                    if (!isNum(run.current_a)) pushMissing(run, index, 'current_a', SEVERITY.WARN, 'corrente di saldatura');
                    if (!isNum(run.weld_time_ms)) pushMissing(run, index, 'weld_time_ms', SEVERITY.WARN, 'tempo di saldatura');
                    if (!isNum(run.protrusion_mm)) pushMissing(run, index, 'protrusion_mm', SEVERITY.INFO, 'sporgenza (protrusion)');
                    if (!isNum(run.lift_mm)) pushMissing(run, index, 'lift_mm', SEVERITY.INFO, 'alzata (lift)');
                }
                return;
            }

            if (isBlank(run.welding_process) && isBlank(run.welding_process_code)) {
                pushMissing(run, index, 'welding_process', SEVERITY.WARN, 'processo della passata');
            }
            const runCode = run.welding_process_code || view.welding_process_code;
            if (!isAutogenous(runCode)) {
                if (!isNum(run.current_a)) pushMissing(run, index, 'current_a', SEVERITY.WARN, 'corrente');
                if (!isNum(run.voltage_v)) pushMissing(run, index, 'voltage_v', SEVERITY.WARN, 'tensione');
                if (!isNum(run.filler_diameter_mm)) {
                    pushMissing(run, index, 'filler_diameter_mm', SEVERITY.WARN, 'diametro del materiale d\'apporto');
                }
                if (isBlank(run.polarity_effective)) {
                    pushMissing(run, index, 'current_polarity', SEVERITY.WARN, 'polarità (né in riga né in testata)');
                }
            }
            if (!isNum(run.travel_speed)) {
                pushMissing(run, index, 'travel_speed', SEVERITY.INFO, 'velocità di avanzamento');
            } else if (isBlank(run.travel_speed_unit)) {
                pushMissing(run, index, 'travel_speed_unit', SEVERITY.INFO, 'unità della velocità di avanzamento (valore presente)');
            }
            if (!isNum(run.heat_input_value)) {
                pushMissing(run, index, 'heat_input_value', SEVERITY.INFO, 'apporto termico');
            } else if (isBlank(run.heat_input_unit)) {
                pushMissing(run, index, 'heat_input_unit', SEVERITY.INFO, 'unità dell\'apporto termico (valore presente)');
            }
            // wire_feed_speed: mai warn (0/18 nel campione): non si emette finding
        });
        return out;
    }),
];

module.exports = {
    id: 'wpqr.completeness',
    standardFamily: '15614-1',
    editions: ['2017', '2017+A1:2019'],
    profiles: ['15614-1:BW', '15614-1:FW', '15614-1:UNKNOWN', '15614-2:BW', '15614-2:FW', '14555:SW'],
    rules: RULES,
};
