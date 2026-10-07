/**
 * welder9606Part2.pack.js — completezza e correttezza ISO 9606-2:2004 (saldatori, alluminio), BW/FW (VQ-10).
 *
 * Fonte: NORMA_00032 (EN ISO 9606-2:2004, edizione unica) + estratto operativo
 * docs/reference/ISO-9606-2-range-validita-patentino.md. I numeri vengono da
 * `data/weldingQualificationRules9606Part2.js` (Tab. 3/4/5/6, §9): qui nessuna tabella ricopiata.
 *
 * Principio (piano § 1.4): la validità scritta sul certificato prevale, `expected_value` è solo
 * informativo. Severità (D2: nessuna tolleranza oltre 0,01 mm):
 * - campo richiesto dalla norma assente, certificato PIÙ LARGO della norma = `warn`;
 * - certificato più stretto, campo non essenziale, regola non vincolante = `info`;
 * - input di prova assente o combinazione non modellata = `non_verificabile_dato_mancante` (mai `warn`);
 * - ciò che l'estratto dichiara GAP = `non_verificabile_fonte_mancante`, MAI codificato:
 *   Tab. 1 multi-processo (G1), gruppi Al 21-26 / gruppo 26 / CR ISO 15608 (G2), simboli posizione tubo
 *   PH/PJ di 9606-1 senza ISO 6947 integrale (G4).
 * Senza validità dichiarata non c'è nulla da confrontare: la mancanza del dato è compito della completezza.
 * Modulo puro: nessun DB, nessun fs. Tab. 7/8 (dettagli di giunto) e designazione §11 non sono verificate
 * (nessuna colonna strutturata per la prova / parser 9606-2 assente).
 */

'use strict';

const rules2 = require('../../../data/weldingQualificationRules9606Part2');
const { getJointTypeProfile, getVisibleFieldKeys } = require('../../../data/jointTypeProfiles');
const {
    FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS, makeFinding,
} = require('../findingTypes');

const NORM = 'ISO 9606-2';
const EDITION = rules2.EDITION;
const NORM_REF = 'docs/Normative/Normative NORMA_00032_ UNI EN ISO 9606-2_2004 Rev. 0.md; docs/reference/ISO-9606-2-range-validita-patentino.md';
const GAP_REF = 'docs/reference/ISO-9606-2-range-validita-patentino.md (sezione GAP / da confermare con il PDF)';
const COMP = 'WQ9606_2.COMP.';
const CORR = 'WQ9606_2.CORR.';

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/** Confronto a 0,01 mm (D2): -1 se a < b, 0 se uguali, +1 se a > b. */
const cmp = (a, b) => Math.sign(round2(a) - round2(b));
const fmtNum = (n) => String(round2(n)).replace('.', ',');

function fmtRange(min, max, { unlimited = false } = {}) {
    const lo = min != null ? `da ${fmtNum(min)}` : null;
    if (max != null) return `${lo ? `${lo} a ` : 'fino a '}${fmtNum(max)} mm`;
    if (unlimited) return `${lo || 'da 0'} mm, senza limite superiore`;
    return `${lo || 'n.d.'} mm (massimo non dichiarato)`;
}

function source(clause, over = {}) {
    return {
        norm: NORM, edition: EDITION, clause, text_status: TEXT_STATUS.MD_INTEGRALE, ref: NORM_REF, ...over,
    };
}

function gapSource(clause) {
    return source(clause, { text_status: TEXT_STATUS.ASSENTE, ref: GAP_REF });
}

function finding(prefix, family, code, partial) {
    return {
        code: prefix + code,
        family,
        severity: SEVERITY.INFO,
        status: STATUS.VERIFICABILE,
        ...partial,
    };
}

const comp = (code, partial) => finding(COMP, FAMILY.COMPLETEZZA, code, partial);
const corr = (code, partial) => finding(CORR, FAMILY.CORRETTEZZA, code, partial);

function dataMissing(build, code, field, clause, message, extra = {}) {
    return build(code, {
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field,
        source: source(clause),
        message_it: message,
        ...extra,
    });
}

function sourceMissing(build, code, field, clause, message, extra = {}) {
    return build(code, {
        status: STATUS.NON_VERIFICABILE_FONTE_MANCANTE,
        field,
        source: gapSource(clause),
        message_it: message,
        ...extra,
    });
}

