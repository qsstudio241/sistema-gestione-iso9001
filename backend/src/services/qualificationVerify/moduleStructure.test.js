'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_DIR = __dirname;
const BACKEND_DIR = path.resolve(MODULE_DIR, '..', '..', '..');
const MANIFEST = path.join(BACKEND_DIR, 'scripts', 'deploy-manifest.json');

function listJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return listJs(p);
        return e.name.endsWith('.js') ? [p] : [];
    });
}

/** Unico file del modulo che legge dal DB (sola SELECT): verifica dedicata in verifyReadOnly.test.js. */
const DB_READER = 'verifyRecordLoader.js';

const allJs = listJs(MODULE_DIR);
const sourceFiles = allJs.filter((f) => !f.endsWith('.test.js'));
const rel = (f) => path.relative(BACKEND_DIR, f).split(path.sep).join('/');

describe('modulo qualificationVerify — puro', () => {
    test.each(sourceFiles.map((f) => [rel(f), f]))('%s: nessun import DB/fs/ingest né scrittura', (_name, file) => {
        const src = fs.readFileSync(file, 'utf8');
        if (path.basename(file) !== DB_READER) {
            expect(src).not.toMatch(/require\(\s*['"][^'"]*config\/database['"]\s*\)/);
        }
        expect(src).not.toMatch(/require\(\s*['"](?:node:)?(?:fs|fs\/promises|child_process)['"]\s*\)/);
        expect(src).not.toMatch(/createStagingRecord/);
        expect(src).not.toMatch(/qualificationIngest\.service/);
        expect(src).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|MERGE\s+INTO)\b/i);
    });

    test('index espone solo funzioni di lettura', () => {
        expect(Object.keys(require('./index')).sort()).toEqual(['listRulePacks', 'validateFinding', 'verifyQualification', 'verifyWpqr']);
    });
});

describe('pack ⇄ registerDefaultPacks ⇄ deploy-manifest', () => {
    const packFiles = allJs.filter((f) => f.endsWith('.pack.js'));
    const registerSrc = fs.readFileSync(path.join(MODULE_DIR, 'registerDefaultPacks.js'), 'utf8');
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const manifestFiles = new Set(manifest.groups.flatMap((g) => g.files));

    test('esistono gli otto pack previsti (quattro qualifiche, quattro WPQR)', () => {
        expect(packFiles.map((f) => path.basename(f)).sort()).toEqual([
            'operator14732.pack.js',
            'welder9606Completeness.pack.js',
            'welder9606Correctness.pack.js',
            'welder9606Part2.pack.js',
            'wpqr14555Correctness.pack.js',
            'wpqr15614_1Correctness.pack.js',
            'wpqr15614_2Correctness.pack.js',
            'wpqrCompleteness.pack.js',
        ]);
    });

    test.each(packFiles.map((f) => [path.basename(f), f]))('%s è elencato in registerDefaultPacks.js e nel manifest', (name, file) => {
        expect(registerSrc).toContain(`require('./packs/${name.replace(/\.js$/, '')}')`);
        expect(manifestFiles.has(rel(file))).toBe(true);
    });

    test.each(sourceFiles.map((f) => [rel(f), f]))('%s è nel deploy-manifest', (name) => {
        expect(manifestFiles.has(name)).toBe(true);
    });

    test('la directory del modulo è in ensureRemoteDirs', () => {
        expect(manifest.ensureRemoteDirs).toEqual(expect.arrayContaining([
            'src/services/qualificationVerify',
            'src/services/qualificationVerify/packs',
        ]));
    });
});
