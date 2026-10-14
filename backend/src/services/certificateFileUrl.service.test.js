/**
 * @jest-environment node
 *
 * Validazione di certificate_file_url (A2): solo /uploads/qualifications/<file> e
 * /uploads/imports/<org>/<job>/<file> della propria organizzazione, file reale dentro la root uploads,
 * nessun file rivendicato da altre organizzazioni.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

const fs = require('fs');
const os = require('os');
const path = require('path');
const { query } = require('../config/database');
const {
    validateCertificateFileUrl,
    expectedQualificationUrl,
    CERTIFICATE_FILE_URL_ERROR,
} = require('./certificateFileUrl.service');

const ORG = 1002;
let root;
let outside;
const prevUploadDir = process.env.UPLOAD_DIR;

beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-a2-uploads-'));
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-a2-outside-'));
    process.env.UPLOAD_DIR = root;
    fs.mkdirSync(path.join(root, 'qualifications'), { recursive: true });
    fs.mkdirSync(path.join(root, 'imports', String(ORG), '55'), { recursive: true });
    fs.mkdirSync(path.join(root, 'imports', '9999', '7'), { recursive: true });
    fs.mkdirSync(path.join(root, 'docs', String(ORG)), { recursive: true });
    fs.writeFileSync(path.join(root, 'qualifications', 'qual_1_cert.pdf'), '%PDF');
    fs.writeFileSync(path.join(root, 'imports', String(ORG), '55', 'cert.pdf'), '%PDF');
    fs.writeFileSync(path.join(root, 'imports', '9999', '7', 'altrui.pdf'), '%PDF');
    fs.writeFileSync(path.join(root, 'docs', String(ORG), 'doc.pdf'), '%PDF');
    fs.writeFileSync(path.join(outside, 'secret.pdf'), '%PDF');
    try {
        fs.symlinkSync(path.join(outside, 'secret.pdf'), path.join(root, 'qualifications', 'qual_2_link.pdf'));
        fs.symlinkSync(outside, path.join(root, 'qualifications', 'linkdir'));
    } catch { /* symlink non disponibili: i test relativi si auto-saltano */ }
});

afterAll(() => {
    if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = prevUploadDir;
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
});

beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ recordset: [] });
});

describe('validateCertificateFileUrl — valori consentiti', () => {
    it.each([[null], [undefined], [''], ['   ']])('%j = rimozione certificato (value null)', async (raw) => {
        await expect(validateCertificateFileUrl(raw, { organizationId: ORG })).resolves.toEqual({ ok: true, value: null });
        expect(query).not.toHaveBeenCalled();
    });

    it('file della cartella qualifications esistente e non rivendicato da altre org', async () => {
        const out = await validateCertificateFileUrl('/uploads/qualifications/qual_1_cert.pdf', { organizationId: ORG });
        expect(out).toEqual({ ok: true, value: '/uploads/qualifications/qual_1_cert.pdf' });
        expect(query).toHaveBeenCalledTimes(1);
        expect(query.mock.calls[0][1]).toEqual({ organizationId: ORG, url: '/uploads/qualifications/qual_1_cert.pdf' });
        expect(query.mock.calls[0][0]).toMatch(/organization_id <> @organizationId/);
    });

    it('file di import della PROPRIA organizzazione', async () => {
        const out = await validateCertificateFileUrl(`/uploads/imports/${ORG}/55/cert.pdf`, { organizationId: ORG });
        expect(out.ok).toBe(true);
    });
});

