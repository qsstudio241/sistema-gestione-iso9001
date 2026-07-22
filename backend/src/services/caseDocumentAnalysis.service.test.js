/**
 * @jest-environment node
 */

/* eslint-env jest */

const {
    resolveAnalysisSource,
    analyzeAllCaseDocuments,
} = require('./caseDocumentAnalysis.service');

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('./drawingExtraction.service', () => ({
    extractFromFile: jest.fn(),
    resolveProvider: jest.fn(() => 'gemini'),
}));

jest.mock('./caseTextAnalysis.service', () => ({
    extractTextRequirements: jest.fn(),
}));

jest.mock('./aiProviderAdapter', () => ({
    getActiveProvider: jest.fn(() => 'gemini'),
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
}));

jest.mock('fs', () => ({
    promises: { readFile: jest.fn() },
}));

const { query } = require('../config/database');

describe('caseDocumentAnalysis.service', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('resolveAnalysisSource', () => {
        test('drawing role → drawing', () => {
            expect(resolveAnalysisSource('drawing', 'image/png')).toBe('drawing');
        });

        test('capitolato PDF → text', () => {
            expect(resolveAnalysisSource('capitolato', 'application/pdf')).toBe('text');
        });

        test('order PDF → text', () => {
            expect(resolveAnalysisSource('order', 'application/pdf')).toBe('text');
        });

        test('other role → null', () => {
            expect(resolveAnalysisSource('quote', 'application/pdf')).toBeNull();
        });
    });

    describe('analyzeAllCaseDocuments', () => {
        test('avvia job solo su allegati analizzabili', async () => {
            query.mockImplementation((sqlText) => {
                if (/FROM commercial_cases WHERE id/.test(sqlText)) {
                    return { recordset: [{ id: 5 }] };
                }
                if (/FROM attachments\s+WHERE commercial_case_id/.test(sqlText)) {
                    return {
                        recordset: [
                            { attachment_id: 1, file_name: 'd.png', mime_type: 'image/png', commercial_doc_role: 'drawing' },
                            { attachment_id: 2, file_name: 'off.pdf', mime_type: 'application/pdf', commercial_doc_role: 'quote' },
                            { attachment_id: 3, file_name: 'cap.pdf', mime_type: 'application/pdf', commercial_doc_role: 'capitolato' },
                        ],
                    };
                }
                if (/FROM attachments a\s+INNER JOIN commercial_cases/.test(sqlText)) {
                    return {
                        recordset: [{
                            attachment_id: 1,
                            storage_path: '/tmp/d.png',
                            mime_type: 'image/png',
                            file_name: 'd.png',
                            commercial_doc_role: 'drawing',
                        }],
                    };
                }
                if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) {
                    return { recordset: [{ id: 100 }] };
                }
                if (/DELETE/.test(sqlText)) return { recordset: [] };
                return { recordset: [] };
            });

            const result = await analyzeAllCaseDocuments({
                caseId: 5,
                organizationId: 1,
                userId: 7,
                mode: 'async',
            });

            expect(result.started).toBe(2);
            expect(result.skipped).toBe(1);
            expect(result.jobs).toHaveLength(2);
            expect(result.skipped_attachments[0].attachment_id).toBe(2);
        });

        test('NOT_FOUND se caso assente', async () => {
            query.mockResolvedValue({ recordset: [] });
            await expect(analyzeAllCaseDocuments({
                caseId: 99,
                organizationId: 1,
                userId: 7,
            })).rejects.toMatchObject({ code: 'NOT_FOUND' });
        });
    });
});
