'use strict';

const { verifyWpqr } = require('../index');
const { validateFinding, SEVERITY, STATUS, FAMILY } = require('../findingTypes');
const registry = require('../verifyRegistry');
const { ensureDefaultPacks } = require('../registerDefaultPacks');
const pack = require('./wpqrCompleteness.pack');
const { toWpqrView } = require('../wpqrRecordView');

const P1 = 'WPQR15614_1.COMP.';
const P2 = 'WPQR15614_2.COMP.';
const P55 = 'WPQR14555.COMP.';

const arcRun = (over = {}) => ({
    run_label: '1',
    welding_process: '135',
    filler_diameter_mm: 1.2,
    current_a: 180,
    voltage_v: 22,
    current_polarity: 'DCEN',
    travel_speed: 8,
    travel_speed_unit: 'mm/s',
    heat_input_value: 0.5,
    heat_input_unit: 'kJ/mm',
    ...over,
});

const complete15614 = (over = {}) => ({
    standard_reference: 'ISO 15614-1:2017+A1:2019',
    qualification_level: 'Level 2',
    joint_type: 'BW',
    product_type: 'P',
    welding_process: '135',
    material_group: '1.1',
    filler_material: 'G42',
    thickness_test_mm: 12,
    welding_positions: 'PA',
    current_type: 'DCEN',
    heat_input_kind: 'heat_input',
    heat_input_note: '0,5 kJ/mm',
    preheat_temp_test: 50,
    interpass_temp_test: 150,
    backing_gas: 'none',
    post_heating: 'none',
    pwht: 0,
    test_runs: [arcRun()],
    ...over,
});

const complete15614Fw = (over = {}) => complete15614({
    joint_type: 'FW',
    throat_test_mm: 5,
    ...over,
});

const complete15614_2 = (over = {}) => complete15614({
    standard_reference: 'ISO 15614-2:2025',
    ...over,
});

const studRun = (over = {}) => ({
    run_label: '1',
    welding_process: '783',
    current_a: 900,
    weld_time_ms: 400,
    protrusion_mm: 4,
    lift_mm: 2,
    ...over,
});

const complete14555 = (over = {}) => ({
    standard_reference: 'ISO 14555:2025',
    welding_process: '783',
    material_group: '1.1',
    thickness_test_mm: 10,
    welding_positions: 'PA',
    preheat_temp: 'nessuno',
    pwht: 0,
    test_runs: [studRun()],
    ...over,
});

const run = (input, opts) => verifyWpqr(input, opts);
const own = (result, prefix = P1) => result.findings.filter((f) => f.code.startsWith(prefix));
const find = (result, code) => result.findings.filter((f) => f.code === code);
const only = (result, code) => {
    const found = find(result, code);
    expect(found).toHaveLength(1);
    return found[0];
};

beforeEach(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('pack wpqrCompleteness — forma', () => {
    test('è registrato per i profili 15614-1/2 e 14555', () => {
        expect(registry.getRulePack('wpqr.completeness')).toBe(pack);
        expect(pack.standardFamily).toBe('15614-1');
        expect(pack.profiles).toEqual([
            '15614-1:BW', '15614-1:FW', '15614-1:UNKNOWN', '15614-2:BW', '15614-2:FW', '14555:SW',
        ]);
        expect(pack.editions).toEqual(['2017', '2017+A1:2019']);
    });

    test('regole di completezza, id unici, ogni finding passa validateFinding', () => {
        expect(pack.rules.length).toBeGreaterThan(10);
        const ids = pack.rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const r of pack.rules) {
            expect(r.family).toBe(FAMILY.COMPLETEZZA);
            expect(r.id.startsWith(P1)).toBe(true);
            expect(Array.isArray(r.codes)).toBe(true);
        }
        const r = run(complete15614({ welding_process: null, filler_material: null }));
        expect(r.findings.length).toBeGreaterThan(0);
        r.findings.forEach((f) => expect(validateFinding(f)).toEqual({ ok: true, errors: [] }));
    });
});

describe('certificato completo → nessun avviso di completezza', () => {
    test.each([
        ['15614-1 BW piastra L2', complete15614(), P1],
        ['15614-1 FW piastra', complete15614Fw(), P1],
        ['15614-1 UNKNOWN (giunto assente)', complete15614({ joint_type: null }), P1],
        ['15614-1 BW tubo L2 con diametro', complete15614({
            product_type: 'T', diameter_test_mm: 168.3, diameter_min: 84,
        }), P1],
        ['15614-2 BW', complete15614_2(), P2],
        ['15614-2 FW', complete15614_2({ joint_type: 'FW', throat_test_mm: 4 }), P2],
        ['14555 stud', complete14555(), P55],
    ])('%s', (_name, input, prefix) => {
        const r = run(input);
        expect(own(r, prefix).map((f) => f.code)).toEqual([]);
    });
});

