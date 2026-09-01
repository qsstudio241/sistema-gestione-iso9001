/**
 * @jest-environment node
 *
 * VC-3 Bugbot: loadExtractedRequirements deve includere un job ancora processing
 * quando includeExtractionId è passato (requisiti già in DB prima di mark done).
 */

/* eslint-env jest */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

const { query } = require('../config/database');
const { loadExtractedRequirements } = require('./caseExtractedCoverage.service');

describe('loadExtractedRequirements — includeExtractionId (VC-3)', () => {
    beforeEach(() => jest.clearAllMocks());

    test('senza includeExtractionId: filtro solo e.status = done', async () => {
        query.mockResolvedValue({ recordset: [] });
        await loadExtractedRequirements(9, 42);
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/e\.status = 'done'/);
        expect(sql).not.toMatch(/OR e\.id = @includeExtractionId/);
        expect(params).toEqual({ caseId: 9, organizationId: 42 });
    });

    test('con includeExtractionId: include anche quel job (anche se processing)', async () => {
        query.mockResolvedValue({
            recordset: [
                {
                    req_type: 'dim',
                    field_key: 'L',
                    value_text: '10',
                    unit: 'mm',
                    confidence: 0.9,
                    review_status: 'extracted',
                    source: 'drawing',
                },
            ],
        });
        const rows = await loadExtractedRequirements(9, 42, { includeExtractionId: 55 });
        expect(rows).toHaveLength(1);
        expect(rows[0].field_key).toBe('L');
        const [sql, params] = query.mock.calls[0];
        expect(sql).toMatch(/e\.status = 'done' OR e\.id = @includeExtractionId/);
        expect(params).toEqual({
            caseId: 9,
            organizationId: 42,
            includeExtractionId: 55,
        });
    });
});
