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
    ISO_COLUMNS,
} = require('./run-migration-181-vps');

describe('run-migration-181', () => {
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

    it('lo SQL è additivo, senza USE, UPDATE, DELETE, CASCADE', () => {
        const text = fs.readFileSync(
            path.join(__dirname, '../../database/migrations', SQL_FILE),
            'utf8'
        );
        const batches = splitGoBatches(text);
        expect(batches.length).toBeGreaterThanOrEqual(7);
        expect(batchesWithUse(batches)).toEqual([]);
        ISO_COLUMNS.forEach((col) => expect(text).toMatch(new RegExp(col)));
        const ddl = batches.map((b) => b.replace(/--[^\n]*/g, '')).join('\n');
        expect(ddl).not.toMatch(/\bUPDATE\b/i);
        expect(ddl).not.toMatch(/\bDELETE\s+FROM\b/i);
        expect(ddl).not.toMatch(/ON DELETE/i);
        expect(text).toMatch(/TYPE: additive/);
        expect(text).toMatch(/COL_LENGTH/);
    });
});
