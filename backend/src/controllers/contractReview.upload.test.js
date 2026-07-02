/**
 * @jest-environment node
 *
 * Test della funzione uploadCaseAttachment con auto-estrazione AI (slice #4).
 *
 * Verifica che:
 *  1. upload disegno → extraction job creato, drawingExtraction.service avviato in bg
 *  2. upload capitolato PDF → extraction job creato, caseTextAnalysis.service avviato in bg
 *  3. errori AI NON bloccano l'upload (201 anche con AI in errore)
 *  4. multi-tenant: upload su caso di altra org → 404
 *  5. upload con ruolo non estraibile → nessun job creato
 */

/* eslint-env jest */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../services/drawingExtraction.service', () => ({
    extractFromFile: jest.fn(),
    resolveProvider: jest.fn(() => 'gemini'),
}));
jest.mock('../services/caseTextAnalysis.service', () => ({
    extractTextRequirements: jest.fn(),
}));
jest.mock('../services/aiProviderAdapter', () => ({
    chat: jest.fn(),
    getActiveProvider: jest.fn(() => 'gemini'),
}));
jest.mock('../utils/logger', () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
}));
jest.mock('fs', () => ({
    promises: { readFile: jest.fn(), unlink: jest.fn().mockResolvedValue(undefined) },
}));

// Stub servizi non pertinenti al test
jest.mock('../services/contractReviewWorkflow.service', () => ({
    CASE_STATUSES: new Set(['OPEN']),
}));
jest.mock('../services/contractReviewNotification.service', () => ({}));
jest.mock('../services/aiContextBuilder.service', () => ({}));
jest.mock('../services/aiOrganizationContext.service', () => ({}));
jest.mock('../services/qualificationCompany.service', () => ({}));
jest.mock('../services/commercialCustomerCounterparty.service', () => ({
    resolveCommercialCustomerFields: jest.fn(),
    CASE_SELECT_SQL: 'cc.id, cc.organization_id',
    CASE_FROM_SQL: 'FROM commercial_cases cc',
}));

const { query } = require('../config/database');
const drawingSvc = require('../services/drawingExtraction.service');
const textSvc = require('../services/caseTextAnalysis.service');
const fs = require('fs').promises;

// Richiede dopo i mock per catturare i mock
const ctrl = require('./contractReview.controller');

// Flush tutte le micro-task pendenti (per il fire-and-forget)
async function flushAsync() {
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
}

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(function (code) { this.statusCode = code; return this; });
    res.json = jest.fn(function (payload) { this.body = payload; return this; });
    return res;
}

function makeReq(params = {}, body = {}, file = null) {
    return {
        user: { organization_id: 1, user_id: 7 },
        params,
        body,
        file,
    };
}

/**
 * Installa mock di query() che risponde in base al pattern SQL.
 * Compatibile con caseDocumentAnalysis.service (lookup allegato + DELETE idempotenza).
 */
function installQueryMock({ caseRows = [{ id: 5 }], attId = 99 } = {}) {
    let lastAttachmentMeta = { docRole: 'drawing', mimeType: 'image/png', storagePath: '/tmp/disegno.png' };

    query.mockImplementation((sqlText, params = {}) => {
        if (/FROM commercial_cases/.test(sqlText)) return { recordset: caseRows };
        if (/INSERT INTO attachments/.test(sqlText)) {
            lastAttachmentMeta = {
                docRole: params.docRole || 'drawing',
                mimeType: params.mimeType || 'image/png',
                storagePath: params.storagePath || '/tmp/file',
            };
            return { recordset: [{ attachment_id: attId, attachment_uuid: 'uuid-1' }] };
        }
        if (/FROM attachments a\s+INNER JOIN commercial_cases/.test(sqlText)) {
            if (!caseRows.length) return { recordset: [] };
            return {
                recordset: [{
                    attachment_id: attId,
                    storage_path: lastAttachmentMeta.storagePath,
                    mime_type: lastAttachmentMeta.mimeType,
                    file_name: 'file',
                    commercial_doc_role: lastAttachmentMeta.docRole,
                }],
            };
        }
        if (/DELETE/.test(sqlText)) return { recordset: [] };
        if (/INSERT INTO commercial_case_drawing_extractions/.test(sqlText)) {
            return { recordset: [{ id: 10 }] };
        }
        if (/INSERT INTO commercial_case_extracted_requirements/.test(sqlText)) {
            return { recordset: [] };
        }
        if (/UPDATE commercial_case_drawing_extractions/.test(sqlText)) {
            return { recordset: [] };
        }
        return { recordset: [] };
    });
}

const fakePdfFile = {
    originalname: 'cap.pdf',
    mimetype: 'application/pdf',
    size: 1000,
    path: '/tmp/cap.pdf',
};

const fakeImageFile = {
    originalname: 'disegno.png',
    mimetype: 'image/png',
    size: 2000,
    path: '/tmp/disegno.png',
};

beforeEach(() => {
    jest.clearAllMocks();
    fs.readFile.mockResolvedValue(Buffer.from('fake'));
});

// ──────────────────────────────────────────────────────────────────────────────

