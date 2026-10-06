'use strict';

const { verifyQualification, validateFinding } = require('../index');
const registry = require('../verifyRegistry');
const { ensureDefaultPacks } = require('../registerDefaultPacks');
const { SEVERITY, STATUS, DIRECTION } = require('../findingTypes');
const pack = require('./welder9606Part2.pack');

const C = 'WQ9606_2.COMP';
const R = 'WQ9606_2.CORR';

const rec = (over = {}) => ({
    qualification_type: 'Saldatore ISO 9606-2',
    standard_reference: 'EN ISO 9606-2:2004',
    joint_type: 'BW',
    product_type: 'P',
    ...over,
});
const fw = (over = {}) => rec({ joint_type: 'FW', ...over });

const all = (input, mode = 'review') => verifyQualification(input, { mode }).findings;
const byCode = (input, code, mode) => all(input, mode).filter((f) => f.code === code);
const one = (input, code, mode) => {
    const found = byCode(input, code, mode);
    expect(found).toHaveLength(1);
    return found[0];
};
const none = (input, code) => expect(byCode(input, code)).toEqual([]);

const expectWarnOver = (f, clause) => {
    expect(f.severity).toBe(SEVERITY.WARN);
    expect(f.status).toBe(STATUS.VERIFICABILE);
    expect(f.direction).toBe(DIRECTION.OVER_CLAIM);
    expect(f.source.clause).toBe(clause);
    expect(f.message_it).toContain(clause);
};
const expectInfoUnder = (f) => {
    expect(f.severity).toBe(SEVERITY.INFO);
    expect(f.status).toBe(STATUS.VERIFICABILE);
    expect(f.direction).toBe(DIRECTION.UNDER_CLAIM);
};
const expectDataMissing = (f) => {
    expect(f.severity).toBe(SEVERITY.INFO);
    expect(f.status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
};
const expectSourceMissing = (f) => {
    expect(f.severity).toBe(SEVERITY.INFO);
    expect(f.status).toBe(STATUS.NON_VERIFICABILE_FONTE_MANCANTE);
    expect(f.source.text_status).toBe('assente');
};

beforeEach(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('pack welder9606Part2 — forma', () => {
    test('profili BW/FW, edizione unica 2004, codici dichiarati unici con prefisso WQ9606_2', () => {
        expect(pack.id).toBe('welder9606.part2');
        expect(pack.standardFamily).toBe('9606-2');
        expect(pack.profiles).toEqual(['9606-2:BW', '9606-2:FW']);
        expect(pack.editions).toEqual(['2004']);
        const codes = pack.rules.flatMap((r) => registry.getDeclaredCodes(r));
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes.every((c) => c.startsWith('WQ9606_2.COMP.') || c.startsWith('WQ9606_2.CORR.'))).toBe(true);
        expect(pack.rules.every((r) => ['completezza', 'correttezza'].includes(r.family))).toBe(true);
    });

    test('il pack è registrato e produce finding solo per la famiglia 9606-2', () => {
        const f9606_1 = all({
            qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN ISO 9606-1:2017', joint_type: 'BW', product_type: 'P',
        });
        expect(f9606_1.some((f) => f.code.startsWith('WQ9606_2.'))).toBe(false);
        expect(all(rec()).some((f) => f.code.startsWith('WQ9606_2.'))).toBe(true);
        expect(all(rec()).some((f) => f.code.startsWith('WQ9606_1.'))).toBe(false);
    });

    test('tutti i finding sono validi e mai bloccanti, anche su record vuoto o ricco', () => {
        const rich = rec({
            welding_process_test: '141',
            welding_processes_validity: '141',
            welding_position_test: 'PF',
            welding_positions: 'PA PB PF',
            thickness_t_test_mm: 4,
            thickness_min_mm: 2,
            thickness_max_mm: 8,
            material_group: '22',
            exam_date: '2024-01-15',
            expiry_date: '2026-01-15',
        });
        for (const input of [rec(), fw(), rich, { ...rich, product_type: 'T', pipe_diameter_test_mm: 100 }]) {
            for (const f of all(input)) {
                expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
                expect([SEVERITY.INFO, SEVERITY.WARN]).toContain(f.severity);
                if (f.severity === SEVERITY.WARN) {
                    expect(f.status).toBe(STATUS.VERIFICABILE);
                    expect(f.source.clause).toBeTruthy();
                }
            }
        }
    });

    test('edizione non dichiarata (9606-2:1994) → fonte mancante di motore, nessun finding del pack', () => {
        const f = all(rec({ standard_reference: 'EN 9606-2:1994' }));
        expect(f.some((x) => x.code.startsWith('WQ9606_2.'))).toBe(false);
        expect(f.some((x) => x.status === STATUS.NON_VERIFICABILE_FONTE_MANCANTE)).toBe(true);
    });
});

describe('COMP — completezza (§5.1, §10, §11, Annex A)', () => {
    const empty = rec({ product_type: null });

    test.each([
        ['PROCESS', 'welding_process_test', '§5.1 a), §5.2, §10, Annex A'],
        ['PRODUCT_TYPE', 'product_type', '§5.1 b), §5.3, §11'],
        ['MATERIAL_GROUP', 'material_group', '§5.1 d), §5.5, Tab. 2, §10'],
        ['FILLER_MATERIAL', 'filler_material_group', '§5.1 e), §5.6, §11'],
        ['THK_VALIDITY', 'thickness_min_mm', '§5.7 Tab. 3, Annex A'],
        ['POSITIONS', 'welding_positions', '§5.8 Tab. 6, §11'],
        ['WELD_DETAILS', 'weld_details', '§5.1 h), §5.9, Tab. 7, Tab. 8, §11'],
        ['EXAM_DATE', 'exam_date', '§9.1, §10, Annex A'],
        ['CERTIFICATE_NUMBER', 'certificate_number', '§10, Annex A'],
        ['ISSUING_BODY', 'issuing_body', '§10, Annex A'],
    ])('%s mancante → warn verificabile con clausola', (code, field, clause) => {
        const f = one(empty, `${C}.${code}`);
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.direction).toBe(DIRECTION.MISSING);
        expect(f.field).toBe(field);
        expect(f.source.clause).toBe(clause);
        expect(f.message_it).toContain(clause);
        expect(f.source.edition).toBe('2004');
    });

    test.each([
        ['THK_TEST', '§5.7 Tab. 3, §11'],
        ['POSITION_TEST', '§5.8, §11'],
        ['SHIELDING_GAS', '§5.6, §11, Annex A'],
        ['EXPIRY_DATE', '§9.2, Annex A'],
        ['STANDARD_REFERENCE', 'Annex A'],
    ])('%s mancante → info (non essenziale), mai warn', (code, clause) => {
        const f = one({ ...empty, standard_reference: null }, `${C}.${code}`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.source.clause).toBe(clause);
    });

    test('campi presenti → nessun finding di completezza per quei campi', () => {
        const full = rec({
            welding_process_test: '141',
            product_type: 'P',
            material_group: '22',
            filler_material_group: 'ER5356',
            thickness_min_mm: 2,
            thickness_max_mm: 8,
            thickness_t_test_mm: 4,
            welding_positions: 'PA PB',
            welding_position_test: 'PA',
            weld_details: 'ss nb',
            shielding_gas: 'I1',
            exam_date: '2024-01-15',
            expiry_date: '2026-01-15',
            certificate_number: 'AL-1',
            issuing_body: 'IIS',
        });
        for (const code of ['PROCESS', 'PRODUCT_TYPE', 'MATERIAL_GROUP', 'FILLER_MATERIAL', 'THK_VALIDITY', 'THK_TEST', 'POSITIONS', 'POSITION_TEST', 'WELD_DETAILS', 'SHIELDING_GAS', 'EXAM_DATE', 'EXPIRY_DATE', 'CERTIFICATE_NUMBER', 'ISSUING_BODY', 'STANDARD_REFERENCE']) {
            none(full, `${C}.${code}`);
        }
    });

    test('THK_VALIDITY: BW cita Tab. 3, FW cita Tab. 5; «senza limite» basta come massimo', () => {
        expect(one(rec(), `${C}.THK_VALIDITY`).source.clause).toBe('§5.7 Tab. 3, Annex A');
        expect(one(fw(), `${C}.THK_VALIDITY`).source.clause).toBe('§5.7 Tab. 5, Annex A');
        none(rec({ thickness_min_mm: 6, thickness_max_unlimited: true }), `${C}.THK_VALIDITY`);
        const half = one(rec({ thickness_min_mm: 2 }), `${C}.THK_VALIDITY`);
        expect(half.message_it).toContain('limite massimo');
    });

    test('THK_TEST: se c\'è solo s depositato, la nota spiega che 9606-2 usa t e non converte', () => {
        const f = one(rec({ thickness_s_test_mm: 5 }), `${C}.THK_TEST`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.message_it).toContain('solo lo spessore depositato s');
        none(rec({ thickness_t_test_mm: 5 }), `${C}.THK_TEST`);
    });

    test('PIPE_DIAMETER: warn per tubo (T), non verificabile se il prodotto è ignoto, assente per piastra', () => {
        const t = one(rec({ product_type: 'T' }), `${C}.PIPE_DIAMETER`);
        expect(t.severity).toBe(SEVERITY.WARN);
        expect(t.source.clause).toBe('§5.7 Tab. 4, Annex A');
        expect(one(rec({ product_type: null }), `${C}.PIPE_DIAMETER`).status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
        expect(one(rec({ product_type: null }), `${C}.PIPE_DIAMETER_TEST`).status).toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
        none(rec({ product_type: 'P' }), `${C}.PIPE_DIAMETER`);
        none(rec({ product_type: 'P' }), `${C}.PIPE_DIAMETER_TEST`);
        none(rec({ product_type: 'T', pipe_diameter_min_mm: 20 }), `${C}.PIPE_DIAMETER`);
        const test = one(rec({ product_type: 'T' }), `${C}.PIPE_DIAMETER_TEST`);
        expect(test.severity).toBe(SEVERITY.INFO);
        expect(test.status).toBe(STATUS.VERIFICABILE);
    });

    test('CURRENT_141: processo 141 → info non verificabile (corrente c.c./c.a. non strutturata, §5.2)', () => {
        const f = one(rec({ welding_process_test: '141' }), `${C}.CURRENT_141`);
        expectDataMissing(f);
        expect(f.source.clause).toBe('§5.2');
        none(rec({ welding_process_test: '131' }), `${C}.CURRENT_141`);
        none(rec(), `${C}.CURRENT_141`);
    });

    test('9606-1 non regressione: nessun codice COMP 9606-2 su un record 9606-1', () => {
        const f = all({
            qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN ISO 9606-1:2017', joint_type: 'BW',
        });
        expect(f.filter((x) => x.code.startsWith('WQ9606_2.'))).toEqual([]);
        expect(f.some((x) => x.code.startsWith('WQ9606_1.'))).toBe(true);
    });
});

describe('CORR.THK_BW — Tab. 3 (spessore del materiale t)', () => {
    const bw = (t, min, max, over = {}) => rec({
        thickness_t_test_mm: t, thickness_min_mm: min, thickness_max_mm: max, ...over,
    });

    test.each([
        ['t = 4: [2; 8]', 4, 2, 8],
        ['t = 6: [3; 12]', 6, 3, 12],
        ['t = 1: [0,5; 2]', 1, 0.5, 2],
    ])('certificato uguale alla norma (%s) → nessun finding', (_n, t, min, max) => {
        none(bw(t, min, max), `${R}.THK_BW`);
    });

    test('t > 6: da 6 senza limite superiore → nessun finding', () => {
        none(bw(10, 6, null, { thickness_max_unlimited: true }), `${R}.THK_BW`);
    });

    test('massimo oltre la norma → warn over_claim con clausola Tab. 3', () => {
        const f = one(bw(4, 2, 10), `${R}.THK_BW`);
        expectWarnOver(f, '§5.7 Tab. 3');
        expect(f.message_it).toContain('massimo');
        expect(f.expected_value).toEqual({ min: 2, max: 8, unlimited: false });
    });

    test('minimo sotto la norma → warn; t > 6 con «senza limite» ma minimo 3 → warn', () => {
        expectWarnOver(one(bw(4, 1, 8), `${R}.THK_BW`), '§5.7 Tab. 3');
        expectWarnOver(one(bw(10, 3, null, { thickness_max_unlimited: true }), `${R}.THK_BW`), '§5.7 Tab. 3');
    });

    test('t ≤ 6 ma certificato «senza limite» → warn (massimo oltre la norma)', () => {
        expectWarnOver(one(bw(4, 2, null, { thickness_max_unlimited: true }), `${R}.THK_BW`), '§5.7 Tab. 3');
    });

    test('certificato più stretto → info under_claim', () => {
        expectInfoUnder(one(bw(4, 2.5, 8), `${R}.THK_BW`));
        expectInfoUnder(one(bw(4, 2, 6), `${R}.THK_BW`));
        expectInfoUnder(one(bw(10, 6, 20), `${R}.THK_BW`));
    });

    test('tolleranza 0,01 mm (D2): 8,004 non è oltre 8; 8,02 sì', () => {
        none(bw(4, 2, 8.004), `${R}.THK_BW`);
        expectWarnOver(one(bw(4, 2, 8.02), `${R}.THK_BW`), '§5.7 Tab. 3');
    });

    test('manca t → non verificabile (mai warn); con solo s la nota lo dice', () => {
        const f = one(rec({ thickness_min_mm: 2, thickness_max_mm: 8 }), `${R}.THK_BW`);
        expectDataMissing(f);
        const g = one(rec({ thickness_min_mm: 2, thickness_max_mm: 8, thickness_s_test_mm: 4 }), `${R}.THK_BW`);
        expectDataMissing(g);
        expect(g.message_it).toContain('spessore depositato s');
    });

    test('nessuna validità dichiarata → nulla da confrontare; FW non produce THK_BW', () => {
        none(rec({ thickness_t_test_mm: 4 }), `${R}.THK_BW`);
        none(fw({ thickness_t_test_mm: 4, thickness_min_mm: 2, thickness_max_mm: 10 }), `${R}.THK_BW`);
    });

    test('lo spessore s (deposito) non viene mai usato per BW 9606-2', () => {
        none(rec({ thickness_s_test_mm: 4, thickness_t_test_mm: 4, thickness_min_mm: 2, thickness_max_mm: 8 }), `${R}.THK_BW`);
        expect(one(rec({ thickness_s_test_mm: 4, thickness_min_mm: 2, thickness_max_mm: 8 }), `${R}.THK_BW`).status)
            .toBe(STATUS.NON_VERIFICABILE_DATO_MANCANTE);
    });
});

describe('CORR.THK_FW — Tab. 5 (spessore del materiale t, giunto d\'angolo)', () => {
    const f5 = (t, min, max, over = {}) => fw({
        thickness_t_test_mm: t, thickness_min_mm: min, thickness_max_mm: max, ...over,
    });

    test('t < 3: da t a 3 → nessun finding; t ≥ 3: da 3 senza limite → nessun finding', () => {
        none(f5(2, 2, 3), `${R}.THK_FW`);
        none(f5(5, 3, null, { thickness_max_unlimited: true }), `${R}.THK_FW`);
    });

    test('certificato più largo → warn con clausola Tab. 5', () => {
        expectWarnOver(one(f5(2, 1, 3), `${R}.THK_FW`), '§5.7 Tab. 5');
        expectWarnOver(one(f5(2, 2, 6), `${R}.THK_FW`), '§5.7 Tab. 5');
        expectWarnOver(one(f5(5, 2, null, { thickness_max_unlimited: true }), `${R}.THK_FW`), '§5.7 Tab. 5');
        expectWarnOver(one(f5(5, 1, 30), `${R}.THK_FW`), '§5.7 Tab. 5');
    });

    test('certificato più stretto → info; t mancante → non verificabile', () => {
        expectInfoUnder(one(f5(5, 4, null, { thickness_max_unlimited: true }), `${R}.THK_FW`));
        expectDataMissing(one(fw({ thickness_min_mm: 3, thickness_max_unlimited: true }), `${R}.THK_FW`));
    });

    test('un FW con solo s non viene convertito', () => {
        const f = one(fw({ thickness_s_test_mm: 5, thickness_min_mm: 3, thickness_max_unlimited: true }), `${R}.THK_FW`);
        expectDataMissing(f);
    });
});

describe('CORR.PIPE_DIAMETER — Tab. 4', () => {
    const tube = (d, min, max, over = {}) => rec({
        product_type: 'T', pipe_diameter_test_mm: d, pipe_diameter_min_mm: min, pipe_diameter_max_mm: max, ...over,
    });

    test('D = 100: [50; ∞) come 9606-1 → nessun finding se uguale', () => {
        const ok = tube(100, 50, null);
        none(ok, `${R}.PIPE_DIAMETER`);
    });

    test('minimo sotto la norma → warn con clausola Tab. 4', () => {
        expectWarnOver(one(tube(100, 20, null), `${R}.PIPE_DIAMETER`), '§5.7 Tab. 4');
    });

    test('più stretto → info; D mancante → non verificabile; piastra → nessun controllo', () => {
        expectInfoUnder(one(tube(100, 80, null), `${R}.PIPE_DIAMETER`));
        expectDataMissing(one(tube(null, 50, null), `${R}.PIPE_DIAMETER`));
        none(rec({ product_type: 'P', pipe_diameter_test_mm: 100, pipe_diameter_min_mm: 10 }), `${R}.PIPE_DIAMETER`);
    });

    test('nessuna validità dichiarata → nessun finding di correttezza', () => {
        none(tube(100, null, null), `${R}.PIPE_DIAMETER`);
    });
});

describe('CORR.PLATE_TO_PIPE — §5.3 b)', () => {
    const plate = (pos, min) => rec({ product_type: 'P', welding_position_test: pos, pipe_diameter_min_mm: min });

    test('piastra in PA/PB/PC con tubi da meno di 150 mm → info (§5.3 b)', () => {
        const f = one(plate('PC', 100), `${R}.PLATE_TO_PIPE`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.source.clause).toBe('§5.3 b)');
        expect(f.message_it).toContain('150');
        none(plate('PC', 150), `${R}.PLATE_TO_PIPE`);
    });

    test('piastra in altre posizioni: soglia 500 mm', () => {
        const f = one(plate('PF', 300), `${R}.PLATE_TO_PIPE`);
        expect(f.message_it).toContain('500');
        none(plate('PF', 500), `${R}.PLATE_TO_PIPE`);
    });

    test('posizione di prova assente → soglia minima 150, indicata come «almeno»', () => {
        const f = one(plate(null, 100), `${R}.PLATE_TO_PIPE`);
        expect(f.message_it).toContain('almeno');
    });

    test('tubo o diametro assente → nessun finding', () => {
        none(rec({ product_type: 'T', pipe_diameter_min_mm: 20, welding_position_test: 'PC' }), `${R}.PLATE_TO_PIPE`);
        none(plate('PC', null), `${R}.PLATE_TO_PIPE`);
    });
});

describe('CORR.POSITIONS — Tab. 6', () => {
    const pos = (test, declared, over = {}) => rec({ welding_position_test: test, welding_positions: declared, ...over });

    test('PA qualifica PA, PB: certificato uguale → nessun finding', () => {
        none(pos('PA', 'PA PB'), `${R}.POSITIONS`);
    });

    test('posizione non qualificata dalla prova → warn over_claim con clausola', () => {
        const f = one(pos('PA', 'PA PB PC'), `${R}.POSITIONS`);
        expectWarnOver(f, '§5.8 Tab. 6');
        expect(f.message_it).toContain('PC');
        expect(f.expected_value).toEqual(['PA', 'PB']);
    });

    test('certificato più stretto → info under_claim', () => {
        expectInfoUnder(one(pos('PC', 'PA PB'), `${R}.POSITIONS`));
    });

    test('PF su piastra e su tubo qualificano insiemi diversi (serve product_type)', () => {
        none(pos('PF', 'PA PB PF', { product_type: 'P' }), `${R}.POSITIONS`);
        expectWarnOver(one(pos('PF', 'PA PB PD PF', { product_type: 'P' }), `${R}.POSITIONS`), '§5.8 Tab. 6');
        none(pos('PF', 'PA PB PD PE PF', { product_type: 'T' }), `${R}.POSITIONS`);
    });

    test('PF senza product_type → non verificabile per dato mancante, mai warn', () => {
        const f = one(pos('PF', 'PA PB PF', { product_type: null }), `${R}.POSITIONS`);
        expectDataMissing(f);
    });

    test('posizione di prova assente → non verificabile (dato mancante)', () => {
        expectDataMissing(one(pos(null, 'PA PB'), `${R}.POSITIONS`));
    });

    test('più posizioni di prova: unione delle righe (PF tubo + PC → anche H-L045)', () => {
        none(pos('PF PC', 'PA PB PC PD PE PF H-L045', { product_type: 'T' }), `${R}.POSITIONS`);
    });

    test('PB/PD su giunto BW → info (nota b), nessun confronto; su FW si confronta', () => {
        const f = one(pos('PB', 'PA PB'), `${R}.POSITION_TEST_JOINT`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.source.clause).toBe('§5.8 Tab. 6 nota b');
        none(pos('PB', 'PA PB'), `${R}.POSITIONS`);
        none(fw({ welding_position_test: 'PB', welding_positions: 'PA PB' }), `${R}.POSITION_TEST_JOINT`);
        none(fw({ welding_position_test: 'PB', welding_positions: 'PA PB' }), `${R}.POSITIONS`);
    });

    test('simboli PH/PJ/J-L045 (9606-1) → fonte mancante (GAP G4, ISO 6947), nessun warn', () => {
        const a = one(pos('PH', 'PA PB', { product_type: 'T' }), `${R}.POSITIONS_SYMBOLS`);
        expectSourceMissing(a);
        expect(a.message_it).toContain('ISO 6947');
        const b = one(pos('PA', 'PA PB PH'), `${R}.POSITIONS_SYMBOLS`);
        expectSourceMissing(b);
        none(pos('PA', 'PA PB PH'), `${R}.POSITIONS`);
        expectSourceMissing(one(pos('PA', 'J-L045'), `${R}.POSITIONS_SYMBOLS`));
    });

    test('nessuna posizione dichiarata → nessun finding di correttezza', () => {
        none(pos('PA', null), `${R}.POSITIONS`);
    });
});

describe('CORR.PROCESS — §5.2 (nessuna equivalenza), §4.2', () => {
    test('processo di validità coperto dalla prova → nessun finding', () => {
        none(rec({ welding_process_test: '141', welding_processes_validity: '141' }), `${R}.PROCESS`);
        none(rec({ welding_process_test: '15', welding_processes_validity: '15' }), `${R}.PROCESS`);
    });

    test('processo di validità diverso dalla prova → warn over_claim §5.2', () => {
        const f = one(rec({ welding_process_test: '141', welding_processes_validity: '141 131' }), `${R}.PROCESS`);
        expectWarnOver(f, '§5.2');
        expect(f.message_it).toContain('131');
        expect(f.message_it).toContain('nessuna equivalenza');
    });

    test('rami 15x equivalenti a 15; 141 e 15 non lo sono', () => {
        none(rec({ welding_process_test: '151', welding_processes_validity: '15' }), `${R}.PROCESS`);
        expectWarnOver(one(rec({ welding_process_test: '141', welding_processes_validity: '15' }), `${R}.PROCESS`), '§5.2');
    });

    test('validità dichiarata senza processo di prova → non verificabile', () => {
        expectDataMissing(one(rec({ welding_processes_validity: '141' }), `${R}.PROCESS`));
    });

    test('nessuna validità dichiarata → nessun finding', () => {
        none(rec({ welding_process_test: '141' }), `${R}.PROCESS`);
    });

    test('processo fuori dal campo della norma (es. 111) → info §4.2', () => {
        const f = one(rec({ welding_process_test: '111' }), `${R}.PROCESS_SCOPE`);
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.source.clause).toBe('§4.2');
        none(rec({ welding_process_test: '141' }), `${R}.PROCESS_SCOPE`);
    });
});

