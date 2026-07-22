/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('./ingestReferencePattern.service', () => ({
    upsertPatternsFromFeedback: jest.fn().mockResolvedValue({ upserted: 0 }),
}));

const { query } = require('../config/database');
const { getFieldDiff, recordFeedback, resolveAction } = require('./ingestFeedback.service');

describe('ingestFeedback.service (IG-4)', () => {
    afterEach(() => jest.clearAllMocks());

    it('getFieldDiff rileva campi modificati', () => {
        const diffs = getFieldDiff(
            { wpqr_number: 'A1', process: '135' },
            { wpqr_number: 'A1', process: '136' },
        );
        expect(diffs.process).toEqual({ ai: '135', human: '136' });
        expect(diffs.wpqr_number).toBeUndefined();
    });

    it('resolveAction corrected se ci sono diff', () => {
        expect(resolveAction('accepted', { x: { ai: 1, human: 2 } })).toBe('corrected');
        expect(resolveAction('accepted', {})).toBe('accepted');
    });

    it('recordFeedback inserisce riga', async () => {
        query.mockResolvedValueOnce({ recordset: [] });
        const out = await recordFeedback({
            organizationId: 1,
            docType: 'wpqr',
            action: 'accepted',
            aiPayload: { a: 1 },
            humanPayload: { a: 2 },
        });
        expect(out.action).toBe('corrected');
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO import_extraction_feedback'),
            expect.objectContaining({ action: 'corrected' }),
        );
    });
});
