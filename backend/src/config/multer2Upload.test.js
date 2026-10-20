'use strict';

/**
 * Upload con multer 2: i limiti già scritti nel codice restano, il PDF passa,
 * il tipo vietato e il file oltre il tetto vengono rifiutati.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const request = require('supertest');

const uploadRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-multer2-'));
process.env.UPLOAD_DIR = uploadRoot;

const mockUploadOk = (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    res.status(200).json({
        count: files.length,
        sizes: files.map((f) => f.size),
        names: files.map((f) => f.originalname),
    });
};

jest.mock('../middleware/auth.middleware', () => ({
    authenticate: (req, _res, next) => {
        req.user = { id: 1, organization_id: 1005, role: 'admin' };
        next();
    },
    authenticateDownload: (_req, _res, next) => next(),
    authorize: () => (_req, _res, next) => next(),
}));

jest.mock('../middleware/moduleLicense.middleware', () => ({
    useModuleLicense: () => {},
    requireLicensedModule: () => (_req, _res, next) => next(),
    requireMaterialComplianceCapability: () => (_req, _res, next) => next(),
}));

jest.mock('../middleware/aiAuditTrail.middleware', () => ({
    logAiInteraction: () => (_req, _res, next) => next(),
}));

jest.mock('../services/normChunker.service', () => ({ reindexAll: jest.fn() }));

jest.mock('../controllers/qualifications.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/qualificationVerify.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/welding.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/attachment.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/docfile.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/materialCertificates.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/contractReview.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/normUpload.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/aiChat.controller', () => new Proxy({}, { get: () => mockUploadOk }));
jest.mock('../controllers/figureKnowledge.controller', () => new Proxy({}, { get: () => mockUploadOk }));

function fileSizeExprs(relFromSrc) {
    const src = fs.readFileSync(path.join(__dirname, '..', relFromSrc), 'utf8');
    return [...src.matchAll(/fileSize:\s*([^,\n}]+)/g)].map((m) => m[1].trim());
}

function mount(router) {
    const app = express();
    app.use(router);
    app.use((err, _req, res, _next) => {
        res.status(400).json({ code: err.code || null, message: err.message });
    });
    return app;
}

const pdf = Buffer.from('%PDF-1.4\n% prova\n');

describe('limiti di upload invariati', () => {
    it('i tetti in byte restano quelli già presenti', () => {
        expect(fileSizeExprs('config/multer.js')).toEqual([
            '10 * 1024 * 1024',
            '5 * 1024 * 1024',
            '200 * 1024 * 1024',
        ]);
        expect(fileSizeExprs('routes/qualifications.routes.js')).toEqual([
            '50 * 1024 * 1024',
            '50 * 1024 * 1024',
        ]);
        expect(fileSizeExprs('routes/welding.routes.js')).toEqual([
            '50 * 1024 * 1024',
            '8 * 1024 * 1024',
            '50 * 1024 * 1024',
        ]);
        expect(fileSizeExprs('routes/materialCertificates.routes.js')).toEqual(['50 * 1024 * 1024']);
        expect(fileSizeExprs('routes/normUpload.routes.js')).toEqual(['200 * 1024 * 1024']);
        expect(fileSizeExprs('routes/importJobs.routes.js')).toEqual(['200 * 1024 * 1024']);
        expect(fileSizeExprs('controllers/document.controller.js')).toEqual(['200 * 1024 * 1024']);
        expect(fileSizeExprs('routes/aiChat.routes.js')).toEqual(['4 * 1024 * 1024']);
        expect(fileSizeExprs('routes/company.routes.js')).toEqual([
            '2 * 1024 * 1024',
            '5 * 1024 * 1024',
        ]);
        expect(fileSizeExprs('routes/organization.routes.js')).toEqual(['2 * 1024 * 1024']);
        expect(fileSizeExprs('routes/risks.routes.js')).toEqual(['5 * 1024 * 1024']);

        const qual = fs.readFileSync(path.join(__dirname, '../routes/qualifications.routes.js'), 'utf8');
        const weld = fs.readFileSync(path.join(__dirname, '../routes/welding.routes.js'), 'utf8');
        const imp = fs.readFileSync(path.join(__dirname, '../routes/importJobs.routes.js'), 'utf8');
        expect(qual).toContain("batchUpload.array('files', 50)");
        expect(qual).toContain('files: 50');
        expect(weld).toContain("upload.array('files', 20)");
        expect(weld).toContain("uploadWps.array('files', 20)");
        expect(imp).toContain('MAX_IMPORT_JOB_FILES = 80');
    });
});

describe('upload PDF con multer 2', () => {
    let qual;
    let weld;
    let attachments;
    let docfile;
    let materials;
    let contract;
    let norms;
    let ai;

    beforeAll(() => {
        qual = mount(require('../routes/qualifications.routes'));
        weld = mount(require('../routes/welding.routes'));
        attachments = mount(require('../routes/attachment.routes'));
        docfile = mount(require('../routes/docfile.routes'));
        materials = mount(require('../routes/materialCertificates.routes'));
        contract = mount(require('../routes/contractReview.routes'));
        norms = mount(require('../routes/normUpload.routes'));
        ai = mount(require('../routes/aiChat.routes'));
    });

    afterAll(() => {
        fs.rmSync(uploadRoot, { recursive: true, force: true });
    });

    it('qualifiche: il PDF entra, l\'eseguibile no, oltre 50 MB no', async () => {
        const ok = await request(qual)
            .post('/qualifications/upload-batch')
            .attach('files', pdf, 'certificato_prova.pdf');
        expect(ok.status).toBe(200);
        expect(ok.body.count).toBe(1);
        expect(ok.body.names[0]).toBe('certificato_prova.pdf');

        const bad = await request(qual)
            .post('/qualifications/upload-batch')
            .attach('files', Buffer.from('MZ'), 'virus.exe');
        expect(bad.status).toBe(400);
        expect(bad.body.error).toMatch(/Solo PDF o immagini/);

        const huge = await request(qual)
            .post('/qualifications/upload-batch')
            .attach('files', Buffer.alloc(50 * 1024 * 1024 + 1), 'grande.pdf');
        expect(huge.status).toBe(400);
        expect(huge.body.error).toMatch(/too large|troppo grande/i);
    }, 30000);

    it('certificato singolo: campo certificate', async () => {
        const ok = await request(qual)
            .post('/qualifications/7/certificate')
            .attach('certificate', pdf, 'patentino.pdf');
        expect(ok.status).toBe(200);
        expect(ok.body.names[0]).toBe('patentino.pdf');
    });

    it('WPQR e WPS: PDF accettato, tipo rifiutato, errore multer non butta giù il processo', async () => {
        const wpqr = await request(weld)
            .post('/welding/wpqr/upload-batch')
            .attach('files', pdf, 'wpqr_prova.pdf');
        expect(wpqr.status).toBe(200);
        expect(wpqr.body.count).toBe(1);

        const wps = await request(weld)
            .post('/welding/wps/upload-batch')
            .attach('files', pdf, 'wps_prova.pdf');
        expect(wps.status).toBe(200);

        const bad = await request(weld)
            .post('/welding/wpqr/upload-batch')
            .attach('files', Buffer.from('no'), 'note.txt');
        expect(bad.status).toBe(400);
        expect(bad.body.message).toMatch(/Solo PDF o immagini/);
    });

    it('allegati (anche verbali e commesse): PDF sotto 10 MB, oltre il tetto 413, eseguibile 415', async () => {
        const ok = await request(attachments)
            .post('/attachments/upload')
            .attach('file', pdf, 'allegato.pdf');
        expect(ok.status).toBe(200);
        expect(ok.body.names[0]).toBe('allegato.pdf');

        const huge = await request(attachments)
            .post('/attachments/upload')
            .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.pdf');
        expect(huge.status).toBe(413);
        expect(huge.body.code).toBe('FILE_TOO_LARGE');

        const exe = await request(attachments)
            .post('/attachments/upload')
            .attach('file', Buffer.from('MZ'), 'a.exe');
        expect(exe.status).toBe(415);
        expect(exe.body.error).toMatch(/non supportato/i);
    }, 20000);

    it('riesame commessa: stesso tetto 10 MB e stesso filtro', async () => {
        const ok = await request(contract)
            .post('/contract-reviews/3/attachments/upload')
            .attach('file', pdf, 'capitolato.pdf');
        expect(ok.status).toBe(200);

        const huge = await request(contract)
            .post('/contract-reviews/3/attachments/upload')
            .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.pdf');
        expect(huge.status).toBe(413);
        expect(huge.body.code).toBe('FILE_TOO_LARGE');
    }, 20000);

    it('registro documenti: il PDF passa, l\'eseguibile no', async () => {
        const ok = await request(docfile)
            .post('/documents/9/file')
            .attach('file', pdf, 'verbale.pdf');
        expect(ok.status).toBe(200);

        const exe = await request(docfile)
            .post('/documents/9/file')
            .attach('file', Buffer.from('MZ'), 'a.exe');
        expect(exe.status).toBe(415);
        expect(exe.body.code).toBe('UNSUPPORTED_MEDIA_TYPE');
    });

    it('certificati materiale e norme: solo PDF', async () => {
        const ok = await request(materials)
            .post('/material-certificates')
            .attach('file', pdf, '3_1.pdf');
        expect(ok.status).toBe(200);

        const png = await request(materials)
            .post('/material-certificates')
            .attach('file', Buffer.from('png'), 'foto.png');
        expect(png.status).toBe(400);
        expect(png.body.error).toMatch(/Solo file PDF/);

        const norm = await request(norms)
            .post('/documents/norms/upload')
            .attach('files', pdf, 'norma.pdf');
        expect(norm.status).toBe(200);

        const badNorm = await request(norms)
            .post('/documents/norms/upload')
            .attach('files', Buffer.from('x'), 'norma.docx');
        expect(badNorm.status).toBe(400);
        expect(badNorm.body.message).toMatch(/Solo file PDF/);
    });

    it('immagine AI: il PNG passa, il PDF no, senza alzare il tetto da 4 MB', async () => {
        const ok = await request(ai)
            .post('/ai/figures/search-by-image')
            .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), 'ritaglio.png');
        expect(ok.status).toBe(200);

        const pdfNo = await request(ai)
            .post('/ai/figures/search-by-image')
            .attach('file', pdf, 'ritaglio.pdf');
        expect(pdfNo.status).toBe(400);
        expect(pdfNo.body.code).toBe('INVALID_FILE');
    });
});
