'use strict';

const { verifyQualification, validateFinding } = require('../index');
const registry = require('../verifyRegistry');
const { ensureDefaultPacks } = require('../registerDefaultPacks');
const { SEVERITY, STATUS, DIRECTION } = require('../findingTypes');
const pack = require('./welder9606Correctness.pack');
const { buildWelderQualificationDesignation } = require('../../../utils/weldingDesignation');

const P = 'WQ9606_1.CORR';

const rec = (over = {}) => ({
    qualification_type: 'Saldatore ISO 9606-1',
    standard_reference: 'EN ISO 9606-1:2017',
    joint_type: 'BW',
    product_type: 'P',
    ...over,
});
const fw = (over = {}) => rec({ joint_type: 'FW', ...over });

const all = (input, mode = 'review') => verifyQualification(input, { mode }).findings;
const byCode = (input, suffix, mode) => all(input, mode).filter((f) => f.code === `${P}.${suffix}`);
const one = (input, suffix, mode) => {
    const found = byCode(input, suffix, mode);
    expect(found).toHaveLength(1);
    return found[0];
};
const none = (input, suffix) => expect(byCode(input, suffix)).toEqual([]);

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

beforeEach(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

afterAll(() => {
    registry.clearRulePacks();
    ensureDefaultPacks();
});

describe('pack welder9606Correctness — forma', () => {
    test('profili BW/FW, edizioni 2017/2013/2012, codici dichiarati unici e con prefisso WQ9606_1.CORR', () => {
        expect(pack.profiles).toEqual(['9606-1:BW', '9606-1:FW']);
        expect(pack.editions).toEqual(['2017', '2013', '2012']);
        const codes = pack.rules.flatMap((r) => registry.getDeclaredCodes(r));
        expect(new Set(codes).size).toBe(codes.length);
        expect(codes.every((c) => c.startsWith(`${P}.`))).toBe(true);
        expect(pack.rules.every((r) => r.family === 'correttezza')).toBe(true);
    });

    test('record senza alcuna validità dichiarata né dati: nessun finding (non c\'è nulla da confrontare)', () => {
        expect(all(rec())).toEqual([]);
        expect(all(fw())).toEqual([]);
    });
});

describe('CORR.THK_BW — Tab. 6 (spessore depositato s, giunto testa a testa)', () => {
    const bw = (s, min, max, over = {}) => rec({ thickness_s_test_mm: s, thickness_min_mm: min, thickness_max_mm: max, ...over });

    test.each([
        ['s = 2,99: [2,99; 5,98]', 2.99, 2.99, 5.98],
        ['s = 3: [3; 6]', 3, 3, 6],
        ['s = 11,99: [3; 23,98]', 11.99, 3, 23.98],
        ['s = 6: [3; 12]', 6, 3, 12],
    ])('certificato uguale alla norma (%s) → nessun finding', (_n, s, min, max) => {
        none(bw(s, min, max), 'THK_BW');
    });

    test('s = 12: nessun limite superiore → flag «senza limite» uguale alla norma', () => {
        none(bw(12, 3, null, { thickness_max_unlimited: true }), 'THK_BW');
    });

    test.each([
        ['s = 2,99 con massimo 6 (0,02 mm oltre)', bw(2.99, 2.99, 6)],
        ['s = 3 con massimo 6,01 (0,01 mm oltre)', bw(3, 3, 6.01)],
        ['s = 3 con minimo 2 (sotto il minimo)', bw(3, 2, 6)],
        ['s = 11,99 con massimo 24', bw(11.99, 3, 24)],
        ['s = 11,99 con «senza limite superiore»', bw(11.99, 3, null, { thickness_max_unlimited: true })],
    ])('over_claim → warn con clausola Tab. 6: %s', (_n, input) => {
        const f = one(input, 'THK_BW');
        expectWarnOver(f, '§5.7 Tab. 6');
        expect(f.field).toBe('thickness_max_mm');
        expect(f.fields).toEqual(expect.arrayContaining(['thickness_s_test_mm']));
        expect(f.expected_value).toEqual(expect.objectContaining({ min: expect.any(Number) }));
    });

    test('nessuna tolleranza oltre 0,01 mm: 6,004 si arrotonda a 6,00 (uguale), 6,01 è oltre', () => {
        none(bw(3, 3, 6.004), 'THK_BW');
        expectWarnOver(one(bw(3, 3, 6.01), 'THK_BW'), '§5.7 Tab. 6');
    });

    test.each([
        ['s = 12 con massimo 24 (norma: illimitato)', bw(12, 3, 24, { welding_process_test: '135' })],
        ['s = 6 con massimo 10', bw(6, 3, 10, { welding_process_test: '135' })],
        ['s = 6 con minimo 4', bw(6, 4, 12, { welding_process_test: '135' })],
    ])('under_claim → info: %s', (_n, input) => {
        expectInfoUnder(one(input, 'THK_BW'));
    });

    test('311 (ossiacetilenica): s = 2 → [2; 3] (nota c), con valori generali è over_claim con clausola note c/d', () => {
        none(bw(2, 2, 3, { welding_process_test: '311' }), 'THK_BW');
        const f = one(bw(2, 2, 4, { welding_process_test: '311' }), 'THK_BW');
        expectWarnOver(f, '§5.7 Tab. 6 note c/d');
        expect(f.expected_value).toEqual(expect.objectContaining({ min: 2, max: 3 }));
    });

    test('311: s = 4 → [3; 6] (1,5s, nota d); 3–8 è over_claim, 3–6 coincide', () => {
        none(bw(4, 3, 6, { welding_process_test: '311' }), 'THK_BW');
        expectWarnOver(one(bw(4, 3, 8, { welding_process_test: '311' }), 'THK_BW'), '§5.7 Tab. 6 note c/d');
    });

    test('processo di prova ignoto: over_claim resta warn, un possibile under_claim diventa dato mancante', () => {
        expectWarnOver(one(bw(6, 3, 20), 'THK_BW'), '§5.7 Tab. 6');
        expectDataMissing(one(bw(6, 3, 10), 'THK_BW'));
        none(bw(6, 3, 12), 'THK_BW');
    });

    test('limite superiore non dichiarato (max null senza flag): non si giudica il massimo', () => {
        none(bw(6, 3, null), 'THK_BW');
        expectWarnOver(one(bw(6, 2, null), 'THK_BW'), '§5.7 Tab. 6');
    });

    test('spessore di prova s assente con validità dichiarata → dato mancante (mai warn), cita il solo t', () => {
        const f = one(rec({ thickness_min_mm: 3, thickness_max_mm: 6 }), 'THK_BW');
        expectDataMissing(f);
        expect(f.message_it).not.toMatch(/solo lo spessore t/);
        const withT = one(rec({ thickness_min_mm: 3, thickness_max_mm: 6, thickness_t_test_mm: 10 }), 'THK_BW');
        expectDataMissing(withT);
        expect(withT.message_it).toMatch(/solo lo spessore t = 10 mm/);
    });

    test('nota e (≥ 3 passate) per s ≥ 12: info fisso non verificabile; assente sotto 12', () => {
        const f = one(bw(12, 3, null, { thickness_max_unlimited: true }), 'THK_BW_LAYERS');
        expectDataMissing(f);
        expect(f.message_it).toContain('almeno 3 passate');
        none(bw(11.99, 3, 23.98), 'THK_BW_LAYERS');
    });

    test('non si applica a FW né senza validità dichiarata', () => {
        none(fw({ thickness_s_test_mm: 3, thickness_min_mm: 1, thickness_max_mm: 99 }), 'THK_BW');
        none(rec({ thickness_s_test_mm: 3 }), 'THK_BW');
    });
});

describe('CORR.THK_FW — Tab. 8 (spessore materiale t, giunto d\'angolo)', () => {
    const f8 = (t, min, max, over = {}) => fw({ thickness_t_test_mm: t, thickness_min_mm: min, thickness_max_mm: max, ...over });

    test.each([
        ['t = 2,99: [2,99; 5,98]', 2.99, 2.99, 5.98],
        ['t = 2: [2; 4]', 2, 2, 4],
        ['t = 1: [1; 3] (max(2t, 3))', 1, 1, 3],
    ])('uguale alla norma (%s) → nessun finding', (_n, t, min, max) => {
        none(f8(t, min, max), 'THK_FW');
    });

    test('t = 3: ≥ 3 senza limite superiore (flag o massimo non dichiarato)', () => {
        none(f8(3, 3, null, { thickness_max_unlimited: true }), 'THK_FW');
        none(f8(3, 3, null), 'THK_FW');
    });

    test.each([
        ['t = 2,99 con massimo 6', f8(2.99, 2.99, 6)],
        ['t = 3 con minimo 2', f8(3, 2, null, { thickness_max_unlimited: true })],
        ['t = 2 senza limite superiore', f8(2, 2, null, { thickness_max_unlimited: true })],
    ])('over_claim → warn con clausola Tab. 8: %s', (_n, input) => {
        expectWarnOver(one(input, 'THK_FW'), '§5.7 Tab. 8');
    });

    test('under_claim → info (t = 3 con massimo 20)', () => {
        expectInfoUnder(one(f8(3, 3, 20), 'THK_FW'));
    });

    test('spessore t assente → dato mancante; non si applica a BW', () => {
        expectDataMissing(one(fw({ thickness_min_mm: 3, thickness_max_mm: 6 }), 'THK_FW'));
        none(rec({ thickness_t_test_mm: 3, thickness_min_mm: 1, thickness_max_mm: 99 }), 'THK_FW');
    });
});

describe('CORR.PIPE_DIAMETER — Tab. 7 (BW e FW, solo tubo)', () => {
    const pipe = (D, min, max, over = {}) => rec({ product_type: 'T', pipe_diameter_test_mm: D, pipe_diameter_min_mm: min, pipe_diameter_max_mm: max, ...over });

    test('bordo D = 25: [25; 50]; D = 25,01: ≥ 25 senza limite superiore', () => {
        none(pipe(25, 25, 50), 'PIPE_DIAMETER');
        none(pipe(25.01, 25, null), 'PIPE_DIAMETER');
        expectWarnOver(one(pipe(25, 25, null, { pipe_diameter_max_mm: 80 }), 'PIPE_DIAMETER'), '§5.7 Tab. 7');
        expectInfoUnder(one(pipe(25.01, 25, 50), 'PIPE_DIAMETER'));
    });

    test('D = 60: ≥ 30 → un minimo di 20 è over_claim (warn); D = 40: minimo 25 (non 20)', () => {
        const f = one(pipe(60, 20, null), 'PIPE_DIAMETER');
        expectWarnOver(f, '§5.7 Tab. 7');
        expect(f.expected_value).toEqual(expect.objectContaining({ min: 30, max: null }));
        none(pipe(40, 25, null), 'PIPE_DIAMETER');
        expectWarnOver(one(pipe(40, 20, null), 'PIPE_DIAMETER'), '§5.7 Tab. 7');
    });

    test('D = 20: [20; 40] → max 60 è over_claim, max 30 under_claim', () => {
        expectWarnOver(one(pipe(20, 20, 60), 'PIPE_DIAMETER'), '§5.7 Tab. 7');
        expectInfoUnder(one(pipe(20, 20, 30), 'PIPE_DIAMETER'));
    });

    test('vale anche per FW; diametro di prova assente → dato mancante', () => {
        expectWarnOver(one(fw({ product_type: 'T', pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 20 }), 'PIPE_DIAMETER'), '§5.7 Tab. 7');
        expectDataMissing(one(rec({ product_type: 'T', pipe_diameter_min_mm: 20, pipe_diameter_max_mm: 40 }), 'PIPE_DIAMETER'));
        expectDataMissing(one(rec({ pipe_diameter_min_mm: 20, pipe_diameter_max_mm: 40, product_type: null }), 'PIPE_DIAMETER'));
    });

    test('piastra (P): nessun controllo Tab. 7', () => {
        none(rec({ product_type: 'P', pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 1 }), 'PIPE_DIAMETER');
    });
});

describe('CORR.PLATE_TO_PIPE — §5.3 b), c) (informativo)', () => {
    test('piastra con tubo da meno di 75 mm → info con clausola; da 75 mm o su tubo → nessun finding', () => {
        const f = one(rec({ pipe_diameter_min_mm: 60 }), 'PLATE_TO_PIPE');
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.source.clause).toBe('§5.3 b), c)');
        expect(f.message_it).toContain('§5.3 b), c)');
        none(rec({ pipe_diameter_min_mm: 75 }), 'PLATE_TO_PIPE');
        none(rec({ product_type: 'T', pipe_diameter_min_mm: 60 }), 'PLATE_TO_PIPE');
        none(rec(), 'PLATE_TO_PIPE');
    });
});