function normProduct(v) {
    const s = String(v || '').trim().toUpperCase();
    if (s === 'P' || s === 'PLATE' || s === 'PIASTRA') return 'P';
    if (s === 'T' || s === 'PIPE' || s === 'TUBO') return 'T';
    return null;
}

const processCodes = (text) => String(text || '').match(/\d{2,3}/g) || [];

function distinctBranches(text) {
    return Array.from(new Set(processCodes(text).map(rules2.normalizeProcessBranch)));
}

/** Processi di prova: colonna di prova, poi campo legacy `welding_process`. */
const testProcessText = (view) => view.welding_process_test || view.welding_process;

const positionTokens = (raw) => String(raw || '')
    .toUpperCase()
    .split(/[\s,;/+]+/)
    .map((t) => t.trim())
    .filter(Boolean);

const isMultiProcess = (view) => distinctBranches(testProcessText(view)).length > 1;

/** Campi applicabili al profilo, derivati da jointTypeProfiles (nessuna seconda lista). */
function visibleKeys(view) {
    return getVisibleFieldKeys({
        jointType: view.joint_type,
        productType: view.product_type,
        qualificationType: NORM,
    }).keys;
}

const profileOf = (view) => getJointTypeProfile(view.joint_type, { standard: '9606-2' });
const validityTableOf = (view) => profileOf(view)?.validityTable || '3 (BW) / 5 (FW)';

// ---------------------------------------------------------------------------------------------
// COMPLETEZZA (§5.1, §10, §11, Annex A)
// ---------------------------------------------------------------------------------------------

function missing({
    code, field, fields, severity, clause, label, note = '',
}) {
    return comp(code, {
        severity,
        field,
        fields,
        direction: DIRECTION.MISSING,
        read_value: null,
        expected_value: null,
        source: source(clause),
        message_it: `${label}: dato ${severity === SEVERITY.WARN ? 'richiesto' : 'previsto'} dalla norma assente sul certificato (${NORM} ${clause}).${note ? ` ${note}` : ''}`,
    });
}

function notVerifiableComp({
    code, field, fields, clause, label, reason,
}) {
    return dataMissing(comp, code, field, clause, `${label}: controllo non eseguibile, ${reason} (${NORM} ${clause}).`, { fields });
}

function compRule(code, run, codes) {
    const id = COMP + code;
    return {
        id, family: FAMILY.COMPLETEZZA, codes: codes || [id], run,
    };
}

function simple({
    code, field, getValue = (v) => v[field], severity, clause, label, note,
}) {
    return compRule(code, (view) => (isBlank(getValue(view))
        ? [missing({
            code, field, severity, clause, label, note,
        })]
        : []));
}

const PROCESS_FIELDS = ['welding_process_test', 'welding_processes_validity', 'welding_process'];

