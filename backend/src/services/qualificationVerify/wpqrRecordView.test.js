'use strict';

const {
    toWpqrView, detectWpqrStandard, resolveWpqrProfile, canonicalCurrent, canonicalResult,
} = require('./wpqrRecordView');

const deepFreeze = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
        Object.freeze(o);
        Object.values(o).forEach(deepFreeze);
    }
    return o;
};

const reviewFields = {
    reference_number: 'SYN-WPQR-001',
    standard_reference: 'ISO 15614-1:2017+A1:2019',
    qualification_level: 'Level 2',
    joint_type: 'BW',
    product_type: 'P',
    welding_process: '135',
    material_group: '1.1',
    filler_material: 'G 42 4 M21 3Si1',
    thickness_test_mm: '12,5',
    thickness_min: 5,
    thickness_max: 25,
    diameter_min: null,
    welding_positions: 'PA, PB',
    approval_date: '2025-03-01',
    examiner_body: 'Ente Sintetico',
    current_type: 'DC-EP',
    pwht: true,
    preheat_temp: 'min 50 C',
    heat_input_note: '1,0 kJ/mm',
};

const dbRow = {
    reference_number: 'SYN-WPQR-001',
    standard_reference: 'ISO 15614-1:2017+A1:2019',
    qualification_level: 'Level 2',
    joint_type: 'BW',
    product_type: 'P',
    welding_process: '135',
    base_material_group: '1.1',
    filler_material: 'G 42 4 M21 3Si1',
    thickness_tested: 12.5,
    thickness_min: 5,
    thickness_max: 25,
    diameter_min: null,
    welding_positions: 'PA, PB',
    issue_date: new Date('2025-03-01T00:00:00Z'),
    examiner_body: 'Ente Sintetico',
    current_type: 'DC-EP',
    pwht: 1,
    preheat_temp: 'min 50 C',
    heat_input_note: '1,0 kJ/mm',
};

describe('toWpqrView — parità review-fields ↔ riga DB', () => {
    test('stessi valori canonici da ingressi diversi', () => {
        const a = toWpqrView(reviewFields, { source: 'review' });
        const b = toWpqrView(dbRow, { source: 'db' });
        expect(a.source).toBe('review');
        expect(b.source).toBe('db');
        const { source: _sa, ...restA } = a;
        const { source: _sb, ...restB } = b;
        expect(restA).toEqual(restB);
        expect(a.thickness_tested).toBe(12.5);
        expect(a.material_group).toBe('1.1');
        expect(a.issue_date).toBe('2025-03-01');
        expect(a.positions).toEqual(['PA', 'PB']);
        expect(a.profile).toBe('15614-1:BW');
    });

    test('input non mutato (normalizzazione solo in memoria)', () => {
        const input = deepFreeze({ ...reviewFields, test_runs: [{ run_label: '1', current_polarity: 'DCEP' }] });
        const snapshot = JSON.parse(JSON.stringify(input));
        expect(() => toWpqrView(input, { source: 'review' })).not.toThrow();
        expect(JSON.parse(JSON.stringify(input))).toEqual(snapshot);
        expect(input.current_type).toBe('DC-EP');
    });

    test('input assente/non oggetto: vista vuota, nessun errore', () => {
        for (const bad of [null, undefined, 'x', 3]) {
            const v = toWpqrView(bad);
            expect(v.profile).toBeNull();
            expect(v.runs).toEqual([]);
            expect(v.standard.family).toBeNull();
        }
    });

    test('colonne nuove assenti = null (vista tollerante alle colonne non ancora migrate)', () => {
        const v = toWpqrView(dbRow, { source: 'db' });
        for (const k of ['deposited_thickness_mm', 'diameter_test_mm',
            'heat_input_range_min', 'heat_input_tol_minus_pct', 'shielding_gas_flow_l_min_min', 'torch_angle_deg',
            'pwht_details', 'post_heating', 'backing_gas', 'range_standard_reference', 'test_date']) {
            expect(v[k]).toBeNull();
        }
        expect(v.heat_input_kind).toBeNull();
        expect(v.preheat_test.value).toBeNull();
        expect(v.interpass_test.value).toBeNull();
    });
});

