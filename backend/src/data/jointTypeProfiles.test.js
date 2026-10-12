const {
    JOINT_TYPE_PROFILES,
    getJointTypeProfile,
    listJointTypeProfileKeys,
    uses9606DimensionalBlock,
    getVisibleFieldKeys,
    buildProfilePromptSection,
    resolveProfileStandard,
    JOINT_TYPE_PROFILES_BY_STANDARD,
    FIELD_STATE,
    NOT_APPLICABLE_14732_ALL_EDITIONS,
    POSITION_KEYS,
    extractStandardEdition,
    getFieldApplicability,
    getFieldState,
    getNotApplicableFieldKeys,
    nullNotApplicableFields,
} = require('./jointTypeProfiles');

describe('jointTypeProfiles', () => {
    it('espone BW e FW; un terzo tipo si aggiunge come nuova chiave', () => {
        expect(listJointTypeProfileKeys()).toEqual(['BW', 'FW']);
        expect(getJointTypeProfile('fw').thicknessKind).toBe('material_t');
        expect(getJointTypeProfile('BW').testThicknessKey).toBe('thickness_s_test_mm');
        expect(JOINT_TYPE_PROFILES.STUD).toBeUndefined();
    });

    it('BW mostra s e nasconde t; FW il contrario', () => {
        const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'P', qualificationType: 'Saldatore ISO 9606-1' });
        expect(bw.keys).toContain('thickness_s_test_mm');
        expect(bw.keys).not.toContain('thickness_t_test_mm');
        expect(bw.keys).not.toContain('pipe_diameter_test_mm');
        const fw = getVisibleFieldKeys({ jointType: 'FW', productType: 'T', qualificationType: 'Saldatore ISO 9606-1' });
        expect(fw.keys).toContain('thickness_t_test_mm');
        expect(fw.keys).not.toContain('thickness_s_test_mm');
        expect(fw.keys).toContain('pipe_diameter_test_mm');
    });

    it('14732 non usa il blocco dimensionale 9606', () => {
        expect(uses9606DimensionalBlock('Operatore ISO 14732')).toBe(false);
        const vis = getVisibleFieldKeys({ jointType: 'FW', qualificationType: 'Operatore ISO 14732' });
        expect(vis.dimensionalEnabled).toBe(false);
        expect(vis.keys).toEqual([]);
    });
});

describe('jointTypeProfiles — non regressione ISO 9606-1 (decisione committente: BW = s depositato, FW = t)', () => {
    it('il default senza norma è 9606-1 e non cambia', () => {
        const bw = getJointTypeProfile('BW');
        expect(bw.standard).toBe('ISO 9606-1');
        expect(bw.testThicknessKey).toBe('thickness_s_test_mm');
        expect(bw.thicknessKind).toBe('deposited_s');
        expect(bw.validityTable).toBe('6');
        expect(bw.hiddenKeys).toEqual(['thickness_t_test_mm']);
        const fw = getJointTypeProfile('FW');
        expect(fw.testThicknessKey).toBe('thickness_t_test_mm');
        expect(fw.thicknessKind).toBe('material_t');
        expect(fw.validityTable).toBe('8');
        expect(getJointTypeProfile('BW', { standard: '9606-1' })).toBe(bw);
        expect(getJointTypeProfile('BW', { standard: 'ISO 9606-1:2017' })).toBe(bw);
        expect(getJointTypeProfile('BW', { standard: null })).toBe(bw);
    });

    it('i profili 9606-1 non hanno chiavi della variante 9606-2', () => {
        Object.values(JOINT_TYPE_PROFILES).forEach((p) => {
            expect(p.hiddenCommonKeys).toBeUndefined();
            expect(p.standard).toBe('ISO 9606-1');
        });
    });

    it.each(['Saldatore ISO 9606-1', 'ISO 9606-1', '9606', 'ISO 9606-1:2017', 'Saldatore ISO 9606-3', null, ''])(
        'getVisibleFieldKeys con qualificationType %p: BW usa s e nasconde t, trasferimento visibile',
        (qualificationType) => {
            if (!uses9606DimensionalBlock(qualificationType)) return;
            const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'T', qualificationType });
            expect(bw.profile.testThicknessKey).toBe('thickness_s_test_mm');
            expect(bw.keys).toContain('thickness_s_test_mm');
            expect(bw.keys).not.toContain('thickness_t_test_mm');
            expect(bw.keys).toContain('transfer_mode');
            const fw = getVisibleFieldKeys({ jointType: 'FW', productType: 'T', qualificationType });
            expect(fw.profile.testThicknessKey).toBe('thickness_t_test_mm');
            expect(fw.keys).toContain('transfer_mode');
        },
    );

    it('il prompt di ingest per 9606-1 non cambia (BW s depositato, Tabella 6, a/z)', () => {
        const bw = buildProfilePromptSection('BW');
        expect(bw).toContain('- thickness_s_test_mm: s del provino (BV). Range di validità: Tabella 6 ISO 9606-1. Non copiare su FW.');
        expect(bw).toContain('(Tabella 6), come stampato');
        expect(bw).toContain('(riga ISO 9606-1: …)');
        expect(bw).toContain('NON usare a/z come campi 9606-1.');
        const fw = buildProfilePromptSection('FW');
        expect(fw).toContain('- thickness_t_test_mm: t del materiale del provino (FV). Range di validità: Tabella 8 ISO 9606-1.');
        expect(buildProfilePromptSection(null)).toContain('PROFILO GIUNTO NON ANCORA NOTO');
    });
});

