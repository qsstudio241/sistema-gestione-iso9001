'use strict';

jest.mock('../../wpsGenerator.service', () => {
    const actual = jest.requireActual('../../wpsGenerator.service');
    return { ...actual, loadWpqrRecords: jest.fn() };
});

const { loadWpqrRecords } = require('../../wpsGenerator.service');
const adapter = require('./wpqrProcedure.adapter');
const { MATCH_STATUS } = require('../coverageTypes');
const { publicDomainMeta } = require('../coverageTypes');

const { matchWpqrCapability } = adapter;

const bwWpqr = {
    id: 1,
    wpqr_code: 'WPQR-001',
    standard_reference: 'ISO 15614-1',
    qualification_level: '2',
    welding_process: '135',
    joint_type: 'BW',
    base_material_group: '1.2',
    thickness_min: 3,
    thickness_max: 20,
    diameter_min: 50,
    diameter_max: 500,
};

const fwWpqr = {
    id: 2,
    wpqr_code: 'WPQR-FW',
    standard_reference: 'ISO 15614-1',
    welding_process: '135',
    joint_type: 'FW',
    base_material_group: '1.2',
    thickness_min: 3,
    thickness_max: 20,
    thickness_tested: 10,
};

describe('wpqr_procedure adapter (COV-2)', () => {
    beforeEach(() => {
        loadWpqrRecords.mockReset();
    });

    it('metadati: implementato, maturita full, campi estesi senza rompere COV-1', () => {
        const meta = publicDomainMeta(adapter);
        expect(meta.implemented).toBe(true);
        expect(meta.maturity).toBe('full');
        const keys = meta.requirementFields.map((f) => f.key);
        expect(keys).toEqual(expect.arrayContaining([
            'welding_process', 'joint_type', 'thickness_mm', 'material_group',
            'thickness_b_mm', 'diameter_mm', 'throat_mm', 'material_group_b',
        ]));
    });

    it('match pieno: processo, giunto, materiale, spessore, diametro nel range', () => {
        const m = matchWpqrCapability(bwWpqr, {
            welding_process: '135',
            joint_type: 'BW',
            material_group: '1.2',
            thickness_mm: 10,
            diameter_mm: 100,
        });
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.capability_id).toBe(1);
        expect(m.capability.wpqr_code).toBe('WPQR-001');
        expect(m.capability.qualification_basis).toBe('ISO 15614-1');
        expect(m.detail).toMatchObject({
            process: 'ok', joint_type: 'ok', material: 'ok', thickness: 'ok', diameter: 'ok', throat: 'skipped',
        });
    });

    it('no_match per spessore fuori range', () => {
        const m = matchWpqrCapability(bwWpqr, { welding_process: '135', thickness_mm: 40 });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.thickness).toBe('fail');
        expect(m.reasons.join(' ')).toMatch(/fuori range/i);
    });

    it('no_match per processo diverso', () => {
        const m = matchWpqrCapability(bwWpqr, { welding_process: '141' });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.process).toBe('fail');
    });

    it('no_match per tipo giunto non coperto', () => {
        const m = matchWpqrCapability(bwWpqr, { joint_type: 'FW' });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.joint_type).toBe('fail');
    });

    it('no_match per diametro fuori range dichiarato', () => {
        const m = matchWpqrCapability(bwWpqr, { diameter_mm: 800 });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.diameter).toBe('fail');
    });

    it('partial per dato mancante sulla WPQR (processo non dichiarato)', () => {
        const m = matchWpqrCapability({ ...bwWpqr, welding_process: null }, { welding_process: '135' });
        expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        expect(m.detail.process).toBe('partial');
        expect(m.reasons.join(' ')).toMatch(/non dichiarato/i);
    });

    it('partial per tipo giunto e range spessore mancanti (mai match silenzioso)', () => {
        const m = matchWpqrCapability({
            id: 9, wpqr_code: 'WPQR-VUOTA', welding_process: '135', base_material_group: '1.2',
        }, { joint_type: 'BW', thickness_mm: 10 });
        expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        expect(m.detail.joint_type).toBe('partial');
        expect(m.detail.thickness).toBe('partial');
    });

    it('partial per diametro richiesto ma non dichiarato (Level 2)', () => {
        const m = matchWpqrCapability(
            { ...bwWpqr, diameter_min: null, diameter_max: null, product_type: 'T' },
            { diameter_mm: 100 }
        );
        expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        expect(m.detail.diameter).toBe('partial');
    });

    it('doppio range t1/t2 e spessore B', () => {
        const wpqr = {
            ...fwWpqr,
            thickness_min: null,
            thickness_max: null,
            thickness_t1_min: 3,
            thickness_t1_max: 10,
            thickness_t2_min: 8,
            thickness_t2_max: 20,
        };
        const ok = matchWpqrCapability(wpqr, { thickness_mm: 5, thickness_b_mm: 12 });
        expect(ok.detail.thickness).toBe('ok');
        const ko = matchWpqrCapability(wpqr, { thickness_mm: 5, thickness_b_mm: 30 });
        expect(ko.status).toBe(MATCH_STATUS.NO_MATCH);
    });

    it('gola FW: dentro Tabella 8 match, fuori no_match, WPQR BW no_match', () => {
        expect(matchWpqrCapability(fwWpqr, { joint_type: 'FW', throat_mm: 5 }).status)
            .toBe(MATCH_STATUS.MATCH);
        const out = matchWpqrCapability(fwWpqr, { joint_type: 'FW', throat_mm: 40 });
        expect(out.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(out.detail.throat).toBe('fail');
        expect(matchWpqrCapability(bwWpqr, { throat_mm: 5 }).detail.throat).toBe('fail');
    });

    it('gruppo materiale: grado commerciale riconosciuto, gruppo non coperto no_match, non riconosciuto partial', () => {
        expect(matchWpqrCapability(bwWpqr, { material_group: 'S355' }).detail.material).toBe('ok');
        const unrelated = matchWpqrCapability(
            { ...bwWpqr, base_material_group: '8.1' },
            { material_group: '1.2' }
        );
        expect(unrelated.detail.material).toBe('fail');
        const unknown = matchWpqrCapability(bwWpqr, { material_group: 'XYZ' });
        expect(unknown.detail.material).toBe('partial');
        expect(unknown.status).toBe(MATCH_STATUS.PARTIAL);
    });

    it('gruppo materiale B diverso viene verificato (combinazione)', () => {
        const m = matchWpqrCapability(
            { ...bwWpqr, base_material_group: '1.1' },
            { material_group: '1.1', material_group_b: '8.1' }
        );
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.material).toBe('fail');
    });

    it('SW stud 14555: etichetta base, spessore su §10.2.8.6 = partial, gola non applicabile', () => {
        const stud = {
            id: 3,
            wpqr_code: 'WPQR-STUD',
            standard_reference: 'ISO 14555:2025',
            welding_process: '783',
            joint_type: 'SW',
            base_material_group: '1.1',
        };
        const m = matchWpqrCapability(stud, {
            welding_process: '783', joint_type: 'SW', thickness_mm: 6, material_group: '1.1',
        });
        expect(m.capability.qualification_basis).toBe('ISO 14555');
        expect(m.detail.thickness).toBe('partial');
        expect(m.detail.joint_type).toBe('ok');
        expect(m.detail.material).toBe('ok');
        expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        expect(m.detail.stud_scope).toMatch(/non verificate/);
        const throat = matchWpqrCapability(stud, { throat_mm: 4 });
        expect(throat.status).toBe(MATCH_STATUS.NO_MATCH);
        const otherGroup = matchWpqrCapability(stud, { material_group: '8.1' });
        expect(otherGroup.detail.material).toBe('partial');
        expect(otherGroup.reasons.join(' ')).toMatch(/14555/);
    });

    it('SW stud 14555 con range spessore dichiarato: fuori range no_match', () => {
        const m = matchWpqrCapability({
            id: 4, standard_reference: 'ISO 14555', joint_type: 'SW', thickness_min: 2, thickness_max: 8,
        }, { thickness_mm: 20 });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
    });

    it('ISO 15613 senza soglie: etichetta, nessun match inventato', () => {
        const wpqr = {
            id: 5,
            wpqr_code: 'WPQR-15613',
            standard_reference: 'ISO 15613:2025',
            welding_process: '135',
            joint_type: 'BW',
            base_material_group: '1.2',
            thickness_tested: 10,
            product_type: 'P',
        };
        const m = matchWpqrCapability(wpqr, {
            welding_process: '135',
            joint_type: 'BW',
            material_group: '1.2',
            thickness_mm: 10,
            diameter_mm: 100,
            throat_mm: 4,
        });
        expect(m.capability.qualification_basis).toBe('ISO 15613');
        expect(m.status).toBe(MATCH_STATUS.PARTIAL);
        expect(m.detail).toMatchObject({
            process: 'ok', joint_type: 'ok', material: 'partial', thickness: 'partial', diameter: 'partial', throat: 'partial',
        });
        expect(m.detail.thresholds).toMatch(/nessuna soglia/);
    });

    it('ISO 15613 con range spessore dichiarato: vale solo il dichiarato', () => {
        const m = matchWpqrCapability({
            id: 6, standard_reference: 'ISO 15613', joint_type: 'BW', thickness_min: 4, thickness_max: 12,
        }, { thickness_mm: 8 });
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        const out = matchWpqrCapability({
            id: 6, standard_reference: 'ISO 15613', joint_type: 'BW', thickness_min: 4, thickness_max: 12,
        }, { thickness_mm: 30 });
        expect(out.status).toBe(MATCH_STATUS.NO_MATCH);
    });

    it('requisito vuoto: match con motivo esplicito, nessun controllo applicato', () => {
        const m = matchWpqrCapability(bwWpqr, {});
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.reasons.length).toBe(1);
    });

    it('spessore richiesto non valido: no_match esplicito', () => {
        const m = matchWpqrCapability(bwWpqr, { thickness_mm: 'abc' });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.reasons).toContain('Spessore richiesto non valido');
    });

    describe('match() con registro WPQR', () => {
        it('ordina match -> partial -> no_match e usa organizzazione/ambito', async () => {
            loadWpqrRecords.mockResolvedValue([
                { ...bwWpqr, id: 11, thickness_max: 5 },
                { id: 12, wpqr_code: 'WPQR-VUOTA', welding_process: '135' },
                { ...bwWpqr, id: 13 },
            ]);
            const matches = await adapter.match(
                { criteria: { welding_process: '135', joint_type: 'BW', thickness_mm: 10 } },
                { organizationId: 7, companyId: 3 }
            );
            expect(loadWpqrRecords).toHaveBeenCalledWith(7, 3);
            expect(matches.map((m) => m.status)).toEqual([
                MATCH_STATUS.MATCH, MATCH_STATUS.PARTIAL, MATCH_STATUS.NO_MATCH,
            ]);
            expect(matches.map((m) => m.capability_id)).toEqual([13, 12, 11]);
        });

        it('company_id del requisito ha precedenza sul contesto', async () => {
            loadWpqrRecords.mockResolvedValue([]);
            await adapter.match({ company_id: 9, criteria: {} }, { organizationId: 7, companyId: 3 });
            expect(loadWpqrRecords).toHaveBeenCalledWith(7, 9);
        });

        it('nessuna WPQR: lista vuota e messaggio esposto dall\'adapter', async () => {
            loadWpqrRecords.mockResolvedValue([]);
            const matches = await adapter.match({ criteria: {} }, { organizationId: 1 });
            expect(matches).toEqual([]);
            expect(adapter.emptyMessage).toMatch(/Nessuna WPQR/);
        });
    });
});
