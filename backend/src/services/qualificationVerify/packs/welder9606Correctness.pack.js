/**
 * welder9606Correctness.pack.js — correttezza ISO 9606-1 (VQ-6).
 *
 * Dalla PROVA dichiarata (colonne `*_test`, designazione) ricalcola la validità con le funzioni
 * di `data/weldingQualificationRules9606.js` (unica fonte dei numeri) e la confronta con la validità
 * scritta sul certificato. Principio: la validità del certificato prevale — nessun valore viene
 * riscritto, `expected_value` è solo informativo.
 *
 * Severità (D2: nessuna tolleranza oltre l'arrotondamento a 0,01 mm):
 * - certificato PIÙ LARGO della norma (over_claim) o discordanza di token = `warn`;
 * - certificato più stretto (under_claim), dato non verificabile, regole «should» = `info`;
 * - input di prova assente (ma validità dichiarata) = `non_verificabile_dato_mancante`, mai `warn`.
 * Se il certificato non dichiara alcuna validità non c'è nulla da confrontare: nessun finding
 * (la mancanza del dato è compito del pack di completezza).
 * Tab. 3/4/5/11/12 (non confermate sul PDF, HITL 4) non sono codificate.
 *
 * Taratura VQ-TUNE (06/10/2026, misura su dati reali, brief DEPUTYTASK_VERIFICA_QUALIFICHE_TARATURA):
 * - `PIPE_DIAMETER` su giunti d'angolo (FW): al massimo `info` (Tab. 7 è per i giunti di testa);
 * - `PROCESS`: scarto di processo = `info` finché non esiste una base empirica (0 record con la validità);
 * - `DESIGNATION`: `info` se la designazione è costruita dalle colonne di validità (circolare).
 * Restano `warn`: spessori (Tab. 6/8), diametro BW (Tab. 7), posizioni, FILLER_GROUP, CONFIRMATION_INTERVAL.
 */

'use strict';

const rules9606 = require('../../../data/weldingQualificationRules9606');
const { normalizeWeldingProcessCode } = require('../../../data/weldingProcesses4063');
const { normalizeShieldingGasCode } = require('../../../data/shieldingGases14175');
const { normalizeMaterialGroupCode, getMaterialGroupSelectOptions } = require('../../../data/materialGroups15608');
const { parseWelderQualificationDesignation, buildWelderQualificationDesignation } = require('../../../utils/weldingDesignation');
const { FAMILY, SEVERITY, STATUS, DIRECTION, TEXT_STATUS } = require('../findingTypes');

const NORM = 'ISO 9606-1';
const EDITION = '2017';
const NORM_REF = 'docs/Normative/Normative NORMA_00018_ UNI EN ISO 9606-1_2017 Rev. 0.md';
const GAS_REF = 'docs/Normative/Normative NORMA_00012_ UNI EN ISO 14175_2008 Rev. 0.md';
const PREFIX = 'WQ9606_1.CORR';

const BUTT_WELD_COLUMNS = columnsOf(rules9606.BUTT_WELD_POSITION_QUALIFICATION_MATRIX);
const FILLET_WELD_COLUMNS = columnsOf(rules9606.FILLET_WELD_POSITION_QUALIFICATION_MATRIX);

function columnsOf(matrix) {
    return Array.from(new Set(Object.values(matrix).flat()));
}

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
/** Confronto a 0,01 mm (D2): -1 se a < b, 0 se uguali, +1 se a > b. */
const cmp = (a, b) => Math.sign(round2(a) - round2(b));
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function fmtNum(n) {
    return String(round2(n)).replace('.', ',');
}

function fmtRange(min, max, { unlimited = false } = {}) {
    const lo = min != null ? `da ${fmtNum(min)}` : null;
    if (max != null) return `${lo ? `${lo} a ` : 'fino a '}${fmtNum(max)} mm`;
    if (unlimited) return `${lo || 'da 0'} mm, senza limite superiore`;
    return `${lo || 'n.d.'} mm (massimo non dichiarato)`;
}

function source(clause, over = {}) {
    return { norm: NORM, edition: EDITION, clause, text_status: TEXT_STATUS.MD_INTEGRALE, ref: NORM_REF, ...over };
}

function finding(code, partial) {
    return {
        code,
        family: FAMILY.CORRETTEZZA,
        severity: SEVERITY.INFO,
        status: STATUS.VERIFICABILE,
        ...partial,
    };
}