const COMPLETENESS_RULES = [
    compRule('PROCESS', (view) => {
        if (PROCESS_FIELDS.some((k) => !isBlank(view[k]))) return [];
        return [missing({
            code: 'PROCESS',
            field: 'welding_process_test',
            fields: PROCESS_FIELDS,
            severity: SEVERITY.WARN,
            clause: '§5.1 a), §5.2, §10, Annex A',
            label: 'Processo di saldatura (131, 141, 15)',
        })];
    }),

    simple({
        code: 'PRODUCT_TYPE',
        field: 'product_type',
        severity: SEVERITY.WARN,
        clause: '§5.1 b), §5.3, §11',
        label: 'Tipo di prodotto (piastra P / tubo T)',
    }),

    simple({
        code: 'MATERIAL_GROUP',
        field: 'material_group',
        severity: SEVERITY.WARN,
        clause: '§5.1 d), §5.5, Tab. 2, §10',
        label: 'Gruppo del materiale base (21-26)',
    }),

    simple({
        code: 'FILLER_MATERIAL',
        field: 'filler_material_group',
        severity: SEVERITY.WARN,
        clause: '§5.1 e), §5.6, §11',
        label: 'Materiale d\'apporto (designazione, anche «senza apporto»)',
    }),

    compRule('THK_VALIDITY', (view) => {
        const hasMin = isNum(view.thickness_min_mm);
        const hasMax = isNum(view.thickness_max_mm) || view.thickness_max_unlimited === true;
        if (hasMin && hasMax) return [];
        const part = !hasMin && !hasMax ? 'limite minimo e massimo' : (!hasMin ? 'limite minimo' : 'limite massimo (o «nessun limite»)');
        return [missing({
            code: 'THK_VALIDITY',
            field: hasMin ? 'thickness_max_mm' : 'thickness_min_mm',
            fields: ['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited'],
            severity: SEVERITY.WARN,
            clause: `§5.7 Tab. ${validityTableOf(view)}, Annex A`,
            label: `Campo di validità dello spessore del materiale (${part})`,
        })];
    }),

    compRule('THK_TEST', (view) => {
        if (isNum(view.thickness_t_test_mm)) return [];
        const onlyS = isNum(view.thickness_s_test_mm);
        return [missing({
            code: 'THK_TEST',
            field: 'thickness_t_test_mm',
            severity: SEVERITY.INFO,
            clause: `§5.7 Tab. ${validityTableOf(view)}, §11`,
            label: 'Spessore del materiale t del provino',
            note: `Senza questo dato non è possibile ricalcolare la validità.${onlyS ? ' Sul record c\'è solo lo spessore depositato s: ISO 9606-2 usa t del materiale e non lo converte.' : ''}`,
        })];
    }),

    compRule('PIPE_DIAMETER', (view) => {
        if (!visibleKeys(view).includes('pipe_diameter_min_mm')) return [];
        if (isNum(view.pipe_diameter_min_mm) || isNum(view.pipe_diameter_max_mm)) return [];
        const fields = ['pipe_diameter_min_mm', 'pipe_diameter_max_mm'];
        const clause = '§5.7 Tab. 4, Annex A';
        const label = 'Campo di validità del diametro esterno del tubo';
        if (normProduct(view.product_type) !== 'T') {
            return [notVerifiableComp({
                code: 'PIPE_DIAMETER',
                field: 'pipe_diameter_min_mm',
                fields,
                clause,
                label,
                reason: 'tipo di prodotto non leggibile: il diametro è richiesto solo per i tubi (T)',
            })];
        }
        return [missing({
            code: 'PIPE_DIAMETER', field: 'pipe_diameter_min_mm', fields, severity: SEVERITY.WARN, clause, label,
        })];
    }),

    compRule('PIPE_DIAMETER_TEST', (view) => {
        if (!visibleKeys(view).includes('pipe_diameter_test_mm')) return [];
        if (isNum(view.pipe_diameter_test_mm)) return [];
        const clause = '§5.7 Tab. 4, §11';
        const label = 'Diametro esterno del tubo di prova';
        if (normProduct(view.product_type) !== 'T') {
            return [notVerifiableComp({
                code: 'PIPE_DIAMETER_TEST',
                field: 'pipe_diameter_test_mm',
                clause,
                label,
                reason: 'tipo di prodotto non leggibile: il diametro è richiesto solo per i tubi (T)',
            })];
        }
        return [missing({
            code: 'PIPE_DIAMETER_TEST',
            field: 'pipe_diameter_test_mm',
            severity: SEVERITY.INFO,
            clause,
            label,
            note: 'Senza questo dato non è possibile ricalcolare la validità.',
        })];
    }),

    compRule('POSITIONS', (view) => {
        if (view.positions.length > 0) return [];
        return [missing({
            code: 'POSITIONS',
            field: 'welding_positions',
            fields: ['welding_positions', 'position_range'],
            severity: SEVERITY.WARN,
            clause: '§5.8 Tab. 6, §11',
            label: 'Posizioni di saldatura qualificate',
        })];
    }),

    simple({
        code: 'POSITION_TEST',
        field: 'welding_position_test',
        severity: SEVERITY.INFO,
        clause: '§5.8, §11',
        label: 'Posizione di saldatura del provino di prova',
        note: 'Senza questo dato non è possibile ricalcolare le posizioni qualificate.',
    }),

    simple({
        code: 'WELD_DETAILS',
        field: 'weld_details',
        severity: SEVERITY.WARN,
        clause: '§5.1 h), §5.9, Tab. 7, Tab. 8, §11',
        label: 'Dettagli di giunto (supporto, lati, strati)',
    }),

    simple({
        code: 'SHIELDING_GAS',
        field: 'shielding_gas',
        severity: SEVERITY.INFO,
        clause: '§5.6, §11, Annex A',
        label: 'Gas di protezione',
        note: 'Il gas va sul certificato ma non nella designazione.',
    }),

    compRule('CURRENT_141', (view) => {
        if (!processCodes(testProcessText(view)).includes('141')) return [];
        return [dataMissing(
            comp,
            'CURRENT_141',
            'welding_process_test',
            '§5.2',
            'Corrente del processo 141: il passaggio da corrente continua ad alternata (o viceversa) richiede una nuova prova (ISO 9606-2 §5.2, variabile essenziale), ma il certificato non ha un campo strutturato per il tipo di corrente: controllo non eseguibile.',
            { read_value: view.welding_process_test || view.welding_process },
        )];
    }),

    simple({
        code: 'EXAM_DATE',
        field: 'exam_date',
        severity: SEVERITY.WARN,
        clause: '§9.1, §10, Annex A',
        label: 'Data di saldatura dei provini (inizio validità)',
    }),

    simple({
        code: 'CERTIFICATE_NUMBER',
        field: 'certificate_number',
        severity: SEVERITY.WARN,
        clause: '§10, Annex A',
        label: 'Numero di riferimento del certificato',
    }),

    simple({
        code: 'ISSUING_BODY',
        field: 'issuing_body',
        severity: SEVERITY.WARN,
        clause: '§10, Annex A',
        label: 'Esaminatore od organismo di esame che rilascia il certificato',
    }),

    simple({
        code: 'EXPIRY_DATE',
        field: 'expiry_date',
        severity: SEVERITY.INFO,
        clause: '§9.2, Annex A',
        label: 'Validità fino a (due anni dalla data di saldatura dei provini)',
    }),

    simple({
        code: 'STANDARD_REFERENCE',
        field: 'standard_reference',
        severity: SEVERITY.INFO,
        clause: 'Annex A',
        label: 'Norma di riferimento della prova (Code/testing standard)',
    }),
];

