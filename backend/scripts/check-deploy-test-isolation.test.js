'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

describe('isolamento deploy TEST', () => {
    it('rifiuta fallback che può toccare PROD (porta 3000 / sgq-backend)', () => {
        const script = path.join(__dirname, 'check-deploy-test-isolation.js');
        const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toMatch(/OK isolamento deploy TEST/);
    });
});