describe('CORR.POSITIONS — Tab. 9 (BW) / Tab. 10 (FW)', () => {
    test('BW: prova PC → PA, PC; dichiarate uguali → nessun finding', () => {
        none(rec({ welding_position_test: 'PC', welding_positions: ['PA', 'PC'] }), 'POSITIONS');
        none(rec({ welding_position_test: 'PC', welding_positions: 'PA, PC' }), 'POSITIONS');
    });

    test('BW: posizione dichiarata non qualificata → warn con Tab. 9', () => {
        const f = one(rec({ welding_position_test: 'PC', welding_positions: ['PA', 'PC', 'PE'] }), 'POSITIONS');
        expectWarnOver(f, '§5.8 Tab. 9');
        expect(f.expected_value).toEqual(['PA', 'PC']);
        expect(f.message_it).toContain('PE');
    });

    test('BW: posizione qualificata non dichiarata → info (under_claim)', () => {
        expectInfoUnder(one(rec({ welding_position_test: 'PC', welding_positions: ['PC'] }), 'POSITIONS'));
    });

    test('BW: PH (pipe) → PA, PE, PF; PF dichiarata con prova PA è over_claim', () => {
        none(rec({ welding_position_test: 'PH', welding_positions: ['PA', 'PE', 'PF'] }), 'POSITIONS');
        expectWarnOver(one(rec({ welding_position_test: 'PA', welding_positions: ['PA', 'PF'] }), 'POSITIONS'), '§5.8 Tab. 9');
    });

    test('BW: prove in PH + PC coprono l\'unione delle righe; separatori "/" accettati anche nelle posizioni dichiarate', () => {
        none(rec({ welding_position_test: 'PH/PC', welding_positions: 'PA/PC/PE/PF' }), 'POSITIONS');
    });

    test('FW: Tab. 10 (prova PB → PA, PB); PD dichiarata è over_claim, PA/PB dichiarate coincidono', () => {
        none(fw({ welding_position_test: 'PB', welding_positions: ['PA', 'PB'] }), 'POSITIONS');
        const f = one(fw({ welding_position_test: 'PB', welding_positions: ['PA', 'PB', 'PD'] }), 'POSITIONS');
        expectWarnOver(f, '§5.8 Tab. 10');
        expect(f.expected_value).toEqual(['PA', 'PB']);
    });

    test('FW: prova PF → PA, PB, PF; PG dichiarata over_claim', () => {
        none(fw({ welding_position_test: 'PF', welding_positions: ['PA', 'PB', 'PF'] }), 'POSITIONS');
        expectWarnOver(one(fw({ welding_position_test: 'PF', welding_positions: ['PA', 'PB', 'PF', 'PG'] }), 'POSITIONS'), '§5.8 Tab. 10');
    });

    test('posizione di prova assente o non in tabella → dato mancante (mai warn)', () => {
        expectDataMissing(one(rec({ welding_positions: ['PA'] }), 'POSITIONS'));
        expectDataMissing(one(rec({ welding_position_test: 'ZZ', welding_positions: ['PA'] }), 'POSITIONS'));
        expectDataMissing(one(fw({ welding_position_test: 'H-L045', welding_positions: ['PA'] }), 'POSITIONS'));
    });

    test('BW con posizione fuori da Tab. 9 (es. PB da prova d\'angolo supplementare): non giudicata, dato mancante', () => {
        const f = one(rec({ welding_position_test: 'PA', welding_positions: ['PA', 'PB'] }), 'POSITIONS');
        expectDataMissing(f);
        expect(f.message_it).toContain('§5.4 e');
    });

    test('modo db: legge position_range della riga DB', () => {
        const f = one({ ...rec({ welding_position_test: 'PC' }), position_range: 'PA, PC, PE' }, 'POSITIONS', 'db');
        expectWarnOver(f, '§5.8 Tab. 9');
    });
});

