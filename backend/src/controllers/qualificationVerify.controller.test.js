/**
 * @jest-environment node
 *
 * Test L1 — qualificationVerify.controller (VQ-7): POST /qualifications/verify.
 * Copre validazione input (400), scope organizzazione (403), contratto di risposta
 * compatibile con QualificationVerifyPanel, assenza di scritture e cablaggio route.
 */

jest.mock('../utils/logger', () => ({
    info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(),
}));

jest.mock('../config/database', () => ({
    getPool: jest.fn(() => { throw new Error('il verificatore non deve accedere al DB'); }),
}));

jest.mock('../middleware/auth.middleware', () => ({
    authenticate: (req, res, next) => {
        if (req.headers['x-test-user'] === 'none') return res.status(401).json({ error: 'Non autenticato' });
        req.user = req.headers['x-test-user'] === 'no-org'
            ? { user_id: 1, role: 'user' }
            : { user_id: 1, organization_id: 10, role: req.headers['x-test-role'] || 'user' };
        return next();
    },
}));

jest.mock('../middleware/moduleLicense.middleware', () => ({
    requireLicensedModule: () => (req, res, next) => next(),
}));

jest.mock('./qualifications.controller', () => new Proxy({}, {
    get: () => (req, res) => res.status(204).end(),
}));

const express = require('express');
const request = require('supertest');
const logger = require('../utils/logger');
const qualificationVerify = require('../services/qualificationVerify');
const { validateFinding } = require('../services/qualificationVerify');
const { parseVerifyBody, verifyQualificationFields } = require('./qualificationVerify.controller');

function makeRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

const VALID_BODY = {
    fields: {
        welding_process: '135',
        joint_type: 'BW',
        product_type: 'P',
        standard_reference: 'ISO 9606-1:2017',
        welding_positions: ['PA', 'PC'],
        thickness_max_mm: 12,
    },
    qualification_type: 'Saldatore ISO 9606-1',
};

describe('parseVerifyBody', () => {
    it.each([
        ['body assente', undefined],
        ['body null', null],
        ['body array', []],
        ['body stringa', 'x'],
        ['body vuoto', {}],
        ['fields mancante', { qualification_type: 'Saldatore ISO 9606-1' }],
        ['fields stringa', { fields: 'abc' }],
        ['fields array', { fields: [1, 2] }],
        ['fields null', { fields: null }],
        ['fields vuoto', { fields: {} }],
    ])('rifiuta %s', (_label, body) => {
        expect(parseVerifyBody(body).ok).toBe(false);
    });

    it('rifiuta troppe chiavi', () => {
        const fields = {};
        for (let i = 0; i < 201; i += 1) fields[`k${i}`] = 1;
        expect(parseVerifyBody({ fields }).ok).toBe(false);
    });

    it('rifiuta stringhe enormi, oggetti annidati, array non scalari, numeri non finiti', () => {
        expect(parseVerifyBody({ fields: { notes: 'x'.repeat(5001) } }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: { b: 1 } } }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: [{ b: 1 }] } }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: new Array(51).fill('x') } }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: Number.POSITIVE_INFINITY } }).ok).toBe(false);
    });

    it('rifiuta qualification_type di tipo errato o troppo lungo', () => {
        expect(parseVerifyBody({ fields: { a: 1 }, qualification_type: 42 }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: 1 }, qualification_type: { x: 1 } }).ok).toBe(false);
        expect(parseVerifyBody({ fields: { a: 1 }, qualification_type: 'x'.repeat(201) }).ok).toBe(false);
    });

    it('accetta il body del pannello e fonde qualification_type nei campi', () => {
        const parsed = parseVerifyBody(VALID_BODY);
        expect(parsed.ok).toBe(true);
        expect(parsed.input.qualification_type).toBe('Saldatore ISO 9606-1');
        expect(parsed.input.welding_positions).toEqual(['PA', 'PC']);
    });

    it('qualification_type assente/null/vuoto non è un errore', () => {
        expect(parseVerifyBody({ fields: { a: 1 } }).ok).toBe(true);
        expect(parseVerifyBody({ fields: { a: 1 }, qualification_type: null }).ok).toBe(true);
        const blank = parseVerifyBody({ fields: { a: 1, qualification_type: 'X' }, qualification_type: '  ' });
        expect(blank.input.qualification_type).toBe('X');
    });

    it('scarta chiavi pericolose (prototype pollution)', () => {
        const fields = JSON.parse('{"__proto__": 1, "constructor": 2, "welding_process": "135"}');
        const parsed = parseVerifyBody({ fields });
        expect(parsed.ok).toBe(true);
        expect(Object.keys(parsed.input)).toEqual(['welding_process']);
        expect({}.polluted).toBeUndefined();
    });
});

