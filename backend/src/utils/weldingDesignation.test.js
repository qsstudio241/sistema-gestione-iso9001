const {
    buildWelderQualificationDesignation,
    parseWelderQualificationDesignation,
    designationFieldsToIngest,
    resolvePrintedDesignation,
} = require('./weldingDesignation');

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

    it('usa il simbolo >= quando e\' noto solo lo spessore minimo (nessun limite superiore)', () => {
        const out = buildWelderQualificationDesignation({
            welding_process: '111',
            thickness_min_mm: 3,
        });
        expect(out).toBe('111 t\u22653');
    });

    it('usa il simbolo >= anche per il diametro tubo quando e\' noto solo il minimo', () => {
        const out = buildWelderQualificationDesignation({
            welding_process: '141',
            pipe_diameter_min_mm: 60,
        });
        expect(out).toBe('141 D\u226560');
    });
});

describe('parseWelderQualificationDesignation', () => {
    it('parsa riga ISO 9606-1 FW (caso Mason-like) senza AI', () => {
        const text = [
            'CERTIFICATO DI QUALIFICA SALDATORE',
            'ISO 9606-1: 135 P FW FM1 t8 PB ss mb',
            'Range of qualification 135 / 138',
        ].join('\n');
        const parsed = parseWelderQualificationDesignation(text);
        expect(parsed.joint_type).toBe('FW');
        expect(parsed.product_type).toBe('P');
        expect(parsed.welding_process_test).toBe('135');
        expect(parsed.thickness_t_test_mm).toBe(8);
        expect(parsed.thickness_s_test_mm).toBeNull();
        expect(parsed.welding_position_test).toBe('PB');
        expect(parsed.filler_material_group).toBe('FM1');
        expect(parsed.qualification_designation).toMatch(/135 P FW FM1 t8 PB/);
        const fields = designationFieldsToIngest(parsed);
        expect(fields.welding_process_test).toBe('135');
        expect(fields.thickness_min_mm).toBeUndefined();
    });

    it('parsa BW con s depositato e D tubo', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 141 T BW FM1 s12 D60 PA ss nb');
        expect(parsed.joint_type).toBe('BW');
        expect(parsed.thickness_s_test_mm).toBe(12);
        expect(parsed.thickness_t_test_mm).toBeNull();
        expect(parsed.pipe_diameter_test_mm).toBe(60);
        expect(parsed.weld_details).toBe('ss nb');
    });
});

describe('resolvePrintedDesignation', () => {
    it('non sovrascrive la stringa certificato con il ricalcolo min/max', () => {
        const printed = 'ISO 9606-1: 135 P FW FM1 t8 PB ss mb';
        const out = resolvePrintedDesignation(printed, {
            welding_process: '138',
            joint_type: 'FW',
            thickness_min_mm: 3,
            thickness_max_mm: 16,
        });
        expect(out).toBe(printed);
    });
});
