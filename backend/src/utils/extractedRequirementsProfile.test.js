/**
 * @jest-environment node
 */

/* eslint-env jest */

const {
    buildTechnicalProfile,
    mergeWpsWithExtractedProfile,
    profileHasTechnicalData,
    parseThicknessValue,
} = require('./extractedRequirementsProfile');

describe('extractedRequirementsProfile', () => {
    test('parseThicknessValue estrae range mm', () => {
        expect(parseThicknessValue('12 - 20 mm', 'mm')).toEqual({ min: 12, max: 20 });
    });

    test('buildTechnicalProfile mappa materiali, processo, spessore', () => {
        const profile = buildTechnicalProfile([
            { req_type: 'material', field_key: 'material_group', value_text: '1.2', confidence: 0.9 },
            { req_type: 'weld_symbol', field_key: 'welding_process', value_text: '135', confidence: 0.8 },
            { req_type: 'dimension', field_key: 'thickness', value_text: '10 mm', unit: 'mm', confidence: 0.7 },
            { req_type: 'note', field_key: 'position', value_text: 'PA, PB', confidence: 0.6 },
        ]);

        expect(profile.base_material_group).toBe('1.2');
        expect(profile.welding_process).toBe('135');
        expect(profile.thickness_range_min).toBe(10);
        expect(profile.thickness_range_max).toBe(10);
        expect(profile.welding_positions).toBe('PA, PB');
        expect(profileHasTechnicalData(profile)).toBe(true);
    });

    test('ISO-3: material_role / filler_designation / material_standard non sono gruppo WPS', () => {
        const profile = buildTechnicalProfile([
            { req_type: 'spec', field_key: 'material_role', value_text: 'filler' },
            { req_type: 'spec', field_key: 'filler_designation', value_text: 'G 42 4 M21 3Si1' },
            { req_type: 'spec', field_key: 'material_standard', value_text: 'EN 10025-2' },
            { req_type: 'spec', field_key: 'steel_designation', value_text: 'S355J2' },
            { req_type: 'material', field_key: 'material_group', value_text: '1.2' },
        ]);
        expect(profile.base_material_group).toBe('1.2');
    });

    test('mergeWpsWithExtractedProfile: estratto prevale su WPS', () => {
        const merged = mergeWpsWithExtractedProfile(
            {
                id: 1,
                wps_code: 'WPS-01',
                welding_process: '111',
                base_material_group: '1.1',
                thickness_range_min: 5,
                thickness_range_max: 15,
                welding_positions: 'PA',
            },
            {
                base_material_group: '1.2',
                welding_process: null,
                thickness_range_min: 8,
                thickness_range_max: null,
                welding_positions: null,
            },
        );

        expect(merged.base_material_group).toBe('1.2');
        expect(merged.welding_process).toBe('111');
        expect(merged.thickness_range_min).toBe(8);
        expect(merged.thickness_range_max).toBe(15);
    });
});
