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

    it('le passate già spaziate restano quattro, con i range sulla prima riga', () => {
        const runs = extractValidityRuns(SYNTHETIC);
        expect(runs.map((row) => row.run_label)).toEqual(['1', '2 +n', '3÷4', '4R']);
        expect(runs[0]).toEqual(expect.objectContaining({
            welding_process: '135',
            filler_diameter_mm: 1,
            current_a: null,
            current_a_min: 90,
            current_a_max: 110,
            voltage_v_min: 18,
            voltage_v_max: 22,
            travel_speed_min: 150,
            travel_speed_max: 170,
            heat_input_value_min: 0.4,
            heat_input_value_max: 0.55,
        }));
        expect(runs[2].run_label).toBe('3÷4');
        expect(normRunLabel(runs[1].run_label)).toBe('2+n');
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

const GLUED_HEADER = 'Run Process Polarity Current A Voltage V Travel speed mm/min Heat input kJ/mm';

/** Riga sintetica: etichetta attaccata al processo, quattro range attaccati. Nessun estratto cliente. */
const GLUED_2R = '2Ra138-S1,2DC EP250÷27027÷29240÷2601,248÷1,568';

function validityDoc(rows) {
    return [GLUED_HEADER, ...rows].join('\n');
}

describe('etichetta di passata attaccata al processo', () => {
    it('estrae 2R con i quattro range, diametro e polarità, senza valori puntuali', () => {
        const runs = extractValidityRuns(validityDoc([GLUED_2R]));
        expect(runs).toHaveLength(1);
        expect(runs[0]).toEqual(expect.objectContaining({
            run_label: '2R',
            run_no: 2,
            welding_process: '138-S',
            filler_diameter_mm: 1.2,
            current_polarity: 'DC EP',
            current_a: null,
            voltage_v: null,
            travel_speed: null,
            heat_input_value: null,
            current_a_min: 250,
            current_a_max: 270,
            voltage_v_min: 27,
            voltage_v_max: 29,
            travel_speed_min: 240,
            travel_speed_max: 260,
            travel_speed_unit: 'mm/min',
            heat_input_value_min: 1.248,
            heat_input_value_max: 1.568,
            heat_input_unit: 'kJ/mm',
        }));
    });

    it('accetta 1R135 e 3÷4R con o senza spazio prima del processo', () => {
        const compact = extractValidityRuns(validityDoc([
            '1R135 1,0 DC-EP 10÷20 21÷22 30÷40 0,5÷0,6',
            '3÷4R136 1.0 DC EP 11÷21 22÷23 31÷41 0.6÷0.7',
            '3÷4R 141-S 1.2 DC EP 12÷22 23÷24 32÷42 0.7÷0.8',
        ]));
        expect(compact.map((row) => row.run_label)).toEqual(['1R', '3÷4R', '3÷4R']);
        expect(compact.map((row) => row.welding_process)).toEqual(['135', '136', '141-S']);
        expect(compact[0].run_label).not.toBe('1');
        expect(compact[0].current_a_min).toBe(10);
        expect(compact[0].current_a_max).toBe(20);
        expect(compact[2].filler_diameter_mm).toBe(1.2);
    });

    it('non spezza processo, diametro o un range senza etichetta', () => {
        const runs = extractValidityRuns(validityDoc([
            '135-S 1,2 DC EP 10÷20 21÷22 30÷40 0,5÷0,6',
            '1,2',
            '1.2',
            '250÷27027÷29240÷2601,248÷1,568',
            '90÷110 18÷22 150÷170 0,40÷0,55',
        ]));
        expect(runs).toEqual([]);
    });

    it('i numeri di contorno non spostano i quattro range né il diametro', () => {
        const line = '2Ra138-SX9 8 ZZ 3 Q4 1,2DC EP250÷27027÷29240÷2601,248÷1,568';
        const runs = extractValidityRuns(validityDoc([line]));
        expect(runs).toHaveLength(1);
        expect(runs[0].welding_process).toBe('138-S');
        expect(runs[0].filler_diameter_mm).toBe(1.2);
        expect(runs[0].current_a_min).toBe(250);
        expect(runs[0].current_a_max).toBe(270);
        expect(runs[0].voltage_v_min).toBe(27);
        expect(runs[0].heat_input_value_min).toBe(1.248);
        expect(runs[0].heat_input_value_max).toBe(1.568);
        const gluedDiameter = extractValidityRuns(validityDoc([
            '2Ra138-S51,2DC EP250÷27027÷29240÷2601,248÷1,568',
        ]));
        expect(gluedDiameter).toHaveLength(1);
        expect(gluedDiameter[0].filler_diameter_mm).toBe(1.2);
        expect(gluedDiameter[0].welding_process).toBe('138-S');
        expect(gluedDiameter[0].current_a_min).toBe(250);
        expect(gluedDiameter[0].heat_input_value_max).toBe(1.568);
        const mixed = extractValidityRuns(validityDoc([
            '2Ra138-SX42 6 ZZ 1 Q51,2DC EP250÷27027÷29240÷2601,248÷1,568',
        ]));
        expect(mixed[0].filler_diameter_mm).toBe(1.2);
        expect(mixed[0].welding_process).toBe('138-S');
        expect(mixed[0].current_a_max).toBe(270);
        expect(mixed[0].voltage_v_max).toBe(29);
        expect(mixed[0].travel_speed_max).toBe(260);
    });

    it('legge 2R anche se l\'intestazione è spezzata su più righe', () => {
        const text = [
            'Record of weld test',
            'Run Process Current A Voltage V Travel speed mm/s Heat input kJ/mm',
            '1 135 1.0 DC-EP 100 20 3.0 0.50',
            '',
            'Runs',
            'Passate',
            'current',
            'Corrente',
            'Voltage',
            'Travel speed mm/min',
            'Heat input kJ/mm',
            GLUED_2R,
        ].join('\n');
        const runs = extractValidityRuns(text);
        expect(runs).toHaveLength(1);
        expect(runs[0].run_label).toBe('2R');
        expect(runs[0].current_a_min).toBe(250);
        expect(runs[0].current_a_max).toBe(270);
        expect(runs[0].travel_speed_unit).toBe('mm/min');
        expect(runs[0].heat_input_unit).toBe('kJ/mm');
        expect(runs[0].travel_speed_min).toBe(240);
        expect(runs[0].heat_input_value_max).toBe(1.568);
    });

    it('tiene le altre passate e, in merge, non duplica 2R né tocca la passata puntuale 2', () => {
        const text = validityDoc([
            '1a135-S1,0DC-EP90÷11018÷22150÷1700,40÷0,55',
            '2a135-S1,0DC EP100÷12019÷23160÷1800,45÷0,65',
            '3÷4a135-S1,0DC EP110÷13020÷24170÷1900,50÷0,75',
            '1Ra135-S1,2DC EP80÷10021÷22200÷2200,70÷0,90',
            GLUED_2R,
            '3R÷4Ra141-S1,6DC EP130÷15024÷26180÷2000,80÷1,00',
        ]);
        const parsed = extractValidityRuns(text);
        expect(parsed.map((row) => row.run_label)).toEqual(['1', '2', '3÷4', '1R', '2R', '3R÷4R']);
        expect(parsed.map((row) => row.welding_process)).toEqual(['135-S', '135-S', '135-S', '135-S', '138-S', '141-S']);
        expect(parsed[0].current_a_min).toBe(90);
        expect(parsed[0].current_a_max).toBe(110);
        expect(parsed[0].heat_input_value_min).toBe(0.4);
        expect(parsed[0].heat_input_value_max).toBe(0.55);
        expect(parsed[3].filler_diameter_mm).toBe(1.2);
        expect(parsed[3].current_a_min).toBe(80);
        expect(parsed.map((row) => normRunLabel(row.run_label))).toEqual(['1', '2', '3÷4', '1r', '2r', '3r÷4r']);
        const twoR = parsed.filter((row) => normRunLabel(row.run_label) === '2r');
        expect(twoR).toHaveLength(1);
        expect(twoR[0].current_a_min).toBe(250);
        expect(twoR[0].welding_process).toBe('138-S');
        expect(parsed.find((row) => row.run_label === '3R÷4R').welding_process).toBe('141-S');
        expect(parsed.find((row) => row.run_label === '1').current_a).toBeNull();

        const point1 = { run_label: '1', welding_process: '135', current_a: 245 };
        const point2 = { run_label: '2', welding_process: '135', current_a: 260 };
        const before2 = { ...point2 };
        const merged = mergeValidityOnlyRuns([point1, point2], parsed);
        expect(merged[0]).toBe(point1);
        expect(merged[1]).toBe(point2);
        expect(merged[1]).toEqual(before2);
        expect(merged.filter((row) => normRunLabel(row.run_label) === '2')).toHaveLength(1);
        expect(merged.filter((row) => normRunLabel(row.run_label) === '2r')).toHaveLength(1);
        expect(merged.map((row) => row.run_label)).toEqual(['1', '2', '3÷4', '1R', '2R', '3R÷4R']);
        const appended = merged.find((row) => row.run_label === '2R');
        expect(appended.current_a).toBeNull();
        expect(appended.current_a_min).toBe(250);
        expect(appended.voltage_v_min).toBe(27);
        expect(appended.travel_speed_min).toBe(240);
        expect(appended.heat_input_value_min).toBe(1.248);
        expect(appended.heat_input_value_max).toBe(1.568);
    });
});
