/**
 * @jest-environment node
 *
 * A2: validazione di certificate_file_url in create / update / rinnovo / upload certificato.
 */

jest.mock('../config/database', () => ({ query: jest.fn(), getPool: jest.fn() }));
jest.mock('../utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() }));
jest.mock('../services/companyAccess.service', () => ({
    ensureCompanyAccessLoaded: jest.fn().mockResolvedValue([]),
    companyAccessSqlFilter: jest.fn().mockReturnValue({ clause: '', params: {} }),
    assertMutatingAllowed: jest.fn().mockResolvedValue(null),
    assertCompanyRead: jest.fn().mockResolvedValue(null),
    hasCompanyAccessRows: jest.fn().mockReturnValue(false),
    sendAccessDenied: jest.fn((res, denied) => res.status(denied.status).json(denied.body)),
}));
jest.mock('../services/qualificationIngest.service', () => ({ extractQualificationFromPdf: jest.fn() }));
jest.mock('../services/ingestStaging.service', () => ({ createStagingRecord: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { getPool, query } = require('../config/database');
const {
    createQualification,
    updateQualification,
    renewQualification,
    uploadCertificate,
} = require('./qualifications.controller');

const ORG = 10;
const VALID_URL = '/uploads/qualifications/qual_1_cert.pdf';
const prevUploadDir = process.env.UPLOAD_DIR;
let root;

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-a2-ctrl-'));
    process.env.UPLOAD_DIR = root;
    fs.mkdirSync(path.join(root, 'qualifications'), { recursive: true });
    fs.mkdirSync(path.join(root, 'imports', '99', '1'), { recursive: true });
    fs.writeFileSync(path.join(root, 'qualifications', 'qual_1_cert.pdf'), '%PDF');
    fs.writeFileSync(path.join(root, 'imports', '99', '1', 'altrui.pdf'), '%PDF');
});

afterAll(() => {
    if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prevUploadDir;
    fs.rmSync(root, { recursive: true, force: true });
});

function makeRes() {
    return { status: jest.fn().mockReturnThis(), json: jest.fn() };
}

function expectValidationError(res) {
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/certificato/);
    return body;
}

beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
});