describe('CORR.MULTI_PROCESS — Tab. 1 (GAP G1)', () => {
    const multi = (over = {}) => rec({
        welding_process_test: '141 + 131',
        thickness_t_test_mm: 4,
        thickness_min_mm: 1,
        thickness_max_mm: 40,
        ...over,
    });

    test('prova multi-processo → fonte mancante; spessore e processi non giudicati', () => {
        const f = one(multi(), `${R}.MULTI_PROCESS`);
        expectSourceMissing(f);
        expect(f.source.clause).toBe('§5.2 Tab. 1');
        none(multi(), `${R}.THK_BW`);
        none(multi({ welding_processes_validity: '141 131 15' }), `${R}.PROCESS`);
    });

    test('multi-processo su FW e tubo non produce warn di spessore/diametro', () => {
        const input = multi({
            joint_type: 'FW', product_type: 'T', pipe_diameter_test_mm: 100, pipe_diameter_min_mm: 1,
        });
        none(input, `${R}.THK_FW`);
        none(input, `${R}.PIPE_DIAMETER`);
        expectSourceMissing(one(input, `${R}.MULTI_PROCESS`));
    });

    test('processo singolo → nessun MULTI_PROCESS; 15 + 151 sono lo stesso ramo', () => {
        none(rec({ welding_process_test: '141' }), `${R}.MULTI_PROCESS`);
        none(rec({ welding_process_test: '15 151' }), `${R}.MULTI_PROCESS`);
    });
});

