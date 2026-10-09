/**
 * @jest-environment node
 *
 * Privacy log: pre-extract non scrive il nome file nei log (resta solo nella risposta, se serve).
 */

jest.mock('multer', () => {
    const multer = jest.fn(() => ({ single: () => (_req, _res, cb) => cb(null) }));
    multer.memoryStorage = jest.fn();
    multer.diskStorage = jest.fn();
    return multer;
});
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    sendAccessDenied: jest.fn(),
}));
jest.mock('../utils/importPdfText', () => ({
    extractPdfText: jest.fn().mockResolvedValue('Testo del certificato abbastanza lungo per l\'estrazione AI'),
    confidenceFromTextLength: jest.fn(() => 70),
}));
jest.mock('../services/importAiExtraction.service', () => ({
    extractStructuredByDocType: jest.fn().mockResolvedValue({
        model: 'test-model',
        data: { title: 'Titolo', type_specific_data: { codice: 'X1' }, extraction_confidence: 80 },
    }),
}));

const logger = require('../utils/logger');
const { redactFileNameForLog } = require('../utils/ingestErrorMessage');
const { preExtractMetadata } = require('./document.controller');

const FILE_NAME = '99-00000_ZZROSSI ZZMARIO_14732_X.pdf';

describe('preExtractMetadata: privacy log', () => {
    afterEach(() => jest.clearAllMocks());

    it('pre-extract completato: file#hash e nessun nome nei log; risposta invariata', async () => {
        const req = {
            file: { originalname: FILE_NAME, mimetype: 'application/pdf', buffer: Buffer.from('%PDF') },
            body: { doc_type: 'procedura' },
            user: { organization_id: 1, user_id: 2 },
        };
        const res = { statusCode: 200, body: null, headersSent: false };
        res.status = jest.fn((c) => { res.statusCode = c; return res; });
        res.json = jest.fn((b) => { res.body = b; return res; });

        await preExtractMetadata(req, res);

        const call = logger.info.mock.calls.find((c) => c[0] === 'pre-extract completato');
        expect(call[1].file).toBe(redactFileNameForLog(FILE_NAME));
        expect(call[1]).not.toHaveProperty('filename');
        const logged = ['info', 'warn', 'error'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n');
        expect(logged).not.toContain('ZZROSSI');
        expect(logged).not.toContain(FILE_NAME);
        expect(res.body.metadata).toEqual(expect.objectContaining({ titolo: 'Titolo', codice: 'X1' }));
    });
});
