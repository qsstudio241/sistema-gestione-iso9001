/**
 * @jest-environment node
 *
 * Privacy log: upload-batch WPQR/WPS, errore di estrazione senza nome file nei log.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/wpqrIngest.service', () => ({ extractWPQRFromPdf: jest.fn() }));
jest.mock('../services/wpsIngest.service', () => ({ extractWPSFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const fs = require('fs');
const logger = require('../utils/logger');
const { redactFileNameForLog } = require('../utils/ingestErrorMessage');
const { extractWPQRFromPdf } = require('../services/wpqrIngest.service');
const { extractWPSFromPdf } = require('../services/wpsIngest.service');
const { uploadWPQRBatch, uploadWPSBatch } = require('./welding.controller');

const FILE_NAME = '99-00000_ZZROSSI ZZMARIO_WPQR.pdf';

function run(handler) {
    const req = {
        body: { company_id: '5' },
        files: [{ originalname: FILE_NAME, path: '/tmp/x.pdf', mimetype: 'application/pdf', size: 10 }],
        user: { organization_id: 1, user_id: 42 },
    };
    const res = {
        body: null,
        status() { return this; },
        json(payload) { this.body = payload; return this; },
    };
    return handler(req, res).then(() => res);
}

describe('welding upload-batch: privacy log', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('pdf'));
        jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {});
    });

    afterEach(() => jest.restoreAllMocks());

    it.each([
        ['[WPQR/batch] Estrazione fallita', uploadWPQRBatch, extractWPQRFromPdf],
        ['[WPS/batch] Estrazione fallita', uploadWPSBatch, extractWPSFromPdf],
    ])('%s: file#hash, nome solo nella risposta API', async (message, handler, extractor) => {
        extractor.mockRejectedValue(new Error('estrazione KO'));
        const res = await run(handler);

        const call = logger.error.mock.calls.find((c) => c[0] === message);
        expect(call[1].file).toBe(redactFileNameForLog(FILE_NAME));
        expect(call[1]).not.toHaveProperty('fileName');
        const logged = ['info', 'warn', 'error'].flatMap((m) => logger[m].mock.calls.map((c) => JSON.stringify(c))).join('\n');
        expect(logged).not.toContain('ZZROSSI');
        expect(logged).not.toContain(FILE_NAME);
        expect(res.body.results[0]).toEqual(expect.objectContaining({ fileName: FILE_NAME, status: 'error' }));
    });
});
