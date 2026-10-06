'use strict';

const { verifyQualification } = require('../index');
const { validateFinding, SEVERITY, STATUS, FAMILY, TEXT_STATUS } = require('../findingTypes');
const registry = require('../verifyRegistry');
const { ensureDefaultPacks } = require('../registerDefaultPacks');
const pack = require('./welder9606Completeness.pack');

const P = 'WQ9606_1.COMP.';

const baseCommon = {
    qualification_type: 'Saldatore ISO 9606-1',
    standard_reference: 'EN ISO 9606-1:2017',
    welding_process_test: '135',
    welding_processes_validity: '135, 138',
    transfer_mode: 'short_arc',
    filler_material_group: 'FM1',
    material_group: '1.1',
    shielding_gas: 'M21',
    welding_position_test: 'PA',
    welding_positions: ['PA'],
    weld_details: 'ss nb',
    exam_date: '2026-01-10',
    certificate_number: 'C-001',
    issuing_body: 'Organismo di esame',
};

const bw = (over = {}) => ({
    ...baseCommon,
    joint_type: 'BW',
    product_type: 'P',
    thickness_s_test_mm: 10,
    thickness_min_mm: 3,
    thickness_max_mm: 20,
    ...over,
});

const fw = (over = {}) => ({
    ...baseCommon,
    joint_type: 'FW',
    product_type: 'P',
    thickness_t_test_mm: 8,
    thickness_min_mm: 3,
    thickness_max_unlimited: true,
    ...over,
});

const unknown = (over = {}) => ({
    ...baseCommon,
    joint_type: null,
    product_type: 'P',
    thickness_s_test_mm: 10,
    thickness_min_mm: 3,
    thickness_max_mm: 20,
    ...over,
});

const PROFILES = [
    ['BW', bw, '9606-1:BW'],
    ['FW', fw, '9606-1:FW'],
    ['UNKNOWN', unknown, '9606-1:UNKNOWN'],
];

const run = (input, mode = 'review') => verifyQualification(input, { mode });
const find = (result, code) => result.findings.filter((f) => f.code === P + code);
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

describe('pack welder9606Completeness — forma', () => {
    test('è registrato per BW/FW/UNKNOWN 9606-1 e per le tre edizioni coperte', () => {
        expect(registry.getRulePack('welder9606.completeness')).toBe(pack);
        expect(pack.standardFamily).toBe('9606-1');
        expect(pack.profiles).toEqual(['9606-1:BW', '9606-1:FW', '9606-1:UNKNOWN']);
        expect(pack.editions).toEqual(['2017', '2013', '2012']);
    });

    test('18 regole, famiglia completezza, codici unici con prefisso WQ9606_1.COMP.', () => {
        expect(pack.rules).toHaveLength(18);
        const ids = pack.rules.map((r) => r.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const r of pack.rules) {
            expect(r.family).toBe(FAMILY.COMPLETEZZA);
            expect(r.id.startsWith(P)).toBe(true);
        }
    });

    test('nessun processo fuori da 9606-1 è servito', () => {
        const r = run({ qualification_type: 'Saldatore ISO 9606-2', standard_reference: 'ISO 9606-2:2004', joint_type: 'BW' });
        expect(r.findings.filter((f) => f.code.startsWith(P))).toEqual([]);
    });
});