describe('toWpqrView — normalizzazione in memoria', () => {
    test('DC-EP / DCEP / DC+ → DCEP; DC-EN / DC- → DCEN; non riconosciuto → null', () => {
        for (const t of ['DC-EP', 'DCEP', 'DC EP', 'dc+', 'DC (+)', 'DC/EP']) expect(canonicalCurrent(t)).toBe('DCEP');
        for (const t of ['DC-EN', 'DCEN', 'DC-', 'dc(-)']) expect(canonicalCurrent(t)).toBe('DCEN');
        expect(canonicalCurrent('AC')).toBe('AC');
        expect(canonicalCurrent('DC')).toBe('DC');
        expect(canonicalCurrent('pulsata')).toBeNull();
        expect(canonicalCurrent(null)).toBeNull();
    });

    test('current_type grafia non canonica: valore canonico + voce di normalizzazione, dato letto invariato', () => {
        const v = toWpqrView({ ...reviewFields, current_type: 'DC-EP' });
        expect(v.current_type).toBe('DC-EP');
        expect(v.current_type_canonical).toBe('DCEP');
        expect(v.normalization).toEqual(expect.arrayContaining([
            { field: 'current_type', read: 'DC-EP', canonical: 'DCEP' },
        ]));
        const w = toWpqrView({ ...reviewFields, current_type: 'DCEP' });
        expect(w.normalization.find((n) => n.field === 'current_type')).toBeUndefined();
    });

    test('edizione in standard_reference: grafia «2019» → 2017+A1:2019 con voce di normalizzazione', () => {
        const v = toWpqrView({ ...reviewFields, standard_reference: 'UNI EN ISO 15614-1:2019' });
        expect(v.standard).toMatchObject({ family: '15614-1', edition: '2017+A1:2019', edition_read: '2019' });
        expect(v.normalization).toEqual(expect.arrayContaining([
            { field: 'standard_reference', read: 'UNI EN ISO 15614-1:2019', canonical: '2017+A1:2019' },
        ]));
        const exact = toWpqrView(reviewFields);
        expect(exact.normalization.find((n) => n.field === 'standard_reference')).toBeUndefined();
    });

    test('designazione filler: chiave di confronto senza spazi/separatori, dato letto invariato', () => {
        const v = toWpqrView({ ...reviewFields, filler_material: 'G 42 4 M21 3Si1' });
        expect(v.filler_material).toBe('G 42 4 M21 3Si1');
        expect(v.filler_material_key).toBe('G42 4M213SI1'.replace(/ /g, ''));
        expect(toWpqrView({ ...reviewFields, filler_material: 'G42' }).filler_material_key).toBe('G42');
    });
});

