/**
 * @jest-environment node
 */

/* eslint-env jest */

const {
    resolveAnalysisSource,
    analyzeAllCaseDocuments,
    analyzeAttachment,
    isCatalogedDocRole,
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

jest.mock('./caseCapabilityGapReport.service', () => ({
    maybeRefreshCapabilityGapReport: jest.fn(async () => ({
        refreshed: false,
        skipped: true,
        reason: 'no_company',
    })),
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
const { promises: fs } = require('fs');
const drawingExtractionService = require('./drawingExtraction.service');
const caseCapabilityGapReportService = require('./caseCapabilityGapReport.service');

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

        test('ruolo non catalogato → null', () => {
            expect(resolveAnalysisSource(null, 'application/pdf')).toBeNull();
            expect(resolveAnalysisSource('', 'image/png')).toBeNull();
        });
    });

    describe('isCatalogedDocRole', () => {
        test('whitelist e vuoto', () => {
            expect(isCatalogedDocRole('drawing')).toBe(true);
            expect(isCatalogedDocRole('ORDER')).toBe(true);
            expect(isCatalogedDocRole(null)).toBe(false);
            expect(isCatalogedDocRole('xyz')).toBe(false);
        });
    });

    describe('analyzeAttachment sync — ordine done vs report refresh (VC-3 Bugbot)', () => {
        test('refresh con includeExtractionId PRIMA di status done (requisiti job corrente nel snapshot)', async () => {
            const callOrder = [];
            caseCapabilityGapReportService.maybeRefreshCapabilityGapReport.mockImplementation(async () => {
                callOrder.push('refresh');
                return {
                    refreshed: true,
                    skipped: false,
                    report: { summary: { requirements_count: 1 } },
                };
            });
            fs.readFile.mockResolvedValue(Buffer.from('png'));
            drawingExtractionService.extractFromFile.mockResolvedValue({
                requirements: [{ req_type: 'dim', field_key: 'L', value_text: '10' }],
                raw: '{"ok":1}',
            });

            query.mockImplementation((sqlText) => {
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
                if (/DELETE/.test(sqlText)) return { recordset: [] };
                if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) {
                    return { recordset: [{ id: 55 }] };
                }
                if (/INSERT INTO commercial_case_extracted_requirements/.test(sqlText)) {
                    callOrder.push('insert_req');
                    return { recordset: [] };
                }
                if (/UPDATE commercial_case_drawing_extractions/.test(sqlText)
                    && /status = 'done'/.test(sqlText)) {
                    callOrder.push('done');
                    return { recordset: [] };
                }
                return { recordset: [] };
            });

            const result = await analyzeAttachment({
                caseId: 5,
                attachmentId: 1,
                organizationId: 1,
                userId: 7,
                mode: 'sync',
            });

            expect(result.status).toBe('done');
            expect(result.report_refresh?.refreshed).toBe(true);
            expect(result.report_refresh?.report?.summary?.requirements_count).toBe(1);
            // Senza includeExtractionId il load (solo e.status=done) escludeva i requisiti appena inseriti.
            expect(callOrder).toEqual(['insert_req', 'refresh', 'done']);
            expect(caseCapabilityGapReportService.maybeRefreshCapabilityGapReport)
                .toHaveBeenCalledWith({
                    caseId: 5,
                    organizationId: 1,
                    includeExtractionId: 55,
                });
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

        test('salta allegati non catalogati con reason dedicato', async () => {
            query.mockImplementation((sqlText) => {
                if (/FROM commercial_cases WHERE id/.test(sqlText)) {
                    return { recordset: [{ id: 5 }] };
                }
                if (/FROM attachments\s+WHERE commercial_case_id/.test(sqlText)) {
                    return {
                        recordset: [
                            { attachment_id: 9, file_name: 'x.pdf', mime_type: 'application/pdf', commercial_doc_role: null },
                        ],
                    };
                }
                return { recordset: [] };
            });

            const result = await analyzeAllCaseDocuments({
                caseId: 5,
                organizationId: 1,
                userId: 7,
            });
            expect(result.started).toBe(0);
            expect(result.skipped).toBe(1);
            expect(result.skipped_attachments[0].reason).toMatch(/non catalogato/);
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