describe('certificato completo → nessun avviso', () => {
    test.each([
        ['BW piastra', bw()],
        ['FW piastra', fw()],
        ['BW tubo', bw({ product_type: 'T', pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 60, pipe_diameter_max_mm: 120 })],
        ['FW tubo, senza limite superiore di diametro', fw({ product_type: 'T', pipe_diameter_test_mm: 100, pipe_diameter_min_mm: 50, pipe_diameter_max_mm: null })],
        ['UNKNOWN (con spessore di prova e validità)', unknown({ joint_type: null })],
    ])('%s', (_name, input) => {
        const r = run(input);
        const own = r.findings.filter((f) => f.code.startsWith(P));
        // UNKNOWN: l'unico avviso è il tipo di giunto mancante (controllo di contesto, non un buco di dato)
        expect(own.map((f) => f.code)).toEqual(input.joint_type ? [] : [`${P}JOINT_TYPE`]);
    });

    test.each(['2017', '2013', '2012'])('edizione %s: stesso comportamento', (ed) => {
        expect(run(bw({ standard_reference: `ISO 9606-1:${ed}` })).findings).toEqual([]);
        const r = run(bw({ standard_reference: `ISO 9606-1:${ed}`, weld_details: null }));
        expect(r.findings.map((f) => f.code)).toEqual([`${P}WELD_DETAILS`]);
    });

    test('edizione non coperta (2004): un solo finding di fonte mancante, nessuna regola di completezza', () => {
        const r = run(bw({ standard_reference: 'ISO 9606-1:2004', weld_details: null }));
        expect(r.findings.map((f) => f.status)).toEqual([STATUS.NON_VERIFICABILE_FONTE_MANCANTE]);
    });

    test('mode db: riga DB con alias (filler_material, position_range, standard_ref, issue_date)', () => {
        const row = {
            qualification_type: 'Saldatore ISO 9606-1',
            standard_ref: 'EN ISO 9606-1:2017',
            joint_type: 'BW',
            product_type: 'P',
            welding_process_test: '141',
            filler_material: 'FM5',
            material_group: '8.1',
            shielding_gas: 'I1',
            welding_position_test: 'PF',
            position_range: 'PA, PF',
            weld_details: 'ss nb',
            thickness_s_test_mm: 4,
            thickness_min_mm: 3,
            thickness_max_mm: 8,
            issue_date: '2026-02-01',
            certificate_number: 'DB-1',
            examiner_body: 'Ente',
        };
        expect(run(row, 'db').findings).toEqual([]);
    });

    test('processo solo nel campo legacy welding_process: PROCESS non scatta', () => {
        const r = run(bw({ welding_process_test: null, welding_processes_validity: null, welding_process: '135' }));
        expect(find(r, 'PROCESS')).toEqual([]);
    });
});

describe('campi semplici — assenti → avviso con clausola, per BW / FW / UNKNOWN', () => {
    const SIMPLE = [
        ['PROCESS', { welding_process_test: null, welding_processes_validity: null, welding_process: null }, SEVERITY.WARN, '§5.1, §5.2, §10, Annex A'],
        ['PRODUCT_TYPE', { product_type: null }, SEVERITY.WARN, '§5.1, §5.3, §11'],
        ['FILLER_GROUP', { filler_material_group: null }, SEVERITY.WARN, '§5.5, Tab. 2, §11'],
        ['MATERIAL_GROUP', { material_group: null }, SEVERITY.WARN, '§5.1, §10, Annex A'],
        ['WELD_DETAILS', { weld_details: null }, SEVERITY.WARN, '§5.1, §5.9, §11'],
        ['EXAM_DATE', { exam_date: null }, SEVERITY.WARN, '§9.1, §10, Annex A'],
        ['CERTIFICATE_NUMBER', { certificate_number: null }, SEVERITY.WARN, '§10, Annex A'],
        ['ISSUING_BODY', { issuing_body: null }, SEVERITY.WARN, '§10, Annex A'],
        ['POSITION_TEST', { welding_position_test: null }, SEVERITY.INFO, '§5.8, §11'],
        ['STANDARD_REFERENCE', { standard_reference: null }, SEVERITY.INFO, 'Annex A'],
    ];

    describe.each(PROFILES)('profilo %s', (_name, make) => {
        test.each(SIMPLE)('%s assente', (code, over, severity, clause) => {
            const r = run(make(over));
            const f = only(r, code);
            expect(f.severity).toBe(severity);
            expect(f.status).toBe(STATUS.VERIFICABILE);
            expect(f.family).toBe(FAMILY.COMPLETEZZA);
            expect(f.direction).toBe('missing');
            expect(f.read_value).toBeNull();
            expect(f.expected_value).toBeNull();
            expect(f.source).toMatchObject({ norm: 'ISO 9606-1', edition: '2017', clause, text_status: TEXT_STATUS.MD_INTEGRALE });
            expect(f.message_it).toContain(clause);
            expect(f.message_it).toMatch(/assente/);
            expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
        });
    });

    test('un solo campo mancante → un solo finding (nessuna pioggia)', () => {
        expect(run(bw({ certificate_number: null })).findings.map((f) => f.code)).toEqual([`${P}CERTIFICATE_NUMBER`]);
    });

    test('POSITIONS assenti: clausola per tabella BW / FW / UNKNOWN', () => {
        const cases = [[bw, '§5.8 Tab. 9, §11'], [fw, '§5.8 Tab. 10, §11'], [unknown, '§5.8 Tab. 9/10, §11']];
        for (const [make, clause] of cases) {
            const f = only(run(make({ welding_positions: [] })), 'POSITIONS');
            expect(f.severity).toBe(SEVERITY.WARN);
            expect(f.source.clause).toBe(clause);
            expect(f.message_it).toContain(clause);
        }
    });
});

