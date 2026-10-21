'use strict';

/**
 * @jest-environment node
 * Testo sintetico: nessuna riga copiata da un certificato cliente.
 */

const {
    extractValidityRuns,
    mergeValidityOnlyRuns,
    normRunLabel,
} = require('./wpqrValidityRuns');

const SYNTHETIC = [
    'SYNTHETIC WPQR — validity runs fixture',
    'Record of weld test',
    'Run  Process  Electrode size mm  Polarity  Current A  Voltage V  Travel speed mm/s  Heat input kJ/mm',
    '1    135      1.0                 DC-EP     100        20         3.0                0.50',
    '2+n  135      1.0                 DC-EP     110        21         4.0                0.60',
    '3-4  135      1.0                 DC-EP     120        22         5.0                0.70',
    '',
    'Range of qualification',
    'Run  Process  Electrode size mm  Polarity  Current A  Voltage V  Travel speed mm/min  Heat input kJ/mm',
    'Passate  Processo  Corrente  Tensione',
    '1     135      1,0                 DC-EP     90÷110     18÷22      150÷170             0.40÷0.55',
    '2 +n  135      1,0                 DC-EP     100÷120    19÷23      160÷180             0.45÷0.65',
    '3÷4   135      1,0                 DC-EP     110÷130    20÷24      170÷190             0.50÷0.75',
    '4R    141-S    1,6                 DC EP     140÷160    26÷28      200÷220             0.80÷0.95',
    '',
].join('\n');

describe('passate solo in tabella di validità', () => {
    it('normalizza etichette equivalenti e tiene distinta la passata R', () => {
        expect(normRunLabel('2 +n')).toBe(normRunLabel('2+n'));
        expect(normRunLabel('3-4')).toBe(normRunLabel('3÷4'));
        expect(normRunLabel('4R')).not.toBe(normRunLabel('4'));
    });

    it('aggiunge solo la passata assente in prova, con i range e senza valore puntuale', () => {
        const testRuns = [
            {
                run_label: '1', welding_process: '135', filler_diameter_mm: 1,
                current_a: 100, voltage_v: 20, travel_speed: 3, heat_input_value: 0.5,
                current_polarity: 'DC-EP',
            },
            {
                run_label: '2+n', welding_process: '135', current_a: 110,
            },
            {
                run_label: '3-4', welding_process: '135', current_a: 120,
            },
        ];
        const before = testRuns.map((row) => ({ ...row }));
        const merged = mergeValidityOnlyRuns(testRuns, extractValidityRuns(SYNTHETIC));

        expect(merged).toHaveLength(4);
        expect(merged[0]).toBe(testRuns[0]);
        expect(merged[0]).toEqual(before[0]);
        expect(merged[1]).toBe(testRuns[1]);
        expect(merged[2]).toBe(testRuns[2]);
        expect(merged.map((row) => row.run_label)).toEqual(['1', '2+n', '3-4', '4R']);
        expect(merged[3]).toEqual(expect.objectContaining({
            run_label: '4R',
            run_no: 4,
            welding_process: '141-S',
            filler_diameter_mm: 1.6,
            current_polarity: 'DC EP',
            current_a: null,
            voltage_v: null,
            travel_speed: null,
            heat_input_value: null,
            current_a_min: 140,
            current_a_max: 160,
            voltage_v_min: 26,
            voltage_v_max: 28,
            travel_speed_min: 200,
            travel_speed_max: 220,
            travel_speed_unit: 'mm/min',
            heat_input_value_min: 0.8,
            heat_input_value_max: 0.95,
            heat_input_unit: 'kJ/mm',
            source: 'ai',
        }));
    });

    it('senza tabella di validità non aggiunge righe', () => {
        const onlyTest = SYNTHETIC.split('Range of qualification')[0];
        expect(extractValidityRuns(onlyTest)).toEqual([]);
        const runs = [{ run_label: '1', current_a: 100 }];
        expect(mergeValidityOnlyRuns(runs, [])).toBe(runs);
    });

    it('i range parsati completano lo stub AI e lasciano intatti i puntuali di prova', () => {
        const point = { run_label: '1', welding_process: '135', current_a: 100 };
        const stub = { run_label: '4R', welding_process: '141-S', current_a: null, current_a_min: null };
        const before = { ...point };
        const parsed = extractValidityRuns(SYNTHETIC).filter((row) => {
            const key = normRunLabel(row.run_label);
            return key === normRunLabel('1') || key === normRunLabel('4R');
        });
        const merged = mergeValidityOnlyRuns([point, stub], parsed);

        expect(merged).toHaveLength(2);
        expect(merged[0]).toBe(point);
        expect(merged[0]).toEqual(before);
        expect(merged[0].current_a_min).toBeUndefined();
        expect(merged[1]).not.toBe(stub);
        expect(merged[1].voltage_v).toBeUndefined();
        expect(merged[1].travel_speed).toBeUndefined();
        expect(merged[1]).toEqual(expect.objectContaining({
            run_label: '4R',
            welding_process: '141-S',
            filler_diameter_mm: 1.6,
            current_polarity: 'DC EP',
            current_a: null,
            current_a_min: 140,
            current_a_max: 160,
            voltage_v_min: 26,
            voltage_v_max: 28,
            travel_speed_min: 200,
            travel_speed_max: 220,
            travel_speed_unit: 'mm/min',
            heat_input_value_min: 0.8,
            heat_input_value_max: 0.95,
            heat_input_unit: 'kJ/mm',
        }));
    });
});
