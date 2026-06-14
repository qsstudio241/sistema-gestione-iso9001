const { buildWelderQualificationDesignation } = require('./weldingDesignation');

describe('buildWelderQualificationDesignation', () => {
    it('compone la designazione completa con spessore singolo e tubo', () => {
        const out = buildWelderQualificationDesignation({
            welding_process: '141',
            product_type: 'P',
            joint_type: 'BW',
            filler_material_group: 'FM1',
            thickness_max_mm: 10,
            pipe_diameter_max_mm: 60,
            welding_positions: 'PA',
            weld_details: 'ss nb',
        });
        expect(out).toBe('141 P BW FM1 t10 D60 PA ss nb');
    });

    it('usa range t e D quando min e max differiscono e unisce piu posizioni', () => {
        const out = buildWelderQualificationDesignation({
            welding_process: '135',
            joint_type: 'FW',
            thickness_min_mm: 3,
            thickness_max_mm: 20,
            pipe_diameter_min_mm: 60,
            pipe_diameter_max_mm: 120,
            welding_positions: ['PA', 'PF'],
        });
        expect(out).toBe('135 FW t3-20 D60-120 PA/PF');
    });

    it('include solo i token disponibili e ritorna null se vuoto', () => {
        expect(buildWelderQualificationDesignation({ welding_process: '111' })).toBe('111');
        expect(buildWelderQualificationDesignation({})).toBeNull();
    });
});