describe('JOINT_TYPE e profilo UNKNOWN', () => {
    test('giunto non letto: warn con clausola e profilo UNKNOWN', () => {
        const r = run(unknown());
        expect(r.profile).toBe('9606-1:UNKNOWN');
        const f = only(r, 'JOINT_TYPE');
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.source.clause).toBe('§5.1, §5.4, §11');
        expect(f.message_it).toContain('§5.1, §5.4, §11');
    });

    test('giunto presente: nessun finding JOINT_TYPE', () => {
        expect(find(run(bw()), 'JOINT_TYPE')).toEqual([]);
        expect(find(run(fw()), 'JOINT_TYPE')).toEqual([]);
    });
});

describe('THK_VALIDITY / THK_TEST', () => {
    test('BW: validità assente → warn Tab. 6', () => {
        const f = only(run(bw({ thickness_min_mm: null, thickness_max_mm: null })), 'THK_VALIDITY');
        expect(f).toMatchObject({ severity: SEVERITY.WARN, status: STATUS.VERIFICABILE, direction: 'missing' });
        expect(f.source.clause).toBe('§5.7 Tab. 6');
        expect(f.message_it).toContain('§5.7 Tab. 6');
        expect(f.message_it).toContain('limite minimo e massimo');
    });

    test('FW: validità assente → warn Tab. 8', () => {
        const f = only(run(fw({ thickness_min_mm: null, thickness_max_unlimited: false })), 'THK_VALIDITY');
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.source.clause).toBe('§5.7 Tab. 8');
        expect(f.fields).toEqual(['thickness_min_mm', 'thickness_max_mm', 'thickness_max_unlimited', 'thickness_range']);
    });

    test('manca il minimo (max dichiarato, nessun testo legacy) → warn che nomina il limite minimo', () => {
        const noMin = only(run(bw({ thickness_min_mm: null })), 'THK_VALIDITY');
        expect(noMin).toMatchObject({ severity: SEVERITY.WARN, status: STATUS.VERIFICABILE, field: 'thickness_min_mm' });
        expect(noMin.message_it).toContain('limite minimo');
        expect(noMin.message_it).not.toContain('minimo e massimo');
    });

    test('taratura VQ-TUNE: solo il minimo («t≥3», convenzione «senza limite») → info, mai warn', () => {
        const f = only(run(bw({ thickness_max_mm: null })), 'THK_VALIDITY');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE, direction: 'missing', field: 'thickness_max_mm' });
        expect(f.source.clause).toBe('§5.7 Tab. 6');
        expect(f.message_it).toContain('§5.7 Tab. 6');
        expect(f.message_it).toContain('solo il limite minimo');
        expect(validateFinding(f).ok).toBe(true);
        const fwOnlyMin = only(run(fw({ thickness_max_unlimited: false })), 'THK_VALIDITY');
        expect(fwOnlyMin).toMatchObject({ severity: SEVERITY.INFO });
        expect(fwOnlyMin.source.clause).toBe('§5.7 Tab. 8');
    });

    test.each([
        ['t≥3', true], ['t>=3', true], ['≥ 3 mm', true], ['≥3mm', true], ['>= 3,0 mm', true], ['da 3 mm', true], ['min 3', true],
        ['3-…', true], ['3 - ...', true], ['3 mm -', true], ['3 mm senza limite', true], ['3-illimitato', true],
        ['3-18 mm', true], ['3 – 12.6 mm', true], ['fino a 18 mm', true],
    ])('testo legacy «%s» interpretabile → il minimo senza massimo è info', (text) => {
        const f = only(run(bw({ thickness_max_mm: null, thickness_range: text })), 'THK_VALIDITY');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE });
    });

    test('validità solo nel testo legacy (colonne vuote, «3-12.6 mm») → info; testo inutilizzabile → warn', () => {
        const legacy = only(run(bw({ thickness_min_mm: null, thickness_max_mm: null, thickness_range: '3-12.6 mm' })), 'THK_VALIDITY');
        expect(legacy).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE });
        expect(legacy.message_it).toContain('3-12.6 mm');
        expect(legacy.message_it).toContain('da 3 a 12,6 mm');
        expect(validateFinding(legacy).ok).toBe(true);
        for (const text of ['n.d.', '12', '18-3', 'vedi allegato', 'fino a 18 mm']) {
            const f = only(run(bw({ thickness_min_mm: null, thickness_max_mm: null, thickness_range: text })), 'THK_VALIDITY');
            expect(f.severity).toBe(SEVERITY.WARN);
        }
    });

    test('il testo legacy che non restituisce il minimo non salva il warn (max dichiarato, min assente)', () => {
        const f = only(run(bw({ thickness_min_mm: null, thickness_range: 'fino a 12 mm' })), 'THK_VALIDITY');
        expect(f.severity).toBe(SEVERITY.WARN);
    });

    test('«nessun limite superiore» (thickness_max_unlimited) vale come estremo massimo', () => {
        expect(find(run(bw({ thickness_max_mm: null, thickness_max_unlimited: true })), 'THK_VALIDITY')).toEqual([]);
    });

    test('UNKNOWN: validità assente → non verificabile (Tab. 6 o 8?), mai warn', () => {
        const f = only(run(unknown({ thickness_min_mm: null, thickness_max_mm: null })), 'THK_VALIDITY');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
        expect(f.message_it).toMatch(/Tab\. 6/);
        expect(f.message_it).toMatch(/Tab\. 8/);
        expect(validateFinding(f).ok).toBe(true);
    });

    test('BW: spessore s di prova assente → info (verificabile)', () => {
        const f = only(run(bw({ thickness_s_test_mm: null })), 'THK_TEST');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE, field: 'thickness_s_test_mm' });
        expect(f.source.clause).toBe('§5.7 Tab. 6, §11');
        expect(f.message_it).toContain('§5.7 Tab. 6, §11');
    });

    test('BW: il solo t di prova non sostituisce s', () => {
        const f = only(run(bw({ thickness_s_test_mm: null, thickness_t_test_mm: 8 })), 'THK_TEST');
        expect(f.field).toBe('thickness_s_test_mm');
    });

    test('FW: spessore t di prova assente → info; il solo s non lo sostituisce', () => {
        const f = only(run(fw({ thickness_t_test_mm: null, thickness_s_test_mm: 8 })), 'THK_TEST');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE, field: 'thickness_t_test_mm' });
        expect(f.source.clause).toBe('§5.7 Tab. 8, §11');
    });

    test('UNKNOWN: spessore di prova assente → non verificabile; con s o t presente → nessun finding', () => {
        const f = only(run(unknown({ thickness_s_test_mm: null })), 'THK_TEST');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
        expect(find(run(unknown({ thickness_s_test_mm: null, thickness_t_test_mm: 6 })), 'THK_TEST')).toEqual([]);
    });
});