function dataMissing(code, field, clause, message, extra = {}) {
    return finding(code, {
        status: STATUS.NON_VERIFICABILE_DATO_MANCANTE,
        field,
        source: source(clause),
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

function processCodes(text) {
    return String(text || '').match(/\d{2,3}/g) || [];
}

/** Processo di prova per le regole che dipendono dal processo (311, transfer mode, filler). */
function testProcessOf(view) {
    const raw = view.welding_process_test || view.welding_process;
    return raw ? normalizeWeldingProcessCode(raw) : null;
}

function positionTokens(raw) {
    return String(raw || '')
        .toUpperCase()
        .split(/[\s,;/+]+/)
        .map((t) => rules9606.normalizeWeldingPositionSymbol(t))
        .filter(Boolean);
}

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
    const declaredUnlimited = declared.max == null && declared.unlimited;
    if (declared.max != null && !declared.unlimited) {
        if (expected.maxMm == null) under.push('massimo');
        else {
            const c = cmp(declared.max, expected.maxMm);
            if (c > 0) over.push('massimo');
            else if (c < 0) under.push('massimo');
        }
    } else if (declaredUnlimited && expected.maxMm != null) {
        over.push('massimo');
    }
    return { over, under };
}

function hasRangeClaim(d) {
    return d.min != null || d.max != null || d.unlimited;
}

/** Finding per una verifica di range (spessore, diametro): over_claim warn, under_claim info. */
function rangeFinding({ code, field, fields, label, clause, testText, declared, expected, cmpResult, extraNote = '', maxSeverity = SEVERITY.WARN }) {
    const declText = fmtRange(declared.min, declared.max, { unlimited: declared.unlimited });
    const expText = fmtRange(expected.minMm, expected.maxMm, { unlimited: true });
    const read = { min: declared.min, max: declared.max, unlimited: declared.unlimited };
    const exp = { min: expected.minMm, max: expected.maxMm, unlimited: expected.maxMm == null };
    const base = { field, fields, read_value: read, expected_value: exp, source: source(clause) };
    if (cmpResult.over.length) {
        return finding(code, {
            ...base,
            severity: maxSeverity,
            direction: DIRECTION.OVER_CLAIM,
            message_it: `${label}: il certificato dichiara ${declText}, più largo del campo ammesso da ISO 9606-1 ${clause} per ${testText} (${expText}; ${cmpResult.over.join(' e ')} oltre la norma). La validità scritta sul certificato prevale: verificare il dato.${extraNote}`,
        });
    }
    return finding(code, {
        ...base,
        direction: DIRECTION.UNDER_CLAIM,
        message_it: `${label}: il certificato dichiara ${declText}, più stretto del campo ammesso da ISO 9606-1 ${clause} per ${testText} (${expText}). Il rilascio può restringere la validità: nessuna azione richiesta.${extraNote}`,
    });
}

// ---------------------------------------------------------------------------------------------
// Spessore (Tab. 6 BW, Tab. 8 FW)
// ---------------------------------------------------------------------------------------------

function declaredThickness(view) {
    return { min: view.thickness_min_mm, max: view.thickness_max_mm, unlimited: view.thickness_max_unlimited };
}

const THK_BW_CODE = `${PREFIX}.THK_BW`;
const THK_BW_LAYERS_CODE = `${PREFIX}.THK_BW_LAYERS`;

function runThicknessButtWeld(view) {
    if (view.joint_type !== 'BW') return [];
    const declared = declaredThickness(view);
    if (!hasRangeClaim(declared)) return [];

    const s = view.thickness_s_test_mm;
    const fields = ['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_s_test_mm'];
    if (!isNum(s) || s <= 0) {
        const hint = isNum(view.thickness_t_test_mm)
            ? ` Sul record c'è solo lo spessore t = ${fmtNum(view.thickness_t_test_mm)} mm (Tab. 6 usa lo spessore depositato s).`
            : '';
        return [dataMissing(THK_BW_CODE, 'thickness_max_mm', '§5.7 Tab. 6',
            `Spessore di validità non verificabile: manca lo spessore depositato di prova s (ISO 9606-1 §5.7 Tab. 6).${hint}`,
            { fields })];
    }

    const proc = testProcessOf(view);
    const expected = rules9606.computeQualifiedThicknessRangeButtWeld({ testThicknessMm: s, weldingProcessCode: proc });
    const is311 = proc === '311';
    const clause = is311 ? '§5.7 Tab. 6 note c/d' : '§5.7 Tab. 6';
    const result = compareRange(declared, expected);
    const out = [];

    if (result.over.length || result.under.length) {
        if (!proc && !result.over.length) {
            out.push(dataMissing(THK_BW_CODE, 'thickness_max_mm', '§5.7 Tab. 6',
                'Spessore di validità non verificabile: manca il processo di prova (per 311 la Tab. 6 note c/d dà limiti diversi).',
                { fields: [...fields, 'welding_process_test'] }));
        } else {
            out.push(rangeFinding({
                code: THK_BW_CODE,
                field: 'thickness_max_mm',
                fields,
                label: 'Spessore (giunto testa a testa)',
                clause,
                testText: `s = ${fmtNum(s)} mm`,
                declared,
                expected,
                cmpResult: result,
            }));
        }
    }

    if (s >= 12) {
        out.push(dataMissing(THK_BW_LAYERS_CODE, 'thickness_s_test_mm', '§5.7 Tab. 6 nota e',
            `Per s ≥ 12 mm la prova va saldata in almeno 3 passate (ISO 9606-1 §5.7 Tab. 6 nota e): il numero di passate non è registrato, controllo non eseguibile.`,
            { read_value: s }));
    }
    return out;
}

const THK_FW_CODE = `${PREFIX}.THK_FW`;

function runThicknessFilletWeld(view) {
    if (view.joint_type !== 'FW') return [];
    const declared = declaredThickness(view);
    if (!hasRangeClaim(declared)) return [];

    const t = view.thickness_t_test_mm;
    const fields = ['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_t_test_mm'];
    const expected = isNum(t) ? rules9606.computeQualifiedFilletThicknessRange({ testThicknessMm: t }) : null;
    if (!expected) {
        return [dataMissing(THK_FW_CODE, 'thickness_max_mm', '§5.7 Tab. 8',
            'Spessore di validità non verificabile: manca lo spessore del materiale di prova t (ISO 9606-1 §5.7 Tab. 8).',
            { fields })];
    }

    const result = compareRange(declared, expected);
    if (!result.over.length && !result.under.length) return [];
    return [rangeFinding({
        code: THK_FW_CODE,
        field: 'thickness_max_mm',
        fields,
        label: "Spessore (giunto d'angolo)",
        clause: '§5.7 Tab. 8',
        testText: `t = ${fmtNum(t)} mm`,
        declared,
        expected,
        cmpResult: result,
    })];
}

// ---------------------------------------------------------------------------------------------
// Diametro (Tab. 7) e passaggio piastra → tubo (§5.3 b, c)
// ---------------------------------------------------------------------------------------------

const PIPE_CODE = `${PREFIX}.PIPE_DIAMETER`;
const FILLET_PIPE_NOTE = " Interpretazione, non clausola esplicita: per i cordoni d'angolo il testo di §5.7 rimanda alla Tab. 8 solo per gli spessori; la Tab. 7 (diametro) è presentata per i giunti di testa. Solo informativo.";

function runPipeDiameter(view) {
    if (normProduct(view.product_type) === 'P') return [];
    const declared = { min: view.pipe_diameter_min_mm, max: view.pipe_diameter_max_mm, unlimited: false };
    if (!hasRangeClaim(declared)) return [];

    const fields = ['pipe_diameter_min_mm', 'pipe_diameter_max_mm', 'pipe_diameter_test_mm'];
    const d = view.pipe_diameter_test_mm;
    const expected = isNum(d) ? rules9606.computeQualifiedPipeDiameterRange({ testDiameterMm: d }) : null;
    if (!expected) {
        return [dataMissing(PIPE_CODE, 'pipe_diameter_min_mm', '§5.7 Tab. 7',
            'Diametro di validità non verificabile: manca il diametro esterno del tubo di prova D (ISO 9606-1 §5.7 Tab. 7).',
            { fields })];
    }

    const result = compareRange(declared, expected);
    if (!result.over.length && !result.under.length) return [];
    const isFillet = view.joint_type === 'FW';
    return [rangeFinding({
        code: PIPE_CODE,
        field: 'pipe_diameter_min_mm',
        fields,
        label: 'Diametro esterno tubo',
        clause: '§5.7 Tab. 7',
        testText: `D = ${fmtNum(d)} mm`,
        declared,
        expected,
        cmpResult: result,
        ...(isFillet ? { maxSeverity: SEVERITY.INFO, extraNote: FILLET_PIPE_NOTE } : {}),
    })];
}

const PLATE_TO_PIPE_CODE = `${PREFIX}.PLATE_TO_PIPE`;
/** §5.3 c): la soglia più bassa con cui una prova su piastra copre tubi. */
const PLATE_TO_PIPE_MIN_MM = 75;

function runPlateToPipe(view) {
    if (normProduct(view.product_type) !== 'P') return [];
    const min = view.pipe_diameter_min_mm;
    if (!isNum(min) || min >= PLATE_TO_PIPE_MIN_MM) return [];
    return [finding(PLATE_TO_PIPE_CODE, {
        field: 'pipe_diameter_min_mm',
        fields: ['product_type', 'pipe_diameter_min_mm'],
        direction: DIRECTION.OVER_CLAIM,
        read_value: min,
        expected_value: { min: PLATE_TO_PIPE_MIN_MM },
        source: source('§5.3 b), c)'),
        message_it: `Tipo prodotto piastra (P) con diametro tubo da ${fmtNum(min)} mm: secondo ISO 9606-1 §5.3 b), c) una prova su piastra copre solo tubi fissi con D ≥ 500 mm o tubi in rotazione con D ≥ 75 mm (posizioni PA, PB, PC, PD). Informativo: verificare se il certificato include anche una prova su tubo.`,
    })];
}

// ---------------------------------------------------------------------------------------------
// Posizioni (Tab. 9 BW, Tab. 10 FW)
// ---------------------------------------------------------------------------------------------

const POSITIONS_CODE = `${PREFIX}.POSITIONS`;

function runPositions(view) {
    const joint = view.joint_type;
    if (joint !== 'BW' && joint !== 'FW') return [];
    const declared = Array.from(new Set(view.positions.flatMap((p) => positionTokens(p))));
    if (!declared.length) return [];

    const tab = joint === 'BW' ? 'Tab. 9' : 'Tab. 10';
    const clause = `§5.8 ${tab}`;
    const fields = ['welding_positions', 'welding_position_test'];
    const testTokens = positionTokens(view.welding_position_test);
    if (!testTokens.length) {
        return [dataMissing(POSITIONS_CODE, 'welding_positions', clause,
            `Posizioni di validità non verificabili: manca la posizione della prova (ISO 9606-1 ${clause}).`, { fields })];
    }

    const qualified = new Set();
    for (const tok of testTokens) {
        const list = rules9606.computeQualifiedWeldingPositions({ testPosition: tok, jointType: joint });
        if (!list) {
            return [dataMissing(POSITIONS_CODE, 'welding_position_test', clause,
                `Posizioni di validità non verificabili: la posizione di prova "${tok}" non è una riga di ISO 9606-1 ${clause} per questo tipo di giunto.`, { fields })];
        }
        list.forEach((p) => qualified.add(p));
    }

    const columns = joint === 'BW' ? BUTT_WELD_COLUMNS : FILLET_WELD_COLUMNS;
    const judged = declared.filter((p) => columns.includes(p));
    const unjudged = declared.filter((p) => !columns.includes(p));
    const over = judged.filter((p) => !qualified.has(p));
    const under = Array.from(qualified).filter((p) => !declared.includes(p));
    const qualifiedText = Array.from(qualified).join(', ');
    const common = {
        field: 'welding_positions',
        fields,
        read_value: declared,
        expected_value: Array.from(qualified),
        source: source(clause),
    };

    if (over.length) {
        return [finding(POSITIONS_CODE, {
            ...common,
            severity: SEVERITY.WARN,
            direction: DIRECTION.OVER_CLAIM,
            message_it: `Posizioni: il certificato dichiara ${declared.join(', ')}; ${over.join(', ')} non ${over.length > 1 ? 'sono qualificate' : 'è qualificata'} dalla prova in ${testTokens.join('/')} secondo ISO 9606-1 ${clause} (qualificate: ${qualifiedText}). La validità scritta sul certificato prevale: verificare il dato.`,
        })];
    }
    if (under.length) {
        return [finding(POSITIONS_CODE, {
            ...common,
            direction: DIRECTION.UNDER_CLAIM,
            message_it: `Posizioni: il certificato dichiara ${declared.join(', ')}, più stretto di quanto ammesso da ISO 9606-1 ${clause} per la prova in ${testTokens.join('/')} (qualificate: ${qualifiedText}). Il rilascio può restringere la validità: nessuna azione richiesta.`,
        })];
    }
    if (unjudged.length) {
        return [dataMissing(POSITIONS_CODE, 'welding_positions', clause,
            `Posizioni ${unjudged.join(', ')} non confrontabili con ISO 9606-1 ${clause} (possibile prova d'angolo supplementare §5.4 e, non registrata nel modello).`,
            { fields, read_value: declared })];
    }
    return [];
}

// ---------------------------------------------------------------------------------------------
// Processo (§5.2) e metodo di trasferimento
// ---------------------------------------------------------------------------------------------

const PROCESS_CODE = `${PREFIX}.PROCESS`;
/** Nessun record reale con `welding_processes_validity` (misura 06/10/2026): `info` finché non c'è una base empirica. */
const PROCESS_OVER_CLAIM_SEVERITY = SEVERITY.INFO;

function runProcess(view) {
    const declared = Array.from(new Set(processCodes(view.welding_processes_validity)));
    if (!declared.length) return [];

    const fields = ['welding_processes_validity', 'welding_process_test'];
    const testCodes = processCodes(view.welding_process_test);
    if (!testCodes.length) {
        return [dataMissing(PROCESS_CODE, 'welding_processes_validity', '§5.2',
            'Processi di validità non verificabili: manca il processo di prova (ISO 9606-1 §5.2).', { fields })];
    }
    if (testCodes.length > 1) {
        return [dataMissing(PROCESS_CODE, 'welding_process_test', '§5.2',
            'Processi di validità non verificabili: prova multi-processo (ISO 9606-1 Tab. 1) non modellata.', { fields })];
    }

    const qualified = rules9606.computeQualifiedWeldingProcesses({ testProcess: testCodes[0] });
    const over = declared.filter((c) => !qualified.includes(c));
    if (!over.length) return [];
    return [finding(PROCESS_CODE, {
        field: 'welding_processes_validity',
        fields,
        severity: PROCESS_OVER_CLAIM_SEVERITY,
        direction: DIRECTION.OVER_CLAIM,
        read_value: declared,
        expected_value: qualified,
        source: source('§5.2'),
        message_it: `Processi: il certificato dichiara ${declared.join(', ')}; ${over.join(', ')} non ${over.length > 1 ? 'sono coperti' : 'è coperto'} dalla prova in ${testCodes[0]} secondo ISO 9606-1 §5.2 (coperti: ${qualified.join(', ')}). La validità scritta sul certificato prevale: verificare il dato. Informativo: regola non ancora tarata su dati reali.`,
    })];
}

const TRANSFER_MODE_CODE = `${PREFIX}.TRANSFER_MODE`;

function runTransferMode(view) {
    if (!view.transfer_mode) return [];
    const proc = testProcessOf(view);
    if (!proc) return [];
    if (rules9606.getApplicableWelderFields({ weldingProcessCode: proc }).transferModeApplicable) return [];
    return [finding(TRANSFER_MODE_CODE, {
        field: 'transfer_mode',
        fields: ['transfer_mode', 'welding_process_test'],
        direction: DIRECTION.MISMATCH,
        read_value: view.transfer_mode,
        expected_value: null,
        source: source('§5.2'),
        message_it: `Metodo di trasferimento "${view.transfer_mode}" indicato per il processo ${proc}: ISO 9606-1 §5.2 e Annex A lo prevedono solo per i processi ad arco con filo continuo (${rules9606.CONTINUOUS_WIRE_ARC_PROCESSES.join(', ')}). Verificare il dato.`,
    })];
}

// ---------------------------------------------------------------------------------------------
// Designazione (§11): descrive la PROVA, mai confrontata con la validità
// ---------------------------------------------------------------------------------------------

const DESIGNATION_CODE = `${PREFIX}.DESIGNATION`;

function fmGroup(text) {
    const m = String(text || '').match(/FM\s*(\d+)/i);
    return m ? `FM${m[1]}` : null;
}

/** Token di spessore/diametro che descrivono la VALIDITÀ (`t≥3`, `t3-18`, `D≥60,3`, `D25-50`), non la prova. */
const VALIDITY_RANGE_TOKEN_RE = /(?:^|\s)(?:t\s*[\u2265>]=?\s*\d|[tD]\s*\d+(?:[.,]\d+)?\s*[-\u2013]\s*\d|D\s*[\u2265>]=?\s*\d)/i;

/**
 * La designazione è «circolare» se descrive la validità e non la prova: contiene token di range
 * (`t≥3`, `t3-18`, `D≥60,3`) oppure coincide con quella ricostruita dalle colonne di validità del
 * record (`buildWelderQualificationDesignation`, stessa funzione dell'app). In quel caso il confronto
 * con i campi di prova non è una verifica indipendente.
 */
function isDesignationDerivedFromValidity(view) {
    const printed = String(view.qualification_designation || '').trim();
    if (VALIDITY_RANGE_TOKEN_RE.test(printed)) return true;
    const rebuilt = buildWelderQualificationDesignation({
        welding_process: view.welding_process,
        product_type: view.product_type,
        joint_type: view.joint_type,
        filler_material_group: view.filler_material_group,
        thickness_min_mm: view.thickness_min_mm,
        thickness_max_mm: view.thickness_max_mm,
        pipe_diameter_min_mm: view.pipe_diameter_min_mm,
        pipe_diameter_max_mm: view.pipe_diameter_max_mm,
        welding_positions: view.positions,
        weld_details: view.weld_details,
    });
    const squash = (t) => String(t || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const withoutNorm = printed.replace(/^ISO\s*9606-1\s*[:.\-]?\s*(?:(?:19|20)\d{2}(?:\s*\+\s*A\d+)?\s+)?/i, '');
    return rebuilt != null && squash(withoutNorm) === squash(rebuilt);
}

function runDesignation(view) {
    if (!view.qualification_designation) return [];
    const parsed = parseWelderQualificationDesignation(view.qualification_designation);
    if (!parsed) return [];
    const circular = isDesignationDerivedFromValidity(view);

    const mismatches = [];
    const check = (label, column, columnValue, designationValue, same) => {
        if (columnValue == null || designationValue == null) return;
        if (!same(columnValue, designationValue)) mismatches.push({ label, column, columnValue, designationValue });
    };
    const eq = (a, b) => String(a) === String(b);
    const num = (a, b) => cmp(a, b) === 0;

    const testProcess = view.welding_process_test ? processCodes(view.welding_process_test)[0] : null;
    check('processo', 'welding_process_test', testProcess, parsed.welding_process_test, eq);
    check('tipo prodotto', 'product_type', normProduct(view.product_type), parsed.product_type, eq);
    check('tipo di giunto', 'joint_type', view.joint_type, parsed.joint_type, eq);
    check('gruppo materiale d\'apporto', 'filler_material_group', fmGroup(view.filler_material_group), parsed.filler_material_group, eq);

    const designationThickness = parsed.thickness_s_test_mm != null ? parsed.thickness_s_test_mm : parsed.thickness_t_test_mm;
    if (view.joint_type === 'BW') check('spessore s', 'thickness_s_test_mm', view.thickness_s_test_mm, designationThickness, num);
    if (view.joint_type === 'FW') check('spessore t', 'thickness_t_test_mm', view.thickness_t_test_mm, designationThickness, num);
    check('diametro D', 'pipe_diameter_test_mm', view.pipe_diameter_test_mm, parsed.pipe_diameter_test_mm, num);

    const testPositions = positionTokens(view.welding_position_test);
    check('posizione', 'welding_position_test', testPositions.length ? testPositions : null, parsed.welding_position_test,
        (cols, des) => cols.includes(String(des).toUpperCase()));

    if (!mismatches.length) return [];
    const text = mismatches.map((m) => `${m.label}: designazione ${m.designationValue}, campi di prova ${Array.isArray(m.columnValue) ? m.columnValue.join('/') : m.columnValue}`).join('; ');
    return [finding(DESIGNATION_CODE, {
        field: mismatches[0].column,
        fields: ['qualification_designation', ...mismatches.map((m) => m.column)],
        severity: circular ? SEVERITY.INFO : SEVERITY.WARN,
        direction: DIRECTION.MISMATCH,
        read_value: Object.fromEntries(mismatches.map((m) => [m.column, m.columnValue])),
        expected_value: Object.fromEntries(mismatches.map((m) => [m.column, m.designationValue])),
        source: source('§11'),
        message_it: `La designazione stampata non coincide con i dati di prova (${text}): ISO 9606-1 §11 la designazione descrive la prova eseguita. Verificare quale dei due è stato letto male; la validità non è toccata.${circular ? ' Informativo: la designazione risulta costruita dalle colonne di validità, non letta dal certificato (controllo circolare).' : ''}`,
    })];
}

// ---------------------------------------------------------------------------------------------
// Gas (ISO 14175), gruppo materiale (§5.5.1), gruppo d'apporto (§5.5.2 Tab. 2)
// ---------------------------------------------------------------------------------------------

const GAS_CODE = `${PREFIX}.GAS_14175`;

function runShieldingGas(view) {
    const v = view.shielding_gas;
    if (!v || v.toLowerCase() === 'altro') return [];
    if (normalizeShieldingGasCode(v)) return [];
    return [finding(GAS_CODE, {
        field: 'shielding_gas',
        direction: DIRECTION.MISMATCH,
        read_value: v,
        source: { norm: 'ISO 14175', edition: '2008', clause: 'ISO 14175', text_status: TEXT_STATUS.MD_INTEGRALE, ref: GAS_REF },
        message_it: `Gas di protezione "${v}" non riconosciuto nel catalogo ISO 14175: verificare.`,
    })];
}

const MATERIAL_GROUP_CODE = `${PREFIX}.MATERIAL_GROUP`;

/** Codici esatti del catalogo ISO/TR 15608 (il normalizzatore del catalogo è tollerante: "22" → "2.2"). */
const KNOWN_MATERIAL_GROUPS = new Set(getMaterialGroupSelectOptions({ includeAltro: false }).map((o) => o.value));

function materialGroupOf(token) {
    if (/^\d{1,2}(?:\.\d{1,2})?$/.test(token)) return KNOWN_MATERIAL_GROUPS.has(token) ? token : null;
    return normalizeMaterialGroupCode(token);
}

function runMaterialGroup(view) {
    const v = view.material_group;
    if (!v) return [];
    const unknown = [];
    const outside = [];
    for (const token of v.split(/[,;/+]|\be\b/i).map((s) => s.trim()).filter(Boolean)) {
        if (/^(altro|other)$/i.test(token)) continue;
        const code = materialGroupOf(token);
        if (!code) unknown.push(token);
        else if (parseInt(code, 10) < 1 || parseInt(code, 10) > 11) outside.push(code);
    }
    if (!unknown.length && !outside.length) return [];
    const reasons = [];
    if (unknown.length) reasons.push(`${unknown.join(', ')} non riconosciuto nel catalogo ISO/TR 15608`);
    if (outside.length) reasons.push(`${outside.join(', ')} fuori dai gruppi 1–11`);
    return [finding(MATERIAL_GROUP_CODE, {
        field: 'material_group',
        direction: DIRECTION.MISMATCH,
        read_value: v,
        expected_value: null,
        source: source('§5.5.1'),
        message_it: `Gruppo materiale base "${v}": ${reasons.join('; ')}. ISO 9606-1 §5.5.1 raccomanda («should») materiali ISO/TR 15608 gruppi 1–11: informativo.`,
    })];
}

const FILLER_GROUP_CODE = `${PREFIX}.FILLER_GROUP`;
const FILLER_GROUPS = ['FM1', 'FM2', 'FM3', 'FM4', 'FM5', 'FM6'];
/** 142 e 311 non usano materiale d'apporto: il campo contiene il gruppo del materiale base (§5.6 NOTE). */
const PROCESSES_WITHOUT_FILLER = ['142', '311'];

function runFillerGroup(view) {
    const v = view.filler_material_group;
    if (!v) return [];
    if (PROCESSES_WITHOUT_FILLER.includes(testProcessOf(view))) return [];

    const clause = '§5.5.2 Tab. 2';
    const groups = Array.from(String(v).matchAll(/FM\s*(\d+)/gi)).map((m) => `FM${m[1]}`);
    const invalid = groups.filter((g) => !FILLER_GROUPS.includes(g));
    const common = { field: 'filler_material_group', direction: DIRECTION.MISMATCH, read_value: v, expected_value: FILLER_GROUPS, source: source(clause) };
    if (invalid.length) {
        return [finding(FILLER_GROUP_CODE, {
            ...common,
            severity: SEVERITY.WARN,
            message_it: `Gruppo materiale d'apporto "${v}": ${invalid.join(', ')} non esiste in ISO 9606-1 ${clause} (gruppi ammessi FM1–FM6). Verificare il dato.`,
        })];
    }
    if (!groups.length) {
        return [finding(FILLER_GROUP_CODE, {
            ...common,
            message_it: `Gruppo materiale d'apporto "${v}" non è un gruppo FM1–FM6 di ISO 9606-1 ${clause}: potrebbe essere una designazione del materiale. Informativo.`,
        })];
    }
    return [];
}

// ---------------------------------------------------------------------------------------------
// Conferma 6 mesi (§9.1, §9.2) e periodo di validità (§9.3)
// ---------------------------------------------------------------------------------------------

const CONFIRMATION_CODE = `${PREFIX}.CONFIRMATION_INTERVAL`;
const VALIDITY_PERIOD_CODE = `${PREFIX}.VALIDITY_PERIOD`;
const VALIDITY_PERIOD_MONTHS = 36;

/** `YYYY-MM-DD` + n mesi, con l'overflow di fine mese del calendario (31/08 + 6 mesi = 03/03). */
function addMonths(dateStr, months) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1 + months, d)).toISOString().slice(0, 10);
}

