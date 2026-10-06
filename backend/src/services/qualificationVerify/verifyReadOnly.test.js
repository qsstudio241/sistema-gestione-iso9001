/**
 * Test strutturale «sola lettura» dei moduli DB della verifica (VQ-8, piano § 2.2 punto 3):
 * né il loader né il servizio di Rielaborazioni possono scrivere sul DB, leggere file,
 * creare proposte in coda di revisione o importare whitelist di scrittura.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_DIR = __dirname;
const READ_ONLY_MODULES = ['verifyRecordLoader.js', 'verifyReprocess.service.js'];

const WRITE_STATEMENT = /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|EXEC|EXECUTE)\b/i;

const FORBIDDEN_REFERENCES = [
    /require\(\s*['"](?:node:)?(?:fs|fs\/promises|child_process)['"]\s*\)/,
    /createStagingRecord/,
    /ingestStaging/,
    /ingest_staging/,
    /qualificationIngest\.service/,
    /wpqrIngest\.service/,
    /documentIngestPipeline/,
    /runDocumentIngest/,
    /REPROCESSABLE_FIELDS/,
    /WPQR_REPROCESSABLE_FIELDS/,
    /WRITE_WHITELISTS/,
    /qualificationReprocess\.service/,
    /reprocessTableAdapters/,
    /certificate_file_url/,
    /\.execute\(/,
    /\bexecute\(/,
    /\bgetPool\b/,
];

const read = (name) => fs.readFileSync(path.join(MODULE_DIR, name), 'utf8');

describe.each(READ_ONLY_MODULES)('%s — sola lettura', (name) => {
    const src = read(name);

    test('nessuno statement di scrittura (INSERT/UPDATE/DELETE/MERGE e simili)', () => {
        expect(src).not.toMatch(WRITE_STATEMENT);
    });

    test('nessun riferimento a file, AI, coda di revisione o whitelist di scrittura', () => {
        for (const pattern of FORBIDDEN_REFERENCES) expect(src).not.toMatch(pattern);
    });

    test('ogni chiamata query(...) apre con una SELECT', () => {
        const calls = [...src.matchAll(/\bquery\(\s*(["'`])\s*(\w+)/g)];
        for (const [, , firstWord] of calls) expect(firstWord.toUpperCase()).toBe('SELECT');
    });
});

describe('perimetro DB del modulo', () => {
    test('solo il loader importa config/database; il servizio passa dal loader', () => {
        const importsDb = fs.readdirSync(MODULE_DIR, { withFileTypes: true })
            .filter((e) => e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.test.js'))
            .filter((e) => /require\(\s*['"][^'"]*config\/database['"]\s*\)/.test(read(e.name)))
            .map((e) => e.name);
        expect(importsDb).toEqual(['verifyRecordLoader.js']);
    });

    test('il servizio di verifica non esporta funzioni di scrittura', () => {
        jest.isolateModules(() => {
            jest.doMock('../../config/database', () => ({ query: jest.fn() }));
            const exported = Object.keys(require('./verifyReprocess.service'));
            expect(exported.filter((k) => /write|save|update|insert|delete|persist|commit/i.test(k))).toEqual([]);
            const loaderExports = Object.keys(require('./verifyRecordLoader'));
            expect(loaderExports.filter((k) => /write|save|update|insert|delete|persist|commit/i.test(k))).toEqual([]);
        });
    });
});
