'use strict';

/**
 * COV-4 — Test differenziale ponte commessa ↔ oracolo legacy.
 * Oracolo: computeQualificationCoverage + computeWpsCoverageEsito (qualificationCoverage.js, non toccato).
 * Il ponte (wpsWelderCoverage.js) delega a matchWelderCapability e deve dare lo stesso
 * esito, lo stesso numero di qualificatori e coverage_detail deep-equal.
 */

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));

const {
    computeQualificationCoverage,
    computeWpsCoverageEsito,
} = require('../../utils/qualificationCoverage');
const { isQualificationOperationallyActive } = require('../weldingCoordinatorAuth.service');
const welder = require('./adapters/welder9606.adapter');
const {
    wpsToWelderCriteria,
    matchWpsToQualification,
    computeWpsWelderCoverage,
    loadWelderQualificationsForProject,
} = require('./wpsWelderCoverage');

const TODAY = '2026-10-06';

const baseQual = {
    qualification_type: 'ISO 9606-1',
    status: 'valida',
    expiry_date: '2028-01-01',
    next_confirmation_due: '2027-01-01',
};

function legacyCoverage(wps, quals) {
    const qualifiers = quals
        .filter((q) => isQualificationOperationallyActive(q, TODAY))
        .map((q) => ({ q, detail: computeQualificationCoverage(q, wps) }))
        .filter(({ detail }) => detail.overall !== 'excluded');
    return { qualifiers, esito: computeWpsCoverageEsito(qualifiers.map(({ detail }) => detail)) };
}

const WPS_PROCESS = ['135', '135, 111', '111', null];
const WPS_THICKNESS = [[null, null], [3, 10], [1, 5], [5, null], [null, 12]];
const WPS_MATERIAL = [null, '1.1', '8.1', '1.1, 1.2'];
const WPS_POSITIONS = [null, 'PA', 'PA, PF', 'PG'];

const QUAL_PROCESS = ['135', '135 111', '111', null, ''];
const QUAL_THICKNESS = [
    [3, 20, false], [null, null, false], [5, null, true], [3, null, false],
    [null, null, true], [10, 12, false], [4, 40, '1'], [2, 8, 1],
];
const QUAL_MATERIAL = [null, '1.1, 1.2', '8.1'];
const QUAL_POSITIONS = [null, 'PA, PF', 'PC'];

function buildWpsMatrix() {
    const out = [];
    let id = 0;
    WPS_PROCESS.forEach((welding_process) => WPS_THICKNESS.forEach(([min, max]) => (
        WPS_MATERIAL.forEach((base_material_group) => WPS_POSITIONS.forEach((welding_positions) => {
            id += 1;
            out.push({
                id,
                wps_code: `WPS-${id}`,
                welding_process,
                thickness_range_min: min,
                thickness_range_max: max,
                base_material_group,
                welding_positions,
            });
        }))
    )));
    return out;
}

function buildQualMatrix() {
    const out = [];
    let id = 0;
    QUAL_PROCESS.forEach((welding_process) => QUAL_THICKNESS.forEach(([tmin, tmax, unlimited]) => (
        QUAL_MATERIAL.forEach((material_group) => QUAL_POSITIONS.forEach((position_range) => {
            id += 1;
            out.push({
                ...baseQual,
                id,
                person_name: `Saldatore ${id}`,
                welding_process,
                thickness_min_mm: tmin,
                thickness_max_mm: tmax,
                thickness_max_unlimited: unlimited,
                material_group,
                position_range,
            });
        }))
    )));
    return out;
}

