/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const {
    resolveTarget,
    splitGoBatches,
    batchesWithUse,
    SQL_FILE,
    TEST_DB,
} = require('./run-migration-179-vps');

describe('run-migration-179', () => {
    it('rifiuta prod e un target assente', () => {
        expect(() => resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' })).toThrow(/test/);
        expect(() => resolveTarget({})).toThrow(/test/);
    });

    it('accetta solo il database TEST', () => {
        const cfg = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' });
        expect(cfg.target).toBe('test');
        expect(cfg.expectedDb).toBe(TEST_DB);
        expect(cfg.expectedDb).toBe('2026-06-18_SGQ_ISO9001');
        expect(cfg.checkOnly).toBe(true);
        expect(cfg.backendRoot).toContain('sgq-backend-test');
        expect(cfg.envFile).not.toMatch(/sgq-backend\/\.env$/);
    });

    it('lo SQL è additivo, senza USE, senza UPDATE e senza FK', () => {
        const text = fs.readFileSync(
            path.join(__dirname, '../../database/migrations', SQL_FILE),
            'utf8'
        );
        const batches = splitGoBatches(text);
        expect(batches.length).toBeGreaterThanOrEqual(2);
        expect(batchesWithUse(batches)).toEqual([]);
        expect(text).toMatch(/inspector_qualification_id/);
        expect(text).toMatch(/INT NULL/);
        expect(text).not.toMatch(/\bUPDATE\b/i);
        expect(text).not.toMatch(/\bDELETE\b/i);
        expect(text).not.toMatch(/FOREIGN KEY/i);
        expect(text).not.toMatch(/REFERENCES/i);
        expect(text).toMatch(/TYPE: additive/);
    });
});