describe('CORR.PROCESS — §5.2 equivalenze', () => {
    const proc = (test, validity) => rec({ welding_process_test: test, welding_processes_validity: validity });

    test.each([
        ['135', '135, 138'],
        ['138', '135, 138'],
        ['135', '135'],
        ['121', '121, 125'],
        ['125', '121'],
        ['141', '141, 142, 143, 145'],
        ['143', '141, 142, 143, 145'],
        ['145', '141 143'],
        ['142', '142'],
        ['111', '111'],
    ])('prova %s, validità "%s" → nessun finding', (test, validity) => {
        none(proc(test, validity), 'PROCESS');
    });

    test.each([
        ['142', '141', '141'],
        ['142', '142, 143', '143'],
        ['135', '135, 141', '141'],
        ['135', '121', '121'],
        ['111', '135', '135'],
        ['141', '141, 311', '311'],
    ])('prova %s, validità "%s" → warn §5.2 (oltre l\'equivalenza: %s)', (test, validity, extra) => {
        const f = one(proc(test, validity), 'PROCESS');
        expectWarnOver(f, '§5.2');
        expect(f.message_it).toContain(extra);
    });

    test('la 142 è coperta da 141/143/145 (testo ufficiale §5.2) ma non viceversa', () => {
        none(proc('141', '142'), 'PROCESS');
        expectWarnOver(one(proc('142', '141, 142'), 'PROCESS'), '§5.2');
    });

    test('processo di prova assente o multiplo → dato mancante; nessuna validità → nessun finding', () => {
        expectDataMissing(one(rec({ welding_processes_validity: '135' }), 'PROCESS'));
        const multi = one(proc('111, 135', '111, 135'), 'PROCESS');
        expectDataMissing(multi);
        expect(multi.message_it).toContain('multi-processo');
        none(rec({ welding_process_test: '135' }), 'PROCESS');
    });

    test('vale per BW e FW', () => {
        expectWarnOver(one(fw({ welding_process_test: '142', welding_processes_validity: '141' }), 'PROCESS'), '§5.2');
    });
});