// ---------------------------------------------------------------------------------------------
// CORRETTEZZA — range (Tab. 3, 4, 5)
// ---------------------------------------------------------------------------------------------

/**
 * Confronta la validità dichiarata con quella attesa.
 * Un limite non dichiarato (max null senza flag «senza limite») non è un'affermazione: non si giudica.
 */
function compareRange(declared, expected) {
    const over = [];
    const under = [];
    if (declared.min != null) {
        const c = cmp(declared.min, expected.minMm);
        if (c < 0) over.push('minimo');
        else if (c > 0) under.push('minimo');
    }
    if (declared.max != null && !declared.unlimited) {
        if (expected.maxMm == null) under.push('massimo');
        else {
            const c = cmp(declared.max, expected.maxMm);
            if (c > 0) over.push('massimo');
            else if (c < 0) under.push('massimo');
        }
    } else if (declared.max == null && declared.unlimited && expected.maxMm != null) {
        over.push('massimo');
    }
    return { over, under };
}

const hasRangeClaim = (d) => d.min != null || d.max != null || d.unlimited;

function rangeFinding({
    code, field, fields, label, clause, testText, declared, expected, result,
}) {
    const declText = fmtRange(declared.min, declared.max, { unlimited: declared.unlimited });
    const expText = fmtRange(expected.minMm, expected.maxMm, { unlimited: true });
    const base = {
        field,
        fields,
        read_value: { min: declared.min, max: declared.max, unlimited: declared.unlimited },
        expected_value: { min: expected.minMm, max: expected.maxMm, unlimited: expected.maxMm == null },
        source: source(clause),
    };
    if (result.over.length) {
        return corr(code, {
            ...base,
            severity: SEVERITY.WARN,
            direction: DIRECTION.OVER_CLAIM,
            message_it: `${label}: il certificato dichiara ${declText}, più largo del campo ammesso da ${NORM} ${clause} per ${testText} (${expText}; ${result.over.join(' e ')} oltre la norma). La validità scritta sul certificato prevale: verificare il dato.`,
        });
    }
    return corr(code, {
        ...base,
        direction: DIRECTION.UNDER_CLAIM,
        message_it: `${label}: il certificato dichiara ${declText}, più stretto del campo ammesso da ${NORM} ${clause} per ${testText} (${expText}). Il rilascio può restringere la validità: nessuna azione richiesta.`,
    });
}

const declaredThickness = (view) => ({
    min: view.thickness_min_mm, max: view.thickness_max_mm, unlimited: view.thickness_max_unlimited,
});