describe('toWpqrView — norma, edizione, profilo', () => {
    const profile = (standard_reference, extra = {}) => toWpqrView({ standard_reference, ...extra }).profile;
    const std = (standard_reference, extra = {}) => toWpqrView({ standard_reference, ...extra }).standard;

    test('15614-1: BW / FW / UNKNOWN secondo joint_type', () => {
        expect(profile('ISO 15614-1:2017', { joint_type: 'BW' })).toBe('15614-1:BW');
        expect(profile('ISO 15614-1:2017', { joint_type: 'fw' })).toBe('15614-1:FW');
        expect(profile('ISO 15614-1:2017', { joint_type: 'Fillet weld' })).toBe('15614-1:FW');
        expect(profile('ISO 15614-1:2017', { joint_type: 'Testa a testa' })).toBe('15614-1:BW');
        expect(profile('ISO 15614-1:2017')).toBe('15614-1:UNKNOWN');
        expect(profile('ISO 15614-1:2017', { joint_type: 'BW+FW' })).toBe('15614-1:UNKNOWN');
    });

    test('15614-2: BW/FW; senza giunto leggibile profilo null', () => {
        expect(profile('EN ISO 15614-2:2025', { joint_type: 'BW' })).toBe('15614-2:BW');
        expect(profile('EN ISO 15614-2:2025', { joint_type: 'FW' })).toBe('15614-2:FW');
        expect(profile('EN ISO 15614-2:2025')).toBeNull();
        expect(std('ISO 15614-2:2025')).toMatchObject({ family: '15614-2', edition: '2025' });
    });

    test('14555: profilo SW da standard_reference o da qualifying_element', () => {
        expect(profile('ISO 14555:2025')).toBe('14555:SW');
        expect(profile('ISO 14555:2025', { joint_type: 'BW' })).toBe('14555:SW');
        const v = toWpqrView({ qualifying_element: 'Stud' });
        expect(v.profile).toBe('14555:SW');
        expect(v.standard).toMatchObject({ family: '14555', edition: null, via: 'qualifying_element' });
        expect(toWpqrView({ qualifying_element: 'base' }).profile).toBeNull();
    });

    test('edizioni: moderne, con emendamento, legacy e senza edizione', () => {
        expect(std('ISO 15614-1:2017').edition).toBe('2017');
        expect(std('ISO 15614-1:2017 + A1:2019').edition).toBe('2017+A1:2019');
        expect(std('ISO 15614-1:2017/A1:2019').edition).toBe('2017+A1:2019');
        expect(std('ISO 15614-1:2004+A2:2012').edition).toBe('2004+A2:2012');
        expect(std('EN ISO 15614-1:2012').edition).toBe('2004+A2:2012');
        expect(std('ISO 15614-1').edition).toBeNull();
        expect(std('ISO 15614-1').family).toBe('15614-1');
        expect(std('ISO 15614-2:2005').edition).toBe('2005');
    });

    test('norme riconosciute ma senza fonte: family null con label', () => {
        expect(std('ISO 15614-3:2008')).toMatchObject({ family: null, label: 'ISO 15614-3' });
        expect(std('ISO 15614-10:2005')).toMatchObject({ family: null, label: 'ISO 15614-10' });
        expect(std('ISO 15614')).toMatchObject({ family: null, label: 'ISO 15614' });
        expect(profile('ISO 15614-3:2008', { joint_type: 'BW' })).toBeNull();
    });

    test('norma assente o sconosciuta', () => {
        expect(std(null)).toMatchObject({ family: null, label: null, raw: null });
        expect(std('Norma interna XY')).toMatchObject({ family: null, label: null, raw: 'Norma interna XY' });
        expect(detectWpqrStandard('')).toBeNull();
        expect(resolveWpqrProfile(null, 'BW')).toBeNull();
    });

    test('ISO 15613 con range_standard_reference → profilo della parte 15614 dichiarata', () => {
        const v = toWpqrView({
            standard_reference: 'ISO 15613:2025',
            range_standard_reference: 'ISO 15614-1:2017+A1:2019 Level 2',
            joint_type: 'FW',
        });
        expect(v.profile).toBe('15614-1:FW');
        expect(v.standard).toMatchObject({ family: '15614-1', edition: '2017+A1:2019', via: 'range_standard_reference' });
        expect(v.qualification_standard).toMatchObject({ label: 'ISO 15613' });
        expect(v.range_part_missing).toBe(false);
        expect(v.level).toBe(2);
        expect(v.level_declared).toBe(true);
    });

    test('ISO 15613 senza parte 15614 dichiarata → range_part_missing, nessun profilo', () => {
        const v = toWpqrView({ standard_reference: 'EN ISO 15613:2025', joint_type: 'BW' });
        expect(v.range_part_missing).toBe(true);
        expect(v.profile).toBeNull();
        expect(v.standard.family).toBeNull();
    });
});

describe('toWpqrView — livello 15614-1', () => {
    test('default Level 2 se assente, con level_declared = false', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017', joint_type: 'BW' });
        expect(v.level).toBe(2);
        expect(v.level_declared).toBe(false);
    });

    test('Level 1 e Level 2 dichiarati in più grafie', () => {
        for (const [text, level] of [['Level 1', 1], ['1', 1], ['L1', 1], ['Livello 2', 2], ['2', 2], [2, 2]]) {
            const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017', qualification_level: text });
            expect([text, v.level, v.level_declared]).toEqual([text, level, true]);
        }
    });

    test('livello illeggibile → default 2 non dichiarato', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017', qualification_level: 'Level 3' });
        expect(v.level).toBe(2);
        expect(v.level_declared).toBe(false);
    });

    test('livello nel testo della norma quando la colonna è vuota', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017 Level 1' });
        expect(v.level).toBe(1);
        expect(v.level_declared).toBe(true);
    });

    test('fuori da 15614-1 il livello non si applica', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-2:2025', qualification_level: '1', joint_type: 'BW' });
        expect(v.level).toBeNull();
        expect(v.level_declared).toBe(false);
    });
});

describe('toWpqrView — dato non determinabile (pwht, product_type)', () => {
    test('pwht = 0 e product_type NULL non sono mai «no»', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017', pwht: 0, product_type: null }, { source: 'db' });
        expect(v.pwht).toBe(false);
        expect(v.product_type).toBeNull();
        expect(v.not_determinable).toEqual(expect.arrayContaining(['pwht', 'product_type']));
    });

    test('pwht dichiarato e product_type letto: determinabili', () => {
        const v = toWpqrView({ standard_reference: 'ISO 15614-1:2017', pwht: 1, product_type: 'plate' }, { source: 'db' });
        expect(v.pwht).toBe(true);
        expect(v.product_type).toBe('P');
        expect(v.not_determinable).toEqual([]);
        expect(toWpqrView({ product_type: 'Tubo' }).product_type).toBe('T');
        expect(toWpqrView({ product_type: 'P+T' }).product_type).toBe('P+T');
    });
});