describe('jointTypeProfiles — variante ISO 9606-2 (spessore t del materiale)', () => {
    it('resolveProfileStandard riconosce 9606-2 da tipo qualifica o riferimento norma', () => {
        ['Saldatore ISO 9606-2', 'EN ISO 9606-2:2004', 'ISO 9606 - 2', '9606-2', 'iso 9606-2'].forEach((t) => {
            expect(resolveProfileStandard(t)).toBe('9606-2');
        });
        ['Saldatore ISO 9606-1', 'ISO 9606-1:2017', 'ISO 9606-3', '9606-23', null, undefined, ''].forEach((t) => {
            expect(resolveProfileStandard(t)).toBe('9606-1');
        });
    });

    it('BW 9606-2: lo spessore di prova è t del materiale (Tab. 3), non s depositato', () => {
        const bw = getJointTypeProfile('BW', { standard: '9606-2' });
        expect(bw.standard).toBe('ISO 9606-2');
        expect(bw.testThicknessKey).toBe('thickness_t_test_mm');
        expect(bw.thicknessKind).toBe('material_t');
        expect(bw.validityTable).toBe('3');
        expect(bw.hiddenKeys).toEqual(['thickness_s_test_mm']);
        expect(bw.testThicknessLabel).toMatch(/materiale t/);
        expect(bw).not.toBe(getJointTypeProfile('BW'));
    });

    it('FW 9606-2: t del materiale, Tab. 5', () => {
        const fw = getJointTypeProfile('FW', { standard: 'ISO 9606-2' });
        expect(fw.standard).toBe('ISO 9606-2');
        expect(fw.testThicknessKey).toBe('thickness_t_test_mm');
        expect(fw.validityTable).toBe('5');
        expect(fw.hiddenKeys).toEqual(['thickness_s_test_mm']);
    });

    it('stesse chiavi di 9606-1 (BW, FW): un terzo tipo si aggiunge a tutte le varianti', () => {
        expect(Object.keys(JOINT_TYPE_PROFILES_BY_STANDARD['9606-2'])).toEqual(Object.keys(JOINT_TYPE_PROFILES_BY_STANDARD['9606-1']));
        expect(listJointTypeProfileKeys()).toEqual(['BW', 'FW']);
        expect(getJointTypeProfile('XX', { standard: '9606-2' })).toBeNull();
    });

    it('getVisibleFieldKeys con qualificationType 9606-2: BW mostra t e nasconde s; niente trasferimento', () => {
        const bw = getVisibleFieldKeys({ jointType: 'BW', productType: 'T', qualificationType: 'Saldatore ISO 9606-2' });
        expect(bw.profile.standard).toBe('ISO 9606-2');
        expect(bw.dimensionalEnabled).toBe(true);
        expect(bw.keys).toContain('thickness_t_test_mm');
        expect(bw.keys).not.toContain('thickness_s_test_mm');
        expect(bw.keys).not.toContain('transfer_mode');
        expect(bw.keys).toContain('pipe_diameter_test_mm');
        const plate = getVisibleFieldKeys({ jointType: 'BW', productType: 'P', qualificationType: 'ISO 9606-2' });
        expect(plate.keys).not.toContain('pipe_diameter_test_mm');
    });

    it('9606-2 senza giunto: campi comuni, nessun blocco dimensionale (come 9606-1)', () => {
        const vis = getVisibleFieldKeys({ productType: 'T', qualificationType: 'Saldatore ISO 9606-2' });
        expect(vis.profile).toBeNull();
        expect(vis.profileGated).toBe(true);
        expect(vis.dimensionalEnabled).toBe(false);
    });

    it('14732 resta fuori dal blocco 9606 anche con testo 9606-2', () => {
        expect(getVisibleFieldKeys({ jointType: 'BW', qualificationType: 'Operatore ISO 14732' }).keys).toEqual([]);
    });

    it('il prompt con norma 9606-2 usa t e Tabella 3, non la Tabella 6 di 9606-1', () => {
        const bw = buildProfilePromptSection('BW', { standard: '9606-2' });
        expect(bw).toContain('- thickness_t_test_mm: t del materiale del provino');
        expect(bw).toContain('Tabella 3 ISO 9606-2');
        expect(bw).toContain('(riga ISO 9606-2: …)');
        expect(bw).toContain('NON usare a/z come campi 9606-2.');
        expect(bw).not.toContain('thickness_s_test_mm');
        expect(bw).not.toContain('Tabella 6');
    });
});

