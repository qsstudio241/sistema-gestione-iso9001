'use strict';

const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.resolve(__dirname, '..');
const SRC_DIR = path.join(BACKEND_DIR, 'src');
const MANIFEST = path.join(__dirname, 'deploy-manifest.json');

function listSourceJs(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) return listSourceJs(p);
        return e.name.endsWith('.js') && !e.name.endsWith('.test.js') ? [p] : [];
    });
}

function collectJsonRequires() {
    const re = /require\(\s*['"`]([^'"`]+\.json)['"`]\s*\)/g;
    const found = [];
    for (const file of listSourceJs(SRC_DIR)) {
        const src = fs.readFileSync(file, 'utf8');
        for (const m of src.matchAll(re)) {
            if (!m[1].startsWith('.')) continue;
            const target = path.resolve(path.dirname(file), m[1]);
            found.push({
                from: path.relative(BACKEND_DIR, file).split(path.sep).join('/'),
                json: path.relative(BACKEND_DIR, target).split(path.sep).join('/'),
            });
        }
    }
    return found;
}

describe('deploy-manifest ⇄ require() di JSON in backend/src', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    const manifestFiles = new Set(manifest.groups.flatMap((g) => g.files));
    const requires = collectJsonRequires();

    test('la scansione trova almeno il seed legislazione', () => {
        expect(requires.map((r) => r.json)).toContain('data/legislation_seed.json');
    });

    test.each(requires.map((r) => [`${r.from} -> ${r.json}`, r.json]))(
        '%s è nel deploy-manifest',
        (_label, json) => {
            expect(manifestFiles.has(json)).toBe(true);
        },
    );

    test('ogni JSON del manifest esiste nel repo', () => {
        const missing = [...manifestFiles]
            .filter((f) => f.endsWith('.json'))
            .filter((f) => !fs.existsSync(path.join(BACKEND_DIR, f)));
        expect(missing).toEqual([]);
    });
});
