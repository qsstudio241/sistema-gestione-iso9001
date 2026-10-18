/**
 * @jest-environment node
 *
 * L1 — runner VPS 175 e 176: target obbligatorio, niente USE nei batch, oggetti attesi
 * presenti nel SQL. Nessuna connessione e nessun apply.
 */
const fs = require('fs');
const path = require('path');

const MIGRATIONS = path.resolve(__dirname, '../../database/migrations');

const runners = [175, 176].map((n) => ({
    n,
    mod: require(`./run-migration-${n}-vps.js`),
}));

describe('runner VPS 175 e 176', () => {
    it.each(runners)('migrazione $n: target obbligatorio, SQL senza USE, oggetti attesi nel file', ({ mod }) => {
        expect(() => mod.resolveTarget({})).toThrow(/SGQ_MIGRATION_TARGET/);
        const cfg = mod.resolveTarget({ SGQ_MIGRATION_TARGET: 'test', CHECK_ONLY: '1' });
        expect(cfg.target).toBe('test');
        expect(cfg.checkOnly).toBe(true);
        expect(mod.assertDbMatchesTarget('test', '2026-06-18_SGQ_ISO9001')).toBeUndefined();
        expect(() => mod.assertDbMatchesTarget('prod', '2026-06-18_SGQ_ISO9001')).toThrow(/Mismatch/);

        const sql = fs.readFileSync(path.join(MIGRATIONS, mod.SQL_FILE), 'utf8');
        const batches = mod.splitGoBatches(sql);
        expect(batches.length).toBeGreaterThanOrEqual(2);
        expect(mod.batchesWithUse(batches)).toEqual([]);
        for (const [table, spec] of Object.entries(mod.EXPECTED)) {
            expect(sql).toContain(table);
            spec.indexes.forEach((name) => expect(sql).toContain(name));
            spec.columns.forEach((name) => expect(sql).toContain(name));
        }
    });
});