describe('uploadCaseAttachment — auto-estrazione disegno', () => {
    test('drawing image: upload 201, extraction job creato, drawingExtraction avviato', async () => {
        installQueryMock();
        drawingSvc.extractFromFile.mockResolvedValue({
            provider: 'gemini', requirements: [{ req_type: 'material', value_text: 'S355', field_key: 'mat', unit: null, confidence: 0.9, source_bbox: null }],
            raw: '{}', model: 'gemini-2.5-flash',
        });

        const req = makeReq({ id: '5' }, { doc_role: 'drawing' }, fakeImageFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        // upload deve riuscire immediatamente
        expect(res.statusCode).toBe(201);
        expect(res.body.attachment_id).toBe(99);
        expect(res.body.analysis_job_id).toBe(10);

        // job record inserito (source='drawing')
        const jobInsert = query.mock.calls.find((c) => /INSERT INTO commercial_case_drawing_extractions/.test(c[0]));
        expect(jobInsert).toBeTruthy();
        expect(jobInsert[1]).toMatchObject({ source: 'drawing', caseId: 5, attachmentId: 99 });

        // flush fire-and-forget
        await flushAsync();

        expect(drawingSvc.extractFromFile).toHaveBeenCalledTimes(1);
        const doneUpdate = query.mock.calls.find(
            (c) => /UPDATE commercial_case_drawing_extractions/.test(c[0]) && /status = 'done'/.test(c[0]),
        );
        expect(doneUpdate).toBeTruthy();
        expect(textSvc.extractTextRequirements).not.toHaveBeenCalled();
    });
});

describe('uploadCaseAttachment — auto-estrazione testo capitolato', () => {
    test('capitolato PDF: upload 201, text extraction job creato, caseTextAnalysis avviato', async () => {
        installQueryMock();
        textSvc.extractTextRequirements.mockResolvedValue({
            provider: 'gemini', requirements: [{ req_type: 'delivery', value_text: '30 giorni', field_key: 'delivery_days', unit: null, confidence: 0.8, source_bbox: null }],
            raw: '{}', model: 'gemini-2.5-flash',
        });

        const req = makeReq({ id: '5' }, { doc_role: 'capitolato' }, fakePdfFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.analysis_job_id).toBe(10);

        const jobInsert = query.mock.calls.find((c) => /INSERT INTO commercial_case_drawing_extractions/.test(c[0]));
        expect(jobInsert).toBeTruthy();
        expect(jobInsert[1]).toMatchObject({ source: 'text' });

        await flushAsync();

        expect(textSvc.extractTextRequirements).toHaveBeenCalledTimes(1);
        const reqInsert = query.mock.calls.find((c) => /INSERT INTO commercial_case_extracted_requirements/.test(c[0]));
        expect(reqInsert).toBeTruthy();
        expect(reqInsert[1]).toMatchObject({ reqType: 'delivery' });
    });

    test('order PDF: upload 201, text extraction avviata', async () => {
        installQueryMock();
        textSvc.extractTextRequirements.mockResolvedValue({
            provider: 'gemini', requirements: [], raw: '{}', model: 'gemini-2.5-flash',
        });

        const req = makeReq({ id: '5' }, { doc_role: 'order' }, fakePdfFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(201);

        await flushAsync();
        expect(textSvc.extractTextRequirements).toHaveBeenCalledTimes(1);
    });
});

describe('uploadCaseAttachment — errori AI non bloccano upload', () => {
    test('AI non configurata: upload riuscito, job in error', async () => {
        installQueryMock();
        const aiErr = Object.assign(new Error('no key'), { code: 'AI_NOT_CONFIGURED' });
        drawingSvc.extractFromFile.mockRejectedValue(aiErr);

        const req = makeReq({ id: '5' }, { doc_role: 'drawing' }, fakeImageFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        // upload non bloccato
        expect(res.statusCode).toBe(201);

        await flushAsync();

        const errUpdate = query.mock.calls.find(
            (c) => /UPDATE commercial_case_drawing_extractions/.test(c[0]) && /status = 'error'/.test(c[0]),
        );
        expect(errUpdate).toBeTruthy();
    });

    test('file non trovato su disco: upload già completato, job in error', async () => {
        installQueryMock();
        fs.readFile.mockRejectedValue(new Error('ENOENT'));

        const req = makeReq({ id: '5' }, { doc_role: 'drawing' }, fakeImageFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(201);

        await flushAsync();

        const errUpdate = query.mock.calls.find(
            (c) => /UPDATE commercial_case_drawing_extractions/.test(c[0]) && /status = 'error'/.test(c[0]),
        );
        expect(errUpdate).toBeTruthy();
    });
});

describe('uploadCaseAttachment — multi-tenant scope', () => {
    test('caso di altra org: 404, nessuna estrazione', async () => {
        installQueryMock({ caseRows: [] });

        const req = makeReq({ id: '5' }, { doc_role: 'drawing' }, fakeImageFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(404);
        expect(drawingSvc.extractFromFile).not.toHaveBeenCalled();

        await flushAsync();
        expect(drawingSvc.extractFromFile).not.toHaveBeenCalled();
    });
});

describe('uploadCaseAttachment — ruolo senza estrazione', () => {
    test('ruolo "other": upload 201, nessun job creato', async () => {
        installQueryMock();

        const req = makeReq({ id: '5' }, { doc_role: 'other' }, fakePdfFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(201);
        expect(res.body.analysis_job_id).toBeUndefined();

        await flushAsync();
        expect(drawingSvc.extractFromFile).not.toHaveBeenCalled();
        expect(textSvc.extractTextRequirements).not.toHaveBeenCalled();
    });

    test('rfq non-PDF: upload 201, nessun job creato', async () => {
        installQueryMock();

        const req = makeReq({ id: '5' }, { doc_role: 'rfq' }, fakeImageFile);
        const res = createRes();
        await ctrl.uploadCaseAttachment(req, res);

        expect(res.statusCode).toBe(201);

        await flushAsync();
        expect(drawingSvc.extractFromFile).not.toHaveBeenCalled();
        expect(textSvc.extractTextRequirements).not.toHaveBeenCalled();
    });
});