describe('ponte wpsWelderCoverage — differenziale vs computeQualificationCoverage', () => {
    const wpsMatrix = buildWpsMatrix();
    const qualMatrix = buildQualMatrix();

    test('matrice di fixture non banale', () => {
        expect(wpsMatrix.length).toBeGreaterThanOrEqual(300);
        expect(qualMatrix.length).toBeGreaterThanOrEqual(250);
    });

    test('ogni coppia WPS x qualifica: stesso overall e stesso coverage_detail', () => {
        let compared = 0;
        let mismatches = 0;
        for (const wps of wpsMatrix) {
            for (const q of qualMatrix) {
                const oracle = computeQualificationCoverage(q, wps);
                const bridge = matchWpsToQualification(q, wps, { todayIso: TODAY });
                compared += 1;
                if (bridge.overall !== oracle.overall) mismatches += 1;
                if (oracle.overall !== 'excluded') {
                    expect(bridge).toEqual(oracle);
                }
            }
        }
        expect(compared).toBe(wpsMatrix.length * qualMatrix.length);
        expect(mismatches).toBe(0);
    });

    test('per ogni WPS e per pool di qualifiche: stesso esito, stesso qualified_count e detail deep-equal', () => {
        const pools = [qualMatrix];
        for (let k = 0; k < 53; k += 4) {
            pools.push(qualMatrix.filter((_, i) => i % 53 === k));
        }
        const esiti = new Set();
        for (const wps of wpsMatrix) {
            for (const pool of pools) {
                const oracle = legacyCoverage(wps, pool);
                const bridge = computeWpsWelderCoverage(wps, pool, { todayIso: TODAY });
                expect(bridge.esito).toBe(oracle.esito);
                expect(bridge.qualifiers.length).toBe(oracle.qualifiers.length);
                expect(bridge.qualifiers.map(({ q }) => q.id)).toEqual(oracle.qualifiers.map(({ q }) => q.id));
                expect(bridge.qualifiers.map(({ detail }) => detail))
                    .toEqual(oracle.qualifiers.map(({ detail }) => detail));
                esiti.add(bridge.esito);
            }
        }
        expect([...esiti].sort()).toEqual(['giallo', 'rosso', 'verde']);
    });

    test('pool ristretto: esiti verde / giallo / rosso identici al legacy', () => {
        const wps = {
            id: 1, wps_code: 'W', welding_process: '135',
            thickness_range_min: 5, thickness_range_max: 10,
            base_material_group: '1.1', welding_positions: 'PA',
        };
        const full = {
            ...baseQual, id: 1, welding_process: '135', thickness_min_mm: 3, thickness_max_mm: 20,
            material_group: '1.1, 1.2', position_range: 'PA, PF',
        };
        const partial = { ...full, id: 2, material_group: null };
        const excluded = { ...full, id: 3, position_range: 'PC' };
        const pools = { verde: [excluded, partial, full], giallo: [excluded, partial], rosso: [excluded] };
        for (const [esito, pool] of Object.entries(pools)) {
            const b = computeWpsWelderCoverage(wps, pool, { todayIso: TODAY });
            expect(b.esito).toBe(esito);
            expect(b).toEqual(legacyCoverage(wps, pool));
        }
    });

    test('qualifica scaduta o con conferma semestrale scaduta: esclusa come nel legacy', () => {
        const wps = { id: 1, welding_process: '135' };
        const valid = { ...baseQual, id: 1, welding_process: '135' };
        const expired = { ...baseQual, id: 2, welding_process: '135', expiry_date: '2025-01-01' };
        const confirmExpired = { ...baseQual, id: 3, welding_process: '135', next_confirmation_due: '2026-01-01' };
        const bridge = computeWpsWelderCoverage(wps, [valid, expired, confirmExpired], { todayIso: TODAY });
        expect(bridge.qualifiers.map(({ q }) => q.id)).toEqual([1]);
        expect(bridge).toEqual(legacyCoverage(wps, [valid, expired, confirmExpired]));
    });

    test('WPS con campi nulli: nessun vincolo oltre al processo della qualifica', () => {
        const wps = { id: 1, welding_process: null };
        const noProcess = { ...baseQual, id: 1, welding_process: null };
        const withProcess = { ...baseQual, id: 2, welding_process: '141' };
        const bridge = computeWpsWelderCoverage(wps, [noProcess, withProcess], { todayIso: TODAY });
        expect(bridge.qualifiers.map(({ q }) => q.id)).toEqual([2]);
        expect(bridge.esito).toBe('verde');
        expect(bridge).toEqual(legacyCoverage(wps, [noProcess, withProcess]));
    });

    test('qualifica senza welding_process: esclusa (legacy), non partial come nel motore', () => {
        const wps = { id: 1, welding_process: '135' };
        const q = { ...baseQual, id: 1, welding_process: null, welding_processes_validity: '135' };
        expect(matchWpsToQualification(q, wps, { todayIso: TODAY }).overall).toBe('excluded');
        expect(welder.matchWelderCapability(q, { welding_process: '135' }, { todayIso: TODAY }).status)
            .not.toBe('no_match');
    });

    test('welding_processes_validity ignorata: la fonte processo resta welding_process', () => {
        const wps = { id: 1, welding_process: '111' };
        const q = {
            ...baseQual, id: 1, welding_process: '135', welding_processes_validity: '111, 135',
        };
        expect(matchWpsToQualification(q, wps, { todayIso: TODAY }).overall).toBe('excluded');
        expect(computeQualificationCoverage(q, wps).overall).toBe('excluded');
    });

    test('processo: segue checkProcess legacy, non il matcher token-based dell\'adapter', () => {
        const wps = { id: 1, welding_process: '135, 111' };
        const q = { ...baseQual, id: 1, welding_process: '135 111' };
        expect(welder.checkProcessValidity(q, wps.welding_process)).toBe('ok');
        expect(computeQualificationCoverage(q, wps).overall).toBe('excluded');
        expect(matchWpsToQualification(q, wps, { todayIso: TODAY }).overall).toBe('excluded');
    });

    test('wpsToWelderCriteria mappa le colonne WPS sui criteri welder_9606', () => {
        expect(wpsToWelderCriteria({
            welding_process: '135',
            thickness_range_min: 3,
            thickness_range_max: 12,
            base_material_group: '1.1',
            welding_positions: 'PA, PF',
        })).toEqual({
            welding_process: '135',
            thickness_min_mm: 3,
            thickness_max_mm: 12,
            material_group: '1.1',
            positions: 'PA, PF',
        });
    });
});