describe('PIPE_DIAMETER / PIPE_DIAMETER_TEST', () => {
    test.each(PROFILES)('%s: piastra (P) → diametro non richiesto', (_n, make) => {
        const r = run(make({ pipe_diameter_min_mm: null, pipe_diameter_max_mm: null, pipe_diameter_test_mm: null }));
        expect(find(r, 'PIPE_DIAMETER')).toEqual([]);
        expect(find(r, 'PIPE_DIAMETER_TEST')).toEqual([]);
    });

    test.each(PROFILES)('%s: tubo (T) senza diametri → warn sulla validità, info sulla prova', (_n, make) => {
        const r = run(make({ product_type: 'T' }));
        const v = only(r, 'PIPE_DIAMETER');
        expect(v).toMatchObject({ severity: SEVERITY.WARN, status: STATUS.VERIFICABILE, direction: 'missing' });
        expect(v.source.clause).toBe('§5.7 Tab. 7, Annex A');
        expect(v.message_it).toContain('§5.7 Tab. 7, Annex A');
        const t = only(r, 'PIPE_DIAMETER_TEST');
        expect(t).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE });
        expect(t.source.clause).toBe('§5.7 Tab. 7, §11');
    });

    test('tubo con solo il minimo (massimo = nessun limite, Tab. 7): nessun avviso', () => {
        const r = run(bw({ product_type: 'T', pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 30, pipe_diameter_max_mm: null }));
        expect(find(r, 'PIPE_DIAMETER')).toEqual([]);
    });

    test.each(PROFILES)('%s: tipo prodotto non letto → non verificabile (e PRODUCT_TYPE warn)', (_n, make) => {
        const r = run(make({ product_type: null }));
        expect(only(r, 'PRODUCT_TYPE').severity).toBe(SEVERITY.WARN);
        for (const code of ['PIPE_DIAMETER', 'PIPE_DIAMETER_TEST']) {
            const f = only(r, code);
            expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
            expect(validateFinding(f).ok).toBe(true);
        }
    });

    test('tipo prodotto non letto ma diametri presenti: nessun finding di diametro', () => {
        const r = run(bw({ product_type: null, pipe_diameter_test_mm: 60, pipe_diameter_min_mm: 60, pipe_diameter_max_mm: 120 }));
        expect(find(r, 'PIPE_DIAMETER')).toEqual([]);
        expect(find(r, 'PIPE_DIAMETER_TEST')).toEqual([]);
    });
});

