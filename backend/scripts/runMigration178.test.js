/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const mod = require('./run-migration-178-vps');

const TEST_DB = '2026-06-18_SGQ_ISO9001';
const PROD_DB = 'SGQ_ISO9001';

describe('run-migration-178-vps — target e nome database', () => {
    it('rifiuta un target assente o diverso da test/prod, senza default', () => {
        expect(() => mod.resolveTarget({})).toThrow(/SGQ_MIGRATION_TARGET/);
        expect(() => mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'staging' })).toThrow(/SGQ_MIGRATION_TARGET/);
    });

    it('test legge .env.test e riconosce CHECK_ONLY', () => {
        const cfg = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' });
        expect(cfg.target).toBe('test');
        expect(cfg.backendRoot).toBe('/var/www/sgq-backend-test');
        expect(cfg.envFile).toBe('/var/www/sgq-backend-test/.env.test');
        expect(cfg.checkOnly).toBe(true);
    });

    it('abortisce se il database connesso non è quello del target', () => {
        expect(() => mod.assertDbMatchesTarget('test', PROD_DB)).toThrow(/Mismatch/);
        expect(() => mod.assertDbMatchesTarget('prod', TEST_DB)).toThrow(/Mismatch/);
        expect(() => mod.assertDbMatchesTarget('test', TEST_DB)).not.toThrow();
        expect(() => mod.assertDbMatchesTarget('prod', PROD_DB)).not.toThrow();
    });

    it('lo SQL non contiene USE e ha almeno due batch', () => {
        const sqlPath = path.join(__dirname, '../../database/migrations/178_qualifications_vision_clocks.sql');
        const text = fs.readFileSync(sqlPath, 'utf8');
        const batches = mod.splitGoBatches(text);
        expect(batches.length).toBeGreaterThanOrEqual(2);
        expect(mod.batchesWithUse(batches)).toHaveLength(0);
        expect(text).toMatch(/near_vision_expiry_date/);
        expect(text).toMatch(/colour_vision_expiry_date/);
        expect(text).not.toMatch(/UPDATE\s+dbo\.qualifications/i);
    });
});