describe('loadWelderQualificationsForProject', () => {
    test('SELECT unica: 9606 + 14732, thickness_max_unlimited, senza welding_processes_validity', async () => {
        const query = jest.fn().mockResolvedValue({ recordset: [] });
        await loadWelderQualificationsForProject({ query, organizationId: 7, companyId: 3, todayIso: TODAY });
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/LIKE '%9606%' OR q\.qualification_type LIKE '%14732%'/);
        expect(sql).toMatch(/q\.thickness_max_unlimited/);
        expect(sql).not.toMatch(/welding_processes_validity/);
        expect(sql).toMatch(/q\.status NOT IN \('revocata','sospesa'\)/);
        expect(sql).toMatch(/q\.company_id = @projCompId/);
        expect(params).toEqual({ organizationId: 7, projCompId: 3 });
    });

    test('senza company_id: nessun filtro azienda', async () => {
        const query = jest.fn().mockResolvedValue({ recordset: [] });
        await loadWelderQualificationsForProject({ query, organizationId: 7, companyId: null });
        const [sql, params] = query.mock.calls[0];
        expect(sql).not.toMatch(/@projCompId/);
        expect(params).toEqual({ organizationId: 7 });
    });

    test('filtra le qualifiche non operative (scaduta, conferma scaduta)', async () => {
        const rows = [
            { ...baseQual, id: 1 },
            { ...baseQual, id: 2, expiry_date: '2025-01-01' },
            { ...baseQual, id: 3, next_confirmation_due: '2026-01-01' },
            { ...baseQual, id: 4, qualification_type: 'ISO 14732', next_confirmation_due: '2026-01-01' },
            { ...baseQual, id: 5, qualification_type: 'ISO 14732', next_confirmation_due: null },
        ];
        const query = jest.fn().mockResolvedValue({ recordset: rows });
        const out = await loadWelderQualificationsForProject({ query, organizationId: 7, todayIso: TODAY });
        expect(out.map((q) => q.id)).toEqual([1, 5]);
    });

    test('recordset assente: lista vuota', async () => {
        const query = jest.fn().mockResolvedValue({});
        const out = await loadWelderQualificationsForProject({ query, organizationId: 1 });
        expect(out).toEqual([]);
    });
});
