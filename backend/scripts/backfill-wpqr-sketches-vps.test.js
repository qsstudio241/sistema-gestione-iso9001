/**
 * @jest-environment node
 */
const { resolveTarget, TEST_DB, TEST_BACKEND_ROOT } = require('./backfill-wpqr-sketches-vps');

describe('backfill-wpqr-sketches-vps', () => {
    it('rifiuta prod e un target assente', () => {
        expect(() => resolveTarget({ SGQ_MIGRATION_TARGET: 'prod' })).toThrow(/test/);
        expect(() => resolveTarget({})).toThrow(/test/);
        expect(() => resolveTarget({ SGQ_MIGRATION_TARGET: 'TEST' })).toThrow(/test/);
    });

    it('accetta solo TEST; default dry-run; APPLY=1 scrive', () => {
        const dry = resolveTarget({ SGQ_MIGRATION_TARGET: 'test' });
        expect(dry.target).toBe('test');
        expect(dry.expectedDb).toBe(TEST_DB);
        expect(dry.expectedDb).toBe('2026-06-18_SGQ_ISO9001');
        expect(dry.backendRoot).toBe(TEST_BACKEND_ROOT);
        expect(dry.envFile).toBe('/var/www/sgq-backend-test/.env.test');
        expect(dry.dryRun).toBe(true);

        const apply = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', APPLY: '1' });
        expect(apply.dryRun).toBe(false);
    });
});
