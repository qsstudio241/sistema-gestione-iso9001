/**
 * welder9606Completeness.pack.js — famiglia «completezza» ISO 9606-1 (BW / FW / UNKNOWN).
 *
 * Domanda: i campi che la norma pretende sul certificato sono presenti?
 * Fonte: NORMA_00018 (ISO 9606-1:2017; edizioni 2013/2012 con lo stesso testo) — §5.1, §5.2,
 * §5.3, §5.4, §5.5, §5.7, §5.8, §5.9, §9.1, §10, §11, Annex A.
 * Piano: docs/agent-tasks/PLAN_VERIFICA_QUALIFICHE_NORMA_SLICES.md § 4.1.
 *
 * Severità: `warn` solo per un campo richiesto dalla clausola e assente, con clausola citata;
 * taratura VQ-TUNE (06/10/2026, misura su dati reali): `THK_VALIDITY` è `warn` solo se manca il
 * limite minimo e il testo legacy `thickness_range` non lo restituisce; «solo minimo» (convenzione
 * «da X, senza limite») e validità presente solo nel testo legacy sono `info`;
 * `info` per campi non essenziali o di prova. Se manca il dato di contesto (tipo giunto, tipo
 * prodotto, processo di prova) la regola non indovina: emette `non_verificabile_dato_mancante`.
 * Gli esiti non bloccano nulla e non propongono mai un valore da scrivere.
 * Modulo puro: nessun DB, nessun fs.
 */

'use strict';

const {
    FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding,
} = require('../findingTypes');
const { getJointTypeProfile, getVisibleFieldKeys } = require('../../../data/jointTypeProfiles');
const { CONTINUOUS_WIRE_ARC_PROCESSES } = require('../../../data/weldingQualificationRules9606');
const { ISO_4063_PROCESSES, normalizeWeldingProcessCode } = require('../../../data/weldingProcesses4063');

const NORM = 'ISO 9606-1';
const EDITION = '2017';
const SOURCE_REF = 'docs/Normative/Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md; docs/reference/ISO-9606-1-range-validita-patentino.md';
const PREFIX = 'WQ9606_1.COMP.';

/** §5.6 NOTE: per 142 e 311 (senza materiale d'apporto) vale il gruppo del materiale base. */
const NO_FILLER_PROCESSES = ['142', '311'];

/** Processi che la ISO 4063:2023 (NORMA_00044) denomina «inert/active gas» (MIG, MAG, TIG). */
const GAS_SHIELDED_PROCESSES = ISO_4063_PROCESSES
    .filter((p) => /\b(MIG|MAG|TIG)\b/.test(p.labelEn))
    .map((p) => p.code);

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function sourceOf(clause) {
    return {
        norm: NORM,
        edition: EDITION,
        clause,
        text_status: TEXT_STATUS.MD_INTEGRALE,
        ref: SOURCE_REF,
    };
}

function missingFinding({
    code, field, fields, severity, clause, label, note = '',
}) {
    return makeFinding({
        code: PREFIX + code,
        family: FAMILY.COMPLETEZZA,
        severity,
        status: STATUS.VERIFICABILE,
        field,
        fields,
        direction: DIRECTION.MISSING,
        read_value: null,
        expected_value: null,
        source: sourceOf(clause),
        message_it: `${label}: dato ${severity === SEVERITY.WARN ? 'richiesto' : 'previsto'} dalla norma assente sul certificato (${NORM} ${clause}).${note ? ` ${note}` : ''}`,
    });
}

function notVerifiableFinding({
    code, field, fields, clause, label, reason,
}) {
    return makeFinding({
        code: PREFIX + code,
        family: FAMILY.COMPLETEZZA,
        severity: SEVERITY.INFO,
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field,
        fields,
        direction: null,
        read_value: null,
        expected_value: null,
        source: sourceOf(clause),
        message_it: `${label}: controllo non eseguibile, ${reason} (${NORM} ${clause}).`,
    });
}

function rule(code, run) {
    return { id: PREFIX + code, family: FAMILY.COMPLETEZZA, run };
}

