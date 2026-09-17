/**
 * @jest-environment node
 */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../data/documentTypeSchemas', () => {
    const actual = jest.requireActual('../data/documentTypeSchemas');
    return {
        getSchemaForDocType: jest.fn((docType) => {
            if (docType === 'material_certificate') {
                return actual.getSchemaForDocType(docType);
            }
            // Altri tipi: stub stabile (prime 2 chiavi = requisiti hard)
            return {
                aiExpectedSchema: { wpqr_number: 'string', welding_process: 'string' },
            };
        }),
    };
});

const { query } = require('../config/database');
const {
    buildFewShotExamples,
    formatFewShotPromptSection,
    humanPayloadComplete,
    buildIngestLearningPromptSection,
} = require('./ingestLearning.service');
const { alignMcFeedbackPayload } = require('../controllers/materialCertificates.controller');

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

    it('MC: humanPayloadComplete accetta mill senza document_kind/inspection_document_type', () => {
        expect(humanPayloadComplete({
            material_role: 'base',
            steel_designation: 'S275JR',
        }, 'material_certificate')).toBe(true);
        expect(humanPayloadComplete({
            document_kind: 'delivery_note',
            ddt_no: '000775RE',
        }, 'material_certificate')).toBe(true);
        expect(humanPayloadComplete({}, 'material_certificate')).toBe(false);
        // Altri tipi: ancora prime 2 chiavi
        expect(humanPayloadComplete({ wpqr_number: '1' }, 'wpqr')).toBe(false);
        expect(humanPayloadComplete({
            wpqr_number: '1',
            welding_process: '135',
        }, 'wpqr')).toBe(true);
    });

    it('MC-7 PATCH Materiale → few-shot include steel_designation corretto', async () => {
        // Simula payload prodotto da alignMcFeedbackPayload dopo PATCH designation
        const human = alignMcFeedbackPayload({
            material_role: 'base',
            designation: 'S275JR',
            steel_designation: 'S355J2',
            // intenzionalmente assenti: document_kind, inspection_document_type
        }, 'base');
        expect(human.steel_designation).toBe('S275JR');
        expect(human).not.toHaveProperty('designation');
        expect(human.document_kind).toBeUndefined();
        expect(human.inspection_document_type).toBeUndefined();
        expect(humanPayloadComplete(human, 'material_certificate')).toBe(true);

        query
            .mockResolvedValueOnce({ recordset: [] }) // getTopReferencePatterns
            .mockResolvedValueOnce({
                recordset: [{
                    file_name: 'mtc.pdf',
                    ai_payload_json: JSON.stringify({
                        material_role: 'base',
                        steel_designation: 'S355J2',
                    }),
                    human_payload_json: JSON.stringify(human),
                    field_diffs_json: JSON.stringify({
                        steel_designation: { ai: 'S355J2', human: 'S275JR' },
                    }),
                    action: 'corrected',
                }],
            });

        const section = await buildIngestLearningPromptSection(1001, 'material_certificate', 3);
        expect(section).toContain('Esempi dalla tua organizzazione');
        expect(section).toContain('S275JR');
        expect(section).toContain('steel_designation');
        expect(section).not.toContain('"designation"');
    });
});