function runThickness(view, { joint, code, table, compute, symbol }) {
    if (view.joint_type !== joint) return [];
    const declared = declaredThickness(view);
    if (!hasRangeClaim(declared) || isMultiProcess(view)) return [];

    const clause = `§5.7 Tab. ${table}`;
    const t = view.thickness_t_test_mm;
    const fields = ['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_t_test_mm'];
    const expected = isNum(t) ? compute({ testThicknessMm: t }) : null;
    if (!expected) {
        const hint = isNum(view.thickness_s_test_mm)
            ? ` Sul record c'è solo lo spessore depositato s = ${fmtNum(view.thickness_s_test_mm)} mm: ISO 9606-2 usa lo spessore del materiale t e non lo converte.`
            : '';
        return [dataMissing(corr, code, 'thickness_max_mm', clause,
            `Spessore di validità non verificabile: manca lo spessore del materiale di prova t (${NORM} ${clause}).${hint}`,
            { fields })];
    }
    const result = compareRange(declared, expected);
    if (!result.over.length && !result.under.length) return [];
    return [rangeFinding({
        code,
        field: 'thickness_max_mm',
        fields,
        label: joint === 'BW' ? 'Spessore (giunto testa a testa)' : 'Spessore (giunto d\'angolo)',
        clause,
        testText: `${symbol} = ${fmtNum(t)} mm`,
        declared,
        expected,
        result,
    })];
}

const THK_BW = 'THK_BW';
const THK_FW = 'THK_FW';
const PIPE_DIAMETER = 'PIPE_DIAMETER';
const PLATE_TO_PIPE = 'PLATE_TO_PIPE';

function runPipeDiameter(view) {
    if (normProduct(view.product_type) === 'P') return [];
    const declared = { min: view.pipe_diameter_min_mm, max: view.pipe_diameter_max_mm, unlimited: false };
    if (!hasRangeClaim(declared) || isMultiProcess(view)) return [];

    const clause = '§5.7 Tab. 4';
    const fields = ['pipe_diameter_min_mm', 'pipe_diameter_max_mm', 'pipe_diameter_test_mm'];
    const d = view.pipe_diameter_test_mm;
    const expected = isNum(d) ? rules2.computeQualifiedPipeDiameterRange({ testDiameterMm: d }) : null;
    if (!expected) {
        return [dataMissing(corr, PIPE_DIAMETER, 'pipe_diameter_min_mm', clause,
            `Diametro di validità non verificabile: manca il diametro esterno del tubo di prova D (${NORM} ${clause}).`,
            { fields })];
    }
    const result = compareRange(declared, expected);
    if (!result.over.length && !result.under.length) return [];
    return [rangeFinding({
        code: PIPE_DIAMETER,
        field: 'pipe_diameter_min_mm',
        fields,
        label: 'Diametro esterno tubo',
        clause,
        testText: `D = ${fmtNum(d)} mm`,
        declared,
        expected,
        result,
    })];
}

function runPlateToPipe(view) {
    if (normProduct(view.product_type) !== 'P') return [];
    const min = view.pipe_diameter_min_mm;
    if (!isNum(min)) return [];
    const testTokens = positionTokens(view.welding_position_test);
    const { minMm, positionKnown } = rules2.computePlateToPipeMinDiameter({
        testPosition: testTokens.length ? testTokens : null,
    });
    if (cmp(min, minMm) >= 0) return [];
    const where = positionKnown
        ? (minMm === 150 ? 'nelle posizioni PA, PB, PC' : 'per le posizioni diverse da PA, PB, PC')
        : 'almeno';
    return [corr(PLATE_TO_PIPE, {
        field: 'pipe_diameter_min_mm',
        fields: ['product_type', 'pipe_diameter_min_mm', 'welding_position_test'],
        direction: DIRECTION.OVER_CLAIM,
        read_value: min,
        expected_value: { min: minMm },
        source: source('§5.3 b)'),
        message_it: `Tipo prodotto piastra (P) con diametro tubo da ${fmtNum(min)} mm: secondo ${NORM} §5.3 b) una prova su piastra copre tubi con D ≥ ${minMm} mm ${where}. Informativo: verificare se il certificato include anche una prova su tubo.`,
    })];
}

// ---------------------------------------------------------------------------------------------
// CORRETTEZZA — posizioni (Tab. 6)
// ---------------------------------------------------------------------------------------------

const POSITIONS = 'POSITIONS';
const POSITIONS_SYMBOLS = 'POSITIONS_SYMBOLS';
const POSITION_TEST_JOINT = 'POSITION_TEST_JOINT';