function runConfirmation(view) {
    const out = [];
    const due = view.next_confirmation_due;
    if (due) {
        const ref = view.last_confirmation_date || view.exam_date;
        const fields = ['exam_date', 'last_confirmation_date', 'next_confirmation_due'];
        if (!ref) {
            out.push(dataMissing(CONFIRMATION_CODE, 'next_confirmation_due', '§9.2',
                'Intervallo di conferma non verificabile: manca la data di esame o dell\'ultima conferma (ISO 9606-1 §9.2).', { fields }));
        } else {
            const limit = addMonths(ref, rules9606.CONFIRMATION_INTERVAL_MONTHS);
            if (due > limit) {
                out.push(finding(CONFIRMATION_CODE, {
                    field: 'next_confirmation_due',
                    fields,
                    severity: SEVERITY.WARN,
                    direction: DIRECTION.OVER_CLAIM,
                    read_value: due,
                    expected_value: limit,
                    source: source('§9.2'),
                    message_it: `Prossima conferma al ${due}, oltre i ${rules9606.CONFIRMATION_INTERVAL_MONTHS} mesi dal ${ref}: ISO 9606-1 §9.1, §9.2 richiede la conferma ogni ${rules9606.CONFIRMATION_INTERVAL_MONTHS} mesi (entro il ${limit}). La data scritta sul certificato prevale: verificare il dato.`,
                }));
            }
        }
    }

    if (view.expiry_date && view.exam_date) {
        const limit = addMonths(view.exam_date, VALIDITY_PERIOD_MONTHS);
        if (view.expiry_date > limit) {
            out.push(finding(VALIDITY_PERIOD_CODE, {
                field: 'expiry_date',
                fields: ['exam_date', 'expiry_date'],
                direction: DIRECTION.OVER_CLAIM,
                read_value: view.expiry_date,
                expected_value: limit,
                source: source('§9.3'),
                message_it: `Scadenza al ${view.expiry_date}, oltre 3 anni dalla data di esame ${view.exam_date}: ISO 9606-1 §9.3 a) prevede il nuovo esame ogni 3 anni; oltre sono ammesse solo le rivalidazioni §9.3 b) e c) (metodo non registrato sul modello). Informativo.`,
            }));
        }
    }
    return out;
}