describe('CORR.TRANSFER_MODE', () => {
    test('metodo di trasferimento su processo fuori da 131/135/136/138 → info con §5.2', () => {
        const f = one(rec({ welding_process_test: '141', transfer_mode: 'spray_arc' }), 'TRANSFER_MODE');
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.message_it).toContain('§5.2');
    });

    test('processo ad arco con filo continuo, processo ignoto, nessun transfer mode → nessun finding', () => {
        none(rec({ welding_process_test: '135', transfer_mode: 'spray_arc' }), 'TRANSFER_MODE');
        none(rec({ transfer_mode: 'spray_arc' }), 'TRANSFER_MODE');
        none(rec({ welding_process_test: '141' }), 'TRANSFER_MODE');
    });
});

describe('CORR.DESIGNATION — §11 (designazione ↔ dati di prova, mai la validità)', () => {
    const bwDes = 'ISO 9606-1 135 P BW FM1 s10 PA ss nb';

    test('coerente con le colonne di prova → nessun finding', () => {
        none(rec({
            qualification_designation: bwDes,
            welding_process_test: '135',
            filler_material_group: 'FM1',
            thickness_s_test_mm: 10,
            welding_position_test: 'PA',
        }), 'DESIGNATION');
    });

    test('token discordanti → warn §11 con elenco dei campi', () => {
        const f = one(rec({
            qualification_designation: bwDes,
            welding_process_test: '141',
            joint_type: 'BW',
            product_type: 'T',
            filler_material_group: 'FM2',
            thickness_s_test_mm: 8,
            welding_position_test: 'PC',
        }), 'DESIGNATION');
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.direction).toBe(DIRECTION.MISMATCH);
        expect(f.source.clause).toBe('§11');
        expect(f.message_it).toContain('§11');
        expect(f.fields).toEqual(expect.arrayContaining([
            'qualification_designation', 'welding_process_test', 'product_type', 'filler_material_group',
            'thickness_s_test_mm', 'welding_position_test',
        ]));
    });

    test('giunto d\'angolo: t di designazione contro thickness_t_test_mm; diametro D', () => {
        const des = 'ISO 9606-1 135 T FW FM1 t8 D60 PB ss mb';
        none(fw({
            qualification_designation: des, product_type: 'T', welding_process_test: '135', filler_material_group: 'FM1',
            thickness_t_test_mm: 8, pipe_diameter_test_mm: 60, welding_position_test: 'PB',
        }), 'DESIGNATION');
        const f = one(fw({
            qualification_designation: des, product_type: 'T', thickness_t_test_mm: 10, pipe_diameter_test_mm: 50,
        }), 'DESIGNATION');
        expect(f.fields).toEqual(expect.arrayContaining(['thickness_t_test_mm', 'pipe_diameter_test_mm']));
    });

    test('la validità non entra mai nel confronto: range diverso dalla designazione → nessun DESIGNATION', () => {
        none(rec({
            qualification_designation: bwDes, welding_process_test: '135', thickness_s_test_mm: 10,
            thickness_min_mm: 3, thickness_max_mm: 99, welding_processes_validity: '111',
        }), 'DESIGNATION');
    });

    test('designazione assente o non interpretabile, campi di prova assenti → nessun finding', () => {
        none(rec(), 'DESIGNATION');
        none(rec({ qualification_designation: 'ISO 9606-1:2017' }), 'DESIGNATION');
        none(rec({ qualification_designation: bwDes }), 'DESIGNATION');
    });

    test('ordine delle voci di buildWelderQualificationDesignation = ordine di §11 (processo, P/T, BW/FW, FM, dimensioni, posizioni, dettagli)', () => {
        const built = buildWelderQualificationDesignation({
            welding_process: '135',
            product_type: 'T',
            joint_type: 'BW',
            filler_material_group: 'FM1',
            thickness_min_mm: 3,
            thickness_max_mm: 20,
            pipe_diameter_min_mm: 30,
            pipe_diameter_max_mm: 60,
            welding_positions: ['PA', 'PC'],
            weld_details: 'ss nb',
        });
        const tokens = built.split(' ');
        const idx = (t) => tokens.indexOf(t);
        expect(tokens.slice(0, 4)).toEqual(['135', 'T', 'BW', 'FM1']);
        expect(idx('t3-20')).toBeGreaterThan(idx('FM1'));
        expect(idx('D30-60')).toBeGreaterThan(idx('t3-20'));
        expect(idx('PA/PC')).toBeGreaterThan(idx('D30-60'));
        expect(idx('ss')).toBeGreaterThan(idx('PA/PC'));
    });
});

