'use strict';

const {
    generateWpsFromWpqr,
    checkThicknessCoverage,
} = require('./wpsGenerator.service');

/** Fixture WPQR caso Mason (in-memory). */
const WPQR_MASON_DEMO = {
    id: 1,
    wpqr_code: 'WPQR-MASON-DEMO',
    welding_process: '135',
    base_material_group: '1.2',
    joint_type: 'FW',
    thickness_tested: 10,
    thickness_min: 3,
    thickness_max: 20,
    filler_material: 'G 42 4 M21 3Si1',
    shielding_gas: 'M21',
    welding_positions: 'PA',
    standard_reference: 'ISO 15614-1',
};

const MASON_REQUEST = {
    joint_type: 'FW',
    welding_process: '135',
    parent_material_a: 'S355',
    parent_material_b: 'S235',
    thickness_a_mm: 10,
    thickness_b_mm: 5,
};

describe('wpsGenerator.service (P0)', () => {
    test('1 — FW S355 10 + S235 5 con WPQR demo → ok', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(['ok', 'partial']).toContain(result.status);
        expect(result.wpqr_used).toBeTruthy();
        expect(result.wpqr_used.wpqr_code).toBe('WPQR-MASON-DEMO');
        expect(result.wps_draft).toBeTruthy();
        expect(result.wps_draft.joint_type).toBe('FW');
        expect(result.wps_draft.wpqr_ref).toBe('WPQR-MASON-DEMO');
        expect(result.wps_draft.welding_process).toBe('135');
        expect(result.extensions_needed).toEqual([]);
    });

    test('2 — WPQR gruppo 8.1 → not_possible (materiale)', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [{ ...WPQR_MASON_DEMO, base_material_group: '8.1' }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.wps_draft).toBeNull();
        expect(result.extensions_needed.join(' ')).toMatch(/gruppo materiale|1\.2|1\.1/i);
    });

    test('3 — thickness_max 8 → not_possible (spessore)', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [{ ...WPQR_MASON_DEMO, thickness_max: 8 }],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/[Ss]pessor|fuori range|10/i);
    });

    test('4 — lista WPQR vuota → not_possible registro', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: MASON_REQUEST,
            wpqrRecords: [],
        });
        expect(result.status).toBe('not_possible');
        expect(result.extensions_needed.join(' ')).toMatch(/vuoto|nessuna/i);
    });

    test('checkThicknessCoverage: entrambi spessori nel range', () => {
        const r = checkThicknessCoverage(WPQR_MASON_DEMO, 10, 5);
        expect(r.ok).toBe(true);
        expect(r.partial).toBe(false);
    });

    test('grado passato come codice gruppo funziona', async () => {
        const result = await generateWpsFromWpqr({
            organizationId: 1,
            request: {
                ...MASON_REQUEST,
                parent_material_a: '1.2',
                parent_material_b: '1.1',
            },
            wpqrRecords: [WPQR_MASON_DEMO],
        });
        expect(['ok', 'partial']).toContain(result.status);
    });
});