// ---------------------------------------------------------------------------------------------

module.exports = {
    id: 'welder9606.correctness',
    standardFamily: '9606-1',
    editions: ['2017', '2013', '2012'],
    profiles: ['9606-1:BW', '9606-1:FW'],
    rules: [
        { id: THK_BW_CODE, family: FAMILY.CORRETTEZZA, codes: [THK_BW_CODE, THK_BW_LAYERS_CODE], run: runThicknessButtWeld },
        { id: THK_FW_CODE, family: FAMILY.CORRETTEZZA, run: runThicknessFilletWeld },
        { id: PIPE_CODE, family: FAMILY.CORRETTEZZA, run: runPipeDiameter },
        { id: PLATE_TO_PIPE_CODE, family: FAMILY.CORRETTEZZA, run: runPlateToPipe },
        { id: POSITIONS_CODE, family: FAMILY.CORRETTEZZA, run: runPositions },
        { id: PROCESS_CODE, family: FAMILY.CORRETTEZZA, run: runProcess },
        { id: TRANSFER_MODE_CODE, family: FAMILY.CORRETTEZZA, run: runTransferMode },
        { id: DESIGNATION_CODE, family: FAMILY.CORRETTEZZA, run: runDesignation },
        { id: GAS_CODE, family: FAMILY.CORRETTEZZA, run: runShieldingGas },
        { id: MATERIAL_GROUP_CODE, family: FAMILY.CORRETTEZZA, run: runMaterialGroup },
        { id: FILLER_GROUP_CODE, family: FAMILY.CORRETTEZZA, run: runFillerGroup },
        { id: CONFIRMATION_CODE, family: FAMILY.CORRETTEZZA, codes: [CONFIRMATION_CODE, VALIDITY_PERIOD_CODE], run: runConfirmation },
    ],
};
