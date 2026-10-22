'use strict';

/**
 * La WPQR non è figlia di una WPS: il codice attivo non legge wpqr_records.wps_id.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');

function sourceFiles(dir, acc = []) {
    for (const name of fs.readdirSync(dir)) {
        if (name === 'node_modules' || name === 'coverage') continue;
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            sourceFiles(full, acc);
            continue;
        }
        if (!/\.(js|jsx)$/.test(name) || /\.test\./.test(name)) continue;
        acc.push(full);
    }
    return acc;
}

describe('nessun uso attivo di wpqr.wps_id', () => {
    const forbidden = [
        /wq\.wps_id/,
        /wpqr_records\.wps_id/,
        /ON w\.id = wq\.wps_id/,
        /FROM wpqr_records[^;]{0,200}WHERE wps_id = @id/,
    ];

    it('backend/src e app/src non leggono la colonna', () => {
        const roots = [
            path.join(ROOT, 'backend', 'src'),
            path.join(ROOT, 'app', 'src'),
        ];
        const hits = [];
        for (const root of roots) {
            for (const file of sourceFiles(root)) {
                const text = fs.readFileSync(file, 'utf8');
                for (const re of forbidden) {
                    if (re.test(text)) hits.push(`${path.relative(ROOT, file)} :: ${re}`);
                }
            }
        }
        expect(hits).toEqual([]);
    });

    it('il form WPQR non ha un select di WPS', () => {
        const page = fs.readFileSync(path.join(ROOT, 'app', 'src', 'pages', 'WeldingProceduresPage.jsx'), 'utf8');
        expect(page).toContain('pWPS di riferimento');
        expect(page).not.toContain('WPS di riferimento *');
        expect(page).not.toContain('WPS collegata');
        expect(page).not.toContain('WPS di riferimento (testo)');
        expect(page).not.toContain('form.wps_id');
    });
});