describe('CORR.GAS_14175 / MATERIAL_GROUP / FILLER_GROUP', () => {
    test('gas di protezione: noto o "altro" → nessun finding; sconosciuto → info ISO 14175', () => {
        none(rec({ shielding_gas: 'M21' }), 'GAS_14175');
        none(rec({ shielding_gas: 'altro' }), 'GAS_14175');
        none(rec(), 'GAS_14175');
        const f = one(rec({ shielding_gas: 'miscela segreta XY' }), 'GAS_14175');
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.source.clause).toBe('ISO 14175');
        expect(f.source.norm).toBe('ISO 14175');
        expect(f.message_it).toContain('ISO 14175');
    });

    test('gruppo materiale: 1–11 noto → nessun finding; gruppo > 11 o ignoto → info §5.5.1', () => {
        none(rec({ material_group: '1.1' }), 'MATERIAL_GROUP');
        none(rec({ material_group: '8.1, 1.2' }), 'MATERIAL_GROUP');
        none(rec(), 'MATERIAL_GROUP');
        const outside = one(rec({ material_group: '22' }), 'MATERIAL_GROUP');
        expect(outside.severity).toBe(SEVERITY.INFO);
        expect(outside.status).toBe(STATUS.VERIFICABILE);
        expect(outside.source.clause).toBe('§5.5.1');
        expect(outside.message_it).toContain('fuori dai gruppi 1–11');
        expect(one(rec({ material_group: 'acciaio misterioso' }), 'MATERIAL_GROUP').message_it).toContain('non riconosciuto');
    });

    test('gruppo d\'apporto: FM1–FM6 → nessun finding; FM7 → warn Tab. 2; testo senza FM → info', () => {
        for (const g of ['FM1', 'FM6', 'fm 3']) none(rec({ filler_material_group: g }), 'FILLER_GROUP');
        const warn = one(rec({ filler_material_group: 'FM7' }), 'FILLER_GROUP');
        expect(warn.severity).toBe(SEVERITY.WARN);
        expect(warn.status).toBe(STATUS.VERIFICABILE);
        expect(warn.source.clause).toBe('§5.5.2 Tab. 2');
        expect(warn.message_it).toContain('§5.5.2 Tab. 2');
        const info = one(rec({ filler_material_group: 'ER70S-6' }), 'FILLER_GROUP');
        expect(info.severity).toBe(SEVERITY.INFO);
        expect(info.status).toBe(STATUS.VERIFICABILE);
    });

    test('processi senza apporto (142/311): il campo è il gruppo del materiale base, non si controlla FM', () => {
        none(rec({ welding_process_test: '142', filler_material_group: '1.1' }), 'FILLER_GROUP');
        none(rec({ welding_process_test: '311', filler_material_group: 'FM9' }), 'FILLER_GROUP');
    });

    test('modo db: legge filler_material della riga', () => {
        expect(one({ ...rec(), filler_material: 'FM8' }, 'FILLER_GROUP', 'db').severity).toBe(SEVERITY.WARN);
    });
});

