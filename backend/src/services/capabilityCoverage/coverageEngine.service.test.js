'use strict';

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
}));

const {
    listCoverageDomains,
    verifyCoverage,
    summarizeMatches,
} = require('./coverageEngine.service');
const { COVERAGE_DOMAINS, MATCH_STATUS } = require('./coverageTypes');
const { domainCount, listDomainAdapters } = require('./coverageRegistry');
const welder = require('./adapters/welder9606.adapter');
const cnd = require('./adapters/cnd9712.adapter');

describe('coverage registry (COV-1)', () => {
    it('registra almeno 3 domini', () => {
        expect(domainCount()).toBeGreaterThanOrEqual(3);
        const domains = listDomainAdapters().map((a) => a.domain);
        expect(domains).toEqual(expect.arrayContaining([
            COVERAGE_DOMAINS.WELDER_9606,
            COVERAGE_DOMAINS.WPQR_PROCEDURE,
            COVERAGE_DOMAINS.CND_9712,
        ]));
    });

    it('listCoverageDomains espone meta senza funzione match', () => {
        const meta = listCoverageDomains();
        expect(meta.length).toBeGreaterThanOrEqual(3);
        expect(meta.every((d) => d.domain && Array.isArray(d.requirementFields))).toBe(true);
        expect(meta.every((d) => typeof d.match !== 'function')).toBe(true);
    });
});

describe('welder_9606 match puro', () => {
    const today = '2026-10-05';
    const baseQual = {
        id: 10,
        person_name: 'Rossi Mario',
        qualification_type: 'ISO 9606-1',
        status: 'attiva',
        expiry_date: '2028-01-01',
        next_confirmation_due: '2027-01-01',
        welding_processes_validity: '135, 138',
        welding_process: '135',
        joint_type: 'BW',
        product_type: 'T',
        thickness_min_mm: 3,
        thickness_max_mm: 20,
        thickness_max_unlimited: false,
        position_range: 'PA, PF',
        pipe_diameter_min_mm: 25,
        pipe_diameter_max_mm: 200,
    };

    it('match quando tutte le dimensioni di validità sono coperte', () => {
        const m = welder.matchWelderCapability(baseQual, {
            welding_process: '135',
            joint_type: 'BW',
            product_type: 'T',
            thickness_min_mm: 5,
            thickness_max_mm: 12,
            positions: 'PA',
            pipe_diameter_mm: 80,
        }, { todayIso: today });
        expect(m.status).toBe(MATCH_STATUS.MATCH);
        expect(m.detail.process).toBe('ok');
        expect(m.detail.thickness).toBe('ok');
    });

    it('no_match su processo fuori validità', () => {
        const m = welder.matchWelderCapability(baseQual, {
            welding_process: '111',
            joint_type: 'BW',
        }, { todayIso: today });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.process).toBe('mismatch');
        expect(m.reasons.some((r) => /Processo/i.test(r))).toBe(true);
    });

    it('no_match su giunto FW vs BW', () => {
        const m = welder.matchWelderCapability(baseQual, {
            welding_process: '135',
            joint_type: 'FW',
        }, { todayIso: today });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.joint_type).toBe('mismatch');
    });

    it('no_match se qualifica scaduta', () => {
        const m = welder.matchWelderCapability({
            ...baseQual,
            expiry_date: '2020-01-01',
        }, { welding_process: '135' }, { todayIso: today });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
        expect(m.detail.operational).toBe('mismatch');
    });

    it('T copre P; P non copre T', () => {
        const tCoversP = welder.checkProductType('T', 'P');
        const pVsT = welder.checkProductType('P', 'T');
        expect(tCoversP).toBe('ok');
        expect(pVsT).toBe('mismatch');
    });
});

describe('wpqr_procedure (COV-2: non piu stub)', () => {
    it('e implementato e non restituisce not_implemented', async () => {
        const { query } = require('../../config/database');
        query.mockResolvedValueOnce({ recordset: [] });
        const result = await verifyCoverage(
            { domain: COVERAGE_DOMAINS.WPQR_PROCEDURE, criteria: { welding_process: '135' } },
            { organizationId: 1, pool: null }
        );
        expect(result.implemented).toBe(true);
        expect(result.maturity).toBe('full');
        expect(result.summary.not_implemented).toBe(0);
        expect(result.matches).toEqual([]);
        expect(result.message).toEqual(expect.stringContaining('Nessuna WPQR'));
    });

    it('listCoverageDomains lo espone come implementato', () => {
        const meta = listCoverageDomains().find((d) => d.domain === COVERAGE_DOMAINS.WPQR_PROCEDURE);
        expect(meta.implemented).toBe(true);
        expect(meta.maturity).toBe('full');
    });
});

describe('cnd_9712 match minimo', () => {
    it('match su metodo + livello', () => {
        const m = cnd.matchCndCapability({
            id: 2,
            person_name: 'Bianchi',
            status: 'attiva',
            expiry_date: '2028-01-01',
            ndt_method: 'UT',
            ndt_level: 2,
        }, { ndt_method: 'UT', ndt_level: 2 }, { todayIso: '2026-10-05' });
        expect(m.status).toBe(MATCH_STATUS.MATCH);
    });

    it('no_match su metodo diverso', () => {
        const m = cnd.matchCndCapability({
            id: 2,
            status: 'attiva',
            expiry_date: '2028-01-01',
            ndt_method: 'MT',
            ndt_level: 2,
        }, { ndt_method: 'UT' }, { todayIso: '2026-10-05' });
        expect(m.status).toBe(MATCH_STATUS.NO_MATCH);
    });
});

describe('summarizeMatches', () => {
    it('conta gli stati', () => {
        expect(summarizeMatches([
            { status: 'match' },
            { status: 'partial' },
            { status: 'no_match' },
            { status: 'not_implemented' },
        ])).toEqual({
            total: 4,
            match: 1,
            partial: 1,
            no_match: 1,
            not_implemented: 1,
        });
    });
});

describe('verifyCoverage validazione', () => {
    it('400 se domain mancante', async () => {
        await expect(verifyCoverage({}, { organizationId: 1 })).rejects.toMatchObject({
            httpStatus: 400,
            code: 'DOMAIN_REQUIRED',
        });
    });

    it('400 se domain sconosciuto', async () => {
        await expect(
            verifyCoverage({ domain: 'unknown_x' }, { organizationId: 1 })
        ).rejects.toMatchObject({
            httpStatus: 400,
            code: 'DOMAIN_UNKNOWN',
        });
    });
});
