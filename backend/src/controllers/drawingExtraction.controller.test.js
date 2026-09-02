/**
 * @jest-environment node
 */

/* eslint-env jest */

jest.mock('../config/database', () => ({
    query: jest.fn(),
}));

jest.mock('../services/drawingExtraction.service', () => ({
    extractFromFile: jest.fn(),
    resolveProvider: jest.fn(() => 'gemini'),
}));

jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));

jest.mock('../services/caseCapabilityGapReport.service', () => ({
    maybeRefreshCapabilityGapReport: jest.fn(async () => ({
        refreshed: true,
        report: { summary: { status: 'ok' } },
    })),
}));

jest.mock('fs', () => ({
    promises: { readFile: jest.fn() },
}));

const { query } = require('../config/database');
const service = require('../services/drawingExtraction.service');
const caseCapabilityGapReportService = require('../services/caseCapabilityGapReport.service');
const fs = require('fs').promises;
const ctrl = require('./drawingExtraction.controller');

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function status(code) {
        this.statusCode = code;
        return this;
    });
    res.json = jest.fn(function json(payload) {
        this.body = payload;
        return this;
    });
    return res;
}

/**
 * Mock "intelligente" di query(): risponde in base al testo SQL così l'ordine
 * delle chiamate del controller non rende fragile il test.
 */
function installQueryMock({ caseRows, attRows, headRow, reqRows, updatedReq }) {
    query.mockImplementation((sqlText) => {
        if (/FROM commercial_cases WHERE id/.test(sqlText)) return { recordset: caseRows };
        if (/FROM attachments/.test(sqlText)) return { recordset: attRows };
        if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) return { recordset: [{ id: 10 }] };
        if (/INSERT INTO commercial_case_extracted_requirements/.test(sqlText)) return { recordset: [] };
        if (/UPDATE commercial_case_drawing_extractions/.test(sqlText)) return { recordset: [] };
        if (/FROM commercial_case_drawing_extractions e/.test(sqlText)) return { recordset: headRow ? [headRow] : [] };
        if (/FROM commercial_case_extracted_requirements\s+WHERE extraction_id/.test(sqlText)) return { recordset: reqRows || [] };
        if (/FROM commercial_case_extracted_requirements r/.test(sqlText)) {
            return { recordset: caseRows.length ? [{ id: 1, case_id: 5 }] : [] };
        }
        if (/UPDATE commercial_case_extracted_requirements/.test(sqlText)) return { recordset: [updatedReq] };
        return { recordset: [] };
    });
}

const baseReq = (params = {}, body = {}) => ({
    user: { organization_id: 1, user_id: 7 },
    params,
    body,
});