function runPositions(view) {
    const joint = view.joint_type;
    if (joint !== 'BW' && joint !== 'FW') return [];
    const declared = Array.from(new Set(view.positions.flatMap((p) => positionTokens(p))));
    if (!declared.length) return [];

    const clause = '§5.8 Tab. 6';
    const fields = ['welding_positions', 'welding_position_test', 'product_type'];
    const testTokens = positionTokens(view.welding_position_test);
    if (!testTokens.length) {
        return [dataMissing(corr, POSITIONS, 'welding_positions', clause,
            `Posizioni di validità non verificabili: manca la posizione della prova (${NORM} ${clause}).`, { fields })];
    }

    const symbolGap = (tokens, where) => sourceMissing(
        corr,
        POSITIONS_SYMBOLS,
        'welding_positions',
        clause,
        `Posizioni ${tokens.join(', ')} (${where}) non presenti nella Tab. 6 di ${NORM}: la corrispondenza con i simboli PH/PJ/J-L045 di ISO 9606-1 richiede ISO 6947 integrale, non disponibile. Controllo non eseguibile.`,
        { fields, read_value: tokens },
    );

    const unknownTest = testTokens.filter((t) => !rules2.isPositionSymbolInTable(t));
    if (unknownTest.length) return [symbolGap(unknownTest, 'posizione di prova')];

    const unknownDeclared = declared.filter((p) => !rules2.isPositionSymbolInTable(p));
    const out = [];

    const pbPd = testTokens.filter((t) => t === 'PB' || t === 'PD');
    if (joint === 'BW' && pbPd.length) {
        out.push(corr(POSITION_TEST_JOINT, {
            field: 'welding_position_test',
            fields: ['joint_type', 'welding_position_test'],
            direction: DIRECTION.MISMATCH,
            read_value: pbPd.join(', '),
            source: source('§5.8 Tab. 6 nota b'),
            message_it: `Prova in posizione ${pbPd.join(', ')} su giunto testa a testa: ${NORM} §5.8 Tab. 6 nota b prevede PB e PD solo per giunti d'angolo, che possono qualificare solo giunti d'angolo nelle altre posizioni. Informativo: verificare tipo di giunto e posizione di prova.`,
        }));
        if (unknownDeclared.length) out.push(symbolGap(unknownDeclared, 'posizione dichiarata'));
        return out;
    }

    const qualifiedColumns = rules2.computeQualifiedWeldingPositions({ testPosition: testTokens, productType: view.product_type });
    if (!qualifiedColumns) {
        out.push(dataMissing(corr, POSITIONS, 'welding_position_test', clause,
            `Posizioni di validità non verificabili: la posizione di prova ${testTokens.join('/')} richiede di distinguere piastra e tubo (colonne PF/PG della ${NORM} ${clause}) ma il tipo di prodotto non è leggibile.`,
            { fields }));
    } else {
        const qualified = rules2.qualifiedPositionSymbols(qualifiedColumns);
        const judged = declared.filter((p) => rules2.isPositionSymbolInTable(p));
        const over = judged.filter((p) => !qualified.includes(p));
        // under-claim solo sulle posizioni effettivamente confrontate con Tab. 6:
        // PH/PJ/J-L045 restano sul GAP, non su «più stretto» (non valutate).
        const under = judged.length
            ? qualified.filter((p) => !judged.includes(p))
            : [];
        const common = {
            field: 'welding_positions',
            fields,
            read_value: declared,
            expected_value: qualified,
            source: source(clause),
        };
        if (over.length) {
            out.push(corr(POSITIONS, {
                ...common,
                severity: SEVERITY.WARN,
                direction: DIRECTION.OVER_CLAIM,
                message_it: `Posizioni: il certificato dichiara ${declared.join(', ')}; ${over.join(', ')} non ${over.length > 1 ? 'sono qualificate' : 'è qualificata'} dalla prova in ${testTokens.join('/')} secondo ${NORM} ${clause} (qualificate: ${qualified.join(', ')}). La validità scritta sul certificato prevale: verificare il dato.`,
            }));
        } else if (under.length) {
            out.push(corr(POSITIONS, {
                ...common,
                direction: DIRECTION.UNDER_CLAIM,
                message_it: `Posizioni: il certificato dichiara ${declared.join(', ')}, più stretto di quanto ammesso da ${NORM} ${clause} per la prova in ${testTokens.join('/')} (qualificate: ${qualified.join(', ')}). Il rilascio può restringere la validità: nessuna azione richiesta.`,
            }));
        }
    }
    if (unknownDeclared.length) out.push(symbolGap(unknownDeclared, 'posizione dichiarata'));
    return out;
}