describe('verifyQualificationFields (handler)', () => {
    afterEach(() => jest.restoreAllMocks());

    it('400 con body non valido, senza chiamare l\'engine', async () => {
        const spy = jest.spyOn(qualificationVerify, 'verifyQualification');
        const res = makeRes();
        await verifyQualificationFields({ user: { organization_id: 10 }, body: {} }, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ error: expect.any(String) });
        expect(spy).not.toHaveBeenCalled();
    });

    it('403 senza utente o senza organization_id', async () => {
        const res1 = makeRes();
        await verifyQualificationFields({ body: VALID_BODY }, res1);
        expect(res1.status).toHaveBeenCalledWith(403);

        const res2 = makeRes();
        await verifyQualificationFields({ user: { user_id: 1 }, body: VALID_BODY }, res2);
        expect(res2.status).toHaveBeenCalledWith(403);
    });

    it('200 { verification } con VerifyResult del contratto e finding validi', async () => {
        const res = makeRes();
        await verifyQualificationFields({ user: { organization_id: 10 }, body: VALID_BODY }, res);

        expect(res.status).not.toHaveBeenCalled();
        const { verification } = res.json.mock.calls[0][0];
        expect(verification).toEqual(expect.objectContaining({
            profile: '9606-1:BW',
            standard: { family: '9606-1', edition: '2017' },
            findings: expect.any(Array),
            summary: expect.objectContaining({
                warn: expect.any(Number), info: expect.any(Number),
                verificabili: expect.any(Number), non_verificabili: expect.any(Number),
            }),
            engine_version: expect.any(String),
            mode: 'review',
        }));
        for (const f of verification.findings) expect(validateFinding(f).ok).toBe(true);
    });

    it('norma non coperta: 200 con un solo finding non_verificabile_fonte_mancante (panel-compatibile)', async () => {
        const res = makeRes();
        await verifyQualificationFields({
            user: { organization_id: 10 },
            body: { fields: { standard_reference: 'EN 287-1' }, qualification_type: 'Saldatore EN 287-1' },
        }, res);

        const { verification } = res.json.mock.calls[0][0];
        expect(verification.profile).toBeNull();
        expect(verification.findings).toHaveLength(1);
        expect(verification.findings[0]).toEqual(expect.objectContaining({
            status: 'non_verificabile_fonte_mancante',
            severity: 'info',
            message_it: expect.any(String),
            source: expect.objectContaining({ text_status: 'assente' }),
        }));
        expect(verification.summary.non_verificabili).toBe(1);
    });

    it('i finding hanno le chiavi che il pannello legge (severity, status, message_it, read/expected, source, direction)', async () => {
        jest.spyOn(qualificationVerify, 'verifyQualification').mockReturnValue({
            profile: '9606-1:BW',
            standard: { family: '9606-1', edition: '2017' },
            findings: [{
                code: 'WQ9606_1.CORR.THK_BW', family: 'correttezza', severity: 'warn', status: 'verificabile',
                field: 'thickness_max_mm', fields: ['thickness_max_mm'], direction: 'over_claim',
                read_value: 20, expected_value: 12,
                source: { norm: 'ISO 9606-1', edition: '2017', clause: '§5.7 Tab. 6', text_status: 'md_integrale', ref: 'r' },
                message_it: 'Spessore oltre la norma (§5.7 Tab. 6).',
            }],
            summary: { warn: 1, info: 0, verificabili: 1, non_verificabili: 0 },
            engine_version: '1.0.0', mode: 'review',
        });
        const res = makeRes();
        await verifyQualificationFields({ user: { organization_id: 10 }, body: VALID_BODY }, res);

        const [f] = res.json.mock.calls[0][0].verification.findings;
        for (const key of ['code', 'severity', 'status', 'message_it', 'read_value', 'expected_value', 'source', 'direction']) {
            expect(f).toHaveProperty(key);
        }
        expect(f.source).toEqual(expect.objectContaining({ norm: 'ISO 9606-1', edition: '2017', clause: expect.any(String) }));
    });

    it('500 generico (senza dettagli interni) se l\'engine lancia; logga l\'errore', async () => {
        jest.spyOn(qualificationVerify, 'verifyQualification').mockImplementation(() => {
            throw new Error('segreto interno');
        });
        const res = makeRes();
        await verifyQualificationFields({ user: { organization_id: 10 }, body: VALID_BODY }, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('segreto interno');
        expect(logger.error).toHaveBeenCalled();
    });

    it('non accede mai al DB (nessuna scrittura)', async () => {
        const { getPool } = require('../config/database');
        const res = makeRes();
        await verifyQualificationFields({ user: { organization_id: 10 }, body: VALID_BODY }, res);
        expect(getPool).not.toHaveBeenCalled();
    });
});

