/**
 * Integration — GET /api/v1/files/content (file di /uploads solo ad utenti autenticati)
 *
 * DB mockato con fixture in memoria; filesystem reale in una cartella temporanea.
 * Verifica: 401 senza token, scope organizzazione/azienda, path traversal
 * (varianti codificate, symlink), file non referenziato, header sicuri e che il
 * vecchio `/uploads/...` pubblico non serva più nulla.
 *
 * @jest-environment node
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-files-'));
const UPLOAD_ROOT = path.join(SANDBOX, 'uploads');
const OUTSIDE_SECRET = path.join(SANDBOX, 'secret.txt');
const SECRET_MARKER = 'SEGRETO-FUORI-ROOT';
const PDF_BYTES = Buffer.from('%PDF-1.4\n% fixture certificato\n%%EOF\n');

process.env.JWT_SECRET = 'test-secret-almeno-32-caratteri-ok';
process.env.NODE_ENV = 'test';
process.env.RATE_LIMIT_DISABLED = 'true';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.CORS_CREDENTIALS = 'true';
process.env.API_BASE_PATH = '/api/v1';
process.env.UPLOAD_DIR = UPLOAD_ROOT;

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    getPool: jest.fn(),
    healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
    closePool: jest.fn(),
}));

jest.mock('../../services/alertScheduler', () => ({
    startAlertScheduler: jest.fn(),
}));

jest.mock('../../services/moduleLicense.service', () => {
    const actual = jest.requireActual('../../services/moduleLicense.service');
    return {
        ...actual,
        getLicensedModuleKeysForOrg: jest.fn(),
        hasMaterialComplianceCapability: jest.fn(),
    };
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const { query } = require('../../config/database');
const moduleLicense = require('../../services/moduleLicense.service');

const API = '/api/v1';
const ORG_A = 100;
const ORG_B = 200;

const QUAL_URL = '/uploads/qualifications/qual_1700000000000_cert.pdf';
const SHARED_URL = '/uploads/qualifications/qual_1700000000001_shared.pdf';
const WPQR_URL = '/uploads/wpqr/wpqr_1700000000002.pdf';
const ORPHAN_URL = '/uploads/qualifications/qual_1700000000003_orfano.pdf';
const ODD_URL = '/uploads/qualifications/qual_1700000000004_scan.bin';
const MAT_URL = `/uploads/material-certificates/${ORG_A}/1700000000005_mat.pdf`;
const MAT_OTHER_ORG_URL = `/uploads/material-certificates/${ORG_B}/1700000000006_mat.pdf`;
const LINK_URL = '/uploads/qualifications/qual_link.pdf';

let qualifications;
let wpqrRecords;
let materials;
let companyAccess;

function write(rel, bytes = PDF_BYTES) {
    const full = path.join(UPLOAD_ROOT, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, bytes);
}

function token(overrides = {}) {
    return jwt.sign(
        {
            user_id: overrides.user_id ?? 1,
            email: 'utente@example.test',
            role: overrides.role ?? 'auditor',
            organization_id: overrides.organization_id ?? ORG_A,
            auditor_org_id: null,
        },
        process.env.JWT_SECRET,
        { expiresIn: '1h' },
    );
}

function get(pathValue, tok = token()) {
    const req = request(app).get(`${API}/files/content`).query({ path: pathValue });
    return tok ? req.set('Authorization', `Bearer ${tok}`) : req;
}

function rowsFor(list, sqlParams) {
    return list.filter((r) => r.organization_id === sqlParams.organizationId
        && r.certificate_file_url === sqlParams.url);
}

beforeAll(() => {
    fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
    fs.writeFileSync(OUTSIDE_SECRET, SECRET_MARKER);
    write('qualifications/qual_1700000000000_cert.pdf');
    write('qualifications/qual_1700000000001_shared.pdf');
    write('qualifications/qual_1700000000003_orfano.pdf');
    write('qualifications/qual_1700000000004_scan.bin', Buffer.from('BINARIO'));
    write('wpqr/wpqr_1700000000002.pdf');
    write(`material-certificates/${ORG_A}/1700000000005_mat.pdf`);
    write(`material-certificates/${ORG_B}/1700000000006_mat.pdf`);
    fs.symlinkSync(OUTSIDE_SECRET, path.join(UPLOAD_ROOT, 'qualifications', 'qual_link.pdf'));
});

afterAll(() => {
    fs.rmSync(SANDBOX, { recursive: true, force: true });
});

beforeEach(() => {
    jest.clearAllMocks();
    qualifications = [
        { id: 11, organization_id: ORG_A, company_id: 10, certificate_file_url: QUAL_URL },
        { id: 12, organization_id: ORG_A, company_id: 10, certificate_file_url: SHARED_URL },
        { id: 13, organization_id: ORG_B, company_id: 90, certificate_file_url: SHARED_URL },
        { id: 14, organization_id: ORG_A, company_id: null, certificate_file_url: ODD_URL },
        { id: 15, organization_id: ORG_A, company_id: 10, certificate_file_url: LINK_URL },
    ];
    wpqrRecords = [
        { id: 21, organization_id: ORG_A, company_id: 10, certificate_file_url: WPQR_URL },
    ];
    materials = [
        { id: 31, organization_id: ORG_A, company_id: 10, storage_path: path.join(UPLOAD_ROOT, 'material-certificates', String(ORG_A), '1700000000005_mat.pdf') },
        { id: 32, organization_id: ORG_B, company_id: 90, storage_path: path.join(UPLOAD_ROOT, 'material-certificates', String(ORG_B), '1700000000006_mat.pdf') },
    ];
    companyAccess = {};

    moduleLicense.getLicensedModuleKeysForOrg.mockResolvedValue(['qualifiche', 'saldatura']);
    moduleLicense.hasMaterialComplianceCapability.mockResolvedValue(true);

    query.mockImplementation(async (sql, params = {}) => {
        if (sql.includes('user_company_access')) {
            return { recordset: companyAccess[params.user_id] || [] };
        }
        if (sql.includes('UNION ALL')) {
            const hit = [...qualifications, ...wpqrRecords].some(
                (r) => r.organization_id !== params.organizationId && r.certificate_file_url === params.url,
            );
            return { recordset: hit ? [{ hit: 1 }] : [] };
        }
        if (sql.includes('FROM qualifications')) return { recordset: rowsFor(qualifications, params) };
        if (sql.includes('FROM wpqr_records')) return { recordset: rowsFor(wpqrRecords, params) };
        if (sql.includes('FROM welding_procedures')) return { recordset: [] };
        if (sql.includes('FROM material_certificates')) {
            const needle = String(params.tail).replace(/^%/, '').replace(/\\(.)/g, '$1');
            return {
                recordset: materials.filter((m) => m.organization_id === params.organizationId
                    && m.storage_path.endsWith(needle)),
            };
        }
        throw new Error(`query inattesa: ${sql.slice(0, 80)}`);
    });
});

describe('autenticazione', () => {
    it('401 senza token', async () => {
        const res = await get(QUAL_URL, null);
        expect(res.status).toBe(401);
        expect(res.body).not.toHaveProperty('success', true);
        expect(query).not.toHaveBeenCalled();
    });

    it('401 con token manomesso', async () => {
        const res = await get(QUAL_URL, `${token()}x`);
        expect(res.status).toBe(401);
    });

    it('401 con token scaduto', async () => {
        const expired = jwt.sign(
            { user_id: 1, role: 'auditor', organization_id: ORG_A },
            process.env.JWT_SECRET,
            { expiresIn: -10 },
        );
        const res = await get(QUAL_URL, expired);
        expect(res.status).toBe(401);
    });
});

describe('accesso consentito', () => {
    it('200 al proprio PDF con header sicuri e nome file senza PII', async () => {
        const res = await get(QUAL_URL).buffer(true).parse((r, cb) => {
            const chunks = [];
            r.on('data', (c) => chunks.push(c));
            r.on('end', () => cb(null, Buffer.concat(chunks)));
        });
        expect(res.status).toBe(200);
        expect(Buffer.compare(res.body, PDF_BYTES)).toBe(0);
        expect(res.headers['content-type']).toMatch(/^application\/pdf/);
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['cache-control']).toBe('private, no-store');
        expect(res.headers['content-disposition']).toBe('inline; filename="qualifica-11.pdf"');
        expect(res.headers['content-disposition']).not.toMatch(/cert|1700000000000/);
        expect(res.headers).not.toHaveProperty('etag');
    });

    it('serve anche i certificati WPQR con nome tipo+id', async () => {
        const res = await get(WPQR_URL);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toBe('inline; filename="wpqr-21.pdf"');
    });

    it('supporta Range (anteprima PDF mobile)', async () => {
        const res = await get(QUAL_URL).set('Range', 'bytes=0-3');
        expect(res.status).toBe(206);
        expect(res.headers['cache-control']).toBe('private, no-store');
    });

    it('tipi non inline sono sempre scaricati come octet-stream', async () => {
        const res = await get(ODD_URL);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toMatch(/^application\/octet-stream/);
        expect(res.headers['content-disposition']).toBe('attachment; filename="qualifica-14.bin"');
    });

    it('certificati materiale: 200 sulla propria cartella organizzazione', async () => {
        const res = await get(MAT_URL);
        expect(res.status).toBe(200);
        expect(res.headers['content-disposition']).toBe('inline; filename="materiale-31.pdf"');
    });
});

describe('scope organizzazione e azienda', () => {
    it('altro studio: 404 senza leak del contenuto', async () => {
        const res = await get(QUAL_URL, token({ organization_id: ORG_B, user_id: 2 }));
        expect(res.status).toBe(404);
        expect(res.text).not.toContain('%PDF');
        const calls = query.mock.calls.filter(([sql]) => sql.includes('organization_id = @organizationId'));
        expect(calls.every(([, p]) => p.organizationId === ORG_B)).toBe(true);
    });

    it('altro studio non legge i materiali nella cartella del primo (path con org diversa)', async () => {
        const res = await get(MAT_OTHER_ORG_URL);
        expect(res.status).toBe(404);
    });

    it('cartelle con organization_id nel path: org diversa dal token = 404 prima di ogni lookup', async () => {
        const res = await get(`/uploads/imports/${ORG_B}/5/file.pdf`);
        expect(res.status).toBe(404);
        expect(query).not.toHaveBeenCalled();
    });

    it('stesso studio, utente limitato ad altra azienda: 403', async () => {
        companyAccess[7] = [{ company_id: 20, permission: 'read' }];
        const res = await get(QUAL_URL, token({ user_id: 7 }));
        expect(res.status).toBe(403);
        expect(res.text).not.toContain('%PDF');
    });

    it('stesso studio, utente limitato alla stessa azienda: 200', async () => {
        companyAccess[8] = [{ company_id: 10, permission: 'read' }];
        const res = await get(QUAL_URL, token({ user_id: 8 }));
        expect(res.status).toBe(200);
    });

    it('utente limitato per azienda: record senza azienda = 403', async () => {
        companyAccess[9] = [{ company_id: 10, permission: 'read' }];
        const res = await get(ODD_URL, token({ user_id: 9 }));
        expect(res.status).toBe(403);
    });

    it('file referenziato anche da un altro studio: negato a entrambi', async () => {
        const a = await get(SHARED_URL);
        const b = await get(SHARED_URL, token({ organization_id: ORG_B, user_id: 3 }));
        expect(a.status).toBe(404);
        expect(b.status).toBe(404);
    });

    it('modulo non licenziato: 403', async () => {
        moduleLicense.getLicensedModuleKeysForOrg.mockResolvedValue(['nc']);
        const res = await get(QUAL_URL);
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('MODULE_NOT_LICENSED');
    });

    it('admin con elenco scritto senza il modulo: 403 sul file', async () => {
        moduleLicense.getLicensedModuleKeysForOrg.mockResolvedValue(['nc']);
        const res = await get(QUAL_URL, token({ role: 'admin' }));
        expect(res.status).toBe(403);
        expect(res.body.code).toBe('MODULE_NOT_LICENSED');
    });

    it('file presente su disco ma non associato a nessun record: 404', async () => {
        const res = await get(ORPHAN_URL);
        expect(res.status).toBe(404);
    });

    it('file inesistente: 404', async () => {
        const res = await get('/uploads/qualifications/non_esiste.pdf');
        expect(res.status).toBe(404);
    });
});

describe('path traversal e input malevoli', () => {
    const variants = [
        '/uploads/../secret.txt',
        '/uploads/qualifications/../../secret.txt',
        '/uploads/qualifications/%2e%2e/%2e%2e/secret.txt',
        '/uploads/%252e%252e/secret.txt',
        '/uploads/qualifications/..%2fsecret.txt',
        '/uploads/qualifications/..%5csecret.txt',
        '/uploads/qualifications\\..\\..\\secret.txt',
        '/uploads/qualifications/qual_1700000000000_cert.pdf%00.png',
        '/uploads/qualifications/qual_1700000000000_cert.pdf\u0000',
        `/uploads/qualifications/../../${path.basename(OUTSIDE_SECRET)}`,
        OUTSIDE_SECRET,
        '/etc/passwd',
        'uploads/qualifications/qual_1700000000000_cert.pdf',
        '/uploads/',
        '/uploads',
        '/uploads//qualifications/qual_1700000000000_cert.pdf',
        '/uploads/qualifications/',
        '/uploads/qualifications',
        '/uploads/./qualifications/qual_1700000000000_cert.pdf',
        '/uploads/C:/Windows/win.ini',
        '/uploads/.env',
        'https://example.test/uploads/qualifications/qual_1700000000000_cert.pdf',
        '',
    ];

    it.each(variants.map((v) => [JSON.stringify(v), v]))('rifiuta %s senza leggere fuori root', async (_l, variant) => {
        const res = await get(variant);
        expect([400, 404]).toContain(res.status);
        expect(res.text).not.toContain(SECRET_MARKER);
        expect(res.text).not.toContain('%PDF');
    });

    it('parametro path assente o ripetuto/oggetto: 400', async () => {
        const noParam = await request(app).get(`${API}/files/content`).set('Authorization', `Bearer ${token()}`);
        expect(noParam.status).toBe(400);
        const twice = await request(app)
            .get(`${API}/files/content?path=${QUAL_URL}&path=${QUAL_URL}`)
            .set('Authorization', `Bearer ${token()}`);
        expect(twice.status).toBe(400);
        const obj = await request(app)
            .get(`${API}/files/content?path[a]=${QUAL_URL}`)
            .set('Authorization', `Bearer ${token()}`);
        expect(obj.status).toBe(400);
    });

    it('symlink che punta fuori dalla root: 404 anche se il record lo referenzia', async () => {
        const res = await get(LINK_URL);
        expect(res.status).toBe(404);
        expect(res.text).not.toContain(SECRET_MARKER);
    });

    it('nessun listing di directory', async () => {
        const res = await get('/uploads/qualifications');
        expect([400, 404]).toContain(res.status);
        expect(res.text).not.toContain('qual_1700000000000_cert.pdf');
    });
});

describe('vecchi URL pubblici /uploads/*', () => {
    it.each([
        ['senza token', null],
        ['con token valido', token()],
    ])('GET /uploads/... %s non serve più il file', async (_l, tok) => {
        const req = request(app).get(QUAL_URL);
        const res = tok ? await req.set('Authorization', `Bearer ${tok}`) : await req;
        expect(res.status).toBe(404);
        expect(res.text).not.toContain('%PDF');
        expect(res.headers['content-type']).toMatch(/json/);
    });

    it('HEAD e traversal diretti su /uploads non servono file', async () => {
        const head = await request(app).head(QUAL_URL);
        expect(head.status).toBe(404);
        const trav = await request(app).get('/uploads/%2e%2e/secret.txt');
        expect(trav.status).toBe(404);
        expect(trav.text).not.toContain(SECRET_MARKER);
    });
});
