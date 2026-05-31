/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { query } = require('../config/database');
const {
    unifiedSearch,
    normalizeEntityTypes,
    clampLimit,
} = require('./unifiedSearch.service');

const ORG_ID = 1001;
const USER = {
    organization_id: ORG_ID,
    user_id: 42,
    role: 'auditor',
    auditor_org_id: 10,
};

afterEach(() => jest.clearAllMocks());

describe('normalizeEntityTypes', () => {
    it('restituisce tutti i tipi se input assente', () => {
        expect(normalizeEntityTypes(null)).toEqual([
            'non_conformity', 'document', 'audit', 'complaint', 'risk', 'qualification',
        ]);
    });

    it('accetta alias e CSV', () => {
        expect(normalizeEntityTypes('nc,documents,complaints')).toEqual([
            'non_conformity', 'document', 'complaint',
        ]);
    });
});

describe('clampLimit', () => {
    it('limita al massimo consentito', () => {
        expect(clampLimit(100)).toBe(25);
        expect(clampLimit('abc')).toBe(10);
    });
});

describe('unifiedSearch', () => {
    it('applica filtro organization_id e pattern LIKE su NC', async () => {
        query.mockResolvedValue({ recordset: [] });

        await unifiedSearch({
            organizationId: ORG_ID,
            reqUser: USER,
            q: 'difetto',
            entityTypes: ['non_conformity'],
            limit: 5,
        });

        expect(query).toHaveBeenCalledTimes(1);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/non_conformities nc/i);
        expect(sql).toMatch(/nc\.description LIKE @pattern/i);
        expect(sql).toMatch(/auditor_org_id = @auditor_org_id/i);
        expect(params).toMatchObject({
            organization_id: ORG_ID,
            pattern: '%difetto%',
            limit: 5,
            auditor_org_id: 10,
            user_id: 42,
        });
    });

    it('applica filtro companyId rigido (senza OR NULL) su documenti', async () => {
        query.mockResolvedValue({ recordset: [] });

        await unifiedSearch({
            organizationId: ORG_ID,
            reqUser: USER,
            q: 'ISO',
            entityTypes: ['document'],
            companyId: 55,
        });

        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/dr\.company_id = @company_id/i);
        expect(sql).not.toMatch(/OR dr\.company_id IS NULL/i);
        expect(params.company_id).toBe(55);
    });

    it('cerca audit su numero e conclusioni JSON', async () => {
        query.mockResolvedValue({ recordset: [] });

        await unifiedSearch({
            organizationId: ORG_ID,
            reqUser: { ...USER, role: 'admin', auditor_org_id: null },
            q: '2026',
            entityTypes: ['audit'],
        });

        const [sql] = query.mock.calls[0];
        expect(sql).toMatch(/a\.audit_number LIKE @pattern/i);
        expect(sql).toMatch(/auditOutcome\.conclusions/i);
        expect(sql).not.toMatch(/auditor_org_id/i);
    });

    it('raggruppa risultati per tipo e calcola totalCount', async () => {
        query
            .mockResolvedValueOnce({
                recordset: [{
                    id: 1,
                    nc_uuid: 'uuid-1',
                    nc_number: 'NC-001',
                    description: 'Descrizione NC',
                    status: 'open',
                    company_id: 5,
                    company_name: 'Azienda A',
                }],
            })
            .mockResolvedValueOnce({ recordset: [] });

        const result = await unifiedSearch({
            organizationId: ORG_ID,
            reqUser: USER,
            q: 'NC',
            entityTypes: ['non_conformity', 'complaint'],
            limit: 10,
        });

        expect(result.totalCount).toBe(1);
        expect(result.groups.non_conformity).toHaveLength(1);
        expect(result.groups.non_conformity[0]).toMatchObject({
            entityType: 'non_conformity',
            id: 1,
            title: 'NC-001',
            companyId: 5,
            companyName: 'Azienda A',
        });
        expect(result.groups.complaint).toEqual([]);
    });
});