describe('jointTypeProfiles — applicabilità campi tri-stato (ISO 14732 Annex C per edizione)', () => {
    const NA = FIELD_STATE.NOT_APPLICABLE;
    const OPT = FIELD_STATE.OPTIONAL;
    const OP_TYPE = 'Operatore ISO 14732';

    it('14732:2025 — posizione e campi 9606 non applicabili', () => {
        const a = getFieldApplicability({ qualificationType: OP_TYPE, standardReference: 'EN ISO 14732:2025' });
        expect(a.profileKey).toBe('14732@2025');
        expect(a.edition).toBe('2025');
        for (const k of ['welding_positions', 'position_range', 'material_group', 'joint_type', 'product_type',
            'filler_material', 'shielding_gas', 'weld_details', 'transfer_mode', 'thickness_min_mm',
            'thickness_max_mm', 'thickness_s_test_mm', 'thickness_t_test_mm', 'pipe_diameter_min_mm',
            'pipe_diameter_max_mm', 'pipe_diameter_test_mm', 'qualification_designation', 'welding_position_test']) {
            expect(a.states[k]).toBe(NA);
        }
        expect(a.notApplicableReason).toBe('ISO 14732:2025');
    });

    it('14732:2013 — la posizione resta facoltativa, gli altri campi N.A. restano N.A.', () => {
        const a = getFieldApplicability({ qualificationType: OP_TYPE, standardReference: 'ISO 14732:2013' });
        expect(a.profileKey).toBe('14732@2013');
        POSITION_KEYS.forEach((k) => expect(a.states[k]).toBe(OPT));
        expect(a.states.material_group).toBe(NA);
        expect(a.states.thickness_min_mm).toBe(NA);
    });

    it.each([
        [OP_TYPE, null],
        [OP_TYPE, ''],
        [OP_TYPE, 'ISO 14732'],
        [OP_TYPE, 'ISO 14732:2005'],
    ])('edizione ignota/diversa (%s | %s) = 2013-safe: position_range facoltativo', (type, ref) => {
        const a = getFieldApplicability({ qualificationType: type, standardReference: ref });
        expect(a.profileKey).toBe('14732@?');
        expect(getFieldState({ qualificationType: type, standardReference: ref }, 'position_range')).toBe(OPT);
        expect(a.states.material_group).toBe(NA);
    });

    it('edizione dal riferimento norma anche con separatori diversi; vince sul tipo', () => {
        expect(getFieldApplicability({ standardReference: 'UNI EN ISO 14732-2025' }).profileKey).toBe('14732@2025');
        expect(getFieldApplicability({ standardReference: 'ISO 14732 (2013)' }).profileKey).toBe('14732@2013');
        expect(getFieldApplicability({ standardReference: 'ISO 14732:2013 / ISO 9606-1' }).profileKey).toBe('14732@2013');
        expect(extractStandardEdition(':2025')).toBe('2025');
        expect(extractStandardEdition(' foo 2025')).toBeNull();
    });

    it('9606-1, 9606-2, 15614 e altri tipi: fuori mappa, nessuno stato (invariati)', () => {
        for (const ctx of [
            { qualificationType: 'Saldatore ISO 9606-1', standardReference: 'ISO 9606-1:2017' },
            { qualificationType: 'Saldatore ISO 9606-2' },
            { qualificationType: 'Saldatore EN 15614' },
            { qualificationType: 'Operatore NDT VT Livello 2' },
            { qualificationType: 'Altra qualifica', standardReference: 'ISO 9712:2022' },
            {},
            undefined,
        ]) {
            const a = getFieldApplicability(ctx);
            expect(a.profileKey).toBeNull();
            expect(a.states).toEqual({});
            expect(getNotApplicableFieldKeys(ctx)).toEqual([]);
            expect(getFieldState(ctx, 'position_range')).toBe(FIELD_STATE.APPLICABLE);
        }
    });

    it('tipo 14732 ma riferimento che cita solo 9606-1: famiglia non certa, nessuno stato', () => {
        const ctx = { qualificationType: OP_TYPE, standardReference: 'ISO 9606-1:2017' };
        expect(getFieldApplicability(ctx).profileKey).toBeNull();
        expect(nullNotApplicableFields({ position_range: 'PA' }, ctx).fields.position_range).toBe('PA');
    });

    it('tipo 9606/15614 con riferimento 14732 (conflitto): fuori mappa, nessun campo azzerato', () => {
        for (const ctx of [
            { qualificationType: 'Saldatore ISO 9606-1', standardReference: 'ISO 14732:2025' },
            { qualificationType: 'Saldatore ISO 9606-2', standardReference: 'EN ISO 14732:2013' },
            { qualificationType: 'Qualifica ISO 15614-1', standardReference: 'ISO 14732:2025' },
        ]) {
            expect(getFieldApplicability(ctx).profileKey).toBeNull();
            expect(nullNotApplicableFields({ position_range: 'PA', material_group: '1.1' }, ctx).fields)
                .toEqual({ position_range: 'PA', material_group: '1.1' });
        }
    });

    it('tipo libero/assente con riferimento 14732: la mappa si applica (ingest batch senza tipo)', () => {
        expect(getFieldApplicability({ standardReference: 'ISO 14732:2025' }).profileKey).toBe('14732@2025');
        expect(getFieldApplicability({ qualificationType: 'Altro', standardReference: 'ISO 14732:2025' }).profileKey).toBe('14732@2025');
    });

    it('9606-1 con diametro e prodotto P: getVisibleFieldKeys invariato (non passa dalla mappa)', () => {
        const vis = getVisibleFieldKeys({ jointType: 'BW', productType: 'P', qualificationType: 'Saldatore ISO 9606-1' });
        expect(vis.keys).toContain('position_range');
        expect(vis.keys).toContain('material_group');
        expect(vis.keys).not.toContain('pipe_diameter_test_mm');
        expect(getFieldState({ qualificationType: 'Saldatore ISO 9606-1' }, 'pipe_diameter_min_mm')).toBe(FIELD_STATE.APPLICABLE);
    });

    it('nullNotApplicableFields: 2025 azzera tutto, 2013/ignota conserva la posizione, mai sentinelle', () => {
        const rec = {
            position_range: 'PA, PB', welding_positions: ['PA'], material_group: '1.1', thickness_min_mm: 3,
            pipe_diameter_mm: 60, filler_material: 'FM1', welding_process: '121', certificate_number: 'X1',
            thickness_max_unlimited: true,
        };
        const y25 = nullNotApplicableFields(rec, { qualificationType: OP_TYPE, standardReference: 'ISO 14732:2025' });
        expect(y25.fields.position_range).toBeNull();
        expect(y25.fields.welding_positions).toBeNull();
        expect(y25.fields.material_group).toBeNull();
        expect(y25.fields.thickness_min_mm).toBeNull();
        expect(y25.fields.pipe_diameter_mm).toBeNull();
        expect(y25.fields.thickness_max_unlimited).toBeNull();
        expect(y25.fields.welding_process).toBe('121');
        expect(y25.fields.certificate_number).toBe('X1');
        expect(Object.values(y25.fields)).not.toContain('NN');
        expect(rec.position_range).toBe('PA, PB');
        for (const ref of ['ISO 14732:2013', null, 'ISO 14732']) {
            const out = nullNotApplicableFields(rec, { qualificationType: OP_TYPE, standardReference: ref });
            expect(out.fields.position_range).toBe('PA, PB');
            expect(out.fields.welding_positions).toEqual(['PA']);
            expect(out.fields.material_group).toBeNull();
        }
    });

    it('nullNotApplicableFields: non aggiunge chiavi assenti e non muta l\'input', () => {
        const rec = { welding_process: '121' };
        const out = nullNotApplicableFields(rec, { qualificationType: OP_TYPE, standardReference: 'ISO 14732:2025' });
        expect(out.fields).toEqual({ welding_process: '121' });
        expect(out.nullified).toEqual([]);
        expect(NOT_APPLICABLE_14732_ALL_EDITIONS).not.toContain('welding_process');
    });
});
