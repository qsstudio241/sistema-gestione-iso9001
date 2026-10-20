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
        expect(dry.regenerateDrafts).toBe(false);

        const apply = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', APPLY: '1' });
        expect(apply.dryRun).toBe(false);
        expect(apply.regenerateDrafts).toBe(false);
    });

    it('REGENERATE_DRAFTS=1 scrive solo bozze; DRY_RUN=1 vince; skip VB0377/VB0387', () => {
        const regen = resolveTarget({ SGQ_MIGRATION_TARGET: 'test', REGENERATE_DRAFTS: '1' });
        expect(regen.dryRun).toBe(false);
        expect(regen.regenerateDrafts).toBe(true);
        expect(regen.skipCodes).toEqual(['VB0377', 'VB0387']);

        const dryRegen = resolveTarget({
            SGQ_MIGRATION_TARGET: 'test',
            REGENERATE_DRAFTS: '1',
            DRY_RUN: '1',
        });
        expect(dryRegen.dryRun).toBe(true);
        expect(dryRegen.regenerateDrafts).toBe(true);

        const custom = resolveTarget({
            SGQ_MIGRATION_TARGET: 'test',
            REGENERATE_DRAFTS: '1',
            SKIP_CODES: 'FOO',
            SKIP_WPQR_IDS: '38,39',
        });
        expect(custom.skipCodes).toEqual(['FOO']);
        expect(custom.skipWpqrIds).toEqual(['38', '39']);
    });
});