describe('validateCertificateFileUrl — rifiuti', () => {
    const NEGATIVES = [
        'http://evil.test/uploads/qualifications/qual_1_cert.pdf',
        'https://evil.test/x.pdf',
        'HTTPS://evil.test/x.pdf',
        '//evil.test/uploads/qualifications/qual_1_cert.pdf',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
        '/etc/passwd',
        'C:\\Windows\\win.ini',
        'uploads/qualifications/qual_1_cert.pdf',
        ' /uploads/qualifications/qual_1_cert.pdf',
        '/uploads/../etc/passwd',
        '/uploads/qualifications/../../etc/passwd',
        '/uploads/qualifications/..',
        '/uploads/qualifications/%2e%2e/secret.pdf',
        '/uploads/qualifications/%2E%2E%2Fsecret.pdf',
        '/uploads/qualifications/%252e%252e/secret.pdf',
        '/uploads/qualifications/qual_1_cert.pdf%00.png',
        '/uploads/qualifications\\..\\secret.pdf',
        '/uploads/qualifications/qual_1_cert.pdf\0',
        '/uploads/qualifications/qual_1_cert.pdf\n',
        '/uploads/qualifications/.hidden.pdf',
        '/uploads/qualifications//qual_1_cert.pdf',
        '/uploads/qualifications/',
        '/uploads/',
        '/uploads',
        '/uploads/qualifications/sub/qual_1_cert.pdf',
        '/uploads/qualifications/qual_inesistente.pdf',
        '/uploads/wpqr/qual_1_cert.pdf',
        `/uploads/docs/${ORG}/doc.pdf`,
        `/uploads/imports/${ORG}/55/../../../qualifications/qual_1_cert.pdf`,
        `/uploads/imports/${ORG}/abc/cert.pdf`,
        `/uploads/imports/${ORG}/cert.pdf`,
        `/uploads/imports/${ORG}/55/inesistente.pdf`,
        `/uploads/qualifications/${'a'.repeat(1100)}.pdf`,
        123,
        true,
        {},
        ['/uploads/qualifications/qual_1_cert.pdf'],
        { toString: () => '/uploads/qualifications/qual_1_cert.pdf' },
    ];

    it.each(NEGATIVES.map((v) => [typeof v === 'string' ? v.slice(0, 60) : JSON.stringify(v) || typeof v, v]))(
        'rifiuta %s',
        async (_label, raw) => {
            await expect(validateCertificateFileUrl(raw, { organizationId: ORG })).resolves.toEqual({ ok: false });
        },
    );

    it('cross-tenant: cartella imports di un\'altra organizzazione', async () => {
        await expect(validateCertificateFileUrl('/uploads/imports/9999/7/altrui.pdf', { organizationId: ORG }))
            .resolves.toEqual({ ok: false });
        await expect(validateCertificateFileUrl(`/uploads/imports/${ORG}/55/cert.pdf`, { organizationId: 9999 }))
            .resolves.toEqual({ ok: false });
    });

    it('cross-tenant: file piatto gia\' rivendicato da un record di un\'altra organizzazione', async () => {
        query.mockResolvedValue({ recordset: [{ hit: 1 }] });
        await expect(validateCertificateFileUrl('/uploads/qualifications/qual_1_cert.pdf', { organizationId: ORG }))
            .resolves.toEqual({ ok: false });
    });

    it('symlink che esce dalla root: file e cartella', async () => {
        if (!fs.existsSync(path.join(root, 'qualifications', 'qual_2_link.pdf'))) return;
        await expect(validateCertificateFileUrl('/uploads/qualifications/qual_2_link.pdf', { organizationId: ORG }))
            .resolves.toEqual({ ok: false });
        await expect(validateCertificateFileUrl('/uploads/qualifications/linkdir', { organizationId: ORG }))
            .resolves.toEqual({ ok: false });
    });

    it('il risultato di rifiuto non contiene il percorso e il messaggio 400 e in italiano senza echo', async () => {
        const secretPath = '/uploads/qualifications/../../etc/passwd';
        const out = await validateCertificateFileUrl(secretPath, { organizationId: ORG });
        expect(JSON.stringify(out)).not.toContain('passwd');
        expect(CERTIFICATE_FILE_URL_ERROR.status).toBe(400);
        expect(CERTIFICATE_FILE_URL_ERROR.body.code).toBe('VALIDATION_ERROR');
        expect(CERTIFICATE_FILE_URL_ERROR.body.error).toMatch(/certificato/);
        expect(CERTIFICATE_FILE_URL_ERROR.body.error).not.toMatch(/uploads|\//);
    });
});

describe('expectedQualificationUrl (sola forma, senza I/O)', () => {
    it('accetta le due forme generate dall\'app e normalizza', () => {
        expect(expectedQualificationUrl('/uploads/qualifications/qual_9_x.pdf', ORG)).toBe('/uploads/qualifications/qual_9_x.pdf');
        expect(expectedQualificationUrl(`/uploads/imports/${ORG}/3/9_x.pdf`, ORG)).toBe(`/uploads/imports/${ORG}/3/9_x.pdf`);
    });

    it('rifiuta null, altre cartelle, altra org e path relativi risalenti (UPLOAD_DIR incoerente)', () => {
        expect(expectedQualificationUrl(null, ORG)).toBeNull();
        expect(expectedQualificationUrl('/uploads/wps/x.pdf', ORG)).toBeNull();
        expect(expectedQualificationUrl('/uploads/imports/1/3/x.pdf', ORG)).toBeNull();
        expect(expectedQualificationUrl('/uploads/../../tmp/x.pdf', ORG)).toBeNull();
        expect(expectedQualificationUrl(`/uploads/imports/${ORG}/3/x.pdf`, undefined)).toBeNull();
    });
});
