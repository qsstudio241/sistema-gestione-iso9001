'use strict';

const { toRecordView, detectStandard, resolveStandard } = require('./qualificationRecordView');
const { uses9606DimensionalBlock } = require('../../data/jointTypeProfiles');

const reviewFields = {
    qualification_type: 'Saldatore ISO 9606-1',
    standard_reference: 'EN ISO 9606-1:2017',
    joint_type: 'bw',
    product_type: 'p',
    welding_positions: ['PA', 'PB'],
    welding_position: 'PA, PB',
    filler_material_group: 'FM1',
    thickness_min_mm: '3',
    thickness_max_mm: 12,
    thickness_max_unlimited: false,
    pipe_diameter_min_mm: '',
    pipe_diameter_max_mm: 'N.A.',
    thickness_s_test_mm: '6,5',
    exam_date: '2025-03-01',
    expiry_date: '2028-03-01',
    material_group: '1.1',
    welding_process_test: '135',
};

const dbRow = {
    qualification_type: 'Saldatore ISO 9606-1',
    standard_ref: 'EN ISO 9606-1:2017',
    joint_type: 'BW',
    product_type: 'P',
    position_range: 'PA, PB',
    filler_material: 'FM1',
    thickness_min_mm: 3,
    thickness_max_mm: 12,
    thickness_max_unlimited: 0,
    pipe_diameter_min_mm: null,
    pipe_diameter_max_mm: null,
    thickness_s_test_mm: 6.5,
    exam_date: new Date('2025-03-01T00:00:00Z'),
    issue_date: new Date('2025-03-01T00:00:00Z'),
    expiry_date: new Date('2028-03-01T00:00:00Z'),
    material_group: '1.1',
    welding_process_test: '135',
};

describe('toRecordView — parità review-fields ↔ riga DB', () => {
    test('stessi valori canonici da ingressi diversi', () => {
        const a = toRecordView(reviewFields, { source: 'review' });
        const b = toRecordView(dbRow, { source: 'db' });
        const { source: sa, ...restA } = a;
        const { source: sb, ...restB } = b;
        expect(sa).toBe('review');
        expect(sb).toBe('db');
        expect(restA).toEqual(restB);
        expect(a.positions).toEqual(['PA', 'PB']);
        expect(a.filler_material_group).toBe('FM1');
        expect(a.thickness_s_test_mm).toBe(6.5);
        expect(a.pipe_diameter_max_mm).toBeNull();
        expect(a.profile).toBe('9606-1:BW');
    });

    test('input vuoto o null non lancia', () => {
        expect(toRecordView(null).profile).toBeNull();
        const v = toRecordView({});
        expect(v.positions).toEqual([]);
        expect(v.standard.family).toBeNull();
    });

    test('alias fallback tra i due ingressi', () => {
        expect(toRecordView({ position_range: 'PC' }, { source: 'review' }).positions).toEqual(['PC']);
        expect(toRecordView({ welding_positions: ['PF'] }, { source: 'db' }).positions).toEqual(['PF']);
    });
});

describe('detectStandard / resolveStandard', () => {
    test.each([
        ['EN ISO 9606-1:2017', '9606-1', '2017'],
        ['ISO 9606-1:2013', '9606-1', '2013'],
        ['ISO 9606-1:2012/Cor 1:2013', '9606-1', '2012'],
        ['UNI EN ISO 9606-1', '9606-1', null],
        ['ISO 9606-1:2004', '9606-1', '2004'],
        ['ISO 9606-2:2004', '9606-2', '2004'],
        ['ISO 14732:2013', '14732', '2013'],
        ['EN ISO 14732', '14732', null],
    ])('%s → %s edizione %s', (text, family, edition) => {
        const s = detectStandard(text);
        expect(s.family).toBe(family);
        expect(s.edition).toBe(edition);
    });

    test.each([
        ['EN 287-1:2011', 'EN 287-1', '2011'],
        ['ISO 9606-3:1999', 'ISO 9606-3', '1999'],
        ['ISO 9606-5', 'ISO 9606-5', null],
    ])('%s: riconosciuta ma senza famiglia (fonte mancante)', (text, label, edition) => {
        expect(detectStandard(text)).toEqual({ family: null, edition, label });
    });

    test('norma non riconosciuta → null', () => {
        expect(detectStandard('ISO 9712')).toBeNull();
        expect(detectStandard('')).toBeNull();
        expect(detectStandard(undefined)).toBeNull();
    });

    test('standard_reference prevale su qualification_type', () => {
        const s = resolveStandard({ standard_reference: 'EN 287-1:2011', qualification_type: 'Saldatore ISO 9606-1' });
        expect(s.family).toBeNull();
        expect(s.label).toBe('EN 287-1');
        const t = resolveStandard({ standard_reference: null, qualification_type: 'Saldatore ISO 9606-1' });
        expect(t.family).toBe('9606-1');
        expect(t.edition).toBeNull();
    });
});

describe('profilo', () => {
    const profileOf = (o) => toRecordView(o).profile;

    test.each([
        [{ qualification_type: 'Saldatore ISO 9606-1', joint_type: 'BW' }, '9606-1:BW'],
        [{ qualification_type: 'Saldatore ISO 9606-1', joint_type: 'FW' }, '9606-1:FW'],
        [{ qualification_type: 'Saldatore ISO 9606-1' }, '9606-1:UNKNOWN'],
        [{ qualification_type: 'Saldatore ISO 9606-1', joint_type: 'XX' }, '9606-1:UNKNOWN'],
        [{ qualification_type: 'Saldatore ISO 9606-2', joint_type: 'BW' }, '9606-2:BW'],
        [{ qualification_type: 'Saldatore ISO 9606-2', joint_type: 'FW' }, '9606-2:FW'],
        [{ qualification_type: 'Saldatore ISO 9606-2' }, null],
        [{ qualification_type: 'Operatore ISO 14732', joint_type: 'BW' }, '14732'],
        [{ qualification_type: 'Operatore NDT' }, null],
        [{ qualification_type: 'Saldatore ISO 9606-1', standard_reference: 'EN 287-1:2011', joint_type: 'BW' }, null],
    ])('%j → %s', (input, expected) => {
        expect(profileOf(input)).toBe(expected);
    });

    test('parità con uses9606DimensionalBlock su tabella di qualification_type', () => {
        const table = [
            'Saldatore ISO 9606-1', 'Saldatore ISO 9606-2', 'Operatore ISO 14732', 'Coordinatore ISO 14731',
            'Operatore NDT', 'Operatore NDT UT', 'Altra qualifica', 'Patentino PES (CEI 11-27)', 'ISO 9606-3', '', null,
        ];
        for (const qualification_type of table) {
            const view = toRecordView({ qualification_type, joint_type: 'BW' });
            expect(view.uses_9606_block).toBe(uses9606DimensionalBlock(qualification_type));
            if (view.profile && view.profile.startsWith('9606-')) expect(uses9606DimensionalBlock(qualification_type)).toBe(true);
            if (view.profile === '14732') expect(uses9606DimensionalBlock(qualification_type)).toBe(false);
            if (!view.uses_9606_block) expect(view.profile === null || view.profile === '14732').toBe(true);
        }
    });
});
