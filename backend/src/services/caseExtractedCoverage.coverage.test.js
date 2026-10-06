/**
 * @jest-environment node
 *
 * COV-4 — golden payload di computeCaseProjectCoverage (GET /cases/:id/extracted-coverage).
 * Costruito sul codice PRIMA del refactor (ponte wpsWelderCoverage): chiavi e valori
 * del payload devono restare identici dopo la delega al registry welder_9606.
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('./caseCoverageAdvisory.service', () => ({
    buildCaseCoverageAdvisory: jest.fn().mockResolvedValue({ stub: 'advisory' }),
}));

const { query } = require('../config/database');
const { buildCaseCoverageAdvisory } = require('./caseCoverageAdvisory.service');
const { computeCaseProjectCoverage } = require('./caseExtractedCoverage.service');

const project = { id: 5, project_code: 'COM-001', applicable_wps_ids: '[1,2,3]', company_id: 9 };

const wpsRows = [
    { id: 1, wps_code: 'WPS-A', welding_process: '135', base_material_group: '1.1', material_group: null,
        thickness_range_min: 5, thickness_range_max: 10, thickness_range: '5-10', welding_positions: 'PA', position: null },
    { id: 2, wps_code: 'WPS-B', welding_process: '111', base_material_group: null, material_group: '8.1',
        thickness_range_min: null, thickness_range_max: null, thickness_range: null, welding_positions: null, position: 'PF' },
    { id: 3, wps_code: 'WPS-C', welding_process: '141', base_material_group: '1.1', material_group: null,
        thickness_range_min: 3, thickness_range_max: 6, thickness_range: '3-6', welding_positions: 'PA', position: null },
];

const base = {
    qualification_type: 'ISO 9606-1', status: 'valida', approval_status: 'approved',
    next_confirmation_due: '2027-03-01', company_name: 'Acme Srl',
};

const qualRows = [
    { ...base, id: 101, person_name: 'Rossi Mario', person_code: 'R01', welding_process: '135',
        material_group: '1.1, 1.2', position_range: 'PA, PF', thickness_min_mm: 3, thickness_max_mm: 20,
        thickness_range: '3-20', joint_type: 'BW', expiry_date: '2027-12-01' },
    { ...base, id: 102, person_name: 'Bianchi Luca', person_code: 'B02', welding_process: '111',
        material_group: null, position_range: 'PF', thickness_min_mm: 3, thickness_max_mm: 20,
        thickness_range: '3-20', joint_type: 'FW', expiry_date: '2026-10-20' },
    { ...base, id: 103, person_name: 'Verdi Anna', person_code: 'V03', welding_process: '135',
        material_group: '1.1', position_range: 'PA', thickness_min_mm: 12, thickness_max_mm: 30,
        thickness_range: '12-30', joint_type: 'BW', expiry_date: '2027-12-01' },
    { ...base, id: 104, person_name: 'Neri Paolo', person_code: 'N04', welding_process: '135',
        material_group: '1.1', position_range: 'PA', thickness_min_mm: 3, thickness_max_mm: 20,
        thickness_range: '3-20', joint_type: 'BW', expiry_date: '2025-01-01' },
    { ...base, id: 105, person_name: 'Gialli Sara', person_code: 'G05', welding_process: '135',
        material_group: '1.1', position_range: 'PA', thickness_min_mm: 3, thickness_max_mm: 20,
        thickness_range: '3-20', joint_type: 'BW', expiry_date: '2027-12-01',
        next_confirmation_due: '2026-04-01' },
];

function mockDb({ requirements = [], wps = wpsRows, quals = qualRows, proj = project } = {}) {
    query.mockImplementation(async (sql) => {
        if (/FROM projects/.test(sql)) return { recordset: proj ? [proj] : [] };
        if (/FROM commercial_case_extracted_requirements/.test(sql)) return { recordset: requirements };
        if (/FROM welding_procedures/.test(sql)) return { recordset: wps };
        if (/FROM qualifications/.test(sql)) return { recordset: quals };
        throw new Error(`query inattesa: ${sql}`);
    });
}

const EMPTY_PROFILE = {
    welding_process: null,
    base_material_group: null,
    thickness_range_min: null,
    thickness_range_max: null,
    welding_positions: null,
    field_sources: [],
};

describe('computeCaseProjectCoverage — golden payload (COV-4)', () => {
    beforeAll(() => {
        jest.useFakeTimers({
            now: new Date('2026-10-06T12:00:00Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'],
        });
    });
    afterAll(() => jest.useRealTimers());
    beforeEach(() => jest.clearAllMocks());

    test('commessa inesistente: NOT_FOUND', async () => {
        mockDb({ proj: null });
        await expect(computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 }))
            .rejects.toMatchObject({ code: 'NOT_FOUND', message: 'Commessa non trovata' });
    });

    test('commessa senza WPS: payload vuoto con advisory', async () => {
        mockDb({ proj: { ...project, applicable_wps_ids: '[]' } });
        const out = await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        expect(out).toEqual({
            case_id: 3,
            project_id: 5,
            project_code: 'COM-001',
            has_wps: false,
            extracted_profile: EMPTY_PROFILE,
            extracted_profile_active: false,
            coverage: [],
            summary: { total: 0, covered: 0, partial: 0, uncovered: 0 },
            advisory: { stub: 'advisory' },
        });
    });

    test('senza requisiti estratti: payload completo', async () => {
        mockDb();
        const out = await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        expect(out).toEqual(GOLDEN_NO_EXTRACTED);
        expect(buildCaseCoverageAdvisory).toHaveBeenCalledWith(expect.objectContaining({
            organizationId: 1, companyId: 9, wpsRows,
        }));
    });

    test('con requisiti estratti (spessore): enriched_from_documents e range sovrascritto', async () => {
        mockDb({
            requirements: [{
                req_type: 'dimension', field_key: 'thickness', value_text: '6-8', unit: 'mm',
                confidence: 0.9, review_status: 'confirmed', source: 'drawing',
            }],
        });
        const out = await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        expect(out).toEqual(GOLDEN_EXTRACTED);
    });
});

describe('computeCaseProjectCoverage — delta dichiarati del Riesame (COV-4)', () => {
    beforeAll(() => {
        jest.useFakeTimers({
            now: new Date('2026-10-06T12:00:00Z'),
            doNotFake: ['nextTick', 'setImmediate', 'setTimeout', 'setInterval', 'queueMicrotask'],
        });
    });
    afterAll(() => jest.useRealTimers());
    beforeEach(() => jest.clearAllMocks());

    test('loader allineato a Progetti: ISO 14732 e thickness_max_unlimited nella SELECT', async () => {
        mockDb();
        await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        const qualCall = query.mock.calls.find(([sql]) => /FROM qualifications/.test(sql));
        expect(qualCall[0]).toMatch(/LIKE '%9606%' OR q\.qualification_type LIKE '%14732%'/);
        expect(qualCall[0]).toMatch(/q\.thickness_max_unlimited/);
        expect(qualCall[1]).toEqual({ organizationId: 1, projCompId: 9 });
    });

    test('range spessore aperto dichiarato: la WPS entro il minimo è coperta (prima unverifiable)', async () => {
        const open = {
            ...base, id: 201, person_name: 'Aperti Gino', person_code: 'A01', welding_process: '135',
            material_group: '1.1', position_range: 'PA', thickness_min_mm: 3, thickness_max_mm: null,
            thickness_max_unlimited: true, thickness_range: null, joint_type: 'BW', expiry_date: '2027-12-01',
        };
        mockDb({ wps: [wpsRows[0]], quals: [open] });
        const out = await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        expect(out.coverage[0].esito).toBe('verde');
        expect(out.coverage[0].qualifiers[0].coverage_detail).toEqual({
            process: 'ok', thickness: 'ok', material_group: 'ok', position: 'ok', overall: 'ok',
        });
        expect(out.summary).toEqual({ total: 1, covered: 1, partial: 0, uncovered: 0 });
    });

    test('qualifica ISO 14732 operativa ora considerata nel semaforo', async () => {
        const op = {
            ...base, id: 202, person_name: 'Operatori Srl', person_code: 'O02', qualification_type: 'ISO 14732',
            welding_process: '135', material_group: '1.1', position_range: 'PA', thickness_min_mm: 3,
            thickness_max_mm: 20, thickness_max_unlimited: false, thickness_range: '3-20', joint_type: 'BW',
            expiry_date: '2027-12-01',
        };
        mockDb({ wps: [wpsRows[0]], quals: [op] });
        const out = await computeCaseProjectCoverage({ caseId: 3, projectId: 5, organizationId: 1 });
        expect(out.coverage[0].qualified_count).toBe(1);
        expect(out.coverage[0].esito).toBe('verde');
    });
});

const qualifier = (id, person_name, person_code, expiry_date, semaforo, coverage_detail) => ({
    id, person_name, person_code, company_name: 'Acme Srl', expiry_date, semaforo, coverage_detail,
});

const GOLDEN_NO_EXTRACTED = {
    case_id: 3,
    project_id: 5,
    project_code: 'COM-001',
    has_wps: true,
    extracted_profile: EMPTY_PROFILE,
    extracted_profile_active: false,
    requirements_used: 0,
    coverage: [
        {
            wps_id: 1,
            wps_code: 'WPS-A',
            welding_process: '135',
            material_group: '1.1',
            thickness_range_min: 5,
            thickness_range_max: 10,
            welding_positions: 'PA',
            qualified_count: 1,
            esito: 'verde',
            enriched_from_documents: false,
            qualifiers: [
                qualifier(101, 'Rossi Mario', 'R01', '2027-12-01', 'verde', {
                    process: 'ok', thickness: 'ok', material_group: 'ok', position: 'ok', overall: 'ok',
                }),
            ],
        },
        {
            wps_id: 2,
            wps_code: 'WPS-B',
            welding_process: '111',
            material_group: '8.1',
            thickness_range_min: null,
            thickness_range_max: null,
            welding_positions: 'PF',
            qualified_count: 1,
            esito: 'giallo',
            enriched_from_documents: false,
            qualifiers: [
                qualifier(102, 'Bianchi Luca', 'B02', '2026-10-20', 'arancione', {
                    process: 'ok', thickness: 'ok', material_group: 'unverifiable', position: 'ok', overall: 'partial',
                }),
            ],
        },
        {
            wps_id: 3,
            wps_code: 'WPS-C',
            welding_process: '141',
            material_group: '1.1',
            thickness_range_min: 3,
            thickness_range_max: 6,
            welding_positions: 'PA',
            qualified_count: 0,
            esito: 'rosso',
            enriched_from_documents: false,
            qualifiers: [],
        },
    ],
    summary: { total: 3, covered: 1, partial: 1, uncovered: 1 },
    advisory: { stub: 'advisory' },
};

const GOLDEN_EXTRACTED = {
    ...GOLDEN_NO_EXTRACTED,
    extracted_profile: {
        ...EMPTY_PROFILE,
        thickness_range_min: 6,
        thickness_range_max: 8,
        field_sources: [{ field: 'thickness', req_type: 'dimension', value: '6-8' }],
    },
    extracted_profile_active: true,
    requirements_used: 1,
    coverage: GOLDEN_NO_EXTRACTED.coverage.map((row) => ({
        ...row,
        thickness_range_min: 6,
        thickness_range_max: 8,
        enriched_from_documents: true,
    })),
};
