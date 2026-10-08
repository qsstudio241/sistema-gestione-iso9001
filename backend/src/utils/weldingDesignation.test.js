const {
    buildWelderQualificationDesignation,
    parseWelderQualificationDesignation,
    designationFieldsToIngest,
    resolvePrintedDesignation,
    resolveTestThicknessByJoint,
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
        expect(fields.welding_process).toBeUndefined();
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

    it('BW con token t (convenzione designazione): spessore depositato in s, non in t', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 t10 D60 PA ss nb');
        expect(parsed.joint_type).toBe('BW');
        expect(parsed.thickness_s_test_mm).toBe(10);
        expect(parsed.thickness_t_test_mm).toBeNull();
        const fields = designationFieldsToIngest(parsed);
        expect(fields.thickness_s_test_mm).toBe(10);
        expect(fields.thickness_t_test_mm).toBeUndefined();
    });

    it('BW con token spessore prima del giunto: assegnazione indipendente dall\'ordine', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 141 P t10 BW FM1 PA');
        expect(parsed.thickness_s_test_mm).toBe(10);
        expect(parsed.thickness_t_test_mm).toBeNull();
    });

    it('FW con token t: spessore materiale in t, s resta null', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 t8 PB ss mb');
        expect(parsed.thickness_t_test_mm).toBe(8);
        expect(parsed.thickness_s_test_mm).toBeNull();
    });

    it('certificato con ENTRAMBI s e t: salva entrambi (BW e FW)', () => {
        const bw = parseWelderQualificationDesignation('ISO 9606-1: 141 P BW FM1 s10 t12 PA ss nb');
        expect(bw.thickness_s_test_mm).toBe(10);
        expect(bw.thickness_t_test_mm).toBe(12);
        const fw = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 s6 t8 PB ss mb');
        expect(fw.thickness_s_test_mm).toBe(6);
        expect(fw.thickness_t_test_mm).toBe(8);
    });

    it('ignora la sola edizione in testata (ISO 9606-1:2017) e non inventa la prova', () => {
        const parsed = parseWelderQualificationDesignation([
            'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
            'ISO 9606-1:2017',
            'Nome: MARIO ROSSI',
        ].join('\n'));
        expect(parsed).toBeNull();
    });

    it('con testata edizione + riga §11 Mason prende 135S P FW, non l\'anno', () => {
        const text = [
            'CERTIFICATO DI QUALIFICAZIONE DEL SALDATORE',
            'ISO 9606-1:2017',
            'Designation',
            'ISO 9606-1: 135S P FW FM1 S t12-12 PB ml',
            'Range of qualification 135 / 138',
        ].join('\n');
        const parsed = parseWelderQualificationDesignation(text);
        expect(parsed).not.toBeNull();
        expect(parsed.qualification_designation).toMatch(/135S P FW FM1/);
        expect(parsed.qualification_designation).not.toMatch(/2017/);
        expect(parsed.welding_process_test).toBe('135');
        expect(parsed.product_type).toBe('P');
        expect(parsed.joint_type).toBe('FW');
        expect(parsed.thickness_t_test_mm).toBe(12);
        expect(parsed.filler_material_group).toBe('FM1');
        expect(parsed.welding_position_test).toBe('PB');
        expect(parsed.weld_details).toBe('ml');
        expect(parsed.transfer_mode).toBe('S');
    });
});