describe('BW / FW / UNKNOWN, piastra vs tubo, L1 vs L2', () => {
    test('piastra: diametro non richiesto', () => {
        const r = run(complete15614({ product_type: 'P', diameter_test_mm: null }));
        expect(find(r, `${P1}DIAMETER`)).toHaveLength(0);
    });

    test('tubo L2 senza diametro → warn', () => {
        const f = only(run(complete15614({ product_type: 'T', diameter_test_mm: null, diameter_min: null })), `${P1}DIAMETER`);
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
    });

    test('tubo L1: diametro non essenziale', () => {
        const r = run(complete15614({
            qualification_level: '1', product_type: 'T', diameter_test_mm: null,
        }));
        expect(find(r, `${P1}DIAMETER`)).toHaveLength(0);
    });

    test('product_type NULL in L2 → non_verificabile_dato_mancante, non warn', () => {
        const f = only(run(complete15614({ product_type: null })), `${P1}DIAMETER`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
        expect(f.field).toBe('product_type');
    });

    test('livello assente → COMP.LEVEL info e applicato L2 (diametro ancora essenziale su tubo)', () => {
        const r = run(complete15614({
            qualification_level: null, product_type: 'T', diameter_test_mm: null, diameter_min: null,
        }));
        const level = only(r, `${P1}LEVEL`);
        expect(level.severity).toBe(SEVERITY.INFO);
        expect(level.message_it).toMatch(/Level 2/i);
        expect(only(r, `${P1}DIAMETER`).severity).toBe(SEVERITY.WARN);
        expect(toWpqrView(complete15614({ qualification_level: null })).level).toBe(2);
        expect(toWpqrView(complete15614({ qualification_level: null })).level_declared).toBe(false);
    });
});

describe('passate presenti / assenti', () => {
    test('senza passate: un solo info RUNS_PRESENT, nessun RUN_FIELDS', () => {
        const r = run(complete15614({ test_runs: [] }));
        expect(find(r, `${P1}RUNS_PRESENT`)).toHaveLength(1);
        expect(find(r, `${P1}RUNS_PRESENT`)[0].status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
        expect(find(r, `${P1}RUNS_PRESENT`)[0].severity).toBe(SEVERITY.INFO);
        expect(find(r, `${P1}RUN_FIELDS`)).toHaveLength(0);
    });

    test('passata presente ma incompleta: warn sui campi essenziali, info su avanzamento/apporto', () => {
        const r = run(complete15614({
            current_type: 'DCEN',
            test_runs: [{ run_label: 'A', welding_process: '135' }],
        }));
        const fields = find(r, `${P1}RUN_FIELDS`);
        const keys = fields.flatMap((f) => f.fields);
        expect(keys).toEqual(expect.arrayContaining([
            'runs[0].current_a', 'runs[0].voltage_v', 'runs[0].filler_diameter_mm',
        ]));
        expect(fields.filter((f) => f.fields.includes('runs[0].current_a'))[0].severity).toBe(SEVERITY.WARN);
        expect(fields.filter((f) => f.fields.includes('runs[0].travel_speed'))[0].severity).toBe(SEVERITY.INFO);
        expect(keys.join(' ')).not.toMatch(/wire_feed/);
        fields.forEach((f) => expect(validateFinding(f)).toEqual({ ok: true, errors: [] }));
    });

    test('polarità assente in riga ma presente in testata: nessun warn di polarità', () => {
        const r = run(complete15614({
            current_type: 'DC-EP',
            test_runs: [arcRun({ current_polarity: null })],
        }));
        const polar = find(r, `${P1}RUN_FIELDS`).filter((f) => f.fields.includes('runs[0].current_polarity'));
        expect(polar).toHaveLength(0);
        expect(find(r, `${P1}NORMALIZATION`).some((f) => f.field === 'current_type')).toBe(true);
    });

    test('polarità assente in riga e in testata: warn', () => {
        const r = run(complete15614({
            current_type: null,
            test_runs: [arcRun({ current_polarity: null })],
        }));
        expect(find(r, `${P1}RUN_FIELDS`).some((f) => f.fields.includes('runs[0].current_polarity'))).toBe(true);
        expect(only(r, `${P1}CURRENT_TYPE`).severity).toBe(SEVERITY.WARN);
    });

    test('unità mancante con valore presente → info', () => {
        const r = run(complete15614({
            test_runs: [arcRun({ travel_speed_unit: null, heat_input_unit: null })],
        }));
        const fields = find(r, `${P1}RUN_FIELDS`);
        expect(fields.find((f) => f.fields.includes('runs[0].travel_speed_unit')).severity).toBe(SEVERITY.INFO);
        expect(fields.find((f) => f.fields.includes('runs[0].heat_input_unit')).severity).toBe(SEVERITY.INFO);
    });
});

describe('evidenze campione 07/10/2026', () => {
    test('HEAT_INPUT_KIND è info se il valore c\'è e il tipo manca', () => {
        const f = only(run(complete15614({ heat_input_kind: null })), `${P1}HEAT_INPUT_KIND`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
    });

    test('wire_feed_speed assente: nessun finding', () => {
        const r = run(complete15614({ test_runs: [arcRun({ wire_feed_speed: null })] }));
        expect(r.findings.some((f) => /wire_feed/i.test(JSON.stringify(f)))).toBe(false);
    });

    test('preheat assente → warn; «nessuno» esplicito accettato', () => {
        const missing = only(run(complete15614({ preheat_temp_test: null, preheat_temp: null })), `${P1}PREHEAT`);
        expect(missing.severity).toBe(SEVERITY.WARN);
        expect(own(run(complete15614({ preheat_temp_test: null, preheat_temp: 'nessuno' })), P1)
            .filter((f) => f.code === `${P1}PREHEAT`)).toHaveLength(0);
    });

    test('interpass assente → info, non warn', () => {
        const f = only(run(complete15614({ interpass_temp_test: null, interpass_temp: null })), `${P1}INTERPASS`);
        expect(f.severity).toBe(SEVERITY.INFO);
    });

    test('pwht = 0 senza dettagli: nessun avviso PWHT', () => {
        const r = run(complete15614({ pwht: 0, pwht_details: null }));
        expect(find(r, `${P1}PWHT_DETAILS`)).toHaveLength(0);
    });

    test('pwht dichiarato senza dettagli → warn', () => {
        const f = only(run(complete15614({ pwht: 1, pwht_details: null })), `${P1}PWHT_DETAILS`);
        expect(f.severity).toBe(SEVERITY.WARN);
    });

    test('NORMALIZATION su grafie PROD senza modificare l\'input', () => {
        const input = {
            ...complete15614({ current_type: 'DC-EP', filler_material: 'G 42 4 M21 3Si1' }),
        };
        const snapshot = JSON.parse(JSON.stringify(input));
        const r = run(input);
        expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
        const norms = find(r, `${P1}NORMALIZATION`);
        expect(norms.map((f) => f.field).sort()).toEqual(['current_type', 'filler_material']);
        norms.forEach((f) => {
            expect(f.severity).toBe(SEVERITY.INFO);
            expect(f.message_it).toMatch(/non viene modificato/);
            expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
        });
    });
});

describe('arco vs stud', () => {
    test('15614-2 usa il prefisso WPQR15614_2 e le stesse assenze', () => {
        const r = run(complete15614_2({ welding_process: null, filler_material: null, test_runs: [] }));
        expect(find(r, `${P2}PROCESS`)[0].severity).toBe(SEVERITY.WARN);
        expect(find(r, `${P2}FILLER`)[0].severity).toBe(SEVERITY.WARN);
        expect(find(r, `${P2}RUNS_PRESENT`)).toHaveLength(1);
        expect(r.findings.some((f) => f.code.startsWith(P1))).toBe(false);
    });

    test('14555: niente FILLER/CURRENT_TYPE/DIAMETER/INTERPASS; RUN_FIELDS stud', () => {
        const r = run(complete14555({
            test_runs: [{ run_label: '1', welding_process: '783' }],
        }));
        expect(find(r, `${P55}FILLER`)).toHaveLength(0);
        expect(find(r, `${P55}CURRENT_TYPE`)).toHaveLength(0);
        expect(find(r, `${P55}DIAMETER`)).toHaveLength(0);
        expect(find(r, `${P55}INTERPASS`)).toHaveLength(0);
        const fields = find(r, `${P55}RUN_FIELDS`);
        expect(fields.some((f) => f.fields.includes('runs[0].current_a') && f.severity === SEVERITY.WARN)).toBe(true);
        expect(fields.some((f) => f.fields.includes('runs[0].voltage_v'))).toBe(false);
        fields.forEach((f) => expect(validateFinding(f)).toEqual({ ok: true, errors: [] }));
    });

    test('14555 scarica capacitiva: corrente d\'arco non richiesta', () => {
        const r = run(complete14555({
            welding_process: '786',
            test_runs: [{
                run_label: 'CD', welding_process: '786', charging_voltage_v: 140, capacitance_mf: 2,
            }],
        }));
        const fields = find(r, `${P55}RUN_FIELDS`);
        expect(fields.some((f) => f.fields.includes('runs[0].current_a'))).toBe(false);
        expect(own(r, P55).filter((f) => f.code !== `${P55}RUN_FIELDS` || f.severity === SEVERITY.WARN)).toEqual(
            own(r, P55).filter((f) => f.code === `${P55}RUN_FIELDS` && f.severity === SEVERITY.WARN),
        );
    });
});
