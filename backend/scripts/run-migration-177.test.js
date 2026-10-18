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
} = require('./run-migration-177-vps');

describe('run-migration-177', () => {
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

    it('lo SQL è additivo, senza USE e senza UPDATE', () => {
        const text = fs.readFileSync(
            path.join(__dirname, '../../database/migrations', SQL_FILE),
            'utf8'
        );
        const batches = splitGoBatches(text);
        expect(batches.length).toBeGreaterThanOrEqual(3);
        expect(batchesWithUse(batches)).toEqual([]);
        expect(text).toMatch(/inspection_phase/);
        expect(text).toMatch(/before/);
        expect(text).toMatch(/during/);
        expect(text).toMatch(/after/);
        expect(text).not.toMatch(/\bUPDATE\b/i);
        expect(text).not.toMatch(/\bDELETE\b/i);
        expect(text).toMatch(/TYPE: additive/);
    });
});