describe('parseWelderQualificationDesignation: diametro con virgola decimale', () => {
    const base = 'ISO 9606-1: 141 T FW FM5 S t3-10';

    it.each([
        ['D48,25 PB sl', '141 T FW FM5 S t3-10 D48,25 PB sl'],
        ['D 48,25 PB sl', '141 T FW FM5 S t3-10 D 48,25 PB sl'],
        ['\u00D848,25 PB sl', '141 T FW FM5 S t3-10 \u00D848,25 PB sl'],
        ['D=48,25 PB sl', '141 T FW FM5 S t3-10 D=48,25 PB sl'],
        ['D48.25 PB sl', '141 T FW FM5 S t3-10 D48.25 PB sl'],
    ])('legge il diametro 48.25 da "%s"', (_label, line) => {
        const parsed = parseWelderQualificationDesignation(`ISO 9606-1: ${line}`);
        expect(parsed.pipe_diameter_test_mm).toBe(48.25);
        expect(parsed.welding_position_test).toBe('PB');
        expect(parsed.weld_details).toBe('sl');
        expect(parsed.thickness_t_test_mm).toBe(3);
        expect(parsed.filler_material_group).toBe('FM5');
        const fields = designationFieldsToIngest(parsed);
        expect(fields.pipe_diameter_test_mm).toBe(48.25);
    });

    it('conserva la designazione stampata con la virgola originale', () => {
        const parsed = parseWelderQualificationDesignation(`${base} D48,25 PB sl`);
        expect(parsed.qualification_designation).toContain('D48,25');
    });

    it('il diametro non finisce nei dettagli giunto', () => {
        const parsed = parseWelderQualificationDesignation(`${base} D48,25 PB sl`);
        expect(parsed.weld_details).toBe('sl');
        expect(parsed.weld_details).not.toMatch(/25/);
    });

    it('spessore decimale con virgola: t12,5 resta 12.5', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 t12,5 PB ml');
        expect(parsed.thickness_t_test_mm).toBe(12.5);
    });

    it('mantiene `;` e virgole tra campi veri come separatori', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1; t8, PB, ss mb');
        expect(parsed.thickness_t_test_mm).toBe(8);
        expect(parsed.welding_position_test).toBe('PB');
        expect(parsed.weld_details).toBe('ss mb');
    });

    it('riga senza diametro (P FW FM1 B t12 PF ml): nessun diametro inventato', () => {
        const parsed = parseWelderQualificationDesignation('ISO 9606-1: 135 P FW FM1 B t12 PF ml');
        expect(parsed.pipe_diameter_test_mm).toBeNull();
        expect(parsed.thickness_t_test_mm).toBe(12);
        expect(parsed.welding_position_test).toBe('PF');
    });

    it('nome file sintetico: la riga stampata resta la fonte del diametro', () => {
        const text = [
            'File: ROSSI_MARIO_141_T_FW_FM5_S_t3-10_D48,25_PB_sl.pdf',
            'ISO 9606-1: 141 T FW FM5 S t3-10 D48,25 PB sl',
        ].join('\n');
        const parsed = parseWelderQualificationDesignation(text);
        expect(parsed.pipe_diameter_test_mm).toBe(48.25);
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

describe('resolveTestThicknessByJoint', () => {
    it('BW: t senza s -> s; FW: s senza t -> t', () => {
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: 10 })).toEqual({ s: 10, t: null });
        expect(resolveTestThicknessByJoint({ joint_type: ' fw ', s: '8' })).toEqual({ s: null, t: 8 });
    });

    it('colonna corretta gia\' valorizzata o entrambi presenti: nessuno spostamento', () => {
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', s: 10, t: 12 })).toEqual({ s: 10, t: 12 });
        expect(resolveTestThicknessByJoint({ joint_type: 'FW', s: 6, t: 8 })).toEqual({ s: 6, t: 8 });
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', s: 10 })).toEqual({ s: 10, t: null });
    });

    it('giunto sconosciuto/assente: nessuna deduzione e numeri sanitizzati', () => {
        expect(resolveTestThicknessByJoint({ joint_type: null, t: 10 })).toEqual({ s: null, t: 10 });
        expect(resolveTestThicknessByJoint({ joint_type: 'BW/FW', t: 10 })).toEqual({ s: null, t: 10 });
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: 'N.A.' })).toEqual({ s: null, t: null });
        expect(resolveTestThicknessByJoint()).toEqual({ s: null, t: null });
    });

    it('toNumericOrNull: virgola italiana, unità e N.A. (Number() li azzererebbe)', () => {
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: '10,5' })).toEqual({ s: 10.5, t: null });
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: '10 mm' })).toEqual({ s: 10, t: null });
        expect(resolveTestThicknessByJoint({ joint_type: 'BW', t: 'N.A.' })).toEqual({ s: null, t: null });
        expect(resolveTestThicknessByJoint({ joint_type: 'FW', s: '10,5' })).toEqual({ s: null, t: 10.5 });
        expect(resolveTestThicknessByJoint({ joint_type: 'FW', s: '10 mm' })).toEqual({ s: null, t: 10 });
    });
});