describe('CORR.CONFIRMATION_INTERVAL / VALIDITY_PERIOD — §9', () => {
    test('prossima conferma entro 6 mesi dall\'esame o dall\'ultima conferma → nessun finding', () => {
        none(rec({ exam_date: '2026-01-10', next_confirmation_due: '2026-07-10' }), 'CONFIRMATION_INTERVAL');
        none(rec({ exam_date: '2026-01-10', last_confirmation_date: '2026-07-01', next_confirmation_due: '2027-01-01' }), 'CONFIRMATION_INTERVAL');
        none(rec({ exam_date: '2026-08-31', next_confirmation_due: '2027-02-28' }), 'CONFIRMATION_INTERVAL');
    });

    test('oltre 6 mesi → warn con §9.2; anche rispetto all\'ultima conferma', () => {
        const f = one(rec({ exam_date: '2026-01-10', next_confirmation_due: '2026-07-11' }), 'CONFIRMATION_INTERVAL');
        expectWarnOver(f, '§9.2');
        expect(f.expected_value).toBe('2026-07-10');
        expectWarnOver(one(rec({ exam_date: '2026-01-10', last_confirmation_date: '2026-07-01', next_confirmation_due: '2027-02-01' }), 'CONFIRMATION_INTERVAL'), '§9.2');
    });

    test('data di riferimento assente → dato mancante; nessuna prossima conferma → nessun finding', () => {
        expectDataMissing(one(rec({ next_confirmation_due: '2026-07-10' }), 'CONFIRMATION_INTERVAL'));
        none(rec({ exam_date: '2026-01-10' }), 'CONFIRMATION_INTERVAL');
    });

    test('scadenza oltre 3 anni dall\'esame → info §9.3 (non vincolante); entro 3 anni → nessun finding', () => {
        const f = one(rec({ exam_date: '2026-01-10', expiry_date: '2029-01-11' }), 'VALIDITY_PERIOD');
        expect(f.severity).toBe(SEVERITY.INFO);
        expect(f.status).toBe(STATUS.VERIFICABILE);
        expect(f.source.clause).toBe('§9.3');
        none(rec({ exam_date: '2026-01-10', expiry_date: '2029-01-10' }), 'VALIDITY_PERIOD');
        none(rec({ expiry_date: '2040-01-10' }), 'VALIDITY_PERIOD');
    });
});