describe('createQualification — certificate_file_url', () => {
    function makePool() {
        const req = { input: jest.fn().mockReturnThis() };
        req.query = jest.fn().mockResolvedValue({ recordset: [{ id: 900 }] });
        return { pool: { request: jest.fn(() => req) }, req };
    }
    const base = { person_name: 'Test Fittizio', qualification_type: 'Saldatore ISO 9606-1' };

    it('percorso valido: salvato com\'e', async () => {
        const { pool, req } = makePool();
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await createQualification({ body: { ...base, certificate_file_url: VALID_URL }, user: { organization_id: ORG, user_id: 1 } }, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(req.input).toHaveBeenCalledWith('certFileUrl', VALID_URL);
    });

    it.each([[undefined], [null], ['']])('%j: consentito, salva NULL', async (v) => {
        const { pool, req } = makePool();
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await createQualification({ body: { ...base, certificate_file_url: v }, user: { organization_id: ORG, user_id: 1 } }, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(req.input).toHaveBeenCalledWith('certFileUrl', null);
    });

    it.each([
        ['../../etc/passwd'],
        ['/uploads/qualifications/../../etc/passwd'],
        ['/uploads/qualifications/%2e%2e/x.pdf'],
        ['https://evil.test/x.pdf'],
        ['//evil.test/x.pdf'],
        ['javascript:alert(1)'],
        ['/uploads/imports/99/1/altrui.pdf'],
    ])('rifiuta %s con 400 VALIDATION_ERROR, nessun INSERT e nessun echo del percorso', async (bad) => {
        const { pool, req } = makePool();
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await createQualification({ body: { ...base, certificate_file_url: bad }, user: { organization_id: ORG, user_id: 1 } }, res);
        const body = expectValidationError(res);
        expect(JSON.stringify(body)).not.toContain(bad);
        expect(req.query).not.toHaveBeenCalled();
    });

    it('cross-tenant: file piatto gia\' usato da un\'altra organizzazione -> 400', async () => {
        const { pool, req } = makePool();
        getPool.mockResolvedValue(pool);
        query.mockResolvedValue({ recordset: [{ hit: 1 }] });
        const res = makeRes();
        await createQualification({ body: { ...base, certificate_file_url: VALID_URL }, user: { organization_id: ORG, user_id: 1 } }, res);
        expectValidationError(res);
        expect(req.query).not.toHaveBeenCalled();
    });
});

describe('updateQualification — certificate_file_url', () => {
    const LEGACY_ANOMALOUS = '/uploads/vecchia-cartella/senza-struttura.pdf';

    function makePool(existing) {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [existing] }) };
        const updateReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
        let n = 0;
        return { pool: { request: jest.fn(() => { n += 1; return n === 1 ? checkReq : updateReq; }) }, checkReq, updateReq };
    }
    const body = (extra) => ({ person_name: 'Test Fittizio', qualification_type: 'Saldatore ISO 9606-1', company_id: 20, ...extra });
    const reqOf = (b) => ({ params: { id: '30' }, body: b, user: { organization_id: ORG } });

    it('la SELECT iniziale legge anche il valore corrente', async () => {
        const { pool, checkReq } = makePool({ id: 30, company_id: 20, certificate_file_url: null });
        getPool.mockResolvedValue(pool);
        await updateQualification(reqOf(body({})), makeRes());
        expect(checkReq.query).toHaveBeenCalledWith(expect.stringContaining('certificate_file_url'));
    });

    it('valore INVARIATO (anche legacy anomalo): nessuna rivalidazione, il record resta modificabile', async () => {
        const { pool, updateReq } = makePool({ id: 30, company_id: 20, certificate_file_url: LEGACY_ANOMALOUS });
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await updateQualification(reqOf(body({ certificate_file_url: LEGACY_ANOMALOUS, notes: 'solo note' })), res);
        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ success: true });
        expect(updateReq.input).toHaveBeenCalledWith('certFileUrl', LEGACY_ANOMALOUS);
        expect(query).not.toHaveBeenCalled();
    });

    it('valore CAMBIATO in un percorso valido: accettato e normalizzato', async () => {
        const { pool, updateReq } = makePool({ id: 30, company_id: 20, certificate_file_url: null });
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await updateQualification(reqOf(body({ certificate_file_url: VALID_URL })), res);
        expect(res.json).toHaveBeenCalledWith({ success: true });
        expect(updateReq.input).toHaveBeenCalledWith('certFileUrl', VALID_URL);
    });

    it('rimozione del certificato (stringa vuota / assente): consentita, salva NULL', async () => {
        for (const extra of [{ certificate_file_url: '' }, {}]) {
            const { pool, updateReq } = makePool({ id: 30, company_id: 20, certificate_file_url: VALID_URL });
            getPool.mockResolvedValue(pool);
            const res = makeRes();
            await updateQualification(reqOf(body(extra)), res);
            expect(res.json).toHaveBeenCalledWith({ success: true });
            expect(updateReq.input).toHaveBeenCalledWith('certFileUrl', null);
        }
    });

    it.each([
        ['/uploads/qualifications/../../etc/passwd'],
        ['/uploads/qualifications/%252e%252e/x.pdf'],
        ['http://evil.test/x.pdf'],
        ['data:text/plain,x'],
        ['file:///etc/passwd'],
        ['/uploads/qualifications\\..\\x.pdf'],
        ['/uploads/imports/99/1/altrui.pdf'],
        ['/uploads/qualifications/qual_inesistente.pdf'],
    ])('valore CAMBIATO in %s: 400 VALIDATION_ERROR, nessun UPDATE, nessun echo', async (bad) => {
        const { pool, updateReq } = makePool({ id: 30, company_id: 20, certificate_file_url: VALID_URL });
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await updateQualification(reqOf(body({ certificate_file_url: bad })), res);
        const payload = expectValidationError(res);
        expect(JSON.stringify(payload)).not.toContain(bad);
        expect(updateReq.query).not.toHaveBeenCalled();
    });

    it('cross-tenant: nuovo valore rivendicato da un\'altra organizzazione -> 400', async () => {
        const { pool, updateReq } = makePool({ id: 30, company_id: 20, certificate_file_url: null });
        getPool.mockResolvedValue(pool);
        query.mockResolvedValue({ recordset: [{ hit: 1 }] });
        const res = makeRes();
        await updateQualification(reqOf(body({ certificate_file_url: VALID_URL })), res);
        expectValidationError(res);
        expect(updateReq.query).not.toHaveBeenCalled();
    });
});