describe('toWpqrView — passate (runs)', () => {
    test('runs assenti, vuoti, presenti (opts, input.runs, input.test_runs)', () => {
        expect(toWpqrView(reviewFields).runs).toEqual([]);
        expect(toWpqrView(reviewFields).runs_archived).toBe(false);
        expect(toWpqrView(reviewFields, { runs: [] }).runs_archived).toBe(false);
        expect(toWpqrView(reviewFields, { runs: 'x' }).runs).toEqual([]);
        expect(toWpqrView(dbRow, { source: 'db', runs: [{ run_no: 1 }, { run_no: 2 }] }).runs).toHaveLength(2);
        expect(toWpqrView({ ...reviewFields, test_runs: [{ run_label: '1' }] }).runs).toHaveLength(1);
        expect(toWpqrView({ ...dbRow, runs: [{ run_label: '1' }] }, { source: 'db' }).runs_archived).toBe(true);
    });

    test('colonne assenti nella passata = null; nessuna passata inventata', () => {
        const [r] = toWpqrView(reviewFields, { runs: [{}] }).runs;
        for (const k of ['run_no', 'welding_process', 'filler_diameter_mm', 'current_a', 'voltage_v', 'wire_feed_speed',
            'travel_speed', 'heat_input_value', 'heat_input_kj_mm', 'travel_speed_mm_s', 'weld_time_ms', 'capacitance_mf']) {
            expect(r[k]).toBeNull();
        }
        expect(r.polarity_source).toBe('header');
    });

    test('etichetta non intera: run_label testo, run_no = primo intero', () => {
        const runs = toWpqrView(reviewFields, {
            runs: [{ run_label: '2 +n' }, { run_label: '3-4' }, { run_label: 'A' }, { run_no: 5, run_label: '5' }],
        }).runs;
        expect(runs.map((r) => [r.run_label, r.run_no])).toEqual([['2 +n', 2], ['3-4', 3], ['A', null], ['5', 5]]);
    });

    test('layout senza polarità per riga: ripiego su current_type di testata con provenienza', () => {
        const runs = toWpqrView({ ...reviewFields, current_type: 'DC-EP' }, {
            runs: [{ run_label: '1', current_a: '210', voltage_v: '24' }, { run_label: '2', current_polarity: 'DC-EN' }],
        }).runs;
        expect(runs[0]).toMatchObject({
            current_polarity: null, polarity_effective: 'DCEP', polarity_source: 'header', current_a: 210, voltage_v: 24,
        });
        expect(runs[1]).toMatchObject({ current_polarity_canonical: 'DCEN', polarity_effective: 'DCEN', polarity_source: 'run' });
    });

    test('né riga né testata: polarità non determinabile (null)', () => {
        const [r] = toWpqrView({ ...reviewFields, current_type: null }, { runs: [{ run_label: '1' }] }).runs;
        expect(r.polarity_effective).toBeNull();
        expect(r.polarity_source).toBeNull();
    });

    test('unità lette e conservate; conversione in kJ/mm e mm/s solo nella vista', () => {
        const input = deepFreeze({
            ...reviewFields,
            test_runs: [
                { run_label: '1', heat_input_value: '1,2', heat_input_unit: 'kJ/mm', travel_speed: '4', travel_speed_unit: 'mm/s' },
                { run_label: '2', heat_input_value: 950, heat_input_unit: 'J/mm', travel_speed: '30', travel_speed_unit: 'cm/min' },
                { run_label: '3', heat_input_value: '12', heat_input_unit: 'kJ/cm', travel_speed: 300, travel_speed_unit: 'mm/min' },
                { run_label: '4', heat_input_value: 1, heat_input_unit: 'BTU', travel_speed: 5, travel_speed_unit: '' },
            ],
        });
        const runs = toWpqrView(input).runs;
        expect(runs[0]).toMatchObject({
            heat_input_value: 1.2, heat_input_unit: 'kJ/mm', heat_input_kj_mm: 1.2, travel_speed: 4, travel_speed_unit: 'mm/s', travel_speed_mm_s: 4,
        });
        expect(runs[1]).toMatchObject({
            heat_input_value: 950, heat_input_unit: 'J/mm', heat_input_kj_mm: 0.95, travel_speed_unit: 'cm/min', travel_speed_mm_s: 5,
        });
        expect(runs[2]).toMatchObject({
            heat_input_unit: 'kJ/cm', heat_input_kj_mm: 1.2, travel_speed_unit: 'mm/min', travel_speed_mm_s: 5,
        });
        expect(runs[3]).toMatchObject({ heat_input_value: 1, heat_input_unit: 'BTU', heat_input_kj_mm: null, travel_speed_mm_s: null });
        expect(input.test_runs[1].heat_input_value).toBe(950);
    });

    test('wire_feed_speed assente = null (normale), valore + unità senza conversione', () => {
        const runs = toWpqrView(reviewFields, {
            runs: [{ run_label: '1', wire_feed_speed: 'N.A.' }, { run_label: '2', wire_feed_speed: 8.5, wire_feed_unit: 'm/min' }],
        }).runs;
        expect(runs[0].wire_feed_speed).toBeNull();
        expect(runs[1]).toMatchObject({ wire_feed_speed: 8.5, wire_feed_unit: 'm/min' });
    });

    test('colonne stud della passata passano come numeri', () => {
        const [r] = toWpqrView({ standard_reference: 'ISO 14555:2025' }, {
            runs: [{ current_a: 1200, weld_time_ms: '600', protrusion_mm: 4, lift_mm: 2, capacitance_mf: 10, charging_voltage_v: 150 }],
        }).runs;
        expect(r).toMatchObject({
            current_a: 1200, weld_time_ms: 600, protrusion_mm: 4, lift_mm: 2, capacitance_mf: 10, charging_voltage_v: 150,
        });
    });

    test('processo della passata normalizzato in codice ISO 4063', () => {
        const [r] = toWpqrView(reviewFields, { runs: [{ welding_process: '135' }] }).runs;
        expect(r.welding_process_code).toBe('135');
    });
});

