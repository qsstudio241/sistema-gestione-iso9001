/**
 * @jest-environment node
 */
const {
    scoreSketch,
    preparationEquivalent,
    processFamily,
    classifyPageText,
    findSketchPages,
    suggestSketches,
    dimensionTextFromWpqr,
    metadataFromWpqr,
    normalizeJointType,
} = require('./weldSketches.service');

describe('weldSketches — scoring ISO 15609 library', () => {
    const fwFillet = {
        id: 2,
        slot: 'combined',
        joint_type: 'FW',
        preparation: 'fillet, close square T',
        product_form: 'plate',
        thickness_min_mm: 5,
        thickness_max_mm: 30,
        process_iso4063: '138',
        run_mode: 'multi',
        position_iso6947: 'PB',
        status: 'confermato',
    };

    it('esclude se il tipo giunto non coincide', () => {
        expect(scoreSketch(fwFillet, { joint_type: 'BW' })).toBeNull();
        expect(normalizeJointType('FW')).toBe('FW');
    });

    it('fillet ⇄ close square T sono equivalenti (+40)', () => {
        expect(preparationEquivalent('fillet', 'close square T (gap 0 mm)')).toBe(true);
        const score = scoreSketch(fwFillet, {
            joint_type: 'FW',
            preparation: 'fillet',
            product_form: 'plate',
            thickness_a_mm: 10,
            welding_process: '138',
            run_mode: 'multi',
            position: 'PB',
        });
        expect(score).toBe(40 + 20 + 15 + 10 + 10 + 5);
    });

    it('135/136/138 stessa famiglia (+5 se processo diverso)', () => {
        expect(processFamily('136')).toBe('13x');
        const score = scoreSketch(fwFillet, {
            joint_type: 'FW',
            welding_process: '135',
        });
        expect(score).toBe(5);
    });

    it('suggest: schizzo della WPQR prima (100), poi max 3 libreria', () => {
        const own = [{
            id: 1, slot: 'combined', joint_type: 'FW', status: 'bozza',
            preparation: 'fillet',
        }];
        const library = [
            { ...fwFillet, id: 10 },
            { ...fwFillet, id: 11, process_iso4063: '135' },
            { ...fwFillet, id: 12, position_iso6947: 'PA' },
            { ...fwFillet, id: 13, joint_type: 'BW' },
        ];
        const out = suggestSketches({
            own,
            library,
            request: { joint_type: 'FW', preparation: 'fillet', welding_process: '138' },
        });
        expect(out.combined[0].id).toBe(1);
        expect(out.combined[0].score).toBe(100);
        expect(out.combined.slice(1).every((s) => s.id !== 13)).toBe(true);
        expect(out.combined.length).toBeLessThanOrEqual(3);
        expect(out.joint_design[0].id).toBe(1);
    });
});

describe('weldSketches — pagine PDF', () => {
    it('riconosce Joint design / Welding sequence / Schizzo e salta la mappa durezza', () => {
        expect(classifyPageText('Joint design / Welding sequences')).toBe('combined');
        expect(classifyPageText('Joint Design')).toBe('joint_design');
        expect(classifyPageText('Welding Sequences')).toBe('welding_sequence');
        expect(classifyPageText('Schizzo del giunto')).toBe('joint_design');
        expect(classifyPageText('Location of measurements (Sketch) HV10 hardness')).toBe('hardness_map');
        const hits = findSketchPages([
            { page: 2, text: 'Joint design Welding sequence' },
            { page: 10, text: 'HV10 hardness map' },
        ]);
        expect(hits.map((h) => ({ page: h.page, slot: h.slot }))).toEqual([
            { page: 2, slot: 'combined' },
            { page: 10, slot: 'hardness_map' },
        ]);
    });

    it('dimension_text e metadati dal record WPQR, non dall\'immagine', () => {
        const wpqr = {
            joint_type: 'FW',
            joint_preparation: 'fillet close square T',
            product_type: 'plate',
            thickness_tested: 30,
            throat_test_mm: 7.5,
            diameter_test_mm: 108,
            welding_process: '138',
            welding_positions: 'PB',
            single_multi_run: 'multi',
            test_runs: [{}, {}, {}],
        };
        expect(dimensionTextFromWpqr(wpqr)).toMatch(/t=30/);
        expect(dimensionTextFromWpqr(wpqr)).toMatch(/a: 7\.5/);
        const meta = metadataFromWpqr(wpqr);
        expect(meta.joint_type).toBe('FW');
        expect(meta.preparation).toBe('fillet');
        expect(meta.n_passes).toBe(3);
        expect(meta.run_mode).toBe('multi');
    });
});