/** Codice ISO 4063 del processo di prova (colonna di prova, poi campo legacy `welding_process`). */
function testProcessCode(view) {
    return normalizeWeldingProcessCode(view.welding_process_test)
        || normalizeWeldingProcessCode(view.welding_process)
        || null;
}

/** Campi applicabili al profilo, derivati da jointTypeProfiles (nessuna seconda lista). */
function visibleKeys(view) {
    return getVisibleFieldKeys({
        jointType: view.joint_type,
        productType: view.product_type,
        qualificationType: NORM,
    }).keys;
}

/** Regola «campo semplice sempre richiesto». */
function simpleRule({
    code, field, getValue = (v) => v[field], severity, clause, label, note,
}) {
    return rule(code, (view) => (isBlank(getValue(view))
        ? [missingFinding({
            code, field, severity, clause, label, note,
        })]
        : []));
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const UNIT = '(?:\\s*mm)?';
const OPEN_TAIL = '(?:\\u2026|\\.{2,3}|\\u221e|inf\\w*|illimitat\\w*|senza\\s+limit\\w*|no\\s+limit\\w*|oo|n\\.?\\s?l\\.?)';
const toNumber = (txt) => Number(String(txt).replace(',', '.'));
const fmtLegacy = (n) => String(n).replace('.', ',');

/**
 * Legge il campo legacy `thickness_range` (testo libero, es. «3-18 mm», «t≥3», «≥ 3 mm», «3-…»).
 * Restituisce solo ciò che il testo dice in modo esplicito:
 * - `min` / `max`: limiti numerici letti; `open`: limite superiore dichiarato assente («≥», «3-…», «senza limite»).
 * Testo non interpretabile (o assente) → `null`: nessuna inferenza.
 * @returns {{min: number|null, max: number|null, open: boolean}|null}
 */
function parseLegacyThicknessRange(text) {
    const s = String(text == null ? '' : text).trim().toLowerCase();
    if (!s) return null;

    const dash = '[-\\u2013\\u2014]';
    const re = (src) => new RegExp(`^${src}$`);

    let m = re(`${NUM}${UNIT}\\s*${dash}\\s*${NUM}${UNIT}`).exec(s);
    if (m) {
        const min = toNumber(m[1]);
        const max = toNumber(m[2]);
        return max >= min ? { min, max, open: false } : null;
    }

    m = re(`(?:t\\s*)?(?:\\u2265|>=|=>|>|min\\.?|da)\\s*${NUM}${UNIT}`).exec(s);
    if (m) return { min: toNumber(m[1]), max: null, open: true };

    m = re(`${NUM}${UNIT}\\s*(?:${dash}\\s*(?:${OPEN_TAIL})?|${OPEN_TAIL})`).exec(s);
    if (m) return { min: toNumber(m[1]), max: null, open: true };

    m = re(`(?:fino\\s+a|max\\.?|\\u2264|<=|=<)\\s*${NUM}${UNIT}`).exec(s);
    if (m) return { min: null, max: toNumber(m[1]), open: false };

    return null;
}

const PROCESS_FIELDS = ['welding_process_test', 'welding_processes_validity', 'welding_process'];

const RULES = [
    rule('PROCESS', (view) => {
        if (PROCESS_FIELDS.some((k) => !isBlank(view[k]))) return [];
        return [missingFinding({
            code: 'PROCESS',
            field: 'welding_process_test',
            fields: PROCESS_FIELDS,
            severity: SEVERITY.WARN,
            clause: '§5.1, §5.2, §10, Annex A',
            label: 'Processo di saldatura',
        })];
    }),

    simpleRule({
        code: 'PRODUCT_TYPE',
        field: 'product_type',
        severity: SEVERITY.WARN,
        clause: '§5.1, §5.3, §11',
        label: 'Tipo di prodotto (piastra P / tubo T)',
    }),

    simpleRule({
        code: 'JOINT_TYPE',
        field: 'joint_type',
        severity: SEVERITY.WARN,
        clause: '§5.1, §5.4, §11',
        label: 'Tipo di giunto (testa a testa BW / angolo FW)',
        note: 'Senza tipo di giunto restano eseguibili solo i controlli comuni.',
    }),

    rule('FILLER_GROUP', (view) => {
        if (!isBlank(view.filler_material_group)) return [];
        const clause = '§5.5, Tab. 2, §11';
        const label = 'Gruppo del materiale d\'apporto (FM1-FM6)';
        const process = testProcessCode(view);
        if (process && NO_FILLER_PROCESSES.includes(process)) return [];
        if (!process) {
            return [notVerifiableFinding({
                code: 'FILLER_GROUP',
                field: 'filler_material_group',
                clause,
                label,
                reason: 'processo di prova non leggibile: non si può stabilire se il processo (142, 311) richieda il gruppo del materiale base al posto di quello d\'apporto',
            })];
        }
        return [missingFinding({
            code: 'FILLER_GROUP', field: 'filler_material_group', severity: SEVERITY.WARN, clause, label,
        })];
    }),

    rule('THK_VALIDITY', (view) => {
        const hasMin = isNum(view.thickness_min_mm);
        const hasMax = isNum(view.thickness_max_mm) || view.thickness_max_unlimited === true;
        if (hasMin && hasMax) return [];
        const fields = ['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_range'];
        const profile = getJointTypeProfile(view.joint_type);
        if (!profile) {
            return [notVerifiableFinding({
                code: 'THK_VALIDITY',
                field: 'thickness_max_mm',
                fields,
                clause: '§5.7 Tab. 6/8',
                label: 'Campo di validità dello spessore',
                reason: 'tipo di giunto non leggibile: non si può stabilire se la validità vada espressa secondo Tab. 6 (BW) o Tab. 8 (FW)',
            })];
        }

        // Il limite minimo è il dato che non ha una convenzione di ripiego: senza né colonna né testo
        // legacy che lo restituisca, l'informazione manca davvero (warn). Il solo massimo mancante è
        // la convenzione «da X, senza limite superiore» (Tab. 6 s ≥ 12, Tab. 8 t ≥ 3).
        const legacy = parseLegacyThicknessRange(view.thickness_range);
        const minFromLegacy = !hasMin && legacy && legacy.min != null;
        if (hasMin || minFromLegacy) {
            const clause = `§5.7 Tab. ${profile.validityTable}`;
            const legacyText = String(view.thickness_range || '').trim();
            let message;
            if (legacy && (legacy.max != null || legacy.open)) {
                const lo = fmtLegacy(legacy.min != null ? legacy.min : view.thickness_min_mm);
                const what = legacy.max != null ? `da ${lo} a ${fmtLegacy(legacy.max)} mm` : `da ${lo} mm, senza limite superiore`;
                const absent = hasMin ? 'manca il limite massimo (o «nessun limite»)' : (hasMax ? 'manca il limite minimo' : 'mancano i limiti');
                message = `Campo di validità dello spessore: nelle colonne ${absent}, ma il testo del campo legacy «${legacyText}» lo esprime (${what}). Dato leggibile solo come testo: nessuna azione richiesta (ISO 9606-1 ${clause}).`;
            } else {
                message = `Campo di validità dello spessore: indicato solo il limite minimo da ${fmtLegacy(hasMin ? view.thickness_min_mm : legacy.min)} mm, senza massimo né «nessun limite». Convenzione normale «da X mm, senza limite superiore» (ISO 9606-1 ${clause}): informativo, verificare il flag «nessun limite» solo se il certificato riporta un massimo.`;
            }
            return [makeFinding({
                code: `${PREFIX}THK_VALIDITY`,
                family: FAMILY.COMPLETEZZA,
                severity: SEVERITY.INFO,
                status: STATUS.VERIFICABILE,
                field: 'thickness_max_mm',
                fields,
                direction: DIRECTION.MISSING,
                read_value: legacyText || null,
                expected_value: null,
                source: sourceOf(clause),
                message_it: message,
            })];
        }

        const part = !hasMin && !hasMax ? 'limite minimo e massimo' : 'limite minimo';
        return [missingFinding({
            code: 'THK_VALIDITY',
            field: 'thickness_min_mm',
            fields,
            severity: SEVERITY.WARN,
            clause: `§5.7 Tab. ${profile.validityTable}`,
            label: `Campo di validità dello spessore (${part})`,
        })];
    }),

    rule('THK_TEST', (view) => {
        const fields = ['thickness_s_test_mm', 'thickness_t_test_mm'];
        const profile = getJointTypeProfile(view.joint_type);
        if (profile ? isNum(view[profile.testThicknessKey]) : fields.some((k) => isNum(view[k]))) return [];
        if (!profile) {
            return [notVerifiableFinding({
                code: 'THK_TEST',
                field: 'thickness_s_test_mm',
                fields,
                clause: '§5.7, §11',
                label: 'Spessore del provino di prova',
                reason: 'tipo di giunto non leggibile: non si può stabilire se serva lo spessore depositato s (BW) o lo spessore del materiale t (FW)',
            })];
        }
        return [missingFinding({
            code: 'THK_TEST',
            field: profile.testThicknessKey,
            severity: SEVERITY.INFO,
            clause: `§5.7 Tab. ${profile.validityTable}, §11`,
            label: profile.thicknessKind === 'deposited_s' ? 'Spessore depositato s del provino' : 'Spessore del materiale t del provino',
            note: 'Senza questo dato non è possibile ricalcolare la validità.',
        })];
    }),

    rule('PIPE_DIAMETER', (view) => {
        if (!visibleKeys(view).includes('pipe_diameter_min_mm')) return [];
        if (isNum(view.pipe_diameter_min_mm) || isNum(view.pipe_diameter_max_mm)) return [];
        const fields = ['pipe_diameter_min_mm', 'pipe_diameter_max_mm'];
        const clause = '§5.7 Tab. 7, Annex A';
        const label = 'Campo di validità del diametro esterno del tubo';
        if (view.product_type !== 'T') {
            return [notVerifiableFinding({
                code: 'PIPE_DIAMETER',
                field: 'pipe_diameter_min_mm',
                fields,
                clause,
                label,
                reason: 'tipo di prodotto non leggibile: il diametro è richiesto solo per i tubi (T)',
            })];
        }
        return [missingFinding({
            code: 'PIPE_DIAMETER', field: 'pipe_diameter_min_mm', fields, severity: SEVERITY.WARN, clause, label,
        })];
    }),

    rule('PIPE_DIAMETER_TEST', (view) => {
        if (!visibleKeys(view).includes('pipe_diameter_test_mm')) return [];
        if (isNum(view.pipe_diameter_test_mm)) return [];
        const clause = '§5.7 Tab. 7, §11';
        const label = 'Diametro esterno del tubo di prova';
        if (view.product_type !== 'T') {
            return [notVerifiableFinding({
                code: 'PIPE_DIAMETER_TEST',
                field: 'pipe_diameter_test_mm',
                clause,
                label,
                reason: 'tipo di prodotto non leggibile: il diametro è richiesto solo per i tubi (T)',
            })];
        }
        return [missingFinding({
            code: 'PIPE_DIAMETER_TEST',
            field: 'pipe_diameter_test_mm',
            severity: SEVERITY.INFO,
            clause,
            label,
            note: 'Senza questo dato non è possibile ricalcolare la validità.',
        })];
    }),

    rule('POSITIONS', (view) => {
        if (view.positions.length > 0) return [];
        const table = { BW: 'Tab. 9', FW: 'Tab. 10' }[view.joint_type] || 'Tab. 9/10';
        return [missingFinding({
            code: 'POSITIONS',
            field: 'welding_positions',
            fields: ['welding_positions', 'position_range'],
            severity: SEVERITY.WARN,
            clause: `§5.8 ${table}, §11`,
            label: 'Posizioni di saldatura qualificate',
        })];
    }),

    simpleRule({
        code: 'POSITION_TEST',
        field: 'welding_position_test',
        severity: SEVERITY.INFO,
        clause: '§5.8, §11',
        label: 'Posizione di saldatura del provino di prova',
        note: 'Senza questo dato non è possibile ricalcolare le posizioni qualificate.',
    }),

    simpleRule({
        code: 'WELD_DETAILS',
        field: 'weld_details',
        severity: SEVERITY.WARN,
        clause: '§5.1, §5.9, §11',
        label: 'Dettagli di giunto (supporto, strati, lati)',
    }),

    rule('TRANSFER_MODE', (view) => {
        if (!isBlank(view.transfer_mode)) return [];
        const clause = '§5.2, Annex A';
        const label = 'Metodo di trasferimento';
        const process = testProcessCode(view);
        if (process && !CONTINUOUS_WIRE_ARC_PROCESSES.includes(process)) return [];
        if (!process) {
            return [notVerifiableFinding({
                code: 'TRANSFER_MODE',
                field: 'transfer_mode',
                clause,
                label,
                reason: 'processo di prova non leggibile: il metodo di trasferimento riguarda i processi 131, 135, 136, 138',
            })];
        }
        return [missingFinding({
            code: 'TRANSFER_MODE', field: 'transfer_mode', severity: SEVERITY.INFO, clause, label,
        })];
    }),

    rule('MATERIAL_GROUP', (view) => {
        if (!isBlank(view.material_group)) return [];
        const process = testProcessCode(view);
        const noFiller = process && NO_FILLER_PROCESSES.includes(process);
        return [missingFinding({
            code: 'MATERIAL_GROUP',
            field: 'material_group',
            severity: SEVERITY.WARN,
            clause: noFiller ? '§5.1, §5.6, §10, Annex A' : '§5.1, §10, Annex A',
            label: 'Gruppo/sottogruppo del materiale base (ISO/TR 15608)',
            note: noFiller ? 'Per i processi 142 e 311 è il gruppo per cui il saldatore è qualificato.' : '',
        })];
    }),

    rule('SHIELDING_GAS', (view) => {
        if (!isBlank(view.shielding_gas)) return [];
        const clause = '§10, Annex A';
        const label = 'Gas di protezione';
        const process = testProcessCode(view);
        if (process && !GAS_SHIELDED_PROCESSES.includes(process)) return [];
        if (!process) {
            return [notVerifiableFinding({
                code: 'SHIELDING_GAS',
                field: 'shielding_gas',
                clause,
                label,
                reason: 'processo di prova non leggibile: il gas va registrato per i processi a gas (MIG, MAG, TIG)',
            })];
        }
        return [missingFinding({
            code: 'SHIELDING_GAS', field: 'shielding_gas', severity: SEVERITY.INFO, clause, label,
        })];
    }),

    simpleRule({
        code: 'EXAM_DATE',
        field: 'exam_date',
        severity: SEVERITY.WARN,
        clause: '§9.1, §10, Annex A',
        label: 'Data di esecuzione/rilascio della prova',
    }),

    simpleRule({
        code: 'CERTIFICATE_NUMBER',
        field: 'certificate_number',
        severity: SEVERITY.WARN,
        clause: '§10, Annex A',
        label: 'Numero di riferimento del certificato',
    }),

    simpleRule({
        code: 'ISSUING_BODY',
        field: 'issuing_body',
        severity: SEVERITY.WARN,
        clause: '§10, Annex A',
        label: 'Esaminatore od organismo di esame che rilascia il certificato',
    }),

    simpleRule({
        code: 'STANDARD_REFERENCE',
        field: 'standard_reference',
        severity: SEVERITY.INFO,
        clause: 'Annex A',
        label: 'Norma di riferimento della prova (Code/testing standard)',
    }),
];

module.exports = {
    id: 'welder9606.completeness',
    standardFamily: '9606-1',
    editions: ['2017', '2013', '2012'],
    profiles: ['9606-1:BW', '9606-1:FW', '9606-1:UNKNOWN'],
    rules: RULES,
};