describe('toWpqrView — condizioni di prova di testata', () => {
    test('heat_input_kind assente = non dichiarato (null); valori noti canonici', () => {
        expect(toWpqrView(reviewFields).heat_input_kind).toBeNull();
        expect(toWpqrView({ heat_input_kind: 'arc_energy' }).heat_input_kind).toBe('arc_energy');
        expect(toWpqrView({ heat_input_kind: 'heat input' }).heat_input_kind).toBe('heat_input');
        expect(toWpqrView({ heat_input_kind: 'altro' }).heat_input_kind).toBeNull();
    });

    test('preheat/interpass di prova: colonna numerica, ripiego sul testo, «nessuno» riconosciuto', () => {
        const withColumn = toWpqrView({ preheat_temp_test: '75', preheat_temp: 'min 50 C' });
        expect(withColumn.preheat_test).toEqual({
            value: 75, text: 'min 50 C', source: 'test_column', none: false,
        });
        const fallback = toWpqrView({ preheat_temp: 'min 50 C', interpass_temp: 'None' });
        expect(fallback.preheat_test).toEqual({
            value: null, text: 'min 50 C', source: 'text_fallback', none: false,
        });
        expect(fallback.interpass_test).toMatchObject({ source: 'text_fallback', none: true });
        expect(toWpqrView({}).preheat_test).toEqual({
            value: null, text: null, source: null, none: false,
        });
    });

    test('esiti non canonici letti come NA, mai KO dedotto', () => {
        expect(canonicalResult('Accettabile / Satisfactory')).toBe('OK');
        expect(canonicalResult('Acceptable')).toBe('OK');
        expect(canonicalResult('Not required')).toBe('NA');
        expect(canonicalResult('--')).toBe('NA');
        expect(canonicalResult('N.A.')).toBe('NA');
        expect(canonicalResult('Non eseguita')).toBe('NA');
        expect(canonicalResult('KO')).toBe('KO');
        expect(canonicalResult('')).toBeNull();
        const v = toWpqrView({
            vt_result: 'Acceptable', rt_result: 'Not required', ut_result: '--', mt_result: 'N.A.', bend_result: 'Satisfactory',
        });
        expect(v.results).toMatchObject({
            vt_result: 'OK', rt_result: 'NA', ut_result: 'NA', mt_result: 'NA', bend_result: 'OK', tensile_result: null,
        });
        expect(Object.values(v.results)).not.toContain('KO');
    });

    test('range di apporto termico come tolleranza relativa e unità lette', () => {
        const v = toWpqrView({
            heat_input_tol_minus_pct: '25', heat_input_plus_unlimited: 1, heat_input_range_unit: 'kJ/cm', heat_input_range_basis: 'relative',
        });
        expect(v).toMatchObject({
            heat_input_tol_minus_pct: 25, heat_input_tol_plus_pct: null, heat_input_plus_unlimited: true,
            heat_input_range_unit: 'kJ/cm', heat_input_range_basis: 'relative',
        });
    });
});