describe('CORR.MATERIAL_GROUP_SOURCE — Tab. 2 (GAP G2)', () => {
    test('gruppo Al dichiarato → un solo finding, fonte mancante (nessun giudizio sul gruppo)', () => {
        for (const g of ['22', '21', '26', '2.2', '23, 24']) {
            const f = byCode(rec({ material_group: g }), `${R}.MATERIAL_GROUP_SOURCE`);
            expect(f).toHaveLength(1);
            expectSourceMissing(f[0]);
            expect(f[0].source.clause).toBe('§5.5, Tab. 2');
            expect(f[0].message_it).toMatch(/15608/);
        }
    });

    test('nessun warn sul gruppo materiale in nessun caso', () => {
        const f = all(rec({ material_group: '26' })).filter((x) => x.field === 'material_group');
        expect(f.every((x) => x.severity === SEVERITY.INFO)).toBe(true);
    });

    test('gruppo assente → nessun MATERIAL_GROUP_SOURCE (c\'è la completezza)', () => {
        none(rec(), `${R}.MATERIAL_GROUP_SOURCE`);
    });
});

describe('CORR.CONFIRMATION_INTERVAL / VALIDITY_PERIOD — §9', () => {
    test('conferma entro 6 mesi dalla data di saldatura → nessun finding', () => {
        none(rec({ exam_date: '2024-01-15', next_confirmation_due: '2024-07-15' }), `${R}.CONFIRMATION_INTERVAL`);
        none(rec({ exam_date: '2024-01-15', next_confirmation_due: '2024-05-01' }), `${R}.CONFIRMATION_INTERVAL`);
    });

    test('conferma oltre 6 mesi → warn §9.2; si parte dall\'ultima conferma se presente', () => {
        expectWarnOver(one(rec({ exam_date: '2024-01-15', next_confirmation_due: '2024-08-01' }), `${R}.CONFIRMATION_INTERVAL`), '§9.2');
        none(rec({
            exam_date: '2024-01-15', last_confirmation_date: '2024-07-10', next_confirmation_due: '2025-01-10',
        }), `${R}.CONFIRMATION_INTERVAL`);
        expectWarnOver(one(rec({
            exam_date: '2024-01-15', last_confirmation_date: '2024-07-10', next_confirmation_due: '2025-02-10',
        }), `${R}.CONFIRMATION_INTERVAL`), '§9.2');
    });

    test('manca la data di riferimento → non verificabile; nessuna conferma dichiarata → nessun finding', () => {
        expectDataMissing(one(rec({ next_confirmation_due: '2024-08-01' }), `${R}.CONFIRMATION_INTERVAL`));
        none(rec({ exam_date: '2024-01-15' }), `${R}.CONFIRMATION_INTERVAL`);
    });

    test('scadenza entro 2 anni dalla saldatura → nessun finding', () => {
        none(rec({ exam_date: '2024-01-15', expiry_date: '2026-01-15' }), `${R}.VALIDITY_PERIOD`);
    });

    test('scadenza oltre 2 anni → solo info non verificabile (prolungamento §9.3 non modellato), mai warn', () => {
        const f = one(rec({ exam_date: '2024-01-15', expiry_date: '2028-01-15' }), `${R}.VALIDITY_PERIOD`);
        expectDataMissing(f);
        expect(f.direction).toBe(DIRECTION.OVER_CLAIM);
        expect(f.source.clause).toBe('§9.3');
    });
});

describe('modalità db: stessi controlli sui nomi di colonna della tabella qualifications', () => {
    test('riga db con spessore oltre la norma → warn THK_BW', () => {
        const row = {
            qualification_type: 'Saldatore ISO 9606-2',
            standard_ref: 'EN ISO 9606-2:2004',
            joint_type: 'BW',
            product_type: 'P',
            thickness_t_test_mm: 4,
            thickness_min_mm: 2,
            thickness_max_mm: 12,
        };
        expectWarnOver(one(row, `${R}.THK_BW`, 'db'), '§5.7 Tab. 3');
    });
});