// ---------------------------------------------------------------------------------------------
// CORRETTEZZA — processo (§4.2, §5.2) e multi-processo (Tab. 1, GAP G1)
// ---------------------------------------------------------------------------------------------

const PROCESS = 'PROCESS';
const PROCESS_SCOPE = 'PROCESS_SCOPE';
const MULTI_PROCESS = 'MULTI_PROCESS';

function runMultiProcess(view) {
    if (!isMultiProcess(view)) return [];
    return [sourceMissing(corr, MULTI_PROCESS, 'welding_process_test', '§5.2 Tab. 1',
        `Prova multi-processo (${distinctBranches(testProcessText(view)).join(' + ')}): i campi di validità dello spessore (${NORM} §5.2 Tab. 1, t = s1 + s2) dipendono da figure non leggibili nel testo digitalizzato (GAP G1). Spessore, diametro e processi non verificabili.`,
        { fields: ['welding_process_test', 'thickness_min_mm', 'thickness_max_mm'], read_value: view.welding_process_test || view.welding_process })];
}

function runProcess(view) {
    const out = [];
    const testBranches = distinctBranches(testProcessText(view));
    if (testBranches.length === 1 && !rules2.QUALIFIED_PROCESSES.includes(testBranches[0])) {
        out.push(corr(PROCESS_SCOPE, {
            field: 'welding_process_test',
            direction: DIRECTION.MISMATCH,
            read_value: testBranches[0],
            expected_value: rules2.QUALIFIED_PROCESSES,
            source: source('§4.2'),
            message_it: `Processo di prova ${testBranches[0]}: ${NORM} §4.2 qualifica solo i processi ${rules2.QUALIFIED_PROCESSES.join(', ')}. Informativo: verificare il processo o la norma di riferimento del certificato.`,
        }));
    }

    const declared = Array.from(new Set(processCodes(view.welding_processes_validity).map(rules2.normalizeProcessBranch)));
    if (!declared.length || testBranches.length > 1) return out;

    const fields = ['welding_processes_validity', 'welding_process_test'];
    if (!testBranches.length) {
        out.push(dataMissing(corr, PROCESS, 'welding_processes_validity', '§5.2',
            `Processi di validità non verificabili: manca il processo di prova (${NORM} §5.2).`, { fields }));
        return out;
    }
    const qualified = rules2.computeQualifiedWeldingProcesses({ testProcess: testBranches[0] });
    if (!qualified) return out;
    const over = declared.filter((c) => !qualified.includes(c));
    if (!over.length) return out;
    out.push(corr(PROCESS, {
        field: 'welding_processes_validity',
        fields,
        severity: SEVERITY.WARN,
        direction: DIRECTION.OVER_CLAIM,
        read_value: declared,
        expected_value: qualified,
        source: source('§5.2'),
        message_it: `Processi: il certificato dichiara ${declared.join(', ')}; ${over.join(', ')} non ${over.length > 1 ? 'sono coperti' : 'è coperto'} dalla prova in ${testBranches[0]} secondo ${NORM} §5.2 (ogni prova qualifica un solo processo, nessuna equivalenza tra processi). La validità scritta sul certificato prevale: verificare il dato.`,
    }));
    return out;
}

// ---------------------------------------------------------------------------------------------
// CORRETTEZZA — gruppo materiale (Tab. 2: composizione gruppi Al = GAP G2)
// ---------------------------------------------------------------------------------------------

const MATERIAL_GROUP_SOURCE = 'MATERIAL_GROUP_SOURCE';

/**
 * Nessun giudizio sul gruppo: composizione dei gruppi 21-26, sottogruppi e gruppo 26 dipendono da CR ISO 15608
 * (GAP G2, HITL 5). Un valore tipo `2.2` può essere un gruppo Al «22» ricondotto al catalogo acciai dal
 * normalizzatore di ingest: per questo non si dichiara «fuori da 21-26» nemmeno quando sembra un gruppo acciaio.
 */
function runMaterialGroup(view) {
    const raw = view.material_group;
    if (!raw) return [];
    const tokens = raw.split(/[,;/+]|\be\b/i).map((s) => s.trim()).filter((s) => s && !/^(altro|other)$/i.test(s));
    if (!tokens.length) return [];
    return [sourceMissing(corr, MATERIAL_GROUP_SOURCE, 'material_group', '§5.5, Tab. 2',
        `Gruppo materiale base "${raw}": la composizione dei gruppi di alluminio 21-26 (${NORM} §5.5, Tab. 2), i sottogruppi e il gruppo 26 dipendono da CR ISO 15608 e ISO/TR 15608, non disponibili (GAP G2): gruppo non verificabile.`,
        { read_value: raw })];
}