describe('invarianti trasversali', () => {
    const fixtures = [
        rec({ thickness_s_test_mm: 6, thickness_min_mm: 3, thickness_max_mm: 30, welding_process_test: '311' }),
        rec({ thickness_min_mm: 3, thickness_max_mm: 6 }),
        rec({ product_type: 'T', pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 20 }),
        rec({ welding_position_test: 'PC', welding_positions: ['PA', 'PC', 'PE', 'PB'] }),
        fw({ thickness_t_test_mm: 2, thickness_min_mm: 1, thickness_max_mm: 10, welding_position_test: 'PB', welding_positions: 'PA PB PF' }),
        fw({ welding_process_test: '142', welding_processes_validity: '141', transfer_mode: 'short_arc', filler_material_group: 'FM9' }),
        rec({ qualification_designation: 'ISO 9606-1 135 P BW FM1 s10 PA', welding_process_test: '111', thickness_s_test_mm: 12 }),
    ];

    test.each(['ingest', 'review', 'db'])('mode %s: finding validi, warn solo se verificabili, non verificabili sempre info', (mode) => {
        for (const input of fixtures) {
            const { findings } = verifyQualification(input, { mode });
            for (const f of findings) {
                expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
                if (f.severity === SEVERITY.WARN) expect(f.status).toBe(STATUS.VERIFICABILE);
                if (f.status !== STATUS.VERIFICABILE) expect(f.severity).toBe(SEVERITY.INFO);
                expect(f.source.clause || f.status !== STATUS.VERIFICABILE).toBeTruthy();
                expect(f.code).not.toBe('QV.ENGINE.RULE_ERROR');
            }
        }
    });

    test('il pack non modifica il record e non espone un valore da applicare', () => {
        const input = rec({ thickness_s_test_mm: 6, thickness_min_mm: 1, thickness_max_mm: 99 });
        const copy = JSON.parse(JSON.stringify(input));
        const result = verifyQualification(input, { mode: 'review' });
        expect(input).toEqual(copy);
        expect(result.findings.length).toBeGreaterThan(0);
    });

    test('edizioni 2013 e 2012 danno gli stessi esiti del 2017', () => {
        const base = { thickness_s_test_mm: 3, thickness_min_mm: 3, thickness_max_mm: 7 };
        const codes = (ed) => all(rec({ ...base, standard_reference: `ISO 9606-1:${ed}` })).map((f) => f.code);
        expect(codes('2013')).toEqual(codes('2017'));
        expect(codes('2012')).toEqual(codes('2017'));
        expect(codes('2017')).toContain(`${P}.THK_BW`);
    });

    test('norma non coperta (EN 287-1): nessuna regola del pack, un solo finding fonte mancante', () => {
        const f = all({ ...rec({ thickness_s_test_mm: 3, thickness_max_mm: 99 }), standard_reference: 'EN 287-1:2011' });
        expect(f).toHaveLength(1);
        expect(f[0].status).toBe(STATUS.NON_VERIFICABILE_FONTE_MANCANTE);
    });
});