describe('drawingExtraction.controller — startExtraction', () => {
    beforeEach(() => jest.clearAllMocks());

    test('happy path: creates record, extracts, inserts requirements, returns done', async () => {
        installQueryMock({
            caseRows: [{ id: 5 }],
            attRows: [{ attachment_id: 99, storage_path: '/tmp/d.png', mime_type: 'image/png', file_name: 'd.png' }],
            headRow: { id: 10, case_id: 5, status: 'done', organization_id: 1 },
            reqRows: [{ id: 1, req_type: 'material', value_text: 'S355JR', review_status: 'extracted' }],
        });
        fs.readFile.mockResolvedValue(Buffer.from('PNG'));
        service.extractFromFile.mockResolvedValue({
            provider: 'gemini',
            requirements: [{ req_type: 'material', value_text: 'S355JR', field_key: 'material', unit: null, confidence: 0.9, source_bbox: null }],
            raw: '{"requirements":[]}',
            model: 'gemini-2.5-flash',
        });

        const res = createRes();
        await ctrl.startExtraction(baseReq({ caseId: '5', docId: '99' }), res);

        expect(service.extractFromFile).toHaveBeenCalledTimes(1);
        // un INSERT requisito
        const reqInserts = query.mock.calls.filter((c) => /INSERT INTO commercial_case_extracted_requirements/.test(c[0]));
        expect(reqInserts).toHaveLength(1);
        // UPDATE done
        const doneUpdate = query.mock.calls.find((c) => /UPDATE commercial_case_drawing_extractions/.test(c[0]) && /status = 'done'/.test(c[0]));
        expect(doneUpdate).toBeTruthy();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.body.status).toBe('done');
        expect(res.body.requirements).toHaveLength(1);
    });

    test('idempotenza: re-estrazione rimuove requisiti e job precedenti dello stesso allegato', async () => {
        installQueryMock({
            caseRows: [{ id: 5 }],
            attRows: [{ attachment_id: 99, storage_path: '/tmp/d.png', mime_type: 'image/png', file_name: 'd.png' }],
            headRow: { id: 10, case_id: 5, status: 'done', organization_id: 1 },
            reqRows: [{ id: 1, req_type: 'material', value_text: 'S355JR', review_status: 'extracted' }],
        });
        fs.readFile.mockResolvedValue(Buffer.from('PNG'));
        service.extractFromFile.mockResolvedValue({
            provider: 'gemini',
            requirements: [{ req_type: 'material', value_text: 'S355JR' }],
            raw: '{}',
            model: 'gemini-2.5-flash',
        });

        const res = createRes();
        await ctrl.startExtraction(baseReq({ caseId: '5', docId: '99' }), res);

        const delReq = query.mock.calls.find((c) => /DELETE r\s+FROM commercial_case_extracted_requirements r/.test(c[0]));
        const delJob = query.mock.calls.find((c) => /DELETE FROM commercial_case_drawing_extractions/.test(c[0]));
        expect(delReq).toBeTruthy();
        expect(delReq[1]).toMatchObject({ caseId: 5, docId: 99 });
        expect(delJob).toBeTruthy();
        // le DELETE devono precedere l'INSERT del nuovo job
        const idxDelJob = query.mock.calls.findIndex((c) => /DELETE FROM commercial_case_drawing_extractions/.test(c[0]));
        const idxInsJob = query.mock.calls.findIndex((c) => /INSERT INTO commercial_case_drawing_extractions/.test(c[0]));
        expect(idxDelJob).toBeGreaterThanOrEqual(0);
        expect(idxDelJob).toBeLessThan(idxInsJob);
        expect(res.body.status).toBe('done');
    });

    test('multi-tenant scope: case of another org returns 404', async () => {
        installQueryMock({ caseRows: [], attRows: [] });
        const res = createRes();
        await ctrl.startExtraction(baseReq({ caseId: '5', docId: '99' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(service.extractFromFile).not.toHaveBeenCalled();
    });

    test('attachment not linked to case returns 404', async () => {
        installQueryMock({ caseRows: [{ id: 5 }], attRows: [] });
        const res = createRes();
        await ctrl.startExtraction(baseReq({ caseId: '5', docId: '99' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('graceful degrade: provider not configured -> record stays in error', async () => {
        installQueryMock({
            caseRows: [{ id: 5 }],
            attRows: [{ attachment_id: 99, storage_path: '/tmp/d.png', mime_type: 'image/png', file_name: 'd.png' }],
            headRow: { id: 10, case_id: 5, status: 'error', error_message: 'AI_NOT_CONFIGURED: GEMINI_API_KEY is not set' },
            reqRows: [],
        });
        fs.readFile.mockResolvedValue(Buffer.from('PNG'));
        const err = new Error('GEMINI_API_KEY is not set');
        err.code = 'AI_NOT_CONFIGURED';
        service.extractFromFile.mockRejectedValue(err);

        const res = createRes();
        await ctrl.startExtraction(baseReq({ caseId: '5', docId: '99' }), res);

        const errUpdate = query.mock.calls.find((c) => /UPDATE commercial_case_drawing_extractions/.test(c[0]) && /status = 'error'/.test(c[0]));
        expect(errUpdate).toBeTruthy();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.body.status).toBe('error');
    });
});

describe('drawingExtraction.controller — getExtraction', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns extraction with requirements when scoped to org', async () => {
        installQueryMock({
            caseRows: [{ id: 5 }],
            headRow: { id: 10, case_id: 5, status: 'done', organization_id: 1, attachment_id: 99 },
            reqRows: [{ id: 1, req_type: 'material', value_text: 'S355JR', review_status: 'extracted' }],
        });
        const res = createRes();
        await ctrl.getExtraction(baseReq({ caseId: '5', id: '10' }), res);
        expect(res.body.status).toBe('done');
        expect(res.body.requirements).toHaveLength(1);
    });
});

describe('drawingExtraction.controller — listExtractions', () => {
    beforeEach(() => jest.clearAllMocks());

    test('returns jobs ordered for case with org scope', async () => {
        query.mockImplementation((sqlText) => {
            if (/FROM commercial_cases WHERE id/.test(sqlText)) return { recordset: [{ id: 5 }] };
            if (/FROM commercial_case_drawing_extractions e/.test(sqlText) && /ORDER BY e.created_at DESC/.test(sqlText)) {
                return {
                    recordset: [
                        { id: 12, attachment_id: 99, status: 'done', case_id: 5 },
                        { id: 11, attachment_id: 99, status: 'error', case_id: 5 },
                    ],
                };
            }
            return { recordset: [] };
        });
        const res = createRes();
        await ctrl.listExtractions(baseReq({ caseId: '5' }), res);
        expect(res.body.extractions).toHaveLength(2);
        expect(res.body.extractions[0].id).toBe(12);
    });

    test('multi-tenant scope: case of another org returns 404', async () => {
        query.mockImplementation((sqlText) => {
            if (/FROM commercial_cases WHERE id/.test(sqlText)) return { recordset: [] };
            return { recordset: [] };
        });
        const res = createRes();
        await ctrl.listExtractions(baseReq({ caseId: '5' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });
});

describe('drawingExtraction.controller — reviewRequirement', () => {
    beforeEach(() => jest.clearAllMocks());

    test('invalid review_status returns 400', async () => {
        const res = createRes();
        await ctrl.reviewRequirement(baseReq({ id: '3' }, { review_status: 'bogus' }), res);
        expect(res.status).toHaveBeenCalledWith(400);
    });

    test('multi-tenant scope: requirement of another org returns 404', async () => {
        installQueryMock({ caseRows: [] }); // ownership query returns empty
        const res = createRes();
        await ctrl.reviewRequirement(baseReq({ id: '3' }, { review_status: 'confirmed' }), res);
        expect(res.status).toHaveBeenCalledWith(404);
    });

    test('edited: updates value and returns row', async () => {
        installQueryMock({
            caseRows: [{ id: 1 }], // ownership ok
            updatedReq: { id: 3, req_type: 'material', value_text: 'S355J2', review_status: 'edited', reviewed_by: 7 },
        });
        const res = createRes();
        await ctrl.reviewRequirement(baseReq({ id: '3' }, { review_status: 'edited', value_text: 'S355J2' }), res);

        const upd = query.mock.calls.find((c) => /UPDATE commercial_case_extracted_requirements/.test(c[0]));
        expect(upd).toBeTruthy();
        expect(upd[1].valueText).toBe('S355J2');
        expect(res.body.value_text).toBe('S355J2');
        expect(caseCapabilityGapReportService.maybeRefreshCapabilityGapReport).toHaveBeenCalledWith(
            expect.objectContaining({ caseId: 5, organizationId: 1 }),
        );
        expect(res.body.report_refresh?.refreshed).toBe(true);
    });

    test('confirmed: trigger refresh report VC-3', async () => {
        installQueryMock({
            caseRows: [{ id: 1 }],
            updatedReq: { id: 3, req_type: 'material', value_text: 'S355', review_status: 'confirmed', reviewed_by: 7 },
        });
        const res = createRes();
        await ctrl.reviewRequirement(baseReq({ id: '3' }, { review_status: 'confirmed' }), res);
        expect(res.body.review_status).toBe('confirmed');
        expect(caseCapabilityGapReportService.maybeRefreshCapabilityGapReport).toHaveBeenCalled();
    });
});