describe('renewQualification — certificate_file_url', () => {
    function makePool() {
        const checkReq = {
            input: jest.fn().mockReturnThis(),
            query: jest.fn().mockResolvedValue({ recordset: [{ id: 30, company_id: 20, person_name: 'Test Fittizio', qualification_type: 'Saldatore ISO 9606-1', certificate_file_url: VALID_URL }] }),
        };
        const insReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 31 }] }) };
        let n = 0;
        return { pool: { request: jest.fn(() => { n += 1; return n === 1 ? checkReq : insReq; }) }, insReq };
    }

    it('rifiuta un URL non valido nel rinnovo: nessun INSERT', async () => {
        const { pool, insReq } = makePool();
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await renewQualification({ params: { id: '30' }, body: { certificate_file_url: '/uploads/../x.pdf' }, user: { organization_id: ORG, user_id: 1 } }, res);
        expectValidationError(res);
        expect(insReq.query).not.toHaveBeenCalled();
    });

    it('accetta URL valido o assente (il vecchio URL non viene copiato)', async () => {
        for (const [url, expected] of [[VALID_URL, VALID_URL], [undefined, null]]) {
            const { pool, insReq } = makePool();
            getPool.mockResolvedValue(pool);
            const res = makeRes();
            await renewQualification({ params: { id: '30' }, body: { certificate_file_url: url }, user: { organization_id: ORG, user_id: 1 } }, res);
            expect(res.status).not.toHaveBeenCalledWith(400);
            expect(insReq.input).toHaveBeenCalledWith('certFileUrl', expected);
        }
    });
});

describe('uploadCertificate — percorso generato dal server', () => {
    function makePool() {
        const checkReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [{ id: 30, company_id: 20, certificate_file_url: null }] }) };
        const updReq = { input: jest.fn().mockReturnThis(), query: jest.fn().mockResolvedValue({ recordset: [] }) };
        let n = 0;
        return { pool: { request: jest.fn(() => { n += 1; return n === 1 ? checkReq : updReq; }) }, updReq };
    }

    it('file multer sotto <root>/qualifications: URL salvato nella forma attesa', async () => {
        const { pool, updReq } = makePool();
        getPool.mockResolvedValue(pool);
        const res = makeRes();
        await uploadCertificate({
            params: { id: '30' }, user: { organization_id: ORG },
            file: { path: path.join(root, 'qualifications', 'qual_1_cert.pdf') },
        }, res);
        expect(updReq.input).toHaveBeenCalledWith('url', VALID_URL);
        expect(res.json).toHaveBeenCalledWith({ success: true, certificate_file_url: VALID_URL });
    });

    it('file fuori dalla cartella attesa (UPLOAD_DIR incoerente): 400, nessun UPDATE, file rimosso', async () => {
        const { pool, updReq } = makePool();
        getPool.mockResolvedValue(pool);
        const strayDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-a2-stray-'));
        const stray = path.join(strayDir, 'stray.pdf');
        fs.writeFileSync(stray, '%PDF');
        const res = makeRes();
        await uploadCertificate({ params: { id: '30' }, user: { organization_id: ORG }, file: { path: stray } }, res);
        expectValidationError(res);
        expect(updReq.query).not.toHaveBeenCalled();
        expect(fs.existsSync(stray)).toBe(false);
        fs.rmSync(strayDir, { recursive: true, force: true });
    });
});