// ---------------------------------------------------------------------------------------------
// CORRETTEZZA — conferma 6 mesi (§9.2), validità 2 anni (§9.2) e prolungamento (§9.3)
// ---------------------------------------------------------------------------------------------

const CONFIRMATION = 'CONFIRMATION_INTERVAL';
const VALIDITY_PERIOD = 'VALIDITY_PERIOD';

function runConfirmation(view) {
    const out = [];
    const due = view.next_confirmation_due;
    if (due) {
        const ref = view.last_confirmation_date || view.exam_date;
        const fields = ['exam_date', 'last_confirmation_date', 'next_confirmation_due'];
        if (!ref) {
            out.push(dataMissing(corr, CONFIRMATION, 'next_confirmation_due', '§9.2',
                `Intervallo di conferma non verificabile: manca la data di saldatura dei provini o dell'ultima conferma (${NORM} §9.2).`, { fields }));
        } else {
            const limit = rules2.computeNextConfirmationDue(ref);
            if (due > limit) {
                out.push(corr(CONFIRMATION, {
                    field: 'next_confirmation_due',
                    fields,
                    severity: SEVERITY.WARN,
                    direction: DIRECTION.OVER_CLAIM,
                    read_value: due,
                    expected_value: limit,
                    source: source('§9.2'),
                    message_it: `Prossima conferma al ${due}, oltre i ${rules2.CONFIRMATION_INTERVAL_MONTHS} mesi dal ${ref}: ${NORM} §9.2 richiede la conferma ogni ${rules2.CONFIRMATION_INTERVAL_MONTHS} mesi (entro il ${limit}). La data scritta sul certificato prevale: verificare il dato.`,
                }));
            }
        }
    }

    if (view.expiry_date && view.exam_date) {
        const limit = rules2.computeInitialValidityEnd(view.exam_date);
        if (view.expiry_date > limit) {
            out.push(dataMissing(corr, VALIDITY_PERIOD, 'expiry_date', '§9.3',
                `Scadenza al ${view.expiry_date}, oltre 2 anni dalla data di saldatura dei provini ${view.exam_date} (${NORM} §9.2: validità due anni, fino al ${limit}): è ammessa solo con il prolungamento biennale a cura di un esaminatore (§9.3), che il modello non registra come campo dedicato. Informativo: prolungamento non verificabile.`,
                {
                    fields: ['exam_date', 'expiry_date'],
                    direction: DIRECTION.OVER_CLAIM,
                    read_value: view.expiry_date,
                    expected_value: limit,
                }));
        }
    }
    return out;
}

// ---------------------------------------------------------------------------------------------

const corrRule = (code, run, codes) => ({
    id: CORR + code, family: FAMILY.CORRETTEZZA, codes: (codes || [code]).map((c) => CORR + c), run,
});

const CORRECTNESS_RULES = [
    corrRule(THK_BW, (v) => runThickness(v, {
        joint: 'BW', code: THK_BW, table: '3', compute: rules2.computeQualifiedThicknessRangeButtWeld, symbol: 't',
    })),
    corrRule(THK_FW, (v) => runThickness(v, {
        joint: 'FW', code: THK_FW, table: '5', compute: rules2.computeQualifiedFilletThicknessRange, symbol: 't',
    })),
    corrRule(PIPE_DIAMETER, runPipeDiameter),
    corrRule(PLATE_TO_PIPE, runPlateToPipe),
    corrRule(POSITIONS, runPositions, [POSITIONS, POSITIONS_SYMBOLS, POSITION_TEST_JOINT]),
    corrRule(PROCESS, runProcess, [PROCESS, PROCESS_SCOPE]),
    corrRule(MULTI_PROCESS, runMultiProcess),
    corrRule(MATERIAL_GROUP_SOURCE, runMaterialGroup),
    corrRule(CONFIRMATION, runConfirmation, [CONFIRMATION, VALIDITY_PERIOD]),
];

module.exports = {
    id: 'welder9606.part2',
    standardFamily: '9606-2',
    editions: [EDITION],
    profiles: ['9606-2:BW', '9606-2:FW'],
    rules: [...COMPLETENESS_RULES, ...CORRECTNESS_RULES],
};