describe('POST /qualifications/verify (cablaggio route)', () => {
    let app;
    beforeAll(() => {
        app = express();
        app.use(express.json({ limit: '50mb' }));
        app.use('/api/v1', require('../routes/qualifications.routes'));
    });

    it('è registrata prima delle rotte :id (non cade nel router :id)', () => {
        const router = require('../routes/qualifications.routes');
        const layers = router.stack.filter((l) => l.route);
        const idx = (method, p) => layers.findIndex((l) => l.route.path === p && l.route.methods[method]);
        const verifyIdx = idx('post', '/qualifications/verify');
        expect(verifyIdx).toBeGreaterThanOrEqual(0);
        const firstIdRoute = layers.findIndex((l) => l.route.path.startsWith('/qualifications/:id'));
        expect(verifyIdx).toBeLessThan(firstIdRoute);
    });

    it('200 con utente autenticato della sua organizzazione', async () => {
        const res = await request(app).post('/api/v1/qualifications/verify').send(VALID_BODY);
        expect(res.status).toBe(200);
        expect(res.body.verification.engine_version).toEqual(expect.any(String));
        expect(Array.isArray(res.body.verification.findings)).toBe(true);
    });

    it('401 senza autenticazione (middleware auth del router)', async () => {
        const res = await request(app)
            .post('/api/v1/qualifications/verify')
            .set('x-test-user', 'none')
            .send(VALID_BODY);
        expect(res.status).toBe(401);
    });

    it('403 se l\'utente non ha un\'organizzazione', async () => {
        const res = await request(app)
            .post('/api/v1/qualifications/verify')
            .set('x-test-user', 'no-org')
            .send(VALID_BODY);
        expect(res.status).toBe(403);
    });

    it('400 con body vuoto o tipo errato', async () => {
        const empty = await request(app).post('/api/v1/qualifications/verify').send({});
        expect(empty.status).toBe(400);
        const wrong = await request(app).post('/api/v1/qualifications/verify').send({ fields: 'x' });
        expect(wrong.status).toBe(400);
        const wrongType = await request(app)
            .post('/api/v1/qualifications/verify')
            .send({ fields: { a: 1 }, qualification_type: 5 });
        expect(wrongType.status).toBe(400);
    });

    it('400 con body enorme (valore oltre il limite)', async () => {
        const res = await request(app)
            .post('/api/v1/qualifications/verify')
            .send({ fields: { notes: 'x'.repeat(200000) } });
        expect(res.status).toBe(400);
    });
});
