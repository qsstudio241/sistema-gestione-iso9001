/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../data/documentTypeSchemas', () => ({
    getSchemaForDocType: jest.fn(() => ({
        aiExpectedSchema: { wpqr_number: 'string', welding_process: 'string' },
    })),
}));

const { query } = require('../config/database');
const { buildFewShotExamples, formatFewShotPromptSection } = require('./ingestLearning.service');

describe('ingestLearning.service (IG-5)', () => {
    afterEach(() => jest.clearAllMocks());

    it('formatFewShotPromptSection vuoto senza esempi sufficienti', () => {
        expect(formatFewShotPromptSection([])).toBe('');
    });

    it('formatFewShotPromptSection include esempio', () => {
        const section = formatFewShotPromptSection([{
            file_name: 'test.pdf',
            ai_payload: { wpqr_number: '1' },
            human_payload: { wpqr_number: '1', welding_process: '135' },
            field_diffs: { welding_process: { ai: null, human: '135' } },
        }]);
        expect(section).toContain('Esempi dalla tua organizzazione');
        expect(section).toContain('test.pdf');
    });

    it('buildFewShotExamples filtra per org', async () => {
        query.mockResolvedValueOnce({
            recordset: [{
                file_name: 'x.pdf',
                ai_payload_json: '{"wpqr_number":"1"}',
                human_payload_json: '{"wpqr_number":"1","welding_process":"135"}',
                field_diffs_json: '{}',
                action: 'accepted',
            }],
        });
        const examples = await buildFewShotExamples(1001, 'wpqr', 3);
        expect(examples).toHaveLength(1);
        expect(examples[0].human_payload.welding_process).toBe('135');
    });
});