describe('FILLER_GROUP — processi senza apporto (142, 311) e processo non letto', () => {
    test.each(PROFILES)('%s: senza gruppo FM con processo 141 → warn', (_n, make) => {
        expect(only(run(make({ welding_process_test: '141', filler_material_group: null })), 'FILLER_GROUP').severity).toBe(SEVERITY.WARN);
    });

    test.each([['142'], ['311']])('processo %s senza apporto: gruppo FM non richiesto', (proc) => {
        const r = run(bw({ welding_process_test: proc, filler_material_group: null, transfer_mode: null, shielding_gas: null }));
        expect(find(r, 'FILLER_GROUP')).toEqual([]);
    });

    test.each(PROFILES)('%s: processo non leggibile e FM assente → non verificabile', (_n, make) => {
        const r = run(make({
            welding_process_test: null, welding_processes_validity: null, filler_material_group: null,
        }));
        const f = only(r, 'FILLER_GROUP');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
        expect(f.message_it).toMatch(/142, 311/);
        expect(only(r, 'PROCESS').severity).toBe(SEVERITY.WARN);
    });

    test('processo 311 senza gruppo materiale base: warn con §5.6 e nota', () => {
        const f = only(run(bw({ welding_process_test: '311', filler_material_group: null, material_group: null })), 'MATERIAL_GROUP');
        expect(f.severity).toBe(SEVERITY.WARN);
        expect(f.source.clause).toBe('§5.1, §5.6, §10, Annex A');
        expect(f.message_it).toContain('§5.1, §5.6, §10, Annex A');
        expect(f.message_it).toMatch(/142 e 311/);
    });
});

describe('TRANSFER_MODE', () => {
    test.each(PROFILES)('%s: processo 135 senza metodo di trasferimento → info', (_n, make) => {
        const f = only(run(make({ transfer_mode: null })), 'TRANSFER_MODE');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE, direction: 'missing' });
        expect(f.source.clause).toBe('§5.2, Annex A');
        expect(f.message_it).toContain('§5.2, Annex A');
    });

    test.each([['131'], ['135'], ['136'], ['138']])('processo %s: richiesto', (proc) => {
        expect(find(run(bw({ welding_process_test: proc, transfer_mode: null })), 'TRANSFER_MODE')).toHaveLength(1);
    });

    test.each([['111'], ['141'], ['311'], ['121']])('processo %s: non applicabile', (proc) => {
        expect(find(run(bw({ welding_process_test: proc, transfer_mode: null })), 'TRANSFER_MODE')).toEqual([]);
    });

    test.each(PROFILES)('%s: processo non letto → non verificabile', (_n, make) => {
        const f = only(run(make({ welding_process_test: null, welding_processes_validity: null, transfer_mode: null })), 'TRANSFER_MODE');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
        expect(validateFinding(f).ok).toBe(true);
    });
});

