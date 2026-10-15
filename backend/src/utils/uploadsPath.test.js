'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
    parseUploadsUrl,
    resolveUploadFile,
    contentTypeFor,
    getUploadRoot,
} = require('./uploadsPath');

describe('parseUploadsUrl', () => {
    it('accetta /uploads/<rel> e normalizza', () => {
        const p = parseUploadsUrl('/uploads/qualifications/qual_1_x.pdf');
        expect(p).toEqual({
            rel: 'qualifications/qual_1_x.pdf',
            url: '/uploads/qualifications/qual_1_x.pdf',
            segments: ['qualifications', 'qual_1_x.pdf'],
        });
    });

    it.each([
        [undefined], [null], [42], [{}], [['/uploads/a.pdf']], [''],
        ['uploads/a.pdf'], ['/upload/a.pdf'], ['/Uploads/a.pdf'], ['/uploads'], ['/uploads/'],
        ['/uploads/../a.pdf'], ['/uploads/a/../b.pdf'], ['/uploads/a/./b.pdf'], ['/uploads//a.pdf'],
        ['/uploads/a/'], ['/uploads/%2e%2e/a.pdf'], ['/uploads/%2E%2E/a.pdf'], ['/uploads/%252e%252e/a.pdf'],
        ['/uploads/a%2fb.pdf'], ['/uploads/a\\b.pdf'], ['/uploads/a\u0000.pdf'], ['/uploads/a\n.pdf'],
        ['/uploads/.env'], ['/uploads/a/.hidden'], ['/uploads/C:/x.pdf'], ['/uploads/c:x.pdf'],
        ['/etc/passwd'], ['https://x.test/uploads/a.pdf'], ['/uploads/' + 'a'.repeat(1100)],
    ])('rifiuta %j', (value) => {
        expect(parseUploadsUrl(value)).toBeNull();
    });
});

describe('resolveUploadFile', () => {
    let sandbox;
    let root;
    const prevUploadDir = process.env.UPLOAD_DIR;

    beforeAll(() => {
        sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sgq-uploadspath-'));
        root = path.join(sandbox, 'uploads');
        fs.mkdirSync(path.join(root, 'qualifications'), { recursive: true });
        fs.writeFileSync(path.join(root, 'qualifications', 'ok.pdf'), 'x');
        fs.writeFileSync(path.join(sandbox, 'fuori.txt'), 'segreto');
        fs.symlinkSync(path.join(sandbox, 'fuori.txt'), path.join(root, 'qualifications', 'link.pdf'));
        fs.symlinkSync(sandbox, path.join(root, 'dirlink'));
        process.env.UPLOAD_DIR = root;
    });

    afterAll(() => {
        if (prevUploadDir === undefined) delete process.env.UPLOAD_DIR;
        else process.env.UPLOAD_DIR = prevUploadDir;
        fs.rmSync(sandbox, { recursive: true, force: true });
    });

    it('risolve un file regolare dentro la root', async () => {
        const f = await resolveUploadFile('qualifications/ok.pdf');
        expect(f.relReal).toBe(path.join('qualifications', 'ok.pdf'));
        expect(f.realFile.startsWith(f.realRoot)).toBe(true);
        expect(f.size).toBe(1);
    });

    it('null per file inesistente, directory, root', async () => {
        expect(await resolveUploadFile('qualifications/no.pdf')).toBeNull();
        expect(await resolveUploadFile('qualifications')).toBeNull();
        expect(await resolveUploadFile('.')).toBeNull();
    });

    it('null per traversal che sfugge al parser (difesa in profondità)', async () => {
        expect(await resolveUploadFile('../fuori.txt')).toBeNull();
        expect(await resolveUploadFile('qualifications/../../fuori.txt')).toBeNull();
        expect(await resolveUploadFile(path.join(sandbox, 'fuori.txt'))).toBeNull();
    });

    it('null per symlink a file o directory fuori dalla root', async () => {
        expect(await resolveUploadFile('qualifications/link.pdf')).toBeNull();
        expect(await resolveUploadFile('dirlink/fuori.txt')).toBeNull();
    });

    it('getUploadRoot rispetta UPLOAD_DIR', () => {
        expect(getUploadRoot()).toBe(path.resolve(root));
    });
});

describe('contentTypeFor', () => {
    it('pdf e immagini inline, il resto octet-stream da scaricare', () => {
        expect(contentTypeFor('a.PDF')).toMatchObject({ type: 'application/pdf', inline: true, ext: '.pdf' });
        expect(contentTypeFor('a.jpg')).toMatchObject({ type: 'image/jpeg', inline: true });
        expect(contentTypeFor('a.png')).toMatchObject({ type: 'image/png', inline: true });
        expect(contentTypeFor('a.html')).toMatchObject({ type: 'application/octet-stream', inline: false });
        expect(contentTypeFor('a.svg')).toMatchObject({ type: 'application/octet-stream', inline: false });
        expect(contentTypeFor('noext')).toMatchObject({ type: 'application/octet-stream', inline: false });
    });
});
