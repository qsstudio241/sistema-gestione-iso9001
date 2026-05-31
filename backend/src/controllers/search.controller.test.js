/**
 * @jest-environment node
 */

jest.mock('../services/unifiedSearch.service', () => ({
    unifiedSearch: jest.fn(),
}));

jest.mock('../utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
}));

const { unifiedSearch } = require('../services/unifiedSearch.service');
const { globalSearch } = require('./search.controller');

const ORG_ID = 1001;

function mockReq(overrides = {}) {
    return {
        user: {
            organization_id: ORG_ID,
            user_id: 42,
            role: 'auditor',
            auditor_org_id: 10,
        },
        query: {},
        ...overrides,
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
}

afterEach(() => jest.clearAllMocks());

describe('globalSearch', () => {
    it('rifiuta q con meno di 2 caratteri', async () => {
        const req = mockReq({ query: { q: 'a' } });
        const res = mockRes();

        await globalSearch(req, res);

        expect(unifiedSearch).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'VALIDATION_ERROR' }),
        );
    });

    it('rifiuta companyId non numerico', async () => {
        const req = mockReq({ query: { q: 'test', companyId: 'abc' } });
        const res = mockRes();

        await globalSearch(req, res);

        expect(unifiedSearch).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
    });

    it('delega al service e restituisce gruppi', async () => {
        unifiedSearch.mockResolvedValue({
            query: 'difetto',
            companyId: 7,
            limit: 10,
            entityTypes: ['non_conformity'],
            groups: { non_conformity: [{ entityType: 'non_conformity', id: 1, title: 'NC-1' }] },
            totalCount: 1,
        });

        const req = mockReq({
            query: { q: '  difetto  ', companyId: '7', entityTypes: 'non_conformity', limit: '10' },
        });
        const res = mockRes();

        await globalSearch(req, res);

        expect(unifiedSearch).toHaveBeenCalledWith({
            organizationId: ORG_ID,
            reqUser: req.user,
            q: 'difetto',
            companyId: 7,
            entityTypes: 'non_conformity',
            limit: '10',
        });
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: true,
                totalCount: 1,
                groups: expect.any(Object),
            }),
        );
    });
});