describe('SHIELDING_GAS', () => {
    test.each(PROFILES)('%s: processo a gas (135) senza gas → info', (_n, make) => {
        const f = only(run(make({ shielding_gas: null })), 'SHIELDING_GAS');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.VERIFICABILE, direction: 'missing' });
        expect(f.source.clause).toBe('§10, Annex A');
        expect(f.message_it).toContain('§10, Annex A');
    });

    test.each([['131'], ['136'], ['141'], ['142'], ['145']])('processo %s: gas richiesto', (proc) => {
        expect(find(run(bw({ welding_process_test: proc, shielding_gas: null })), 'SHIELDING_GAS')).toHaveLength(1);
    });

    test.each([['111'], ['114'], ['121'], ['311']])('processo %s: nessun gas di protezione richiesto', (proc) => {
        expect(find(run(bw({ welding_process_test: proc, shielding_gas: null })), 'SHIELDING_GAS')).toEqual([]);
    });

    test.each(PROFILES)('%s: processo non letto → non verificabile', (_n, make) => {
        const f = only(run(make({ welding_process_test: null, welding_processes_validity: null, shielding_gas: null })), 'SHIELDING_GAS');
        expect(f).toMatchObject({ severity: SEVERITY.INFO, status: STATUS.NON_VERIFICABILE_DATO_MANCANTE });
    });
});

describe('invarianti del contratto su tutti gli esiti del pack', () => {
    const empties = [{}, { qualification_type: 'Saldatore ISO 9606-1' }];
    const inputs = [
        ...empties.map((e) => ({ ...e, joint_type: 'BW' })),
        ...empties.map((e) => ({ ...e, joint_type: 'FW', product_type: 'T' })),
        ...empties,
        bw({ welding_process_test: null, welding_processes_validity: null, thickness_s_test_mm: null, product_type: 'T' }),
        fw({ welding_process_test: '311', filler_material_group: null, material_group: null }),
        unknown({ product_type: null, welding_positions: [], weld_details: null }),
    ].map((e) => ({ qualification_type: 'Saldatore ISO 9606-1', ...e }));

    test.each(inputs.map((i, n) => [n, i]))('input %i: tutti i finding validi, solo info|warn, warn solo se verificabile, nessun blocco', (_n, input) => {
        for (const mode of ['ingest', 'review', 'db']) {
            const r = run(input, mode);
            for (const f of r.findings) {
                expect(validateFinding(f)).toEqual({ ok: true, errors: [] });
                expect([SEVERITY.INFO, SEVERITY.WARN]).toContain(f.severity);
                if (f.severity === SEVERITY.WARN) expect(f.status).toBe(STATUS.VERIFICABILE);
                if (f.status === STATUS.VERIFICABILE) expect(f.source.clause).toBeTruthy();
                expect(f).not.toHaveProperty('blocking');
                expect(f).not.toHaveProperty('error');
            }
        }
    });

    test('record vuoto BW: i warn precedono le info e il summary è coerente', () => {
        const r = run({ qualification_type: 'Saldatore ISO 9606-1', joint_type: 'BW' });
        const firstInfo = r.findings.findIndex((f) => f.severity === SEVERITY.INFO);
        expect(r.findings.slice(firstInfo).every((f) => f.severity === SEVERITY.INFO)).toBe(true);
        expect(r.summary.warn + r.summary.info).toBe(r.findings.length);
        expect(r.summary.verificabili + r.summary.non_verificabili).toBe(r.findings.length);
        expect(r.summary.warn).toBeGreaterThan(0);
    });

    test('non restituisce mai un valore atteso da applicare (expected_value sempre null)', () => {
        const r = run({ qualification_type: 'Saldatore ISO 9606-1', joint_type: 'BW' });
        expect(r.findings.every((f) => f.expected_value === null)).toBe(true);
    });

    test('nessun errore interno dell\'engine su input degeneri', () => {
        for (const input of [null, undefined, {}, [], { joint_type: 'XX' }, { qualification_type: 'ISO 9606-1', positions: 5 }]) {
            const r = run(input);
            expect(r.findings.some((f) => f.code === 'QV.ENGINE.RULE_ERROR')).toBe(false);
        }
    });
});
