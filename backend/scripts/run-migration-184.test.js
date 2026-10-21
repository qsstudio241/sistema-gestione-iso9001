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
    RANGE_COLUMNS,
} = require('./run-migration-184-vps');

describe('run-migration-184', () => {
    it('rifiuta prod e un target assente', () => {
        expect(() => resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' })).toThrow(/test/);
        expect(() => resolveTarget({})).toThrow(/test/);
    });

    it('accetta solo il database TEST', () => {
        const cfg = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' });
        expect(cfg.expectedDb).toBe(TEST_DB);
        expect(cfg.expectedDb).toBe('2026-06-18_SGQ_ISO9001');
        expect(cfg.checkOnly).toBe(true);
        expect(cfg.backendRoot).toContain('sgq-backend-test');
        expect(cfg.envFile).not.toMatch(/sgq-backend\/\.env$/);
    });

    it('lo SQL è additivo, senza USE, UPDATE, DELETE', () => {
        const text = fs.readFileSync(
            path.join(__dirname, '../../database/migrations', SQL_FILE),
            'utf8'
        );
        const batches = splitGoBatches(text);
        expect(batchesWithUse(batches)).toEqual([]);
        expect(text).not.toMatch(/\b(UPDATE|DELETE|INSERT|MERGE)\b/i);
        for (const col of RANGE_COLUMNS) {
            expect(text).toContain(col);
        }
    });
});
